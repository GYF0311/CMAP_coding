import path from "node:path";
import {
  loadModuleIndex,
  mapChangedFilesToModules,
  type ContextModule
} from "../core/module-index.js";

export type SourceLanguage = "typescript" | "javascript" | "unknown";
export type SourceSymbolKind = "File" | "Function" | "Class" | "Method" | "Type" | "Variable" | "Test";
export type SourceEdgeKind = "CONTAINS" | "IMPORTS_FROM" | "EXPORTS" | "CALLS" | "REFERENCES" | "TESTED_BY";
export type SourceConfidenceTier =
  | "parsed"
  | "resolved-local"
  | "resolved-import"
  | "typechecker"
  | "heuristic"
  | "unresolved";

export type SourceFreshnessStatus = "fresh" | "stale" | "missing" | "error";
export type SourceImpactConfidence = "high" | "medium" | "low";

export type SourceFileRecord = {
  path: string;
  language: SourceLanguage;
  extension?: string;
  hash: string;
  size: number;
  modifiedAt: string;
  indexedAt: string;
  gitHead?: string;
  parseErrors: string[];
  isTestFile?: boolean;
  canonical?: false;
  freshness?: SourceFreshnessStatus;
};

export type SourceSymbol = {
  id: string;
  kind: SourceSymbolKind;
  name: string;
  qualifiedName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  parentId?: string;
  signature?: string;
  canonical?: false;
};

export type SourceEdge = {
  id?: string;
  kind: SourceEdgeKind;
  sourceId: string;
  targetId?: string;
  unresolvedTarget?: string;
  filePath: string;
  line?: number;
  confidenceTier: SourceConfidenceTier;
  confidence: number;
  provenance: string;
  canonical?: false;
};

export type SourceIndexMeta = {
  version?: number;
  indexedAt?: string;
  generatedAt?: string;
  gitHead?: string;
  sourceRoot?: string;
  generated?: boolean;
  canonical?: false;
  staleFiles?: string[];
  missingFiles?: string[];
  errorFiles?: Array<string | { path: string; error?: string }>;
  errors?: string[];
  truncated?: boolean;
};

export type SourceIndexLike = {
  version?: number;
  generated?: boolean;
  canonical?: false;
  meta?: SourceIndexMeta;
  files?: SourceFileRecord[] | Record<string, SourceFileRecord>;
  symbols?: SourceSymbol[] | Record<string, SourceSymbol>;
  edges?: SourceEdge[] | Record<string, SourceEdge>;
  unresolvedRefs?: unknown[] | Record<string, unknown>;
};

export type CurrentSourceFileState = {
  path: string;
  hash?: string;
  modifiedAt?: string;
  mtimeMs?: number;
  exists?: boolean;
  error?: string;
};

export type SourceImpactOptions = {
  cwd?: string;
  modules?: ContextModule[];
  currentFiles?: CurrentSourceFileState[] | Record<string, CurrentSourceFileState>;
  maxDepth?: number;
  maxResults?: number;
  maxEdges?: number;
  includeTests?: boolean;
};

export type SourceSymbolRef = {
  id: string;
  kind: SourceSymbolKind;
  name: string;
  qualifiedName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  confidence?: number;
  reason?: string;
  via?: string[];
};

export type SourceFreshnessSummary = {
  generated: true;
  canonical: false;
  status: SourceFreshnessStatus;
  counts: {
    fresh: number;
    stale: number;
    missing: number;
    error: number;
  };
  totalFiles: number;
  staleFiles: string[];
  missingFiles: string[];
  errorFiles: Array<{ path: string; error?: string }>;
  indexedAt?: string;
  gitHead?: string;
  explanations: string[];
};

export type SourceImpactRelatedModule = {
  module: string;
  reason: string;
  confidence: SourceImpactConfidence;
  files: string[];
};

export type SourceImpactRiskFactor = {
  kind: string;
  reason: string;
  evidence: string[];
};

