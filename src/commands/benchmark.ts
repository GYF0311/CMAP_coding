import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { CmapCommandError } from "../errors.js";
import { resolveInsideRoot } from "../fs/safe-path.js";
import { currentSourceFileStates } from "../source-intelligence/freshness.js";
import { impactFileWithProjectModules, summarizeSourceFreshness } from "../source-intelligence/impact.js";
import { findSymbols } from "../source-intelligence/queries.js";
import { readSourceIndex } from "../source-intelligence/store.js";
import type { CurrentSourceFileState, SourceFreshnessSummary } from "../source-intelligence/impact.js";
import type { SourceIndex } from "../source-intelligence/schema.js";
import { routeTask } from "./route.js";

type BenchmarkRouteOptions = {
  file?: string;
  minTop1?: string;
  minTop3?: string;
  minContext?: string;
  maxBad?: string;
};

type RouteBenchmarkCase = {
  task: string;
  expected_modules: string[];
  bad_modules?: string[];
  expected_context_modules?: string[];
};

type BenchmarkSourceIntelligenceOptions = {
  file?: string;
  json?: boolean;
  minPrecision?: string;
  minRecall?: string;
  minF1?: string;
};

type SourceIntelligenceBenchmarkCase = {
  task: string;
  query: string;
  expected_files: string[];
  expected_symbols: string[];
};

type Score = {
  expected: number;
  predicted: number;
  truePositive: number;
  precision: number;
  recall: number;
  f1: number;
  missing: string[];
  extra: string[];
};

type SourceBenchmarkResult = {
  caseNumber: number;
  task: string;
  query: string;
  predictedFiles: string[];
  predictedSymbols: string[];
  expectedFiles: string[];
  expectedSymbols: string[];
  fileScore: Score;
  symbolScore: Score;
  combinedScore: Score;
  freshness: SourceFreshnessSummary;
  tokenProxy: {
    baselineTokens: number;
    evidenceTokens: number;
    savedTokens: number;
    savedPercent: number;
  };
  toolCallProxy: {
    baselineToolCalls: number;
    sourceToolCalls: number;
    savedToolCalls: number;
  };
};

export async function runBenchmarkRoute(cwd: string, options: BenchmarkRouteOptions): Promise<number> {
  const filePath = await resolveInsideRoot(cwd, options.file || "bench/tasks.jsonl");
  const cases = parseCases(await readFile(filePath, "utf8"));
  if (cases.length === 0) {
    throw new CmapCommandError("Benchmark file has no valid cases");
  }

  let top1Hits = 0;
  let top3Hits = 0;
  let badHits = 0;
  let contextHits = 0;
  let contextChecked = 0;
  const thresholds = parseThresholds(options);
  const lines = ["# Route Benchmark", "", `Cases: ${cases.length}`, ""];

  for (const [index, item] of cases.entries()) {
    const route = await routeTask(cwd, item.task);
    const top = route.modules.slice(0, 3).map((module) => module.id);
    const context = route.contextModules.map((module) => module.id);
    const top1 = top[0];
    const top1Hit = Boolean(top1 && item.expected_modules.includes(top1));
    const top3Hit = top.some((module) => item.expected_modules.includes(module));
    const badHit = (item.bad_modules ?? []).some((module) => top.includes(module));
    const expectedContext = item.expected_context_modules ?? [];
    const contextResult = expectedContext.length === 0
      ? "unchecked"
      : expectedContext.every((module) => context.includes(module))
        ? "hit"
        : "miss";
    top1Hits += top1Hit ? 1 : 0;
    top3Hits += top3Hit ? 1 : 0;
    badHits += badHit ? 1 : 0;
    if (expectedContext.length > 0) {
      contextChecked += 1;
      contextHits += contextResult === "hit" ? 1 : 0;
    }

    lines.push(`${index + 1}. ${item.task}`);
    lines.push(`   expected: ${item.expected_modules.join(", ")}`);
    lines.push(`   top3: ${top.length ? top.join(", ") : "(none)"}`);
    if (expectedContext.length > 0) {
      lines.push(`   expected context: ${expectedContext.join(", ")}`);
      lines.push(`   context: ${context.length ? context.join(", ") : "(none)"}`);
    }
    lines.push(`   result: top1=${top1Hit ? "hit" : "miss"}, top3=${top3Hit ? "hit" : "miss"}, bad=${badHit ? "yes" : "no"}, context=${contextResult}`);
  }

  const top1Percent = percentNumber(top1Hits, cases.length);
  const top3Percent = percentNumber(top3Hits, cases.length);
  const badPercent = percentNumber(badHits, cases.length);
  const contextPercent = contextChecked === 0 ? undefined : percentNumber(contextHits, contextChecked);
  const thresholdFailures = thresholdFailureLines({
    top1Percent,
    top3Percent,
    badPercent,
    contextPercent,
    contextChecked,
    thresholds
  });

  lines.push(
    "",
    "## Summary",
    "",
    `Top-1: ${top1Hits}/${cases.length} (${formatPercent(top1Percent)})`,
    `Top-3: ${top3Hits}/${cases.length} (${formatPercent(top3Percent)})`,
    `Bad-module hits: ${badHits}/${cases.length} (${formatPercent(badPercent)})`,
    `Context: ${contextHits}/${contextChecked} (${contextPercent === undefined ? "n/a" : formatPercent(contextPercent)})`,
    ""
  );
  if (thresholdFailures.length > 0) {
    lines.push("Threshold failures:");
    for (const failure of thresholdFailures) {
      lines.push(`- ${failure}`);
    }
    lines.push("");
  }

  process.stdout.write(lines.join("\n"));
  return badHits > 0 || thresholdFailures.length > 0 ? 1 : 0;
}

