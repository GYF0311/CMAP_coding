import { CmapCommandError } from "../errors.js";
import { currentSourceFileStates } from "../source-intelligence/freshness.js";
import { computeSourceIndexMetrics, writeSourceQueryMetric } from "../source-intelligence/metrics.js";
import {
  callersOf,
  calleesOf,
  findSymbols,
  getSymbol,
  importsOfFile
} from "../source-intelligence/queries.js";
import { readSourceIndex } from "../source-intelligence/store.js";
import { summarizeSourceFreshness, type SourceFreshnessSummary } from "../source-intelligence/impact.js";
import type { SourceEdge, SourceIndex, SourceSymbol, SourceSymbolKind } from "../source-intelligence/schema.js";

type SymbolOptions = {
  json?: boolean;
  kind?: string;
  exportedOnly?: boolean;
  limit?: string;
};

type SymbolMatch = SourceSymbol & { canonical: false };

type ResolvedSymbol =
  | { status: "ok"; symbol: SourceSymbol; candidates: SourceSymbol[] }
  | { status: "ambiguous"; candidates: SourceSymbol[] }
  | { status: "missing"; candidates: SourceSymbol[] };

const label = "generated source evidence; non-canonical";

export async function runSymbolFind(cwd: string, query: string, options: SymbolOptions = {}): Promise<void> {
  const { index, freshness } = await loadSymbolContext(cwd);
  const limit = parsePositiveInteger(options.limit, "--limit") ?? 20;
  const kind = parseSymbolKind(options.kind);
  const matches = findSymbols(index, {
    query,
    kind,
    exportedOnly: Boolean(options.exportedOnly),
    limit
  }) as SymbolMatch[];
  const payload = basePayload(index, freshness, {
    query,
    returned: matches.length,
    totalSymbols: index.symbols.length
  });
  await writeSourceQueryMetric(cwd, {
    command: "symbol find",
    query,
    status: "ok",
    indexMetrics: computeSourceIndexMetrics(index),
    queryMetrics: payload.queryMetrics
  });
  const result = {
    ...payload,
    status: "ok",
    confidence: reportConfidence(freshness),
    matches
  };

  if (options.json) {
    writeJson(result);
    return;
  }
  process.stdout.write(renderFindMarkdown(query, result));
}

export async function runSymbolExplain(cwd: string, query: string, options: SymbolOptions = {}): Promise<void> {
  const { index, freshness } = await loadSymbolContext(cwd);
  const resolved = resolveSymbol(index, query);
  const common = basePayload(index, freshness, {
    query,
    candidates: resolved.candidates.length,
    totalSymbols: index.symbols.length
  });

  if (resolved.status !== "ok") {
    const result = {
      ...common,
      status: resolved.status,
      confidence: "low",
      ambiguityCandidates: resolved.status === "ambiguous" ? resolved.candidates : [],
      candidates: resolved.candidates
    };
    await writeSourceQueryMetric(cwd, {
      command: "symbol explain",
      query,
      status: resolved.status,
      indexMetrics: computeSourceIndexMetrics(index),
      queryMetrics: common.queryMetrics
    });
    if (options.json) {
      writeJson(result);
      return;
    }
    process.stdout.write(renderResolutionMarkdown("Symbol Explain", query, result));
    return;
  }

  const symbol = resolved.symbol;
  const limit = parsePositiveInteger(options.limit, "--limit") ?? 20;
  const allCallers = decorateEdges(index, callersOf(index, symbol.id));
  const allCallees = decorateEdges(index, calleesOf(index, symbol.id));
  const allImports = importsOfFile(index, symbol.filePath);
  const callers = allCallers.slice(0, limit);
  const callees = allCallees.slice(0, limit);
  const imports = allImports.slice(0, limit);
  const omitted = {
    callers: Math.max(0, allCallers.length - callers.length),
    callees: Math.max(0, allCallees.length - callees.length),
    imports: Math.max(0, allImports.length - imports.length)
  };
  const truncated = Object.values(omitted).some((count) => count > 0);
  const result = {
    ...common,
    status: "ok",
    confidence: reportConfidence(freshness),
    symbol,
    callers,
    callees,
    imports,
    omitted,
    truncated
  };
  await writeSourceQueryMetric(cwd, {
    command: "symbol explain",
    query,
    status: "ok",
    indexMetrics: computeSourceIndexMetrics(index),
    queryMetrics: {
      ...common.queryMetrics,
      callers: result.callers.length,
      callees: result.callees.length,
      imports: result.imports.length,
      omitted,
      truncated
    }
  });
  if (options.json) {
    writeJson(result);
    return;
  }
  process.stdout.write(renderExplainMarkdown(query, result));
}

export async function runSymbolCallers(cwd: string, query: string, options: SymbolOptions = {}): Promise<void> {
  await runSymbolEdges(cwd, "callers", query, options);
}

export async function runSymbolCallees(cwd: string, query: string, options: SymbolOptions = {}): Promise<void> {
  await runSymbolEdges(cwd, "callees", query, options);
}

