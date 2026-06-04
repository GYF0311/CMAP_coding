import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { loadModuleIndex } from "../core/module-index.js";
import { CmapCommandError } from "../errors.js";
import { currentSourceFileStates } from "./freshness.js";
import {
  impactFileWithProjectModules,
  summarizeSourceFreshness,
  type SourceFreshnessSummary,
  type SourceImpactConfidence,
  type SourceImpactRelatedModule,
  type SourceImpactReport,
  type SourceImpactRiskFactor,
  type SourceSymbolRef
} from "./impact.js";
import { callersOf, calleesOf, getSymbol, resolveSymbolQuery } from "./queries.js";
import { isSourceFileExtension, type SourceIndex, type SourceSymbol } from "./schema.js";
import { readSourceIndex } from "./store.js";
import { assertInsideProject, toProjectRelative } from "./guards.js";

const execFileAsync = promisify(execFile);
const label = "generated source evidence; non-canonical" as const;

export type SourceImpactDiffOptions = {
  files?: string[];
  base?: string;
  staged?: boolean;
  maxDepth?: number;
  maxResults?: number;
};

export type SourceImpactDiffReport = {
  version: 1;
  generated: true;
  canonical: false;
  label: typeof label;
  query: {
    kind: "diff";
    source: "files" | "staged" | "base" | "worktree";
    base?: string;
    staged: boolean;
    files: string[];
  };
  fileReports: SourceImpactReport[];
  reports: SourceImpactReport[];
  changedFiles: string[];
  changedSymbols: SourceSymbolRef[];
  impactedSymbols: SourceSymbolRef[];
  impactedFiles: string[];
  likelyTests: string[];
  relatedModules: SourceImpactRelatedModule[];
  riskFactors: SourceImpactRiskFactor[];
  confidence: SourceImpactConfidence;
  freshness: SourceFreshnessSummary;
  freshnessStatus: SourceFreshnessSummary["status"];
  truncated: boolean;
  omitted: {
    files: number;
    symbols: number;
    tests: number;
    edges: number;
    reports: number;
  };
  nextCommands: string[];
};

export type SourceImpactSymbolReport = {
  version: 1;
  generated: true;
  canonical: false;
  label: typeof label;
  advisory: string;
  status: "ok" | "ambiguous" | "missing";
  query: {
    kind: "symbol";
    symbol: string;
    matched: boolean;
  };
  symbol?: SourceSymbolRef;
  ambiguityCandidates: SourceSymbolRef[];
  callers: SourceSymbolRef[];
  callees: SourceSymbolRef[];
  changedFiles: string[];
  changedSymbols: SourceSymbolRef[];
  impactedSymbols: SourceSymbolRef[];
  impactedFiles: string[];
  likelyTests: string[];
  relatedModules: SourceImpactRelatedModule[];
  riskFactors: SourceImpactRiskFactor[];
  fileImpact?: SourceImpactReport;
  report?: SourceImpactReport;
  confidence: SourceImpactConfidence;
  freshness: SourceFreshnessSummary;
  truncated: boolean;
  omitted: {
    callers: number;
    callees: number;
    symbols: number;
    files: number;
    tests: number;
    edges: number;
  };
  nextCommands: string[];
};

export async function impactDiff(cwd: string, options: SourceImpactDiffOptions = {}): Promise<SourceImpactDiffReport> {
  const index = await readSourceIndex(cwd);
  const modules = await loadModuleIndex(cwd);
  const rawFiles = options.files?.length ? options.files : await gitChangedFiles(cwd, options);
  const files = normalizeSourceFiles(cwd, rawFiles);
  const currentFiles = await currentSourceFileStates(cwd, index);
  const freshness = summarizeSourceFreshness(index, { cwd, currentFiles });
  const reports: SourceImpactReport[] = [];

  for (const file of files) {
    reports.push(await impactFileWithProjectModules(cwd, index, file, {
      modules,
      currentFiles,
      maxDepth: options.maxDepth,
      maxResults: options.maxResults
    }));
  }

  const changedSymbols = sortedSymbols(uniqueSymbols(reports.flatMap((report) => report.changedSymbols)));
  const impactedSymbols = sortedSymbols(uniqueSymbols(reports.flatMap((report) => report.impactedSymbols)));
  const impactedFiles = sortedUnique(reports.flatMap((report) => report.impactedFiles));
  const likelyTests = sortedUnique(reports.flatMap((report) => report.likelyTests));
  const riskFactors = dedupeRiskFactors([
    ...(files.length === 0 ? [{
      kind: "no-changed-source-files",
      reason: "No changed TS/JS source files were found for this diff impact query.",
      evidence: [querySource(options)]
    }] : []),
    ...reports.flatMap((report) => report.riskFactors)
  ]);
  const confidence = combinedConfidence(reports, freshness);
  const freshnessStatus = combinedFreshness(reports, freshness);
  const truncated = reports.some((report) => report.truncated);
  const omitted = {
    files: reports.reduce((total, report) => total + report.omitted.files, 0),
    symbols: reports.reduce((total, report) => total + report.omitted.symbols, 0),
    tests: reports.reduce((total, report) => total + report.omitted.tests, 0),
    edges: reports.reduce((total, report) => total + report.omitted.edges, 0),
    reports: 0
  };

  return {
    version: 1,
    generated: true,
    canonical: false,
    label,
    query: {
      kind: "diff",
      source: querySource(options),
      base: options.base,
      staged: Boolean(options.staged),
      files
    },
    fileReports: reports,
    reports,
    changedFiles: files,
    changedSymbols,
    impactedSymbols,
    impactedFiles,
    likelyTests,
    relatedModules: mergeRelatedModules(reports.flatMap((report) => report.relatedModules)),
    riskFactors,
    confidence,
    freshness,
    freshnessStatus,
    truncated,
    omitted,
    nextCommands: [
      "cmap source status",
      "cmap impact file <path>",
      "cmap symbol callers <symbol>"
    ]
  };
}

