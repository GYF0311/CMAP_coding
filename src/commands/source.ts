import { computeSourceIndexMetrics, writeSourceQueryMetric } from "../source-intelligence/metrics.js";
import { buildAndWriteSourceIndex, readSourceIndex, sourceIndexStorePaths } from "../source-intelligence/store.js";
import { currentSourceFileStates, sourceIndexStatus, type SourceIndexStatus } from "../source-intelligence/freshness.js";
import type { SourceIndex } from "../source-intelligence/schema.js";
import { analyzeSourceArchitecture, type SourceArchitectureReport } from "../source-intelligence/architecture.js";
import { CmapCommandError } from "../errors.js";
import { summarizeSourceFreshness } from "../source-intelligence/impact.js";
import { loadModuleIndex, mapChangedFilesToModules } from "../core/module-index.js";

type SourceCommandOptions = {
  json?: boolean;
  limit?: string;
  maxItems?: string;
  module?: string;
  includeCandidates?: boolean;
};

export async function runSourceIndex(cwd: string, options: SourceCommandOptions = {}): Promise<void> {
  const { index, paths } = await buildAndWriteSourceIndex(cwd);
  const metrics = computeSourceIndexMetrics(index);
  await writeSourceQueryMetric(cwd, {
    command: "source index",
    status: "indexed",
    indexMetrics: metrics,
    queryMetrics: { files: metrics.files, symbols: metrics.symbols, edges: metrics.edges }
  });
  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      generated: true,
      canonical: false,
      label: "generated source evidence; non-canonical",
      status: "indexed",
      paths: {
        root: paths.root,
        meta: paths.meta,
        files: paths.files,
        symbols: paths.symbols,
        edges: paths.edges,
        unresolvedRefs: paths.unresolvedRefs
      },
      meta: index.meta,
      metrics,
      nextCommands: [
        "cmap source status",
        "cmap impact file <path>"
      ]
    }, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderSourceIndexMarkdown(index, metrics));
}

export async function runSourceStatus(cwd: string, options: SourceCommandOptions = {}): Promise<void> {
  const index = await readSourceIndex(cwd);
  const status = await sourceIndexStatus(cwd, index);
  await writeSourceQueryMetric(cwd, {
    command: "source status",
    status: status.exists ? "exists" : "missing",
    indexMetrics: index ? computeSourceIndexMetrics(index) : undefined,
    queryMetrics: {
      freshFiles: status.freshFiles.length,
      staleFiles: status.staleFiles.length,
      newFiles: status.newFiles.length,
      deletedFiles: status.deletedFiles.length
    }
  });
  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      generated: true,
      canonical: false,
      label: "generated source evidence; non-canonical",
      status,
      store: sourceIndexStorePaths(cwd),
      nextCommands: status.exists
        ? ["cmap impact file <path>", "cmap source index"]
        : ["cmap source index"]
    }, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderSourceStatusMarkdown(status));
}

export async function runSourceArchitecture(cwd: string, options: SourceCommandOptions = {}): Promise<void> {
  const index = await readSourceIndex(cwd);
  if (!index) {
    throw new CmapCommandError("Generated source index not found. Run `cmap source index` first.", 2);
  }
  const currentFiles = await currentSourceFileStates(cwd, index);
  const freshness = summarizeSourceFreshness(index, { cwd, currentFiles });
  const scopeFiles = options.module ? await sourceFilesForModule(cwd, index, options.module) : undefined;
  const report = analyzeSourceArchitecture(index, {
    limit: parsePositiveInteger(options.maxItems ?? options.limit, options.maxItems ? "--max-items" : "--limit") ?? 10,
    freshness,
    includeCandidates: options.includeCandidates,
    module: options.module,
    scopeFiles
  });
  await writeSourceQueryMetric(cwd, {
    command: "source architecture",
    status: "ok",
    indexMetrics: report.metrics,
    queryMetrics: {
      entrypoints: report.entrypoints.length,
      hotFiles: report.hotFiles.length,
      hubSymbols: report.hubSymbols.length,
      unresolvedAreas: report.unresolvedAreas.length,
      architectureCandidateHints: report.architectureCandidateHints.length,
      omitted: report.omitted,
      confidence: report.confidence,
      freshness: report.freshness?.status,
      truncated: report.truncated
    }
  });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(renderSourceArchitectureMarkdown(report));
}

async function sourceFilesForModule(cwd: string, index: SourceIndex, moduleId: string): Promise<string[]> {
  const modules = await loadModuleIndex(cwd);
  const normalized = moduleId.toLowerCase();
  const files = index.files.filter((file) => !file.isTestFile).map((file) => file.path);
  const mapping = mapChangedFilesToModules(files, modules);
  return mapping.matches
    .filter((match) => match.modules.some((module) =>
      module.id.toLowerCase() === normalized || module.name.toLowerCase() === normalized
    ))
    .map((match) => match.file)
    .sort((left, right) => left.localeCompare(right));
}