async function runSymbolEdges(
  cwd: string,
  mode: "callers" | "callees",
  query: string,
  options: SymbolOptions
): Promise<void> {
  const { index, freshness } = await loadSymbolContext(cwd);
  const resolved = resolveSymbol(index, query);
  const common = basePayload(index, freshness, {
    query,
    candidates: resolved.candidates.length,
    totalSymbols: index.symbols.length
  });
  if (resolved.status !== "ok") {
    const result = {
      ...common,
      status: resolved.status,
      confidence: "low",
      ambiguityCandidates: resolved.status === "ambiguous" ? resolved.candidates : [],
      candidates: resolved.candidates,
      [mode]: []
    };
    await writeSourceQueryMetric(cwd, {
      command: `symbol ${mode}`,
      query,
      status: resolved.status,
      indexMetrics: computeSourceIndexMetrics(index),
      queryMetrics: common.queryMetrics
    });
    if (options.json) {
      writeJson(result);
      return;
    }
    process.stdout.write(renderResolutionMarkdown(`Symbol ${titleCase(mode)}`, query, result));
    return;
  }

  const limit = parsePositiveInteger(options.limit, "--limit") ?? 20;
  const allEdges = mode === "callers"
    ? decorateEdges(index, callersOf(index, resolved.symbol.id))
    : decorateEdges(index, calleesOf(index, resolved.symbol.id));
  const visible = allEdges.slice(0, limit);
  const omittedCount = Math.max(0, allEdges.length - visible.length);
  const truncated = omittedCount > 0;
  const result = {
    ...common,
    status: "ok",
    confidence: reportConfidence(freshness),
    symbol: resolved.symbol,
    [mode]: visible,
    omitted: { [mode]: omittedCount },
    truncated
  };
  await writeSourceQueryMetric(cwd, {
    command: `symbol ${mode}`,
    query,
    status: "ok",
    indexMetrics: computeSourceIndexMetrics(index),
    queryMetrics: {
      ...common.queryMetrics,
      returned: visible.length,
      omitted: omittedCount,
      truncated
    }
  });

  if (options.json) {
    writeJson(result);
    return;
  }
  process.stdout.write(renderEdgesMarkdown(`Symbol ${titleCase(mode)}`, query, mode, result));
}

async function loadSymbolContext(cwd: string): Promise<{ index: SourceIndex; freshness: SourceFreshnessSummary }> {
  const index = await readSourceIndex(cwd);
  if (!index) {
    throw new CmapCommandError("Generated source index not found. Run `cmap source index` first.", 2);
  }
  const currentFiles = await currentSourceFileStates(cwd, index);
  return {
    index,
    freshness: summarizeSourceFreshness(index, { cwd, currentFiles })
  };
}

function resolveSymbol(index: SourceIndex, query: string): ResolvedSymbol {
  const exact = index.symbols.filter((symbol) =>
    symbol.id === query || symbol.qualifiedName === query || `${symbol.filePath}#${symbol.name}` === query
  );
  if (exact.length === 1) {
    return { status: "ok", symbol: exact[0], candidates: exact };
  }
  if (exact.length > 1) {
    return { status: "ambiguous", candidates: exact };
  }

  const exactNames = index.symbols.filter((symbol) => symbol.name === query && symbol.kind !== "Test");
  if (exactNames.length === 1) {
    return { status: "ok", symbol: exactNames[0], candidates: exactNames };
  }
  if (exactNames.length > 1) {
    return { status: "ambiguous", candidates: exactNames };
  }

  const candidates = findSymbols(index, { query, limit: 10 }).filter((symbol) => symbol.kind !== "File");
  if (candidates.length === 1) {
    return { status: "ok", symbol: candidates[0], candidates };
  }
  if (candidates.length > 1) {
    return { status: "ambiguous", candidates };
  }
  return { status: "missing", candidates: [] };
}

function decorateEdges(index: SourceIndex, edges: SourceEdge[]): Array<SourceEdge & {
  sourceSymbol?: SourceSymbol;
  targetSymbol?: SourceSymbol;
}> {
  return edges.map((edge) => ({
    ...edge,
    sourceSymbol: getSymbol(index, edge.sourceId),
    targetSymbol: edge.targetId ? getSymbol(index, edge.targetId) : undefined
  }));
}

function basePayload(index: SourceIndex, freshness: SourceFreshnessSummary, queryMetrics: Record<string, unknown>) {
  return {
    generated: true,
    canonical: false,
    label,
    freshness,
    metrics: computeSourceIndexMetrics(index),
    queryMetrics
  };
}

function reportConfidence(freshness: SourceFreshnessSummary): "high" | "medium" | "low" {
  if (freshness.status === "fresh") {
    return "high";
  }
  if (freshness.status === "stale") {
    return "medium";
  }
  return "low";
}

function parsePositiveInteger(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CmapCommandError(`Invalid ${flag} "${value}". Expected a positive integer.`, 2);
  }
  return parsed;
}