export async function impactSymbolWithProjectModules(
  cwd: string,
  query: string,
  options: Omit<SourceImpactDiffOptions, "files" | "base" | "staged"> = {}
): Promise<SourceImpactSymbolReport> {
  const index = await readSourceIndex(cwd);
  const currentFiles = await currentSourceFileStates(cwd, index);
  const freshness = summarizeSourceFreshness(index, { cwd, currentFiles });
  if (!index) {
    return unresolvedSymbolReport(query, "missing", [], freshness, [{
      kind: "missing-index",
      reason: "No generated source index was found for symbol impact.",
      evidence: ["Run cmap source index before impact symbol."]
    }]);
  }

  const resolved = resolveSymbolQuery(index, { query, limit: 10 });
  if (resolved.status !== "ok" || !resolved.selected) {
    return unresolvedSymbolReport(
      query,
      resolved.status === "not_found" ? "missing" : "ambiguous",
      resolved.candidates.map((symbol) => symbolRef(symbol, 0.4, "symbol query candidate")),
      freshness,
      [{
        kind: resolved.status === "not_found" ? "symbol-not-found" : "ambiguous-symbol",
        reason: resolved.status === "not_found"
          ? "No generated source symbol matched the impact query."
          : "Multiple generated source symbols matched the impact query.",
        evidence: resolved.candidates.map((symbol) => symbol.qualifiedName)
      }]
    );
  }

  const modules = await loadModuleIndex(cwd);
  const selected = resolved.selected;
  const maxResults = options.maxResults ?? 50;
  const allCallers = callersOf(index, selected.id)
    .map((edge) => getSymbol(index, edge.sourceId))
    .filter((symbol): symbol is SourceSymbol => symbol !== undefined && symbol.kind !== "File");
  const allCallees = calleesOf(index, selected.id)
    .map((edge) => edge.targetId ? getSymbol(index, edge.targetId) : undefined)
    .filter((symbol): symbol is SourceSymbol => symbol !== undefined && symbol.kind !== "File");
  const callers = sortedSymbols(uniqueSymbols(allCallers.map((symbol) => symbolRef(symbol, 0.86, "calls selected symbol"))))
    .slice(0, maxResults);
  const callees = sortedSymbols(uniqueSymbols(allCallees.map((symbol) => symbolRef(symbol, 0.86, "called by selected symbol"))))
    .slice(0, maxResults);
  const fileImpact = await impactFileWithProjectModules(cwd, index, selected.filePath, {
    modules,
    currentFiles,
    maxDepth: options.maxDepth,
    maxResults: options.maxResults
  });
  const changedSymbols = [symbolRef(selected, 1, "selected changed symbol")];
  const impactedSymbols = sortedSymbols(uniqueSymbols([
    ...callers,
    ...fileImpact.impactedSymbols.filter((symbol) => symbol.id !== selected.id)
  ]));
  const omitted = {
    callers: Math.max(0, allCallers.length - callers.length),
    callees: Math.max(0, allCallees.length - callees.length),
    symbols: fileImpact.omitted.symbols,
    files: fileImpact.omitted.files,
    tests: fileImpact.omitted.tests,
    edges: fileImpact.omitted.edges
  };
  const truncated = fileImpact.truncated || Object.values(omitted).some((count) => count > 0);

  return {
    version: 1,
    generated: true,
    canonical: false,
    label,
    advisory: "generated advisory converted through the selected symbol's file impact; not a reviewed .context fact.",
    status: "ok",
    query: {
      kind: "symbol",
      symbol: query,
      matched: true
    },
    symbol: changedSymbols[0],
    ambiguityCandidates: [],
    callers,
    callees,
    changedFiles: [selected.filePath],
    changedSymbols,
    impactedSymbols,
    impactedFiles: fileImpact.impactedFiles,
    likelyTests: fileImpact.likelyTests,
    relatedModules: fileImpact.relatedModules,
    riskFactors: fileImpact.riskFactors,
    fileImpact,
    report: fileImpact,
    confidence: fileImpact.confidence,
    freshness: fileImpact.freshness,
    truncated,
    omitted,
    nextCommands: [
      `cmap symbol callers ${shellQuote(query)}`,
      `cmap symbol callees ${shellQuote(query)}`,
      `cmap impact file ${shellQuote(selected.filePath)}`,
      "cmap source status"
    ]
  };
}

