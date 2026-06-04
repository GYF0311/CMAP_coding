import path from "node:path";
import {
  SOURCE_FILE_EXTENSIONS,
  type SourceEdge,
  type SourceIndex,
  type SourceSymbol,
  type SourceUnresolvedRef
} from "./schema.js";

type ImportBinding = {
  localName: string;
  importedName: string;
  importKind: string;
  targetFileId: string;
  targetFilePath: string;
};

export function resolveSourceIndex(index: SourceIndex): SourceIndex {
  const fileIds = new Set(index.files.map((file) => `file:${file.path}`));
  const symbolsByFileAndName = buildSymbolsByFileAndName(index.symbols);
  const localSymbolsById = new Map(index.symbols.map((symbol) => [symbol.id, symbol]));
  const unresolvedRefs = new Map(index.unresolvedRefs.map((ref) => [ref.id, ref]));

  const moduleResolvedEdges = index.edges.map((edge) => {
    if ((edge.kind === "IMPORTS_FROM" || edge.kind === "EXPORTS") && detailString(edge, "moduleSpecifier")) {
      return resolveModuleEdge(edge, fileIds, unresolvedRefs);
    }
    if (edge.kind === "EXPORTS" && detailString(edge, "localName")) {
      return resolveLocalExportEdge(edge, symbolsByFileAndName, unresolvedRefs);
    }
    return edge;
  });

  const importBindings = collectImportBindings(moduleResolvedEdges);
  const resolvedEdges = moduleResolvedEdges.map((edge) => {
    if (edge.kind !== "CALLS" || edge.targetId) {
      return edge;
    }
    return resolveCallEdge(edge, symbolsByFileAndName, localSymbolsById, importBindings, unresolvedRefs);
  });

  return {
    ...index,
    edges: resolvedEdges,
    unresolvedRefs: [...unresolvedRefs.values()].sort((left, right) =>
      left.filePath.localeCompare(right.filePath) || left.location.line - right.location.line || left.target.localeCompare(right.target)
    )
  };
}

function resolveModuleEdge(
  edge: SourceEdge,
  fileIds: Set<string>,
  unresolvedRefs: Map<string, SourceUnresolvedRef>
): SourceEdge {
  const specifier = detailString(edge, "moduleSpecifier");
  if (!specifier) {
    return edge;
  }
  const resolvedFile = resolveModuleSpecifier(edge.filePath, specifier, fileIds);
  if (!resolvedFile) {
    addUnresolved(unresolvedRefs, edge, specifier, specifier.startsWith(".") ? "missing-local-file" : "external-module");
    return {
      ...edge,
      unresolvedTarget: specifier,
      confidenceTier: "unresolved",
      confidence: specifier.startsWith(".") ? 0.25 : 0.2
    };
  }
  return {
    ...edge,
    targetId: `file:${resolvedFile}`,
    unresolvedTarget: undefined,
    confidenceTier: "resolved-local",
    confidence: 0.92,
    provenance: `${edge.provenance}; resolver.relative-module`
  };
}

function resolveLocalExportEdge(
  edge: SourceEdge,
  symbolsByFileAndName: Map<string, Map<string, SourceSymbol[]>>,
  unresolvedRefs: Map<string, SourceUnresolvedRef>
): SourceEdge {
  const localName = detailString(edge, "localName");
  if (!localName) {
    return edge;
  }
  const target = uniqueSymbol(symbolsByFileAndName.get(edge.filePath)?.get(localName) ?? []);
  if (!target) {
    addUnresolved(unresolvedRefs, edge, localName, "missing-symbol");
    return {
      ...edge,
      unresolvedTarget: localName,
      confidenceTier: "unresolved",
      confidence: 0.3
    };
  }
  return {
    ...edge,
    targetId: target.id,
    unresolvedTarget: undefined,
    confidenceTier: "resolved-local",
    confidence: 0.95,
    provenance: `${edge.provenance}; resolver.local-export`
  };
}