export async function runBenchmarkSourceIntelligence(cwd: string, options: BenchmarkSourceIntelligenceOptions = {}): Promise<number> {
  const filePath = await resolveInsideRoot(cwd, options.file || "bench/source-intelligence.jsonl");
  const cases = parseSourceIntelligenceCases(await readFile(filePath, "utf8"));
  if (cases.length === 0) {
    throw new CmapCommandError("Source intelligence benchmark file has no valid cases");
  }

  const index = await readSourceIndex(cwd);
  if (!index) {
    throw new CmapCommandError("Generated source index not found. Run `cmap source index` first.", 2);
  }

  const canonicalBefore = await readCanonicalContextSnapshot(cwd);
  const currentFiles = await currentSourceFileStates(cwd, index);
  const results: SourceBenchmarkResult[] = [];

  for (const [indexInFile, item] of cases.entries()) {
    results.push(await evaluateSourceIntelligenceCase(cwd, index, currentFiles, item, indexInFile + 1));
  }

  const canonicalAfter = await readCanonicalContextSnapshot(cwd);
  const canonicalChanges = changedCanonicalFiles(canonicalBefore, canonicalAfter);
  const summary = summarizeSourceBenchmark(results);
  const thresholds = parseSourceBenchmarkThresholds(options);
  const thresholdFailures = sourceBenchmarkThresholdFailures(summary, thresholds);

  const payload = {
    generated: true,
    canonical: false,
    label: "generated source evidence; non-canonical",
    cases: results,
    summary: {
      ...summary,
      falseCanonicalWrites: canonicalChanges.length,
      falseCanonicalWriteFiles: canonicalChanges,
      thresholdFailures
    }
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(renderSourceBenchmarkMarkdown(payload));
  }

  return canonicalChanges.length > 0 || thresholdFailures.length > 0 ? 1 : 0;
}

function parseCases(raw: string): RouteBenchmarkCase[] {
  const cases: RouteBenchmarkCase[] = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parsed = JSON.parse(trimmed) as Partial<RouteBenchmarkCase>;
    if (typeof parsed.task !== "string" || !Array.isArray(parsed.expected_modules)) {
      throw new CmapCommandError(`Invalid route benchmark case on line ${index + 1}`);
    }
    cases.push({
      task: parsed.task,
      expected_modules: parsed.expected_modules.filter((item): item is string => typeof item === "string"),
      bad_modules: Array.isArray(parsed.bad_modules)
        ? parsed.bad_modules.filter((item): item is string => typeof item === "string")
        : [],
      expected_context_modules: Array.isArray(parsed.expected_context_modules)
        ? parsed.expected_context_modules.filter((item): item is string => typeof item === "string")
        : []
    });
  }
  return cases;
}

