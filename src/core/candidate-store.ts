import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { projectRelative } from "../fs/safe-path.js";

export const candidateSchema = "cmap.candidate.v1" as const;

export const candidateTypes = [
  "module.alias.add",
  "module.alias.request",
  "module.path.add",
  "evidence.merge",
  "verification.evidence",
  "module.semantic.update",
  "decision.record",
  "status.update",
  "verify.policy.update"
] as const;

export type CmapCandidateType = (typeof candidateTypes)[number];
export type CmapCandidateSource = "mappatch" | "relate" | "reconcile" | "obsidian-pull" | "route" | "manual";
export type CmapCandidateRisk = "routine" | "medium" | "high";

export type CmapCandidate = {
  schema: typeof candidateSchema;
  id: string;
  fingerprint: string;
  createdAt: string;
  source: CmapCandidateSource;
  type: CmapCandidateType;
  target: string;
  risk: CmapCandidateRisk;
  confidence: number;
  summary: string;
  evidence: string[];
  fields: Record<string, unknown>;
  canonical: false;
};

export type CandidateDraft = {
  source: CmapCandidateSource;
  type: CmapCandidateType;
  target: string;
  risk?: string;
  confidence?: number;
  summary: string;
  evidence?: string[];
  fields?: Record<string, unknown>;
};

export type CandidateWriteResult = {
  written: CmapCandidate[];
  duplicates: CmapCandidate[];
};

export async function writeCandidateDrafts(cwd: string, drafts: CandidateDraft[]): Promise<CandidateWriteResult> {
  const root = path.join(cwd, ".context", "inbox", "candidates");
  await mkdir(root, { recursive: true });
  const existing = await existingCandidateFingerprints(cwd);
  const written: CmapCandidate[] = [];
  const duplicates: CmapCandidate[] = [];
  const timestamp = timestampForId(new Date());

  for (const draft of drafts) {
    const fingerprint = candidateFingerprint(draft);
    const candidate = toCandidate(draft, fingerprint, timestamp);
    if (existing.has(fingerprint)) {
      duplicates.push(candidate);
      continue;
    }
    await writeCandidatePair(root, candidate);
    existing.add(fingerprint);
    written.push(candidate);
  }

  return { written, duplicates };
}

export async function existingCandidateFingerprints(cwd: string): Promise<Set<string>> {
  const root = path.join(cwd, ".context", "inbox", "candidates");
  const result = new Set<string>();
  if (!(await fileExists(root))) {
    return result;
  }
  for (const entry of await readdir(root)) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    try {
      const parsed = JSON.parse(await readFile(path.join(root, entry), "utf8")) as { fingerprint?: unknown };
      if (typeof parsed.fingerprint === "string" && parsed.fingerprint.trim()) {
        result.add(parsed.fingerprint);
      }
    } catch {
      // Ignore malformed candidate files; inbox and verify surfaces can report them separately.
    }
  }
  return result;
}

export function candidateFingerprint(draft: CandidateDraft): string {
  const stable = stableJson({
    source: draft.source,
    type: draft.type,
    target: draft.target,
    summary: draft.summary,
    evidence: [...(draft.evidence ?? [])].sort(),
    fields: draft.fields ?? {}
  });
  return createHash("sha256").update(stable).digest("hex");
}

export function parseCmapCandidate(raw: string): CmapCandidate | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  if (parsed.schema !== candidateSchema) {
    return undefined;
  }
  const id = stringField(parsed.id);
  const fingerprint = stringField(parsed.fingerprint);
  const createdAt = stringField(parsed.createdAt);
  const source = stringField(parsed.source);
  const type = stringField(parsed.type);
  const target = stringField(parsed.target);
  const summary = stringField(parsed.summary);
  if (!id || !fingerprint || !createdAt || !source || !type || !target || !summary) {
    return undefined;
  }
  if (!isCandidateType(type)) {
    return undefined;
  }
  return {
    schema: candidateSchema,
    id,
    fingerprint,
    createdAt,
    source: normalizeSource(source),
    type,
    target,
    risk: normalizeRisk(stringField(parsed.risk)),
    confidence: numberField(parsed.confidence) ?? 0.5,
    summary,
    evidence: stringArrayField(parsed.evidence),
    fields: isRecord(parsed.fields) ? parsed.fields : {},
    canonical: false
  };
}

export function renderCandidateMarkdown(candidate: CmapCandidate): string {
  return [
    "---",
    "context_type: candidate",
    `schema: ${candidate.schema}`,
    `id: ${candidate.id}`,
    `type: ${candidate.type}`,
    `source: ${candidate.source}`,
    `risk: ${candidate.risk}`,
    `target: ${candidate.target}`,
    `confidence: ${candidate.confidence}`,
    "canonical: false",
    "---",
    `# Candidate: ${candidate.id}`,
    "",
    "Candidate / Non-canonical: candidate input only.",
    "",
    `- Type: ${candidate.type}`,
    `- Target: ${candidate.target}`,
    `- Source: ${candidate.source}`,
    `- Confidence: ${candidate.confidence}`,
    `- Summary: ${candidate.summary}`,
    "",
    "## Evidence",
    ...(candidate.evidence.length > 0 ? candidate.evidence.map((item) => `- \`${item}\``) : ["- Not available"]),
    "",
    "## Suggested Commands",
    `- \`cmap inbox promote ${candidate.id} --dry-run\``,
    candidate.risk === "routine" ? `- \`cmap inbox promote ${candidate.id} --apply\`` : undefined,
    ""
  ].filter((line): line is string => line !== undefined).join("\n");
}

function toCandidate(draft: CandidateDraft, fingerprint: string, timestamp: string): CmapCandidate {
  return {
    schema: candidateSchema,
    id: `candidate-${timestamp}-${fingerprint.slice(0, 10)}`,
    fingerprint,
    createdAt: new Date().toISOString(),
    source: draft.source,
    type: draft.type,
    target: draft.target,
    risk: normalizeRisk(draft.risk),
    confidence: normalizeConfidence(draft.confidence),
    summary: draft.summary,
    evidence: uniqueStrings(draft.evidence ?? []),
    fields: draft.fields ?? {},
    canonical: false
  };
}

async function writeCandidatePair(root: string, candidate: CmapCandidate): Promise<void> {
  const jsonPath = path.join(root, `${candidate.id}.json`);
  const mdPath = path.join(root, `${candidate.id}.md`);
  await writeFile(jsonPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderCandidateMarkdown(candidate), "utf8");
}

function timestampForId(value: Date): string {
  return value.toISOString().replace(/\.\d{3}z$/i, "").replace(/:/g, "-").toLowerCase();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isCandidateType(value: string): value is CmapCandidateType {
  return (candidateTypes as readonly string[]).includes(value);
}

function normalizeSource(value: string): CmapCandidateSource {
  const allowed = new Set<CmapCandidateSource>(["mappatch", "relate", "reconcile", "obsidian-pull", "route", "manual"]);
  return allowed.has(value as CmapCandidateSource) ? (value as CmapCandidateSource) : "manual";
}

function normalizeRisk(value: string | undefined): CmapCandidateRisk {
  if (value === "high" || value === "medium" || value === "routine") {
    return value;
  }
  return "routine";
}

function normalizeConfidence(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArrayField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function candidateRelativeJsonPath(cwd: string, candidate: CmapCandidate): string {
  return projectRelative(cwd, path.join(cwd, ".context", "inbox", "candidates", `${candidate.id}.json`));
}