export type SourceImpactReport = {
  version: 1;
  generated: true;
  canonical: false;
  label: "generated source evidence; non-canonical";
  query: {
    kind: "file";
    path: string;
    normalizedPath: string;
    matched: boolean;
  };
  changedFiles: string[];
  changedSymbols: SourceSymbolRef[];
  impactedSymbols: SourceSymbolRef[];
  impactedFiles: string[];
  likelyTests: string[];
  relatedModules: SourceImpactRelatedModule[];
  riskFactors: SourceImpactRiskFactor[];
  confidence: SourceImpactConfidence;
  truncated: boolean;
  omitted: {
    symbols: number;
    files: number;
    tests: number;
    edges: number;
  };
  freshness: SourceFreshnessSummary;
  nextCommands: string[];
};

type NormalizedIndex = {
  files: SourceFileRecord[];
  symbols: SourceSymbol[];
  edges: SourceEdge[];
  fileByPath: Map<string, SourceFileRecord>;
  symbolById: Map<string, SourceSymbol>;
  fileSymbolIdsByPath: Map<string, Set<string>>;
};

type TraversalState = {
  impactedSymbols: Map<string, SourceSymbolRef>;
  impactedFiles: Map<string, string[]>;
  likelyTests: Set<string>;
  truncated: boolean;
  omittedEdges: number;
};

const defaultMaxDepth = 2;
const defaultMaxResults = 50;
const defaultMaxEdges = 5000;

export async function impactFileWithProjectModules(
  cwd: string,
  index: SourceIndexLike | undefined,
  filePath: string,
  options: Omit<SourceImpactOptions, "cwd" | "modules"> & { modules?: ContextModule[] } = {}
): Promise<SourceImpactReport> {
  const modules = options.modules ?? await loadModuleIndex(cwd);
  return impactFile(index, filePath, { ...options, cwd, modules });
}

export function impactFile(
  index: SourceIndexLike | undefined,
  filePath: string,
  options: SourceImpactOptions = {}
): SourceImpactReport {
  const normalizedPath = normalizeProjectPath(filePath, options.cwd);
  const freshness = summarizeSourceFreshness(index, options);
  const riskFactors: SourceImpactRiskFactor[] = [];

  if (!index) {
    return emptyImpactReport({
      filePath,
      normalizedPath,
      freshness,
      riskFactors: [{
        kind: "missing-index",
        reason: "No generated source index was provided.",
        evidence: ["Run cmap source index before impact queries."]
      }],
      modules: options.modules,
      confidence: "low"
    });
  }

  const normalized = normalizeIndex(index, options.cwd);
  const targetFile = normalized.fileByPath.get(normalizedPath);
  if (!targetFile) {
    return emptyImpactReport({
      filePath,
      normalizedPath,
      freshness,
      riskFactors: [
        ...riskFactors,
        {
          kind: "missing-target",
          reason: "The requested file is not present in the generated source index.",
          evidence: [normalizedPath]
        }
      ],
      modules: options.modules,
      confidence: "low"
    });
  }

  const changedFiles = [targetFile.path];
  const changedSymbols = normalized.symbols
    .filter((symbol) => normalizeProjectPath(symbol.filePath, options.cwd) === targetFile.path && symbol.kind !== "File")
    .map((symbol) => toSymbolRef(symbol, 1, "changed file contains symbol"));

  const changedSymbolIds = new Set(
    normalized.symbols
      .filter((symbol) => normalizeProjectPath(symbol.filePath, options.cwd) === targetFile.path)
      .map((symbol) => symbol.id)
  );
  const changedFileSet = new Set(changedFiles);
  const state = traverseImpactGraph(normalized, {
    changedFileSet,
    changedSymbolIds,
    maxDepth: positiveInteger(options.maxDepth, defaultMaxDepth),
    maxEdges: positiveInteger(options.maxEdges, defaultMaxEdges),
    includeTests: options.includeTests !== false
  });

  addLikelyTestsFromNames(normalized, [...changedFileSet, ...state.impactedFiles.keys()], state.likelyTests);

  const impactedSymbolsAll = sortSymbols([...state.impactedSymbols.values()]);
  const impactedFilesAll = sortStrings([...state.impactedFiles.keys()]);
  const likelyTestsAll = sortStrings([...state.likelyTests]);
  const maxResults = positiveInteger(options.maxResults, defaultMaxResults);

  const impactedSymbols = impactedSymbolsAll.slice(0, maxResults);
  const impactedFiles = impactedFilesAll.slice(0, maxResults);
  const likelyTests = likelyTestsAll.slice(0, maxResults);
  const omitted = {
    symbols: Math.max(0, impactedSymbolsAll.length - impactedSymbols.length),
    files: Math.max(0, impactedFilesAll.length - impactedFiles.length),
    tests: Math.max(0, likelyTestsAll.length - likelyTests.length),
    edges: state.omittedEdges
  };
  const truncated = state.truncated || Object.values(omitted).some((count) => count > 0) || Boolean(index.meta?.truncated);

  appendIndexRiskFactors(riskFactors, index, freshness, targetFile, truncated, omitted);

  const relatedModules = buildRelatedModules({
    files: [...changedFiles, ...impactedFiles, ...likelyTests],
    changedFiles: changedFileSet,
    likelyTests: new Set(likelyTests),
    modules: options.modules,
    riskFactors
  });

  return {
    version: 1,
    generated: true,
    canonical: false,
    label: "generated source evidence; non-canonical",
    query: {
      kind: "file",
      path: filePath,
      normalizedPath,
      matched: true
    },
    changedFiles,
    changedSymbols,
    impactedSymbols,
    impactedFiles,
    likelyTests,
    relatedModules,
    riskFactors,
    confidence: reportConfidence({ freshness, riskFactors, truncated }),
    truncated,
    omitted,
    freshness,
    nextCommands: nextCommandsFor(normalizedPath, freshness.status)
  };
}