function parseSourceIntelligenceCases(raw: string): SourceIntelligenceBenchmarkCase[] {
  const cases: SourceIntelligenceBenchmarkCase[] = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parsed = JSON.parse(trimmed) as Partial<{
      task: unknown;
      query: unknown;
      expected_files: unknown;
      expected_symbols: unknown;
    }>;
    const expectedFiles = Array.isArray(parsed.expected_files)
      ? parsed.expected_files.filter((item): item is string => typeof item === "string")
      : [];
    const expectedSymbols = Array.isArray(parsed.expected_symbols)
      ? parsed.expected_symbols.filter((item): item is string => typeof item === "string")
      : [];
    if (typeof parsed.task !== "string" || typeof parsed.query !== "string" || (expectedFiles.length === 0 && expectedSymbols.length === 0)) {
      throw new CmapCommandError(`Invalid source intelligence benchmark case on line ${index + 1}`);
    }
    cases.push({
      task: parsed.task,
      query: parsed.query,
      expected_files: expectedFiles,
      expected_symbols: expectedSymbols
    });
  }
  return cases;
}

async function evaluateSourceIntelligenceCase(
  cwd: string,
  index: SourceIndex,
  currentFiles: CurrentSourceFileState[],
  item: SourceIntelligenceBenchmarkCase,
  caseNumber: number
): Promise<SourceBenchmarkResult> {
  const freshness = summarizeSourceFreshness(index, { cwd, currentFiles });
  const predictedSymbols = item.expected_symbols.length > 0
    ? uniqueSorted(findSymbols(index, { query: item.query, limit: 20 }).map((symbol) => symbol.qualifiedName))
    : [];
  const predictedFiles = item.expected_files.length > 0
    ? await predictSourceBenchmarkFiles(cwd, index, currentFiles, item.query)
    : [];
  const fileScore = scoreExpected(item.expected_files, predictedFiles);
  const symbolScore = scoreExpected(item.expected_symbols, predictedSymbols);
  const combinedScore = combineScores([fileScore, symbolScore]);
  const tokenProxy = buildTokenProxy(index, item, predictedFiles, predictedSymbols, freshness.status);
  const toolCallProxy = buildToolCallProxy(index, item, predictedFiles, predictedSymbols);

  return {
    caseNumber,
    task: item.task,
    query: item.query,
    predictedFiles,
    predictedSymbols,
    expectedFiles: item.expected_files,
    expectedSymbols: item.expected_symbols,
    fileScore,
    symbolScore,
    combinedScore,
    freshness,
    tokenProxy,
    toolCallProxy
  };
}

async function predictSourceBenchmarkFiles(
  cwd: string,
  index: SourceIndex,
  currentFiles: CurrentSourceFileState[],
  query: string
): Promise<string[]> {
  const normalizedQuery = query.split(path.sep).join("/");
  if (index.files.some((file) => file.path === normalizedQuery)) {
    const report = await impactFileWithProjectModules(cwd, index, normalizedQuery, {
      currentFiles,
      maxResults: 100
    });
    return uniqueSorted([
      ...report.changedFiles,
      ...report.impactedFiles,
      ...report.likelyTests
    ]);
  }

  return uniqueSorted(findSymbols(index, { query, limit: 20 }).map((symbol) => symbol.filePath));
}

function scoreExpected(expected: string[], predicted: string[]): Score {
  if (expected.length === 0) {
    return {
      expected: 0,
      predicted: 0,
      truePositive: 0,
      precision: 100,
      recall: 100,
      f1: 100,
      missing: [],
      extra: []
    };
  }

  const expectedSet = new Set(expected);
  const predictedSet = new Set(predicted);
  const truePositive = [...predictedSet].filter((item) => expectedSet.has(item)).length;
  const precision = predictedSet.size === 0 ? 0 : percentNumber(truePositive, predictedSet.size);
  const recall = percentNumber(truePositive, expectedSet.size);
  return {
    expected: expectedSet.size,
    predicted: predictedSet.size,
    truePositive,
    precision,
    recall,
    f1: f1Percent(precision, recall),
    missing: [...expectedSet].filter((item) => !predictedSet.has(item)).sort(),
    extra: [...predictedSet].filter((item) => !expectedSet.has(item)).sort()
  };
}