export function renderImpactDiffMarkdown(report: SourceImpactDiffReport): string {
  return [
    "# Diff Impact",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Source: ${report.query.source}`,
    `Changed files: ${report.changedFiles.length}`,
    `Changed symbols: ${report.changedSymbols.length}`,
    `Impacted symbols: ${report.impactedSymbols.length}`,
    `Impacted files: ${report.impactedFiles.length}`,
    `Likely tests: ${report.likelyTests.length}`,
    `Freshness: ${report.freshness.status}`,
    `Confidence: ${report.confidence}`,
    `Truncated: ${report.truncated ? "yes" : "no"}`,
    "",
    "## Changed Files",
    renderPathList(report.changedFiles),
    "",
    "## Changed Symbols",
    renderSymbolList(report.changedSymbols),
    "",
    "## Impacted Symbols",
    renderSymbolList(report.impactedSymbols),
    "",
    "## Impacted Files",
    renderPathList(report.impactedFiles),
    "",
    "## Likely Tests",
    renderPathList(report.likelyTests),
    "",
    "## Related CMAP Modules",
    renderPathList(report.relatedModules.map((module) => `${module.module} (${module.confidence}) - ${module.reason}`)),
    "",
    "## Risk Factors",
    renderPathList(report.riskFactors.map((risk) => `${risk.kind}: ${risk.reason}`)),
    ""
  ].join("\n");
}

export function renderImpactSymbolMarkdown(report: SourceImpactSymbolReport): string {
  return [
    "# Symbol Impact",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Status: ${report.status}`,
    `Query: ${report.query.symbol}`,
    `Advisory: ${report.advisory}`,
    `Freshness: ${report.freshness.status}`,
    `Confidence: ${report.confidence}`,
    `Truncated: ${report.truncated ? "yes" : "no"}`,
    "",
    "## Symbol",
    report.symbol ? `- ${symbolLine(report.symbol)}` : "- None",
    "",
    "## Ambiguity Candidates",
    renderSymbolList(report.ambiguityCandidates),
    "",
    "## Callers",
    renderSymbolList(report.callers),
    "",
    "## Callees",
    renderSymbolList(report.callees),
    "",
    "## Impacted Files",
    renderPathList(report.impactedFiles),
    "",
    "## Likely Tests",
    renderPathList(report.likelyTests),
    ""
  ].join("\n");
}

async function gitChangedFiles(cwd: string, options: SourceImpactDiffOptions): Promise<string[]> {
  const args = options.staged
    ? ["diff", "--name-only", "--cached"]
    : options.base
      ? ["diff", "--name-only", options.base]
      : ["diff", "--name-only"];
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, encoding: "utf8" });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CmapCommandError(`Unable to read git diff files: ${message}`, 2);
  }
}

function normalizeSourceFiles(cwd: string, files: string[]): string[] {
  return sortedUnique(files
    .map((file) => toProjectRelative(cwd, assertInsideProject(cwd, path.isAbsolute(file) ? file : path.join(cwd, file))))
    .filter((file) => isSourceFileExtension(path.extname(file))));
}

function querySource(options: SourceImpactDiffOptions): SourceImpactDiffReport["query"]["source"] {
  if (options.files?.length) {
    return "files";
  }
  if (options.staged) {
    return "staged";
  }
  return options.base ? "base" : "worktree";
}

function combinedConfidence(
  reports: SourceImpactReport[],
  freshness: SourceFreshnessSummary
): SourceImpactConfidence {
  if (reports.length === 0 || freshness.status === "missing" || freshness.status === "error" || reports.some((report) => report.confidence === "low")) {
    return "low";
  }
  if (freshness.status === "stale") {
    return "medium";
  }
  return "high";
}