function resolveCallEdge(
  edge: SourceEdge,
  symbolsByFileAndName: Map<string, Map<string, SourceSymbol[]>>,
  symbolsById: Map<string, SourceSymbol>,
  importBindings: Map<string, ImportBinding[]>,
  unresolvedRefs: Map<string, SourceUnresolvedRef>
): SourceEdge {
  const targetName = detailString(edge, "targetName");
  const targetText = detailString(edge, "targetText") ?? targetName;
  if (!targetName) {
    addUnresolved(unresolvedRefs, edge, targetText ?? "unknown-call", "unsupported-syntax");
    return withUnresolvedCall(edge, targetText ?? "unknown-call", 0.2);
  }

  const sameFileMatch = uniqueSymbol((symbolsByFileAndName.get(edge.filePath)?.get(targetName) ?? [])
    .filter((symbol) => symbol.id !== edge.sourceId));
  if (sameFileMatch) {
    return {
      ...edge,
      targetId: sameFileMatch.id,
      unresolvedTarget: undefined,
      confidenceTier: "resolved-local",
      confidence: 0.86,
      provenance: `${edge.provenance}; resolver.same-file-call`
    };
  }

  const imported = resolveImportedCall(edge, targetName, targetText, symbolsByFileAndName, importBindings);
  if (imported) {
    return imported;
  }

  const sourceSymbol = symbolsById.get(edge.sourceId);
  const reason = sourceSymbol?.filePath === edge.filePath ? "missing-symbol" : "ambiguous-symbol";
  addUnresolved(unresolvedRefs, edge, targetText ?? targetName, reason);
  return withUnresolvedCall(edge, targetText ?? targetName, 0.35);
}

function resolveImportedCall(
  edge: SourceEdge,
  targetName: string,
  targetText: string | undefined,
  symbolsByFileAndName: Map<string, Map<string, SourceSymbol[]>>,
  importBindings: Map<string, ImportBinding[]>
): SourceEdge | undefined {
  const bindings = importBindings.get(edge.filePath) ?? [];
  const directBinding = bindings.find((binding) => binding.localName === targetName);
  if (directBinding) {
    const importedName = directBinding.importedName === "default" ? "default" : directBinding.importedName;
    const targetSymbol = uniqueSymbol(symbolsByFileAndName.get(directBinding.targetFilePath)?.get(importedName) ?? [])
      ?? uniqueSymbol((symbolsByFileAndName.get(directBinding.targetFilePath)?.get(targetName) ?? []).filter((symbol) => symbol.exported));
    return {
      ...edge,
      targetId: targetSymbol?.id ?? directBinding.targetFileId,
      unresolvedTarget: undefined,
      confidenceTier: targetSymbol ? "resolved-import" : "heuristic",
      confidence: targetSymbol ? 0.82 : 0.58,
      provenance: `${edge.provenance}; resolver.imported-call`
    };
  }

  const namespaceBinding = bindings.find((binding) => binding.importKind === "namespace" && targetText?.startsWith(`${binding.localName}.`));
  if (!namespaceBinding || !targetText) {
    return undefined;
  }
  const propertyName = targetText.slice(namespaceBinding.localName.length + 1).split(".").at(-1);
  if (!propertyName) {
    return undefined;
  }
  const targetSymbol = uniqueSymbol(symbolsByFileAndName.get(namespaceBinding.targetFilePath)?.get(propertyName) ?? []);
  return {
    ...edge,
    targetId: targetSymbol?.id ?? namespaceBinding.targetFileId,
    unresolvedTarget: undefined,
    confidenceTier: targetSymbol ? "resolved-import" : "heuristic",
    confidence: targetSymbol ? 0.76 : 0.5,
    provenance: `${edge.provenance}; resolver.namespace-call`
  };
}