function combineScores(scores: Score[]): Score {
  const expected = scores.reduce((total, score) => total + score.expected, 0);
  const predicted = scores.reduce((total, score) => total + score.predicted, 0);
  const truePositive = scores.reduce((total, score) => total + score.truePositive, 0);
  const precision = predicted === 0 ? 0 : percentNumber(truePositive, predicted);
  const recall = expected === 0 ? 0 : percentNumber(truePositive, expected);
  return {
    expected,
    predicted,
    truePositive,
    precision,
    recall,
    f1: f1Percent(precision, recall),
    missing: scores.flatMap((score) => score.missing).sort(),
    extra: scores.flatMap((score) => score.extra).sort()
  };
}

function f1Percent(precision: number, recall: number): number {
  return precision + recall === 0 ? 0 : Math.round((2 * precision * recall) / (precision + recall));
}

function summarizeSourceBenchmark(results: SourceBenchmarkResult[]): {
  precision: number;
  recall: number;
  f1: number;
  expected: number;
  predicted: number;
  truePositive: number;
  baselineTokens: number;
  evidenceTokens: number;
  savedTokens: number;
  savedPercent: number;
  baselineToolCalls: number;
  sourceToolCalls: number;
  savedToolCalls: number;
  staleWarnings: string[];
} {
  const combined = combineScores(results.map((result) => result.combinedScore));
  const baselineTokens = results.reduce((total, result) => total + result.tokenProxy.baselineTokens, 0);
  const evidenceTokens = results.reduce((total, result) => total + result.tokenProxy.evidenceTokens, 0);
  const savedTokens = Math.max(0, baselineTokens - evidenceTokens);
  const baselineToolCalls = results.reduce((total, result) => total + result.toolCallProxy.baselineToolCalls, 0);
  const sourceToolCalls = results.reduce((total, result) => total + result.toolCallProxy.sourceToolCalls, 0);
  return {
    precision: combined.precision,
    recall: combined.recall,
    f1: combined.f1,
    expected: combined.expected,
    predicted: combined.predicted,
    truePositive: combined.truePositive,
    baselineTokens,
    evidenceTokens,
    savedTokens,
    savedPercent: baselineTokens > 0 ? Math.round((savedTokens / baselineTokens) * 100) : 0,
    baselineToolCalls,
    sourceToolCalls,
    savedToolCalls: Math.max(0, baselineToolCalls - sourceToolCalls),
    staleWarnings: uniqueSorted(results.flatMap((result) => result.freshness.staleFiles))
  };
}

function buildTokenProxy(
  index: SourceIndex,
  item: SourceIntelligenceBenchmarkCase,
  predictedFiles: string[],
  predictedSymbols: string[],
  freshnessStatus: string
): SourceBenchmarkResult["tokenProxy"] {
  const baselineFiles = sourceBenchmarkBaselineFiles(index, item, predictedFiles, predictedSymbols);
  const baselineTokens = estimateFileTokens(index, baselineFiles);
  const evidenceTokens = estimateTokens(JSON.stringify({
    task: item.task,
    query: item.query,
    predictedFiles,
    predictedSymbols,
    freshnessStatus
  }));
  const savedTokens = Math.max(0, baselineTokens - evidenceTokens);
  return {
    baselineTokens,
    evidenceTokens,
    savedTokens,
    savedPercent: baselineTokens > 0 ? Math.round((savedTokens / baselineTokens) * 100) : 0
  };
}

function buildToolCallProxy(
  index: SourceIndex,
  item: SourceIntelligenceBenchmarkCase,
  predictedFiles: string[],
  predictedSymbols: string[]
): SourceBenchmarkResult["toolCallProxy"] {
  const baselineFiles = sourceBenchmarkBaselineFiles(index, item, predictedFiles, predictedSymbols);
  const baselineToolCalls = Math.max(1, baselineFiles.length);
  const sourceToolCalls = 1;
  return {
    baselineToolCalls,
    sourceToolCalls,
    savedToolCalls: Math.max(0, baselineToolCalls - sourceToolCalls)
  };
}

function sourceBenchmarkBaselineFiles(
  index: SourceIndex,
  item: SourceIntelligenceBenchmarkCase,
  predictedFiles: string[],
  predictedSymbols: string[]
): string[] {
  const indexedFiles = new Set(index.files.map((file) => file.path));
  const symbolFiles = uniqueSorted([...item.expected_symbols, ...predictedSymbols])
    .map((symbol) => index.symbols.find((candidate) => candidate.qualifiedName === symbol)?.filePath ?? symbol.split("#")[0])
    .filter((filePath) => filePath.length > 0);
  const queryFile = indexedFiles.has(item.query) ? [item.query] : [];
  return uniqueSorted([
    ...item.expected_files,
    ...predictedFiles,
    ...symbolFiles,
    ...queryFile
  ]).filter((filePath) => indexedFiles.has(filePath));
}

