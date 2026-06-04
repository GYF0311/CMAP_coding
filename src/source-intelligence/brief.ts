import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { computeSourceIndexMetrics } from "./metrics.js";
import { writeSourceQueryMetric } from "./metrics.js";
import { currentSourceFileStates } from "./freshness.js";
import { summarizeSourceFreshness } from "./impact.js";
import { assertInsideProject, isCanonicalContextPath, toProjectRelative } from "./guards.js";
import { readSourceIndex } from "./store.js";
import type { SourceEvidenceRecord } from "./evidence.js";
import type { SourceIndex, SourceSymbol } from "./schema.js";

const DEFAULT_SOURCE_BUDGET_TOKENS = 700;
const MIN_SOURCE_SNIPPET_BODY_BUDGET_TOKENS = 30;
const MAX_RECENT_RECORDS = 5;
const MAX_SNIPPETS = 4;
const MAX_LINES_PER_SNIPPET = 10;

export type SourceBriefOptions = {
  task: string;
  sourceBudget?: string | number;
  sourceTarget?: string;
};

export type RecentSourceEvidenceResult = {
  records: SourceEvidenceRecord[];
  omitted: number;
  unreadable: string[];
};

type Snippet = {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  body: string;
  freshness: string;
  truncated: boolean;
};