export function summarizeSourceFreshness(
  index: SourceIndexLike | undefined,
  options: Pick<SourceImpactOptions, "cwd" | "currentFiles"> = {}
): SourceFreshnessSummary {
  if (!index) {
    return {
      generated: true,
      canonical: false,
      status: "missing",
      counts: { fresh: 0, stale: 0, missing: 1, error: 0 },
      totalFiles: 0,
      staleFiles: [],
      missingFiles: ["source-index"],
      errorFiles: [],
      indexedAt: undefined,
      gitHead: undefined,
      explanations: ["No generated source index was found or provided."]
    };
  }

  const files = normalizeFileRecords(index.files, options.cwd);
  const currentFiles = normalizeCurrentFiles(options.currentFiles, options.cwd);
  const staleFiles = new Set<string>();
  const missingFiles = new Set<string>();
  const errorFiles = new Map<string, string | undefined>();
  let fresh = 0;

  for (const file of files) {
    const state = currentFiles.get(file.path);
    if (index.meta?.staleFiles?.map((item) => normalizeProjectPath(item, options.cwd)).includes(file.path)) {
      staleFiles.add(file.path);
    }
    if (file.freshness === "stale") {
      staleFiles.add(file.path);
    }
    if (file.freshness === "missing") {
      missingFiles.add(file.path);
    }
    if (file.freshness === "error" || file.parseErrors.length > 0) {
      errorFiles.set(file.path, file.parseErrors.join("; ") || undefined);
    }

    if (state) {
      if (state.exists === false) {
        missingFiles.add(file.path);
      } else if (state.error) {
        errorFiles.set(file.path, state.error);
      } else if (state.hash && state.hash !== file.hash) {
        staleFiles.add(file.path);
      } else if (isModifiedAfterIndex(state, file)) {
        staleFiles.add(file.path);
      }
    }
  }

  for (const item of index.meta?.staleFiles ?? []) {
    staleFiles.add(normalizeProjectPath(item, options.cwd));
  }
  for (const item of index.meta?.missingFiles ?? []) {
    missingFiles.add(normalizeProjectPath(item, options.cwd));
  }
  for (const item of index.meta?.errorFiles ?? []) {
    if (typeof item === "string") {
      errorFiles.set(normalizeProjectPath(item, options.cwd), undefined);
    } else {
      errorFiles.set(normalizeProjectPath(item.path, options.cwd), item.error);
    }
  }

  const freshFiles = files.filter((file) =>
    !staleFiles.has(file.path) &&
    !missingFiles.has(file.path) &&
    !errorFiles.has(file.path)
  );
  fresh = freshFiles.length;

  const explanations: string[] = [];
  if (!index.files || files.length === 0) {
    explanations.push("The generated source index has no indexed files.");
  }
  if (!options.currentFiles) {
    explanations.push("No current file-state snapshot was supplied; freshness is based on index metadata only.");
  }
  if (index.meta?.errors && index.meta.errors.length > 0) {
    explanations.push(...index.meta.errors);
  }

  const counts = {
    fresh,
    stale: staleFiles.size,
    missing: missingFiles.size,
    error: errorFiles.size
  };

  return {
    generated: true,
    canonical: false,
    status: summaryStatus(counts),
    counts,
    totalFiles: files.length,
    staleFiles: sortStrings([...staleFiles]),
    missingFiles: sortStrings([...missingFiles]),
    errorFiles: [...errorFiles.entries()]
      .map(([errorPath, error]) => ({ path: errorPath, error }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    indexedAt: index.meta?.indexedAt ?? index.meta?.generatedAt ?? newestIndexedAt(files),
    gitHead: index.meta?.gitHead ?? files.find((file) => file.gitHead)?.gitHead,
    explanations
  };
}

function emptyImpactReport(input: {
  filePath: string;
  normalizedPath: string;
  freshness: SourceFreshnessSummary;
  riskFactors: SourceImpactRiskFactor[];
  modules?: ContextModule[];
  confidence: SourceImpactConfidence;
}): SourceImpactReport {
  const riskFactors = [...input.riskFactors];
  const relatedModules = buildRelatedModules({
    files: [input.normalizedPath],
    changedFiles: new Set([input.normalizedPath]),
    likelyTests: new Set(),
    modules: input.modules,
    riskFactors
  });
  return {
    version: 1,
    generated: true,
    canonical: false,
    label: "generated source evidence; non-canonical",
    query: {
      kind: "file",
      path: input.filePath,
      normalizedPath: input.normalizedPath,
      matched: false
    },
    changedFiles: [input.normalizedPath],
    changedSymbols: [],
    impactedSymbols: [],
    impactedFiles: [],
    likelyTests: [],
    relatedModules,
    riskFactors,
    confidence: input.confidence,
    truncated: false,
    omitted: { symbols: 0, files: 0, tests: 0, edges: 0 },
    freshness: input.freshness,
    nextCommands: nextCommandsFor(input.normalizedPath, input.freshness.status)
  };
}

function traverseImpactGraph(
  index: NormalizedIndex,
  input: {
    changedFileSet: Set<string>;
    changedSymbolIds: Set<string>;
    maxDepth: number;
    maxEdges: number;
    includeTests: boolean;
  }
): TraversalState {
  const state: TraversalState = {
    impactedSymbols: new Map(),
    impactedFiles: new Map(),
    likelyTests: new Set(),
    truncated: false,
    omittedEdges: 0
  };

  let frontierFiles = new Set(input.changedFileSet);
  let frontierSymbolIds = new Set(input.changedSymbolIds);
  const seenFiles = new Set(input.changedFileSet);
  const seenSymbolIds = new Set(input.changedSymbolIds);
  let scannedEdges = 0;

  for (let depth = 0; depth < input.maxDepth; depth += 1) {
    const nextFiles = new Set<string>();
    const nextSymbolIds = new Set<string>();

    for (const edge of index.edges) {
      scannedEdges += 1;
      if (scannedEdges > input.maxEdges) {
        state.truncated = true;
        state.omittedEdges += 1;
        continue;
      }

      if (edge.kind === "IMPORTS_FROM" && edgeTargetsFrontier(edge, index, frontierFiles, frontierSymbolIds)) {
        const sourceFile = edgeSourceFile(edge, index);
        if (sourceFile && !seenFiles.has(sourceFile)) {
          addImpactedFile(state, sourceFile, `imports ${describeEdgeTarget(edge, index)}`);
          seenFiles.add(sourceFile);
          nextFiles.add(sourceFile);
          addFileSymbolsToFrontier(index, sourceFile, nextSymbolIds, seenSymbolIds);
          if (input.includeTests && isLikelyTestFile(sourceFile)) {
            state.likelyTests.add(sourceFile);
          }
        }
        addEdgeSourceSymbol(state, edge, index, seenSymbolIds, nextSymbolIds, "imports changed file or symbol");
      }

      if (edge.kind === "CALLS" && edgeTargetsFrontier(edge, index, frontierFiles, frontierSymbolIds)) {
        const sourceFile = edgeSourceFile(edge, index);
        if (sourceFile && !seenFiles.has(sourceFile)) {
          addImpactedFile(state, sourceFile, `calls ${describeEdgeTarget(edge, index)}`);
          seenFiles.add(sourceFile);
          nextFiles.add(sourceFile);
          if (input.includeTests && isLikelyTestFile(sourceFile)) {
            state.likelyTests.add(sourceFile);
          }
        }
        addEdgeSourceSymbol(state, edge, index, seenSymbolIds, nextSymbolIds, "calls changed or impacted symbol");
      }

      if (input.includeTests && edge.kind === "TESTED_BY" && edgeTargetsFrontier(edge, index, frontierFiles, frontierSymbolIds)) {
        const sourceFile = edgeSourceFile(edge, index);
        if (sourceFile) {
          state.likelyTests.add(sourceFile);
          addImpactedFile(state, sourceFile, `tests ${describeEdgeTarget(edge, index)}`);
        }
      }
    }

    if (nextFiles.size === 0 && nextSymbolIds.size === 0) {
      break;
    }
    frontierFiles = nextFiles;
    frontierSymbolIds = nextSymbolIds;
  }

  return state;
}

function addImpactedFile(state: TraversalState, filePath: string, reason: string): void {
  const current = state.impactedFiles.get(filePath) ?? [];
  if (!current.includes(reason)) {
    current.push(reason);
  }
  state.impactedFiles.set(filePath, current);
}

function addEdgeSourceSymbol(
  state: TraversalState,
  edge: SourceEdge,
  index: NormalizedIndex,
  seenSymbolIds: Set<string>,
  nextSymbolIds: Set<string>,
  reason: string
): void {
  const symbol = index.symbolById.get(edge.sourceId);
  if (!symbol || symbol.kind === "File") {
    return;
  }
  if (!seenSymbolIds.has(symbol.id)) {
    seenSymbolIds.add(symbol.id);
    nextSymbolIds.add(symbol.id);
  }
  const current = state.impactedSymbols.get(symbol.id);
  const ref = toSymbolRef(symbol, edge.confidence, reason, [edge.provenance]);
  if (!current || (current.confidence ?? 0) < edge.confidence) {
    state.impactedSymbols.set(symbol.id, ref);
  }
}

function addFileSymbolsToFrontier(
  index: NormalizedIndex,
  filePath: string,
  nextSymbolIds: Set<string>,
  seenSymbolIds: Set<string>
): void {
  for (const symbolId of index.fileSymbolIdsByPath.get(filePath) ?? []) {
    if (!seenSymbolIds.has(symbolId)) {
      seenSymbolIds.add(symbolId);
      nextSymbolIds.add(symbolId);
    }
  }
}

function edgeTargetsFrontier(
  edge: SourceEdge,
  index: NormalizedIndex,
  frontierFiles: Set<string>,
  frontierSymbolIds: Set<string>
): boolean {
  if (edge.targetId && frontierSymbolIds.has(edge.targetId)) {
    return true;
  }
  const targetFile = edge.targetId ? filePathForNode(edge.targetId, index) : undefined;
  return Boolean(targetFile && frontierFiles.has(targetFile));
}

function edgeSourceFile(edge: SourceEdge, index: NormalizedIndex): string | undefined {
  return filePathForNode(edge.sourceId, index) ?? normalizeProjectPath(edge.filePath);
}

function filePathForNode(nodeId: string, index: NormalizedIndex): string | undefined {
  const symbol = index.symbolById.get(nodeId);
  if (symbol) {
    return normalizeProjectPath(symbol.filePath);
  }
  if (nodeId.startsWith("file:")) {
    const filePath = normalizeProjectPath(nodeId.slice("file:".length));
    return index.fileByPath.has(filePath) ? filePath : undefined;
  }
  const normalized = normalizeProjectPath(nodeId);
  return index.fileByPath.has(normalized) ? normalized : undefined;
}

function describeEdgeTarget(edge: SourceEdge, index: NormalizedIndex): string {
  if (!edge.targetId) {
    return edge.unresolvedTarget ?? "unknown target";
  }
  const symbol = index.symbolById.get(edge.targetId);
  if (symbol) {
    return symbol.qualifiedName || symbol.name;
  }
  return filePathForNode(edge.targetId, index) ?? edge.targetId;
}

function addLikelyTestsFromNames(index: NormalizedIndex, affectedFiles: string[], likelyTests: Set<string>): void {
  const sourceNames = new Set(
    affectedFiles
      .filter((file) => !isLikelyTestFile(file))
      .map(testComparableName)
      .filter(Boolean)
  );
  if (sourceNames.size === 0) {
    return;
  }

  for (const file of index.files) {
    if (!isLikelyTestRecord(file)) {
      continue;
    }
    const comparable = testComparableName(file.path);
    if (sourceNames.has(comparable)) {
      likelyTests.add(file.path);
      continue;
    }
    for (const sourceName of sourceNames) {
      if (comparable.endsWith(`.${sourceName}`) || comparable.endsWith(`-${sourceName}`)) {
        likelyTests.add(file.path);
      }
    }
  }

}

function buildRelatedModules(input: {
  files: string[];
  changedFiles: Set<string>;
  likelyTests: Set<string>;
  modules?: ContextModule[];
  riskFactors: SourceImpactRiskFactor[];
}): SourceImpactRelatedModule[] {
  if (!input.modules) {
    input.riskFactors.push({
      kind: "module-mapping-unavailable",
      reason: "No CMAP module index was supplied for source impact mapping.",
      evidence: ["Pass modules from loadModuleIndex(cwd) or use impactFileWithProjectModules()."]
    });
    return [];
  }

  const uniqueFiles = sortStrings([...new Set(input.files.map((file) => normalizeProjectPath(file)))]);
  const mapping = mapChangedFilesToModules(uniqueFiles, input.modules);
  if (mapping.unmapped.length > 0) {
    input.riskFactors.push({
      kind: "unmapped-source-files",
      reason: "Some changed or impacted files do not map to reviewed CMAP modules.",
      evidence: mapping.unmapped
    });
  }

  const moduleFiles = new Map<string, Set<string>>();
  for (const match of mapping.matches) {
    for (const module of match.modules) {
      const files = moduleFiles.get(module.id) ?? new Set<string>();
      files.add(match.file);
      moduleFiles.set(module.id, files);
    }
  }

  return [...moduleFiles.entries()]
    .map(([moduleId, files]) => {
      const fileList = sortStrings([...files]);
      const changed = fileList.filter((file) => input.changedFiles.has(file));
      const tests = fileList.filter((file) => input.likelyTests.has(file));
      const confidence: SourceImpactConfidence = changed.length > 0 ? "high" : tests.length > 0 ? "medium" : "medium";
      return {
        module: moduleId,
        reason: relatedModuleReason(fileList, changed, tests),
        confidence,
        files: fileList
      };
    })
    .sort((left, right) => left.module.localeCompare(right.module));
}

function relatedModuleReason(files: string[], changed: string[], tests: string[]): string {
  if (changed.length > 0) {
    return `Owns changed source file(s): ${changed.join(", ")}`;
  }
  if (tests.length > 0) {
    return `Owns likely test file(s): ${tests.join(", ")}`;
  }
  return `Owns impacted file(s): ${files.join(", ")}`;
}

function appendIndexRiskFactors(
  riskFactors: SourceImpactRiskFactor[],
  index: SourceIndexLike,
  freshness: SourceFreshnessSummary,
  targetFile: SourceFileRecord,
  truncated: boolean,
  omitted: SourceImpactReport["omitted"]
): void {
  if (freshness.status === "stale") {
    riskFactors.push({
      kind: "stale-index",
      reason: "The generated source index may not match current files.",
      evidence: freshness.staleFiles
    });
  }
  if (freshness.status === "missing") {
    riskFactors.push({
      kind: "missing-index-files",
      reason: "Some files referenced by the generated source index are missing.",
      evidence: freshness.missingFiles
    });
  }
  if (freshness.status === "error" || targetFile.parseErrors.length > 0) {
    riskFactors.push({
      kind: "parse-errors",
      reason: "Parse or freshness errors reduce impact confidence.",
      evidence: [
        ...freshness.errorFiles.map((file) => file.error ? `${file.path}: ${file.error}` : file.path),
        ...targetFile.parseErrors.map((message) => `${targetFile.path}: ${message}`)
      ]
    });
  }
  if (unresolvedCount(index) > 0) {
    riskFactors.push({
      kind: "unresolved-refs",
      reason: "The source index contains unresolved references, so impact may be incomplete.",
      evidence: [`unresolvedRefs: ${unresolvedCount(index)}`]
    });
  }
  if (truncated) {
    riskFactors.push({
      kind: "truncated",
      reason: "Impact traversal or result rendering hit configured bounds.",
      evidence: [
        `omitted symbols: ${omitted.symbols}`,
        `omitted files: ${omitted.files}`,
        `omitted tests: ${omitted.tests}`,
        `omitted edges: ${omitted.edges}`
      ]
    });
  }
}

function reportConfidence(input: {
  freshness: SourceFreshnessSummary;
  riskFactors: SourceImpactRiskFactor[];
  truncated: boolean;
}): SourceImpactConfidence {
  if (input.freshness.status === "missing" || input.freshness.status === "error") {
    return "low";
  }
  if (input.truncated || input.freshness.status === "stale") {
    return "medium";
  }
  if (input.riskFactors.some((risk) => ["unresolved-refs", "unmapped-source-files"].includes(risk.kind))) {
    return "medium";
  }
  return "high";
}

function summaryStatus(counts: SourceFreshnessSummary["counts"]): SourceFreshnessStatus {
  if (counts.error > 0) {
    return "error";
  }
  if (counts.missing > 0) {
    return "missing";
  }
  if (counts.stale > 0) {
    return "stale";
  }
  return "fresh";
}

function normalizeIndex(index: SourceIndexLike, cwd?: string): NormalizedIndex {
  const files = normalizeFileRecords(index.files, cwd);
  const symbols = normalizeSymbols(index.symbols, cwd);
  const edges = normalizeEdges(index.edges, cwd);
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const fileSymbolIdsByPath = new Map<string, Set<string>>();

  for (const symbol of symbols) {
    const filePath = normalizeProjectPath(symbol.filePath, cwd);
    const ids = fileSymbolIdsByPath.get(filePath) ?? new Set<string>();
    ids.add(symbol.id);
    fileSymbolIdsByPath.set(filePath, ids);
  }

  return { files, symbols, edges, fileByPath, symbolById, fileSymbolIdsByPath };
}

function normalizeFileRecords(
  value: SourceIndexLike["files"] | undefined,
  cwd?: string
): SourceFileRecord[] {
  return collectionValues(value)
    .filter(isSourceFileRecord)
    .map((file) => ({
      ...file,
      path: normalizeProjectPath(file.path, cwd),
      parseErrors: Array.isArray(file.parseErrors) ? file.parseErrors : []
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeSymbols(value: SourceIndexLike["symbols"] | undefined, cwd?: string): SourceSymbol[] {
  return collectionValues(value)
    .filter(isSourceSymbol)
    .map((symbol) => ({
      ...symbol,
      filePath: normalizeProjectPath(symbol.filePath, cwd)
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeEdges(value: SourceIndexLike["edges"] | undefined, cwd?: string): SourceEdge[] {
  return collectionValues(value)
    .filter(isSourceEdge)
    .map((edge) => ({
      ...edge,
      filePath: normalizeProjectPath(edge.filePath, cwd)
    }));
}

function normalizeCurrentFiles(
  value: SourceImpactOptions["currentFiles"] | undefined,
  cwd?: string
): Map<string, CurrentSourceFileState> {
  const map = new Map<string, CurrentSourceFileState>();
  for (const item of collectionValues(value)) {
    if (!item || typeof item !== "object" || typeof item.path !== "string") {
      continue;
    }
    const normalized = {
      ...item,
      path: normalizeProjectPath(item.path, cwd)
    };
    map.set(normalized.path, normalized);
  }
  return map;
}

function collectionValues<T>(value: T[] | Record<string, T> | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : Object.values(value);
}

function isSourceFileRecord(value: unknown): value is SourceFileRecord {
  return Boolean(value && typeof value === "object" && typeof (value as SourceFileRecord).path === "string");
}

function isSourceSymbol(value: unknown): value is SourceSymbol {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SourceSymbol).id === "string" &&
    typeof (value as SourceSymbol).filePath === "string"
  );
}

function isSourceEdge(value: unknown): value is SourceEdge {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SourceEdge).kind === "string" &&
    typeof (value as SourceEdge).sourceId === "string"
  );
}

function isModifiedAfterIndex(state: CurrentSourceFileState, file: SourceFileRecord): boolean {
  const currentMs = state.mtimeMs ?? (state.modifiedAt ? Date.parse(state.modifiedAt) : 0);
  const indexedMs = file.indexedAt ? Date.parse(file.indexedAt) : 0;
  return Number.isFinite(currentMs) && Number.isFinite(indexedMs) && currentMs > indexedMs + 1000;
}

function newestIndexedAt(files: SourceFileRecord[]): string | undefined {
  return files
    .map((file) => file.indexedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
}

function unresolvedCount(index: SourceIndexLike): number {
  const refs = index.unresolvedRefs;
  if (!refs) {
    return 0;
  }
  return Array.isArray(refs) ? refs.length : Object.keys(refs).length;
}

function toSymbolRef(symbol: SourceSymbol, confidence?: number, reason?: string, via?: string[]): SourceSymbolRef {
  return {
    id: symbol.id,
    kind: symbol.kind,
    name: symbol.name,
    qualifiedName: symbol.qualifiedName,
    filePath: normalizeProjectPath(symbol.filePath),
    lineStart: symbol.lineStart,
    lineEnd: symbol.lineEnd,
    exported: symbol.exported,
    confidence,
    reason,
    via: via && via.length > 0 ? via : undefined
  };
}

function normalizeProjectPath(value: string, cwd?: string): string {
  const trimmed = value.trim();
  const relative = cwd && path.isAbsolute(trimmed) ? path.relative(cwd, trimmed) : trimmed;
  return relative.replace(/\\/g, "/").replace(/^\.\//, "");
}

function testComparableName(filePath: string): string {
  const parsed = path.posix.parse(normalizeProjectPath(filePath));
  return parsed.name
    .replace(/\.(test|spec)$/i, "")
    .replace(/[-_.](test|spec)$/i, "")
    .toLowerCase();
}

function isLikelyTestFile(filePath: string): boolean {
  const normalized = normalizeProjectPath(filePath).toLowerCase();
  return (
    /(^|\/)(__tests__|tests?)(\/|$)/.test(normalized) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized) ||
    /(^|\/)test[-_./]/.test(normalized)
  );
}

function isLikelyTestRecord(file: SourceFileRecord): boolean {
  return Boolean(file.isTestFile) || isLikelyTestFile(file.path);
}

function nextCommandsFor(filePath: string, status: SourceFreshnessStatus): string[] {
  return [
    ...(status === "fresh" ? [] : ["cmap source index"]),
    `cmap impact file ${shellQuote(filePath)}`,
    "cmap source status"
  ];
}

function shellQuote(value: string): string {
  return value.includes(" ") ? JSON.stringify(value) : value;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number") {
    return fallback;
  }
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function sortStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sortSymbols(values: SourceSymbolRef[]): SourceSymbolRef[] {
  return values.sort((left, right) =>
    left.filePath.localeCompare(right.filePath) ||
    left.lineStart - right.lineStart ||
    left.qualifiedName.localeCompare(right.qualifiedName)
  );
}
