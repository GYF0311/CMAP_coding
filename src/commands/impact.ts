import { readSourceIndex } from "../source-intelligence/store.js";
import { impactFileWithProjectModules } from "../source-intelligence/impact.js";
import { renderSourceImpactMarkdown } from "../source-intelligence/format.js";
import { assertInsideProject, toProjectRelative } from "../source-intelligence/guards.js";
import { buildImpactEvidenceRecord, writeSourceEvidenceRecord } from "../source-intelligence/evidence.js";
import { CmapCommandError } from "../errors.js";
import { currentSourceFileStates } from "../source-intelligence/freshness.js";
import { computeSourceIndexMetrics, writeSourceQueryMetric } from "../source-intelligence/metrics.js";
import {
  impactDiff,
  impactSymbolWithProjectModules,
  renderImpactDiffMarkdown,
  renderImpactSymbolMarkdown
} from "../source-intelligence/diff.js";

type ImpactFileOptions = {
  json?: boolean;
  maxDepth?: string;
  maxResults?: string;
  noWriteEvidence?: boolean;
};

type ImpactDiffOptions = ImpactFileOptions & {
  files?: string;
  base?: string;
  staged?: boolean;
};

export async function runImpactFile(cwd: string, filePath: string, options: ImpactFileOptions = {}): Promise<void> {
  const absoluteTarget = assertInsideProject(cwd, filePath);
  const relativeTarget = toProjectRelative(cwd, absoluteTarget);
  const index = await readSourceIndex(cwd);
  const currentFiles = await currentSourceFileStates(cwd, index);
  const report = await impactFileWithProjectModules(cwd, index, relativeTarget, {
    currentFiles,
    maxDepth: parsePositiveInteger(options.maxDepth, "--max-depth"),
    maxResults: parsePositiveInteger(options.maxResults, "--max-results")
  });
  await writeSourceQueryMetric(cwd, {
    command: "impact file",
    query: relativeTarget,
    status: report.query.matched ? "matched" : "missing",
    indexMetrics: index ? computeSourceIndexMetrics(index) : undefined,
    queryMetrics: {
      impactedFiles: report.impactedFiles.length,
      impactedSymbols: report.impactedSymbols.length,
      likelyTests: report.likelyTests.length,
      confidence: report.confidence,
      freshness: report.freshness.status,
      truncated: report.truncated
    }
  });
  const evidence = options.noWriteEvidence ? undefined : await writeSourceEvidenceRecord(cwd, buildImpactEvidenceRecord(report));

  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      ...report,
      evidencePath: evidence?.path
    }, null, 2)}\n`);
    return;
  }

  const body = renderSourceImpactMarkdown(report);
  process.stdout.write(evidence ? `${body}\nEvidence record: \`${evidence.path}\`\n` : body);
}

export async function runImpactDiff(cwd: string, options: ImpactDiffOptions = {}): Promise<void> {
  const report = await impactDiff(cwd, {
    files: splitCsv(options.files),
    base: options.base,
    staged: options.staged,
    maxDepth: parsePositiveInteger(options.maxDepth, "--max-depth"),
    maxResults: parsePositiveInteger(options.maxResults, "--max-results")
  });
  await writeSourceQueryMetric(cwd, {
    command: "impact diff",
    query: report.changedFiles.join(","),
    status: report.freshnessStatus,
    queryMetrics: {
      changedFiles: report.changedFiles.length,
      impactedFiles: report.impactedFiles.length,
      likelyTests: report.likelyTests.length,
      confidence: report.confidence,
      truncated: report.truncated
    }
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(renderImpactDiffMarkdown(report));
}

export async function runImpactSymbol(cwd: string, query: string, options: ImpactFileOptions = {}): Promise<void> {
  const index = await readSourceIndex(cwd);
  const report = await impactSymbolWithProjectModules(cwd, query, {
    maxDepth: parsePositiveInteger(options.maxDepth, "--max-depth"),
    maxResults: parsePositiveInteger(options.maxResults, "--max-results")
  });
  await writeSourceQueryMetric(cwd, {
    command: "impact symbol",
    query,
    status: report.status,
    indexMetrics: index ? computeSourceIndexMetrics(index) : undefined,
    queryMetrics: {
      symbol: report.symbol?.qualifiedName,
      callers: report.callers.length,
      callees: report.callees.length,
      impactedFiles: report.impactedFiles.length,
      likelyTests: report.likelyTests.length,
      confidence: report.confidence,
      freshness: report.freshness.status,
      truncated: report.truncated
    }
  });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(renderImpactSymbolMarkdown(report));
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

function splitCsv(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