export async function buildSourceEvidenceBrief(cwd: string, options: SourceBriefOptions): Promise<string> {
  const budgetTokens = parseSourceBudget(options.sourceBudget);
  const effectiveSnippetBodyBudgetTokens = Math.max(budgetTokens, MIN_SOURCE_SNIPPET_BODY_BUDGET_TOKENS);
  const index = await readSourceIndex(cwd);
  const recent = await readRecentSourceEvidenceRecords(cwd, { limit: MAX_RECENT_RECORDS });
  if (!index) {
    return renderMissingIndexBrief({ budgetTokens, effectiveSnippetBodyBudgetTokens, recent });
  }

  const currentFiles = await currentSourceFileStates(cwd, index);
  const freshness = summarizeSourceFreshness(index, { cwd, currentFiles });
  const metrics = computeSourceIndexMetrics(index);
  const selectedFiles = selectSourceFiles(index, options, recent.records);
  const snippets = await buildSnippets(cwd, index, selectedFiles, freshness.staleFiles, effectiveSnippetBodyBudgetTokens);
  const truncated = snippets.some((snippet) => snippet.truncated)
    || selectedFiles.length > snippets.length
    || recent.omitted > 0;
  const baselineTokens = estimateBaselineTokens(index, selectedFiles);
  const evidenceTokens = estimateTokens(renderSnippetsOnly(snippets));
  const savedTokens = Math.max(0, baselineTokens - evidenceTokens);
  const savedPercent = baselineTokens > 0 ? Math.round((savedTokens / baselineTokens) * 100) : 0;
  await writeSourceQueryMetric(cwd, {
    command: "brief source-evidence",
    query: options.sourceTarget ?? options.task,
    status: freshness.status,
    indexMetrics: metrics,
    queryMetrics: {
      budgetTokens,
      effectiveSnippetBodyBudgetTokens,
      selectedFiles: selectedFiles.length,
      snippets: snippets.length,
      baselineTokens,
      evidenceTokens,
      savedTokens,
      savedPercent,
      truncated
    }
  });

  const lines = [
    "## Generated Source Evidence",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Label: generated=true; canonical=false; freshness=${freshness.status}; truncated=${truncated ? "yes" : "no"}`,
    `Requested source budget: ${budgetTokens} tokens`,
    `Effective snippet body budget: ${effectiveSnippetBodyBudgetTokens} tokens`,
    "Budget note: source budget bounds snippet body text; headings, labels, and freshness metadata are rendered outside that snippet body budget.",
    `Index generated at: ${freshness.indexedAt ?? index.meta.generatedAt}`,
    `Git head: ${freshness.gitHead ?? "Not available"}`,
    `Metrics: files=${metrics.files}, testFiles=${metrics.testFiles}, symbols=${metrics.symbols}, edges=${metrics.edges}, unresolvedRefs=${metrics.unresolvedRefs}, parseErrors=${metrics.parseErrors}`,
    "",
    "### Freshness",
    "",
    `Status: ${freshness.status}`,
    `Counts: fresh=${freshness.counts.fresh}, stale=${freshness.counts.stale}, missing=${freshness.counts.missing}, error=${freshness.counts.error}`,
    `Stale files: ${freshness.staleFiles.length > 0 ? freshness.staleFiles.map((file) => `\`${file}\``).join(", ") : "None"}`,
    `Missing files: ${freshness.missingFiles.length > 0 ? freshness.missingFiles.map((file) => `\`${file}\``).join(", ") : "None"}`,
    "",
    "### Context Savings Estimate",
    "",
    `estimated: true; baselineTokens=${baselineTokens}; evidenceTokens=${evidenceTokens}; savedTokens=${savedTokens}; savedPercent=${savedPercent}%`,
    "",
    "### Recent Source Evidence Records",
    "",
    renderRecentRecords(recent),
    "",
    "### Budgeted Snippets",
    "",
    renderSnippets(snippets),
    "",
    "### Omitted / Notes",
    "",
    `- Omitted source files: ${Math.max(0, selectedFiles.length - snippets.length)}`,
    `- Omitted recent records: ${recent.omitted}`,
    `- Unreadable source evidence records: ${recent.unreadable.length}`,
    "- Source evidence appears after reviewed route/module context by design."
  ];

  if (freshness.status !== "fresh") {
    lines.push("- Freshness is not fresh; inspect affected files directly before relying on this evidence.");
  }

  return lines.join("\n");
}

export async function readRecentSourceEvidenceRecords(
  cwd: string,
  options: { limit?: number } = {}
): Promise<RecentSourceEvidenceResult> {
  const evidenceRoot = path.join(cwd, ".context", "generated", "source-index", "evidence");
  if (!(await fileExists(evidenceRoot))) {
    return { records: [], omitted: 0, unreadable: [] };
  }

  const entries = (await readdir(evidenceRoot))
    .filter((entry) => entry.endsWith(".json"))
    .sort();
  const records: SourceEvidenceRecord[] = [];
  const unreadable: string[] = [];
  for (const entry of entries) {
    const target = path.join(evidenceRoot, entry);
    try {
      const parsed = JSON.parse(await readFile(target, "utf8")) as Partial<SourceEvidenceRecord>;
      if (isSourceEvidenceRecord(parsed)) {
        records.push(parsed);
      } else {
        unreadable.push(`.context/generated/source-index/evidence/${entry}`);
      }
    } catch {
      unreadable.push(`.context/generated/source-index/evidence/${entry}`);
    }
  }

  const limit = options.limit ?? MAX_RECENT_RECORDS;
  const sorted = records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    records: sorted.slice(0, limit),
    omitted: Math.max(0, sorted.length - limit),
    unreadable
  };
}

function renderMissingIndexBrief(input: { budgetTokens: number; effectiveSnippetBodyBudgetTokens: number; recent: RecentSourceEvidenceResult }): string {
  return [
    "## Generated Source Evidence",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    "Label: generated=true; canonical=false; freshness=missing; truncated=no",
    `Requested source budget: ${input.budgetTokens} tokens`,
    `Effective snippet body budget: ${input.effectiveSnippetBodyBudgetTokens} tokens`,
    "Budget note: source budget bounds snippet body text; headings, labels, and freshness metadata are rendered outside that snippet body budget.",
    "Source index: Not available. Run `cmap source index` before relying on source evidence.",
    "",
    "### Recent Source Evidence Records",
    "",
    renderRecentRecords(input.recent),
    "",
    "### Omitted / Notes",
    "",
    `- Omitted recent records: ${input.recent.omitted}`,
    `- Unreadable source evidence records: ${input.recent.unreadable.length}`
  ].join("\n");
}

function selectSourceFiles(
  index: SourceIndex,
  options: SourceBriefOptions,
  records: SourceEvidenceRecord[]
): string[] {
  const candidates: string[] = [];
  const target = normalizeNeedle(options.sourceTarget ?? "");
  const taskTerms = tokenTerms(options.task);

  for (const record of records) {
    candidates.push(...record.files);
  }

  if (target) {
    candidates.push(...index.files.filter((file) => matchesNeedle(file.path, target)).map((file) => file.path));
    candidates.push(...index.symbols.filter((symbol) => matchesSymbol(symbol, target)).map((symbol) => symbol.filePath));
  }

  for (const term of taskTerms) {
    candidates.push(...index.files.filter((file) => matchesNeedle(file.path, term)).map((file) => file.path));
    candidates.push(...index.symbols.filter((symbol) => matchesSymbol(symbol, term)).map((symbol) => symbol.filePath));
  }

  if (candidates.length === 0) {
    candidates.push(...index.files.slice(0, MAX_SNIPPETS).map((file) => file.path));
  }

  const indexed = new Set(index.files.map((file) => file.path));
  return [...new Set(candidates)]
    .filter((filePath) => indexed.has(filePath))
    .filter((filePath) => !isCanonicalContextPath(filePath))
    .slice(0, MAX_SNIPPETS + 3);
}

async function buildSnippets(
  cwd: string,
  index: SourceIndex,
  filePaths: string[],
  staleFiles: string[],
  budgetTokens: number
): Promise<Snippet[]> {
  const snippets: Snippet[] = [];
  let remainingChars = Math.max(120, budgetTokens * 4);
  const stale = new Set(staleFiles);
  for (const filePath of filePaths) {
    if (snippets.length >= MAX_SNIPPETS || remainingChars <= 0) {
      break;
    }
    const snippet = await buildSnippet(cwd, index, filePath, stale.has(filePath), remainingChars);
    if (!snippet) {
      continue;
    }
    remainingChars -= snippet.body.length;
    snippets.push(snippet);
  }
  return snippets;
}

async function buildSnippet(
  cwd: string,
  index: SourceIndex,
  filePath: string,
  isStale: boolean,
  maxChars: number
): Promise<Snippet | undefined> {
  try {
    const absolute = assertInsideProject(cwd, filePath);
    const relative = toProjectRelative(cwd, absolute);
    if (relative !== filePath || isCanonicalContextPath(relative)) {
      return undefined;
    }
    const raw = await readFile(absolute, "utf8");
    const lines = raw.split(/\r?\n/);
    const anchor = snippetAnchorLine(index, filePath);
    const lineStart = Math.max(1, anchor - 2);
    const lineEnd = Math.min(lines.length, lineStart + MAX_LINES_PER_SNIPPET - 1);
    const selected = lines
      .slice(lineStart - 1, lineEnd)
      .map((line, offset) => `${String(lineStart + offset).padStart(4, " ")} | ${line}`)
      .join("\n");
    const redacted = redact(selected);
    const truncated = redacted.length > maxChars;
    const body = truncated ? `${redacted.slice(0, Math.max(0, maxChars - 24))}\n... [truncated]` : redacted;
    return {
      filePath,
      lineStart,
      lineEnd,
      body,
      freshness: isStale ? "stale" : "fresh-or-index-only",
      truncated
    };
  } catch {
    return undefined;
  }
}

function snippetAnchorLine(index: SourceIndex, filePath: string): number {
  const symbol = index.symbols
    .filter((candidate) => candidate.filePath === filePath && candidate.kind !== "File")
    .sort((left, right) => left.lineStart - right.lineStart)[0];
  return symbol?.lineStart ?? 1;
}

function renderRecentRecords(input: RecentSourceEvidenceResult): string {
  if (input.records.length === 0) {
    return "- None";
  }
  return input.records.map((record) =>
    `- ${record.kind} \`${record.id}\` (${record.createdAt}) - ${record.summary}; freshness=${record.freshnessStatus}; confidence=${record.confidence}; truncated=${record.truncated ? "yes" : "no"}; files=${record.files.slice(0, 5).map((file) => `\`${file}\``).join(", ") || "None"}`
  ).join("\n");
}

function renderSnippets(snippets: Snippet[]): string {
  if (snippets.length === 0) {
    return "- None";
  }
  return snippets.map((snippet) => [
    `#### \`${snippet.filePath}:${snippet.lineStart}-${snippet.lineEnd}\``,
    "",
    `Freshness: ${snippet.freshness}; generated=true; canonical=false; truncated=${snippet.truncated ? "yes" : "no"}`,
    "",
    "```ts",
    snippet.body,
    "```"
  ].join("\n")).join("\n\n");
}