function estimateFileTokens(index: SourceIndex, filePaths: string[]): number {
  const fileByPath = new Map(index.files.map((file) => [file.path, file]));
  const bytes = filePaths.reduce((total, filePath) => total + (fileByPath.get(filePath)?.size ?? 0), 0);
  return Math.ceil(bytes / 4);
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

async function readCanonicalContextSnapshot(cwd: string): Promise<Record<string, string>> {
  const fixed = [
    ".context/MAP.md",
    ".context/CHECKPOINT.md",
    ".context/STATUS.md",
    ".context/DECISIONS.md",
    ".context/VERIFY.md"
  ];
  const moduleFiles = await collectRelativeFiles(path.join(cwd, ".context", "modules"), ".context/modules");
  const snapshot: Record<string, string> = {};
  for (const relativePath of [...fixed, ...moduleFiles].sort()) {
    const content = await readOptionalFile(path.join(cwd, relativePath));
    if (content !== undefined) {
      snapshot[relativePath] = content;
    }
  }
  return snapshot;
}

async function collectRelativeFiles(root: string, relativeRoot: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(relativeRoot, entry.name);
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectRelativeFiles(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function changedCanonicalFiles(before: Record<string, string>, after: Record<string, string>): string[] {
  const files = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...files].filter((file) => before[file] !== after[file]).sort();
}

function parseSourceBenchmarkThresholds(options: BenchmarkSourceIntelligenceOptions): { minPrecision?: number; minRecall?: number; minF1?: number } {
  return {
    minPrecision: parseOptionalPercent(options.minPrecision, "--min-precision"),
    minRecall: parseOptionalPercent(options.minRecall, "--min-recall"),
    minF1: parseOptionalPercent(options.minF1, "--min-f1")
  };
}

function sourceBenchmarkThresholdFailures(
  summary: { precision: number; recall: number; f1: number },
  thresholds: { minPrecision?: number; minRecall?: number; minF1?: number }
): string[] {
  const failures: string[] = [];
  if (thresholds.minPrecision !== undefined && summary.precision < thresholds.minPrecision) {
    failures.push(`Precision below ${thresholds.minPrecision}% (${summary.precision}%)`);
  }
  if (thresholds.minRecall !== undefined && summary.recall < thresholds.minRecall) {
    failures.push(`Recall below ${thresholds.minRecall}% (${summary.recall}%)`);
  }
  if (thresholds.minF1 !== undefined && summary.f1 < thresholds.minF1) {
    failures.push(`F1 below ${thresholds.minF1}% (${summary.f1}%)`);
  }
  return failures;
}

function renderSourceBenchmarkMarkdown(input: {
  generated: boolean;
  canonical: boolean;
  label: string;
  cases: SourceBenchmarkResult[];
  summary: ReturnType<typeof summarizeSourceBenchmark> & {
    falseCanonicalWrites: number;
    falseCanonicalWriteFiles: string[];
    thresholdFailures: string[];
  };
}): string {
  const lines = [
    "# Source Intelligence Benchmark",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Label: generated=${input.generated}; canonical=${input.canonical}; ${input.label}`,
    `Cases: ${input.cases.length}`,
    ""
  ];

  for (const result of input.cases) {
    lines.push(
      `${result.caseNumber}. ${result.task}`,
      `   query: ${result.query}`,
      `   expected files: ${renderInlineList(result.expectedFiles)}`,
      `   predicted files: ${renderInlineList(result.predictedFiles)}`,
      `   expected symbols: ${renderInlineList(result.expectedSymbols)}`,
      `   predicted symbols: ${renderInlineList(result.predictedSymbols)}`,
      `   result: precision=${formatPercent(result.combinedScore.precision)}, recall=${formatPercent(result.combinedScore.recall)}, f1=${formatPercent(result.combinedScore.f1)}`,
      `   tokenProxy: baselineTokens=${result.tokenProxy.baselineTokens}, evidenceTokens=${result.tokenProxy.evidenceTokens}, savedTokens=${result.tokenProxy.savedTokens}, savedPercent=${result.tokenProxy.savedPercent}%`,
      `   toolCallProxy: baselineToolCalls=${result.toolCallProxy.baselineToolCalls}, sourceToolCalls=${result.toolCallProxy.sourceToolCalls}, savedToolCalls=${result.toolCallProxy.savedToolCalls}`,
      `   freshness: ${result.freshness.status}; staleFiles=${result.freshness.staleFiles.length}`,
      ""
    );
  }

  lines.push(
    "## Summary",
    "",
    `Precision: ${formatPercent(input.summary.precision)} (${input.summary.truePositive}/${input.summary.predicted || 0} predicted)`,
    `Recall: ${formatPercent(input.summary.recall)} (${input.summary.truePositive}/${input.summary.expected} expected)`,
    `F1: ${formatPercent(input.summary.f1)}`,
    `Token proxy: baselineTokens=${input.summary.baselineTokens}, evidenceTokens=${input.summary.evidenceTokens}, savedTokens=${input.summary.savedTokens}, savedPercent=${input.summary.savedPercent}%`,
    `Tool-call proxy: baselineToolCalls=${input.summary.baselineToolCalls}, sourceToolCalls=${input.summary.sourceToolCalls}, savedToolCalls=${input.summary.savedToolCalls}`,
    `False canonical writes: falseCanonicalWrites=${input.summary.falseCanonicalWrites}`,
    `Stale warnings: ${input.summary.staleWarnings.length === 0 ? "None" : input.summary.staleWarnings.map((file) => `\`${file}\``).join(", ")}`,
    ""
  );

  if (input.summary.thresholdFailures.length > 0) {
    lines.push("Threshold failures:");
    for (const failure of input.summary.thresholdFailures) {
      lines.push(`- ${failure}`);
    }
    lines.push("");
  }

  if (input.summary.falseCanonicalWriteFiles.length > 0) {
    lines.push("False canonical write files:");
    for (const file of input.summary.falseCanonicalWriteFiles) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderInlineList(items: string[]): string {
  return items.length === 0 ? "(none)" : items.join(", ");
}

function uniqueSorted(items: string[]): string[] {
  return [...new Set(items)].sort();
}

function percentNumber(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function parseThresholds(options: BenchmarkRouteOptions): { minTop1?: number; minTop3?: number; minContext?: number; maxBad?: number } {
  return {
    minTop1: parseOptionalPercent(options.minTop1, "--min-top1"),
    minTop3: parseOptionalPercent(options.minTop3, "--min-top3"),
    minContext: parseOptionalPercent(options.minContext, "--min-context"),
    maxBad: parseOptionalPercent(options.maxBad, "--max-bad")
  };
}

function parseOptionalPercent(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new CmapCommandError(`Invalid ${flag} "${value}". Expected an integer from 0 to 100.`);
  }
  return parsed;
}

function thresholdFailureLines(input: {
  top1Percent: number;
  top3Percent: number;
  badPercent: number;
  contextPercent?: number;
  contextChecked: number;
  thresholds: { minTop1?: number; minTop3?: number; minContext?: number; maxBad?: number };
}): string[] {
  const failures: string[] = [];
  if (input.thresholds.minTop1 !== undefined && input.top1Percent < input.thresholds.minTop1) {
    failures.push(`Top-1 below ${input.thresholds.minTop1}% (${input.top1Percent}%)`);
  }
  if (input.thresholds.minTop3 !== undefined && input.top3Percent < input.thresholds.minTop3) {
    failures.push(`Top-3 below ${input.thresholds.minTop3}% (${input.top3Percent}%)`);
  }
  if (input.thresholds.maxBad !== undefined && input.badPercent > input.thresholds.maxBad) {
    failures.push(`Bad-module hits above ${input.thresholds.maxBad}% (${input.badPercent}%)`);
  }
  if (input.thresholds.minContext !== undefined) {
    if (input.contextChecked === 0 || input.contextPercent === undefined) {
      failures.push(`Context below ${input.thresholds.minContext}% (unchecked)`);
    } else if (input.contextPercent < input.thresholds.minContext) {
      failures.push(`Context below ${input.thresholds.minContext}% (${input.contextPercent}%)`);
    }
  }
  return failures;
}
