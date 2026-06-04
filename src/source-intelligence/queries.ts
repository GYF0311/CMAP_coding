import type { SourceEdge, SourceIndex, SourceSymbol, SourceSymbolKind } from "./schema.js";

export type SymbolQueryOptions = {
  query: string;
  kind?: SourceSymbolKind;
  exportedOnly?: boolean;
  limit?: number;
};

export type SymbolQueryResolution = {
  status: "ok" | "ambiguous" | "not_found";
  query: string;
  candidates: SourceSymbol[];
  selected?: SourceSymbol;
};

export function findSymbols(index: SourceIndex, options: SymbolQueryOptions): SourceSymbol[] {
  return matchSymbols(index, options).slice(0, options.limit ?? 20);
}

export function resolveSymbolQuery(
  index: SourceIndex,
  options: Omit<SymbolQueryOptions, "limit"> & { limit?: number }
): SymbolQueryResolution {
  const exactCandidates = exactSymbolMatches(index, options);
  const candidates = exactCandidates.length > 0
    ? exactCandidates
    : matchSymbols(index, options).slice(0, options.limit ?? 20);

  if (candidates.length === 0) {
    return {
      status: "not_found",
      query: options.query,
      candidates
    };
  }
  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      query: options.query,
      candidates
    };
  }
  return {
    status: "ok",
    query: options.query,
    candidates,
    selected: candidates[0]
  };
}

export function matchSymbols(index: SourceIndex, options: SymbolQueryOptions): SourceSymbol[] {
  const needle = options.query.toLowerCase();
  return index.symbols
    .filter((symbol) => {
      if (options.kind && symbol.kind !== options.kind) {
        return false;
      }
      if (options.exportedOnly && !symbol.exported) {
        return false;
      }
      return symbol.name.toLowerCase().includes(needle) || symbol.qualifiedName.toLowerCase().includes(needle);
    })
    .sort((left, right) => scoreSymbol(right, needle) - scoreSymbol(left, needle) || left.qualifiedName.localeCompare(right.qualifiedName));
}

export function getSymbol(index: SourceIndex, symbolId: string): SourceSymbol | undefined {
  return index.symbols.find((symbol) => symbol.id === symbolId);
}

export function callersOf(index: SourceIndex, symbolId: string): SourceEdge[] {
  return index.edges
    .filter((edge) => edge.kind === "CALLS" && edge.targetId === symbolId)
    .sort(compareEdges);
}

export function calleesOf(index: SourceIndex, symbolId: string): SourceEdge[] {
  return index.edges
    .filter((edge) => edge.kind === "CALLS" && edge.sourceId === symbolId)
    .sort(compareEdges);
}

export function importsOfFile(index: SourceIndex, filePath: string): SourceEdge[] {
  const fileId = `file:${filePath}`;
  return index.edges
    .filter((edge) => edge.kind === "IMPORTS_FROM" && edge.sourceId === fileId)
    .sort(compareEdges);
}

export function dependentsOfFile(index: SourceIndex, filePath: string): SourceEdge[] {
  const fileId = `file:${filePath}`;
  return index.edges
    .filter((edge) => edge.kind === "IMPORTS_FROM" && edge.targetId === fileId)
    .sort(compareEdges);
}

function exactSymbolMatches(index: SourceIndex, options: SymbolQueryOptions): SourceSymbol[] {
  const needle = options.query.toLowerCase();
  return index.symbols
    .filter((symbol) => {
      if (options.kind && symbol.kind !== options.kind) {
        return false;
      }
      if (options.exportedOnly && !symbol.exported) {
        return false;
      }
      return symbol.id.toLowerCase() === needle
        || symbol.name.toLowerCase() === needle
        || symbol.qualifiedName.toLowerCase() === needle;
    })
    .sort((left, right) => scoreSymbol(right, needle) - scoreSymbol(left, needle) || left.qualifiedName.localeCompare(right.qualifiedName));
}

function scoreSymbol(symbol: SourceSymbol, needle: string): number {
  if (symbol.name.toLowerCase() === needle) {
    return 100;
  }
  if (symbol.qualifiedName.toLowerCase() === needle) {
    return 90;
  }
  if (symbol.name.toLowerCase().startsWith(needle)) {
    return 70;
  }
  if (symbol.qualifiedName.toLowerCase().includes(needle)) {
    return 50;
  }
  return 10;
}

function compareEdges(left: SourceEdge, right: SourceEdge): number {
  return left.filePath.localeCompare(right.filePath) || left.line - right.line || left.kind.localeCompare(right.kind);
}