function renderSnippetsOnly(snippets: Snippet[]): string {
  return snippets.map((snippet) => snippet.body).join("\n");
}

function estimateBaselineTokens(index: SourceIndex, filePaths: string[]): number {
  const fileByPath = new Map(index.files.map((file) => [file.path, file]));
  const bytes = filePaths.reduce((total, filePath) => total + (fileByPath.get(filePath)?.size ?? 0), 0);
  return Math.ceil(bytes / 4);
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function parseSourceBudget(value: string | number | undefined): number {
  if (value === undefined || value === "") {
    return DEFAULT_SOURCE_BUDGET_TOKENS;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CmapCommandError(`Invalid --source-budget "${value}". Expected a positive integer.`, 2);
  }
  return parsed;
}

function tokenTerms(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9_./-]+/).filter((term) => term.length >= 3))].slice(0, 8);
}

function normalizeNeedle(value: string): string {
  return value.trim().toLowerCase();
}

function matchesNeedle(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle);
}

function matchesSymbol(symbol: SourceSymbol, needle: string): boolean {
  return matchesNeedle(symbol.name, needle)
    || matchesNeedle(symbol.qualifiedName, needle)
    || matchesNeedle(symbol.filePath, needle);
}

function isSourceEvidenceRecord(value: Partial<SourceEvidenceRecord>): value is SourceEvidenceRecord {
  return value.version === 1
    && typeof value.id === "string"
    && typeof value.createdAt === "string"
    && typeof value.kind === "string"
    && value.generated === true
    && value.canonical === false
    && typeof value.summary === "string"
    && Array.isArray(value.files)
    && typeof value.confidence === "number"
    && typeof value.freshnessStatus === "string"
    && typeof value.truncated === "boolean";
}

function redact(value: string): string {
  return value
    .replace(
      /\b(api[_-]?key|token|secret|password|authorization|client[_-]?secret|access[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|x[_-]api[_-]?key)(\s*[:=]\s*)(["']?)[^\s"'`<>&]+/gi,
      "$1$2[REDACTED]"
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g, "Bearer [REDACTED]")
    .replace(/-----BEGIN[^-\n]+PRIVATE KEY-----[\s\S]*?-----END[^-\n]+PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]");
}
