import { computeSourceIndexMetrics } from "./metrics.js";
import { type SourceEdge, type SourceIndex, type SourceSymbol } from "./schema.js";
import type { SourceFreshnessSummary } from "./impact.js";

export type SourceArchitectureCandidateHint = {
  kind: "entrypoint" | "hot-file" | "hub-symbol" | "unresolved-area" | "test-coverage";
  reason: string;
  evidence: string[];
  candidateOnly: true;
};

export type SourceArchitectureReport = {
  version: 1;
  generated: true;
  canonical: false;
  label: "generated source architecture advisory; non-canonical";
  generatedAt?: string;
  freshness?: SourceFreshnessSummary;
  scope: {
    module?: string;
    files: string[];
  };
  metrics: ReturnType<typeof computeSourceIndexMetrics>;
  entrypoints: Array<{ filePath: string; reason: string }>;
  hotFiles: Array<{ filePath: string; incoming: number; outgoing: number; score: number; reason: string }>;
  hubSymbols: Array<{ symbol: SourceSymbol; callers: number; callees: number; score: number; reason: string }>;
  unresolvedAreas: Array<{ filePath: string; unresolvedRefs: number; reason: string; targets: string[] }>;
  testCoverageHints: Array<{ filePath: string; hasLikelyTest: boolean; likelyTests: string[]; reason: string }>;
  candidateHints: string[];
  architectureCandidateHints: SourceArchitectureCandidateHint[];
  confidence: "high" | "medium" | "low";
  omitted: {
    entrypoints: number;
    hotFiles: number;
    hubSymbols: number;
    unresolvedAreas: number;
    testCoverageHints: number;
    architectureCandidateHints: number;
  };
  truncated: boolean;
};