function parseSymbolKind(value: string | undefined): SourceSymbolKind | undefined {
  if (!value) {
    return undefined;
  }
  const allowed: SourceSymbolKind[] = ["File", "Function", "Class", "Method", "Type", "Variable", "Test"];
  const match = allowed.find((kind) => kind.toLowerCase() === value.toLowerCase());
  if (!match) {
    throw new CmapCommandError(`Invalid --kind "${value}". Expected one of ${allowed.join(", ")}.`, 2);
  }
  return match;
}

function renderFindMarkdown(query: string, result: { matches: SourceSymbol[]; freshness: SourceFreshnessSummary; confidence: string }): string {
  return [
    "# Symbol Find",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Query: ${query}`,
    `Freshness: ${result.freshness.status}`,
    `Confidence: ${result.confidence}`,
    "",
    "## Matches",
    renderSymbolList(result.matches),
    ""
  ].join("\n");
}

function renderExplainMarkdown(query: string, result: {
  symbol: SourceSymbol;
  callers: Array<SourceEdge & { sourceSymbol?: SourceSymbol }>;
  callees: Array<SourceEdge & { targetSymbol?: SourceSymbol }>;
  imports: SourceEdge[];
  freshness: SourceFreshnessSummary;
  confidence: string;
  omitted: { callers: number; callees: number; imports: number };
  truncated: boolean;
}): string {
  return [
    "# Symbol Explain",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Query: ${query}`,
    "Status: ok",
    `Freshness: ${result.freshness.status}`,
    `Confidence: ${result.confidence}`,
    `Truncated: ${result.truncated ? "yes" : "no"}`,
    `Omitted: callers=${result.omitted.callers}, callees=${result.omitted.callees}, imports=${result.omitted.imports}`,
    "",
    "## Symbol",
    `- ${symbolLine(result.symbol)}`,
    "",
    "## Callers",
    renderEdgeList(result.callers.map((edge) => edge.sourceSymbol ? `${symbolLine(edge.sourceSymbol)} (${edge.confidenceTier})` : `${edge.filePath}:${edge.line}`)),
    "",
    "## Callees",
    renderEdgeList(result.callees.map((edge) => edge.targetSymbol ? `${symbolLine(edge.targetSymbol)} (${edge.confidenceTier})` : `${edge.unresolvedTarget ?? "unresolved"}`)),
    "",
    "## Imports",
    renderEdgeList(result.imports.map((edge) => `${edge.kind} ${edge.targetId ?? edge.unresolvedTarget ?? ""} (${edge.filePath}:${edge.line})`)),
    ""
  ].join("\n");
}

function renderEdgesMarkdown(title: string, query: string, mode: "callers" | "callees", result: {
  status: string;
  freshness: SourceFreshnessSummary;
  confidence: string;
  callers?: Array<SourceEdge & { sourceSymbol?: SourceSymbol }>;
  callees?: Array<SourceEdge & { targetSymbol?: SourceSymbol }>;
  omitted: Record<string, number>;
  truncated: boolean;
}): string {
  const rows = mode === "callers"
    ? (result.callers ?? []).map((edge) => edge.sourceSymbol ? `${symbolLine(edge.sourceSymbol)} (${edge.confidenceTier})` : `${edge.filePath}:${edge.line}`)
    : (result.callees ?? []).map((edge) => edge.targetSymbol ? `${symbolLine(edge.targetSymbol)} (${edge.confidenceTier})` : `${edge.unresolvedTarget ?? "unresolved"}`);
  return [
    `# ${title}`,
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Query: ${query}`,
    `Status: ${result.status}`,
    `Freshness: ${result.freshness.status}`,
    `Confidence: ${result.confidence}`,
    `Truncated: ${result.truncated ? "yes" : "no"}`,
    `Omitted ${mode}: ${result.omitted[mode] ?? 0}`,
    "",
    `## ${titleCase(mode)}`,
    renderEdgeList(rows),
    ""
  ].join("\n");
}

function renderResolutionMarkdown(title: string, query: string, result: {
  status: string;
  freshness: SourceFreshnessSummary;
  ambiguityCandidates?: SourceSymbol[];
  candidates: SourceSymbol[];
}): string {
  const candidates = result.ambiguityCandidates ?? result.candidates;
  return [
    `# ${title}`,
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Query: ${query}`,
    `Status: ${result.status}`,
    `Freshness: ${result.freshness.status}`,
    "",
    "## Ambiguity candidates",
    renderSymbolList(candidates),
    ""
  ].join("\n");
}

function renderSymbolList(symbols: SourceSymbol[]): string {
  if (symbols.length === 0) {
    return "- None";
  }
  return symbols.map((symbol) => `- ${symbolLine(symbol)}`).join("\n");
}

function renderEdgeList(rows: string[]): string {
  if (rows.length === 0) {
    return "- None";
  }
  return rows.map((row) => `- ${row}`).join("\n");
}

function symbolLine(symbol: SourceSymbol): string {
  return `\`${symbol.qualifiedName}\` (${symbol.kind}, ${symbol.filePath}:${symbol.lineStart})`;
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