function renderSourceIndexMarkdown(index: SourceIndex, metrics: ReturnType<typeof computeSourceIndexMetrics>): string {
  return [
    "# Source Index",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Status: indexed`,
    `Generated at: ${index.meta.generatedAt}`,
    `Git head: ${index.meta.gitHead ?? "Not available"}`,
    `Files: ${metrics.files}`,
    `Symbols: ${metrics.symbols}`,
    `Edges: ${metrics.edges}`,
    `Unresolved refs: ${metrics.unresolvedRefs}`,
    `Parse errors: ${metrics.parseErrors}`,
    "",
    "## Output",
    "",
    "- `.context/generated/source-index/source-index.meta.json`",
    "- `.context/generated/source-index/files.json`",
    "- `.context/generated/source-index/symbols.json`",
    "- `.context/generated/source-index/edges.json`",
    "- `.context/generated/source-index/unresolved-refs.json`",
    "",
    "## Next Commands",
    "",
    "- `cmap source status`",
    "- `cmap impact file <path>`",
    ""
  ].join("\n");
}

function renderSourceStatusMarkdown(status: SourceIndexStatus): string {
  return [
    "# Source Index Status",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Exists: ${status.exists ? "yes" : "no"}`,
    `Generated at: ${status.generatedAt ?? "Not available"}`,
    `Git head: ${status.gitHead ?? "Not available"}`,
    `Files: ${status.fileCount}`,
    `Symbols: ${status.symbolCount}`,
    `Edges: ${status.edgeCount}`,
    `Unresolved refs: ${status.unresolvedRefCount}`,
    `Parse errors: ${status.parseErrorCount}`,
    "",
    "## Freshness",
    "",
    `Fresh files: ${status.freshFiles.length}`,
    `Stale files: ${status.staleFiles.length}`,
    `New files: ${status.newFiles.length}`,
    `Deleted files: ${status.deletedFiles.length}`,
    "",
    "Stale files:",
    renderList(status.staleFiles),
    "",
    "New files:",
    renderList(status.newFiles),
    "",
    "Deleted files:",
    renderList(status.deletedFiles),
    "",
    "## Next Commands",
    "",
    status.exists ? "- `cmap impact file <path>`" : "- `cmap source index`",
    ""
  ].join("\n");
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "- None";
  }
  return items.map((item) => `- \`${item}\``).join("\n");
}

function renderSourceArchitectureMarkdown(report: SourceArchitectureReport): string {
  return [
    "# Source Architecture",
    "",
    "Generated source architecture advisory. Non-canonical: use as review support only.",
    "",
    `Files: ${report.metrics.files}`,
    `Symbols: ${report.metrics.symbols}`,
    `Edges: ${report.metrics.edges}`,
    `Unresolved refs: ${report.metrics.unresolvedRefs}`,
    `Freshness: ${report.freshness?.status ?? "unknown"}`,
    `Confidence: ${report.confidence}`,
    `Scope: ${report.scope.module ? `module ${report.scope.module}` : "all indexed source files"}`,
    `Truncated: ${report.truncated ? "yes" : "no"}`,
    `Omitted: entrypoints=${report.omitted.entrypoints}, hotFiles=${report.omitted.hotFiles}, hubSymbols=${report.omitted.hubSymbols}, unresolvedAreas=${report.omitted.unresolvedAreas}, testCoverageHints=${report.omitted.testCoverageHints}, architectureCandidateHints=${report.omitted.architectureCandidateHints}`,
    "",
    "## Entrypoints",
    renderList(report.entrypoints.map((item) => `${item.filePath} - ${item.reason}`)),
    "",
    "## Hot Files",
    renderList(report.hotFiles.map((item) => `${item.filePath} score=${item.score}`)),
    "",
    "## Hub Symbols",
    renderList(report.hubSymbols.map((item) => `${item.symbol.qualifiedName} score=${item.score}`)),
    "",
    "## Unresolved Areas",
    renderList(report.unresolvedAreas.map((item) => `${item.filePath} refs=${item.unresolvedRefs} targets=${item.targets.join(", ")}`)),
    "",
    "## Test Coverage Hints",
    renderList(report.testCoverageHints.map((item) =>
      `${item.filePath} hasLikelyTest=${item.hasLikelyTest ? "yes" : "no"} tests=${item.likelyTests.join(", ") || "none"}`
    )),
    "",
    "## Candidate Hints",
    renderList(report.architectureCandidateHints.map((item) => `${item.kind}: ${item.reason} (${item.evidence.join(", ")})`)),
    ""
  ].join("\n");
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