export function analyzeSourceArchitecture(
  index: SourceIndex,
  options: {
    limit?: number;
    freshness?: SourceFreshnessSummary;
    includeCandidates?: boolean;
    module?: string;
    scopeFiles?: string[];
  } = {}
): SourceArchitectureReport {
  const limit = options.limit ?? 10;
  const metrics = computeSourceIndexMetrics(index);
  const fileEdges = fileEdgeStats(index.edges);
  const likelyTestsBySource = likelyTestsBySourceFile(index);
  const scopedFiles = new Set(options.scopeFiles ?? index.files.filter((file) => !file.isTestFile).map((file) => file.path));

  const allEntrypoints = index.files
    .filter((file) => !file.isTestFile)
    .filter((file) => scopedFiles.has(file.path))
    .filter((file) => (fileEdges.get(file.path)?.incoming ?? 0) === 0)
    .map((file) => ({ filePath: file.path, reason: "No generated incoming import/call edges." }));
  const entrypoints = allEntrypoints.slice(0, limit);

  const allHotFiles = [...fileEdges.entries()]
    .filter(([filePath]) => scopedFiles.has(filePath))
    .map(([filePath, stats]) => ({
      filePath,
      ...stats,
      score: stats.incoming + stats.outgoing,
      reason: `${stats.incoming} incoming and ${stats.outgoing} outgoing generated source edges.`
    }))
    .sort((left, right) => right.score - left.score || left.filePath.localeCompare(right.filePath));
  const hotFiles = allHotFiles.slice(0, limit);

  const symbolCalls = symbolCallStats(index);
  const allHubSymbols = [...symbolCalls.entries()]
    .map(([symbolId, stats]) => {
      const symbol = index.symbols.find((item) => item.id === symbolId);
      return symbol && scopedFiles.has(symbol.filePath) ? {
        symbol,
        ...stats,
        score: stats.callers + stats.callees,
        reason: `${stats.callers} generated callers and ${stats.callees} generated callees.`
      } : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.score - left.score || left.symbol.qualifiedName.localeCompare(right.symbol.qualifiedName));
  const hubSymbols = allHubSymbols.slice(0, limit);

  const allUnresolvedAreas = [...groupUnresolvedByFile(index).entries()]
    .filter(([filePath]) => scopedFiles.has(filePath))
    .map(([filePath, refs]) => ({
      filePath,
      unresolvedRefs: refs.length,
      reason: uniqueSorted(refs.map((ref) => ref.reason)).join(", "),
      targets: uniqueSorted(refs.map((ref) => ref.target))
    }))
    .sort((left, right) => right.unresolvedRefs - left.unresolvedRefs || left.filePath.localeCompare(right.filePath));
  const unresolvedAreas = allUnresolvedAreas.slice(0, limit);

  const allTestCoverageHints = index.files
    .filter((file) => !file.isTestFile)
    .filter((file) => scopedFiles.has(file.path))
    .map((file) => ({
      filePath: file.path,
      hasLikelyTest: (likelyTestsBySource.get(file.path) ?? []).length > 0,
      likelyTests: likelyTestsBySource.get(file.path) ?? [],
      reason: (likelyTestsBySource.get(file.path) ?? []).length > 0
        ? "Likely tests matched by generated source/test naming evidence."
        : "No likely test file matched by generated source/test naming evidence."
    }));
  const testCoverageHints = allTestCoverageHints.slice(0, limit);
  const candidateHints = candidateHintStrings({ entrypoints, hotFiles, hubSymbols, unresolvedAreas });
  const allArchitectureCandidateHints = options.includeCandidates
    ? candidateHintObjects({ entrypoints, hotFiles, hubSymbols, unresolvedAreas, testCoverageHints })
    : [];
  const architectureCandidateHints = allArchitectureCandidateHints.slice(0, limit);
  const omitted = {
    entrypoints: Math.max(0, allEntrypoints.length - entrypoints.length),
    hotFiles: Math.max(0, allHotFiles.length - hotFiles.length),
    hubSymbols: Math.max(0, allHubSymbols.length - hubSymbols.length),
    unresolvedAreas: Math.max(0, allUnresolvedAreas.length - unresolvedAreas.length),
    testCoverageHints: Math.max(0, allTestCoverageHints.length - testCoverageHints.length),
    architectureCandidateHints: Math.max(0, allArchitectureCandidateHints.length - architectureCandidateHints.length)
  };
  const truncated = allEntrypoints.length > entrypoints.length ||
    allHotFiles.length > hotFiles.length ||
    allHubSymbols.length > hubSymbols.length ||
    allUnresolvedAreas.length > unresolvedAreas.length ||
    allTestCoverageHints.length > testCoverageHints.length ||
    allArchitectureCandidateHints.length > architectureCandidateHints.length;

  return {
    version: 1,
    generated: true,
    canonical: false,
    label: "generated source architecture advisory; non-canonical",
    generatedAt: index.meta.generatedAt,
    freshness: options.freshness,
    scope: {
      module: options.module,
      files: [...scopedFiles].sort((left, right) => left.localeCompare(right))
    },
    metrics,
    entrypoints,
    hotFiles,
    hubSymbols,
    unresolvedAreas,
    testCoverageHints,
    candidateHints,
    architectureCandidateHints,
    confidence: architectureConfidence(options.freshness, truncated, unresolvedAreas.length),
    omitted,
    truncated
  };
}

function architectureConfidence(
  freshness: SourceFreshnessSummary | undefined,
  truncated: boolean,
  unresolvedAreas: number
): "high" | "medium" | "low" {
  if (!freshness || freshness.status === "missing" || freshness.status === "error") {
    return "low";
  }
  if (freshness.status === "stale" || truncated || unresolvedAreas > 0) {
    return "medium";
  }
  return "high";
}

function fileEdgeStats(edges: SourceEdge[]): Map<string, { incoming: number; outgoing: number }> {
  const stats = new Map<string, { incoming: number; outgoing: number }>();
  for (const edge of edges) {
    const source = edge.filePath;
    const target = edge.targetId?.startsWith("file:") ? edge.targetId.slice("file:".length) : undefined;
    const sourceStats = stats.get(source) ?? { incoming: 0, outgoing: 0 };
    sourceStats.outgoing += 1;
    stats.set(source, sourceStats);
    if (target) {
      const targetStats = stats.get(target) ?? { incoming: 0, outgoing: 0 };
      targetStats.incoming += 1;
      stats.set(target, targetStats);
    }
  }
  return stats;
}

function symbolCallStats(index: SourceIndex): Map<string, { callers: number; callees: number }> {
  const stats = new Map<string, { callers: number; callees: number }>();
  for (const edge of index.edges.filter((item) => item.kind === "CALLS")) {
    const source = stats.get(edge.sourceId) ?? { callers: 0, callees: 0 };
    source.callees += 1;
    stats.set(edge.sourceId, source);
    if (edge.targetId) {
      const target = stats.get(edge.targetId) ?? { callers: 0, callees: 0 };
      target.callers += 1;
      stats.set(edge.targetId, target);
    }
  }
  return stats;
}

function groupUnresolvedByFile(index: SourceIndex): Map<string, SourceIndex["unresolvedRefs"]> {
  const counts = new Map<string, SourceIndex["unresolvedRefs"]>();
  for (const ref of index.unresolvedRefs) {
    const refs = counts.get(ref.filePath) ?? [];
    refs.push(ref);
    counts.set(ref.filePath, refs);
  }
  return counts;
}

function candidateHintStrings(input: {
  entrypoints: Array<{ filePath: string }>;
  hotFiles: Array<{ filePath: string; score: number }>;
  hubSymbols: Array<{ symbol: SourceSymbol; score: number }>;
  unresolvedAreas: Array<{ filePath: string; unresolvedRefs: number }>;
}): string[] {
  const hints: string[] = [];
  if (input.entrypoints.length > 0) {
    hints.push(`Review generated entrypoint candidates: ${input.entrypoints.map((item) => item.filePath).join(", ")}`);
  }
  if (input.hotFiles[0]) {
    hints.push(`Hot file candidate: ${input.hotFiles[0].filePath} (score ${input.hotFiles[0].score}).`);
  }
  if (input.hubSymbols[0]) {
    hints.push(`Hub symbol candidate: ${input.hubSymbols[0].symbol.qualifiedName} (score ${input.hubSymbols[0].score}).`);
  }
  if (input.unresolvedAreas[0]) {
    hints.push(`Unresolved source area: ${input.unresolvedAreas[0].filePath} (${input.unresolvedAreas[0].unresolvedRefs} unresolved refs).`);
  }
  return hints;
}

function candidateHintObjects(input: {
  entrypoints: Array<{ filePath: string; reason: string }>;
  hotFiles: Array<{ filePath: string; score: number; reason: string }>;
  hubSymbols: Array<{ symbol: SourceSymbol; score: number; reason: string }>;
  unresolvedAreas: Array<{ filePath: string; unresolvedRefs: number; reason: string; targets: string[] }>;
  testCoverageHints: Array<{ filePath: string; hasLikelyTest: boolean; likelyTests: string[]; reason: string }>;
}): SourceArchitectureCandidateHint[] {
  const hints: SourceArchitectureCandidateHint[] = [];
  hints.push(...input.entrypoints.map((item) => ({
    kind: "entrypoint" as const,
    reason: item.reason,
    evidence: [item.filePath],
    candidateOnly: true as const
  })));
  hints.push(...input.hotFiles.map((item) => ({
    kind: "hot-file" as const,
    reason: item.reason,
    evidence: [item.filePath, `score=${item.score}`],
    candidateOnly: true as const
  })));
  hints.push(...input.hubSymbols.map((item) => ({
    kind: "hub-symbol" as const,
    reason: item.reason,
    evidence: [item.symbol.qualifiedName, `score=${item.score}`],
    candidateOnly: true as const
  })));
  hints.push(...input.unresolvedAreas.map((item) => ({
    kind: "unresolved-area" as const,
    reason: item.reason,
    evidence: [item.filePath, ...item.targets],
    candidateOnly: true as const
  })));
  hints.push(...input.testCoverageHints.filter((item) => !item.hasLikelyTest).map((item) => ({
    kind: "test-coverage" as const,
    reason: item.reason,
    evidence: [item.filePath],
    candidateOnly: true as const
  })));
  return hints;
}

function likelyTestsBySourceFile(index: SourceIndex): Map<string, string[]> {
  const testFiles = index.files.filter((file) => file.isTestFile || isLikelyTestFile(file.path)).map((file) => file.path);
  const bySource = new Map<string, string[]>();
  for (const file of index.files.filter((item) => !item.isTestFile && !isLikelyTestFile(item.path))) {
    const comparable = testComparableName(file.path);
    const likelyTests = testFiles.filter((testFile) => {
      const testComparable = testComparableName(testFile);
      return testComparable === comparable ||
        testComparable.endsWith(`.${comparable}`) ||
        testComparable.endsWith(`-${comparable}`);
    });
    bySource.set(file.path, uniqueSorted(likelyTests));
  }
  return bySource;
}

function testComparableName(filePath: string): string {
  const parsed = filePath.split("/").at(-1) ?? filePath;
  return parsed
    .replace(/\.[cm]?[jt]sx?$/i, "")
    .replace(/\.(test|spec)$/i, "")
    .replace(/[-_.](test|spec)$/i, "")
    .toLowerCase();
}

function isLikelyTestFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return (
    /(^|\/)(__tests__|tests?)(\/|$)/.test(normalized) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized) ||
    /(^|\/)test[-_./]/.test(normalized)
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