function collectImportBindings(edges: SourceEdge[]): Map<string, ImportBinding[]> {
  const bindings = new Map<string, ImportBinding[]>();
  for (const edge of edges) {
    if (edge.kind !== "IMPORTS_FROM" || !edge.targetId?.startsWith("file:")) {
      continue;
    }
    const localNames = detailStringArray(edge, "localNames");
    const importedNames = detailStringArray(edge, "importedNames");
    const importKinds = detailStringArray(edge, "importKinds");
    const bucket = bindings.get(edge.filePath) ?? [];
    localNames.forEach((localName, index) => {
      bucket.push({
        localName,
        importedName: importedNames[index] ?? localName,
        importKind: importKinds[index] ?? "named",
        targetFileId: edge.targetId ?? "",
        targetFilePath: edge.targetId?.slice("file:".length) ?? ""
      });
    });
    bindings.set(edge.filePath, bucket);
  }
  return bindings;
}

function resolveModuleSpecifier(fromFile: string, specifier: string, fileIds: Set<string>): string | undefined {
  if (!specifier.startsWith(".")) {
    return undefined;
  }
  const fromDir = path.posix.dirname(fromFile);
  const base = normalizePosix(path.posix.join(fromDir, specifier));
  const candidates = candidateModulePaths(base);
  return candidates.find((candidate) => fileIds.has(`file:${candidate}`));
}

function candidateModulePaths(base: string): string[] {
  const parsed = path.posix.parse(base);
  const candidates: string[] = [];
  if (SOURCE_FILE_EXTENSIONS.includes(parsed.ext as never)) {
    candidates.push(base);
    const withoutExtension = path.posix.join(parsed.dir, parsed.name);
    for (const extension of SOURCE_FILE_EXTENSIONS) {
      candidates.push(`${withoutExtension}${extension}`);
    }
  } else {
    for (const extension of SOURCE_FILE_EXTENSIONS) {
      candidates.push(`${base}${extension}`);
    }
  }
  for (const extension of SOURCE_FILE_EXTENSIONS) {
    candidates.push(path.posix.join(base, `index${extension}`));
  }
  return [...new Set(candidates.map(normalizePosix))];
}

function buildSymbolsByFileAndName(symbols: SourceSymbol[]): Map<string, Map<string, SourceSymbol[]>> {
  const byFile = new Map<string, Map<string, SourceSymbol[]>>();
  for (const symbol of symbols) {
    if (symbol.kind === "File") {
      continue;
    }
    const fileBucket = byFile.get(symbol.filePath) ?? new Map<string, SourceSymbol[]>();
    const nameBucket = fileBucket.get(symbol.name) ?? [];
    nameBucket.push(symbol);
    fileBucket.set(symbol.name, nameBucket);
    byFile.set(symbol.filePath, fileBucket);
  }
  return byFile;
}

function uniqueSymbol(symbols: SourceSymbol[]): SourceSymbol | undefined {
  const exported = symbols.filter((symbol) => symbol.exported);
  const candidates = exported.length === 1 ? exported : symbols;
  return candidates.length === 1 ? candidates[0] : undefined;
}

function withUnresolvedCall(edge: SourceEdge, target: string, confidence: number): SourceEdge {
  return {
    ...edge,
    unresolvedTarget: target,
    confidenceTier: "unresolved",
    confidence
  };
}

function addUnresolved(
  unresolvedRefs: Map<string, SourceUnresolvedRef>,
  edge: SourceEdge,
  target: string,
  reason: SourceUnresolvedRef["reason"]
): void {
  const id = [
    "unresolved",
    edge.kind,
    edge.sourceId,
    edge.filePath,
    String(edge.line),
    target
  ].join(":");
  if (unresolvedRefs.has(id)) {
    return;
  }
  unresolvedRefs.set(id, {
    id,
    kind: edge.kind,
    sourceId: edge.sourceId,
    filePath: edge.filePath,
    location: edge.location,
    target,
    reason,
    provenance: edge.provenance,
    confidenceTier: "unresolved",
    confidence: edge.confidence,
    canonical: false
  });
}

function detailString(edge: SourceEdge, key: string): string | undefined {
  const value = edge.details?.[key];
  return typeof value === "string" ? value : undefined;
}

function detailStringArray(edge: SourceEdge, key: string): string[] {
  const value = edge.details?.[key];
  return Array.isArray(value) ? value : [];
}

function normalizePosix(inputPath: string): string {
  return path.posix.normalize(inputPath).replace(/^\.\//, "");
}