function combinedFreshness(
  reports: SourceImpactReport[],
  fallback: SourceFreshnessSummary
): SourceFreshnessSummary["status"] {
  if (reports.length === 0) {
    return fallback.status;
  }
  if (reports.some((report) => report.freshness.status === "error")) {
    return "error";
  }
  if (reports.some((report) => report.freshness.status === "missing")) {
    return "missing";
  }
  if (reports.some((report) => report.freshness.status === "stale")) {
    return "stale";
  }
  return "fresh";
}

function unresolvedSymbolReport(
  query: string,
  status: "ambiguous" | "missing",
  candidates: SourceSymbolRef[],
  freshness: SourceFreshnessSummary,
  riskFactors: SourceImpactRiskFactor[]
): SourceImpactSymbolReport {
  return {
    version: 1,
    generated: true,
    canonical: false,
    label,
    advisory: "Generated advisory only; no canonical .context facts were changed.",
    status,
    query: {
      kind: "symbol",
      symbol: query,
      matched: false
    },
    ambiguityCandidates: candidates,
    callers: [],
    callees: [],
    changedFiles: [],
    changedSymbols: [],
    impactedSymbols: [],
    impactedFiles: [],
    likelyTests: [],
    relatedModules: [],
    riskFactors,
    confidence: "low",
    freshness,
    truncated: false,
    omitted: {
      callers: 0,
      callees: 0,
      symbols: 0,
      files: 0,
      tests: 0,
      edges: 0
    },
    nextCommands: [
      "cmap source index",
      "cmap symbol find <query>"
    ]
  };
}

function mergeRelatedModules(modules: SourceImpactRelatedModule[]): SourceImpactRelatedModule[] {
  const byModule = new Map<string, SourceImpactRelatedModule>();
  for (const module of modules) {
    const current = byModule.get(module.module);
    if (!current) {
      byModule.set(module.module, { ...module, files: sortedUnique(module.files) });
      continue;
    }
    current.files = sortedUnique([...current.files, ...module.files]);
    current.confidence = strongerConfidence(current.confidence, module.confidence);
    current.reason = current.reason === module.reason ? current.reason : `${current.reason}; ${module.reason}`;
  }
  return [...byModule.values()].sort((left, right) => left.module.localeCompare(right.module));
}

function strongerConfidence(
  left: SourceImpactConfidence,
  right: SourceImpactConfidence
): SourceImpactConfidence {
  const rank: Record<SourceImpactConfidence, number> = { low: 1, medium: 2, high: 3 };
  return rank[right] > rank[left] ? right : left;
}

function dedupeRiskFactors(risks: SourceImpactRiskFactor[]): SourceImpactRiskFactor[] {
  const byKey = new Map<string, SourceImpactRiskFactor>();
  for (const risk of risks) {
    const key = `${risk.kind}:${risk.reason}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { ...risk, evidence: sortedUnique(risk.evidence) });
      continue;
    }
    current.evidence = sortedUnique([...current.evidence, ...risk.evidence]);
  }
  return [...byKey.values()].sort((left, right) => left.kind.localeCompare(right.kind));
}

function symbolRef(symbol: SourceSymbol, confidence?: number, reason?: string): SourceSymbolRef {
  return {
    id: symbol.id,
    kind: symbol.kind,
    name: symbol.name,
    qualifiedName: symbol.qualifiedName,
    filePath: symbol.filePath,
    lineStart: symbol.lineStart,
    lineEnd: symbol.lineEnd,
    exported: symbol.exported,
    confidence,
    reason
  };
}

function uniqueSymbols(symbols: SourceSymbolRef[]): SourceSymbolRef[] {
  const byId = new Map<string, SourceSymbolRef>();
  for (const symbol of symbols) {
    const current = byId.get(symbol.id);
    if (!current || (current.confidence ?? 0) < (symbol.confidence ?? 0)) {
      byId.set(symbol.id, symbol);
    }
  }
  return [...byId.values()];
}

function sortedSymbols(symbols: SourceSymbolRef[]): SourceSymbolRef[] {
  return symbols.sort((left, right) =>
    left.filePath.localeCompare(right.filePath) ||
    left.lineStart - right.lineStart ||
    left.qualifiedName.localeCompare(right.qualifiedName)
  );
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function renderSymbolList(symbols: SourceSymbolRef[]): string {
  return symbols.length === 0 ? "- None" : symbols.map((symbol) => `- ${symbolLine(symbol)}`).join("\n");
}

function symbolLine(symbol: SourceSymbolRef): string {
  return `${symbol.kind} \`${symbol.qualifiedName || symbol.name}\` (${symbol.filePath}:${symbol.lineStart})`;
}

function renderPathList(items: string[]): string {
  return items.length === 0 ? "- None" : items.map((item) => `- \`${item}\``).join("\n");
}

function shellQuote(value: string): string {
  return value.includes(" ") ? JSON.stringify(value) : value;
}
