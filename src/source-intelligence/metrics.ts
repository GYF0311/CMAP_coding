import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRelative } from "../fs/safe-path.js";
import { assertGeneratedSourceIndexPath } from "./guards.js";
import type { SourceConfidenceTier, SourceEdgeKind, SourceIndex, SourceSymbolKind } from "./schema.js";

export type SourceIndexMetrics = {
  files: number;
  testFiles: number;
  symbols: number;
  edges: number;
  unresolvedRefs: number;
  parseErrors: number;
  symbolsByKind: Record<SourceSymbolKind, number>;
  edgesByKind: Record<SourceEdgeKind, number>;
  edgesByConfidenceTier: Record<SourceConfidenceTier, number>;
};

export type SourceQueryMetricRecord = {
  version: 1;
  id: string;
  createdAt: string;
  command: string;
  generated: true;
  canonical: false;
  label: "generated source query metrics; non-canonical";
  query?: string;
  status?: string;
  durationMs?: number;
  indexMetrics?: Partial<SourceIndexMetrics>;
  queryMetrics?: Record<string, unknown>;
};

export function computeSourceIndexMetrics(index: SourceIndex): SourceIndexMetrics {
  return {
    files: index.files.length,
    testFiles: index.files.filter((file) => file.isTestFile).length,
    symbols: index.symbols.length,
    edges: index.edges.length,
    unresolvedRefs: index.unresolvedRefs.length,
    parseErrors: index.files.reduce((total, file) => total + file.parseErrors.length, 0),
    symbolsByKind: countBy(index.symbols.map((symbol) => symbol.kind)),
    edgesByKind: countBy(index.edges.map((edge) => edge.kind)),
    edgesByConfidenceTier: countBy(index.edges.map((edge) => edge.confidenceTier))
  };
}

export async function writeSourceQueryMetric(
  cwd: string,
  input: Omit<SourceQueryMetricRecord, "version" | "id" | "createdAt" | "generated" | "canonical" | "label"> & {
    createdAt?: string;
    id?: string;
  }
): Promise<{ path: string }> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const id = input.id ?? sourceQueryMetricId(input.command, createdAt, input.query ?? input.status ?? "query");
  const record: SourceQueryMetricRecord = {
    version: 1,
    id,
    createdAt,
    command: input.command,
    generated: true,
    canonical: false,
    label: "generated source query metrics; non-canonical",
    query: input.query,
    status: input.status,
    durationMs: input.durationMs,
    indexMetrics: input.indexMetrics,
    queryMetrics: input.queryMetrics
  };
  const target = assertGeneratedSourceIndexPath(
    cwd,
    path.join(cwd, ".context", "generated", "source-index", "metrics", `${id}.json`)
  );
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { path: projectRelative(cwd, target) };
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function sourceQueryMetricId(command: string, createdAt: string, key: string): string {
  const safeCommand = command.replace(/[^a-zA-Z0-9_.-]+/g, "-").slice(0, 48);
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]+/g, "-").slice(0, 64);
  return `query-${safeCommand}-${createdAt.replace(/[^0-9TZ]/g, "")}-${safeKey}`;
}
