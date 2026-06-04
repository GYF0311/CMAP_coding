import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRelative } from "../fs/safe-path.js";
import { assertGeneratedSourceIndexPath } from "./guards.js";
import type { SourceImpactReport } from "./impact.js";

export type SourceEvidenceKind = "impact.file" | "source.status" | "symbol.query";

export type SourceEvidenceRecord = {
  version: 1;
  id: string;
  createdAt: string;
  kind: SourceEvidenceKind;
  generated: true;
  canonical: false;
  summary: string;
  files: string[];
  confidence: number;
  freshnessStatus: SourceImpactReport["freshness"]["status"];
  truncated: boolean;
  report: SourceImpactReport;
};

export function buildImpactEvidenceRecord(
  report: SourceImpactReport,
  options: { createdAt?: string; id?: string } = {}
): SourceEvidenceRecord {
  const createdAt = options.createdAt ?? new Date().toISOString();
  return {
    version: 1,
    id: options.id ?? sourceEvidenceId("impact-file", createdAt, report.query.normalizedPath),
    createdAt,
    kind: "impact.file",
    generated: true,
    canonical: false,
    summary: impactSummary(report),
    files: [...new Set([...report.changedFiles, ...report.impactedFiles, ...report.likelyTests])],
    confidence: confidenceScore(report.confidence),
    freshnessStatus: report.freshness.status,
    truncated: report.truncated,
    report
  };
}

export async function writeSourceEvidenceRecord(
  cwd: string,
  record: SourceEvidenceRecord
): Promise<{ path: string }> {
  const target = assertGeneratedSourceIndexPath(
    cwd,
    path.join(cwd, ".context", "generated", "source-index", "evidence", `${record.id}.json`)
  );
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { path: projectRelative(cwd, target) };
}

export function sourceEvidenceId(prefix: string, createdAt: string, key: string): string {
  return `${prefix}-${createdAt.replace(/[^0-9TZ]/g, "")}-${key.replace(/[^a-zA-Z0-9_.-]+/g, "-").slice(0, 80)}`;
}

function impactSummary(report: SourceImpactReport): string {
  return [
    `Impact query for ${report.query.normalizedPath}`,
    `${report.impactedFiles.length} impacted file(s)`,
    `${report.likelyTests.length} likely test(s)`,
    `confidence ${report.confidence}`,
    `freshness ${report.freshness.status}`
  ].join("; ");
}

function confidenceScore(confidence: SourceImpactReport["confidence"]): number {
  if (confidence === "high") {
    return 0.9;
  }
  if (confidence === "medium") {
    return 0.65;
  }
  return 0.35;
}
