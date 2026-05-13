import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { fileExists } from "../context/scanner.js";
import { loadContextPolicy, type ContextPolicy } from "../context/policy.js";
import { CmapCommandError } from "../errors.js";
import { createBackup } from "../fs/backup.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";
import {
  appendGeneratedStatsEvent,
  appendModuleEvidence,
  appendVerificationEvidence
} from "./generated-store.js";

const schemaVersions = ["cmap.map_patch.v1", "cmap.mappatch.v1", "cmap.map_patch.v2"] as const;

const operationSchema = z.object({
  op: z.string().min(1),
  target: z.string().optional(),
  risk: z.enum(["routine", "high"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().min(1).optional(),
  evidence: z.array(z.string()).optional(),
  fields: z.record(z.string(), z.unknown()).optional()
});

const legacyChangeSchema = z.object({
  kind: z.string().min(1),
  target: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(z.string()).optional(),
  confidence: z.union([z.literal("candidate"), z.number().min(0).max(1)]).optional()
});

const mapPatchSchema = z
  .object({
    schema: z.enum(schemaVersions),
    agent: z.string().optional(),
    source: z.string().optional(),
    task: z.string().optional(),
    summary: z.string().min(1),
    operations: z.array(operationSchema).optional(),
    changes: z.array(legacyChangeSchema).optional()
  })
  .refine((value) => (value.operations?.length ?? 0) + (value.changes?.length ?? 0) > 0, {
    message: "MapPatch requires at least one operation or change"
  });

export type MapPatchOperation = z.infer<typeof operationSchema>;

export type MapPatch = {
  schema: "cmap.map_patch.v1" | "cmap.mappatch.v1" | "cmap.map_patch.v2";
  agent?: string;
  source?: string;
  task?: string;
  summary: string;
  operations: MapPatchOperation[];
};

export type EvaluatedMapPatchOperation = {
  operation: MapPatchOperation;
  target: string;
  action: "apply" | "inbox" | "reject";
  reason: string;
  missingEvidence: string[];
};

export type MapPatchApplyResult = {
  evaluations: EvaluatedMapPatchOperation[];
  appliedCount: number;
  backupId?: string;
  auditPath?: string;
  inboxPath?: string;
};

export function parseMapPatch(raw: string): MapPatch {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (error) {
    throw new CmapCommandError(`Invalid MapPatch JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const result = mapPatchSchema.safeParse(parsed);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
    throw new CmapCommandError(`Invalid MapPatch: ${message}`);
  }

  const operations = [
    ...(result.data.operations ?? []),
    ...(result.data.changes ?? []).map((change): MapPatchOperation => ({
      op: `candidate.${change.kind}`,
      target: change.target,
      risk: "high",
      confidence: typeof change.confidence === "number" ? change.confidence : 0.5,
      summary: change.summary,
      evidence: change.evidence ?? [],
      fields: {}
    }))
  ];

  return {
    schema: result.data.schema,
    agent: result.data.agent,
    source: result.data.source,
    task: result.data.task,
    summary: result.data.summary,
    operations
  };
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim();
  }
  return trimmed;
}

export async function evaluateMapPatch(cwd: string, patch: MapPatch): Promise<EvaluatedMapPatchOperation[]> {
  const policy = await loadContextPolicy(cwd);
  const evaluations: EvaluatedMapPatchOperation[] = [];
  for (const operation of patch.operations) {
    evaluations.push(await evaluateOperation(cwd, operation, policy));
  }
  return evaluations;
}

export async function applyRoutineMapPatch(
  cwd: string,
  patch: MapPatch,
  evaluations: EvaluatedMapPatchOperation[]
): Promise<MapPatchApplyResult> {
  const routine = evaluations.filter((evaluation) => evaluation.action === "apply");
  const canonicalTargets = [...new Set(routine.map((evaluation) => path.join(cwd, evaluation.target)))];
  const existingTargets: string[] = [];
  for (const target of canonicalTargets) {
    if (await fileExists(target)) {
      existingTargets.push(target);
    }
  }

  const backupId = existingTargets.length > 0 ? await createBackup(cwd, existingTargets) : undefined;
  for (const evaluation of routine) {
    if (evaluation.operation.op === "checkpoint.write") {
      await writeCheckpointFromOperation(cwd, patch, evaluation.operation);
    }
    if (evaluation.operation.op === "checkpoint.close") {
      await closeCheckpointFromOperation(cwd, patch, evaluation.operation);
    }
    if (evaluation.operation.op === "evidence.append") {
      await writeGeneratedEvidenceFromOperation(cwd, evaluation.operation);
    }
    if (evaluation.operation.op === "verification.evidence" || evaluation.operation.op === "verification.record") {
      await writeVerificationEvidenceFromOperation(cwd, evaluation.operation);
    }
    if (evaluation.operation.op === "stats.update") {
      await writeStatsEventFromOperation(cwd, evaluation.operation);
    }
  }

  const inboxPath = evaluations.some((evaluation) => evaluation.action === "inbox")
    ? await writeInboxReport(cwd, patch, evaluations)
    : undefined;
  const auditPath = await writeAudit(cwd, patch, evaluations, backupId, inboxPath);

  return {
    evaluations,
    appliedCount: routine.length,
    backupId,
    auditPath,
    inboxPath
  };
}

export async function writeMapPatchInbox(
  cwd: string,
  patch: MapPatch,
  evaluations: EvaluatedMapPatchOperation[]
): Promise<string> {
  return writeInboxReport(cwd, patch, evaluations);
}

export function renderMapPatchDryRun(patch: MapPatch, evaluations: EvaluatedMapPatchOperation[]): string {
  const lines = [
    "# MapPatch Dry Run",
    "",
    `Schema: \`${patch.schema}\``,
    `Agent: ${patch.agent ?? "unknown"}`,
    `Summary: ${patch.summary}`,
    "",
    "This report classifies AI-authored updates. It does not modify canonical `.context` facts.",
    "",
    ...renderEvaluationGroups(evaluations),
    "## Suggested Commands",
    "",
    "- Apply routine updates only: `cmap update --agent --from <file> --apply-routine`",
    "- Save all candidates to inbox: `cmap update --agent --from <file> --write-inbox`",
    ""
  ];
  return lines.join("\n");
}

export function renderMapPatchApplyReport(result: MapPatchApplyResult): string {
  const lines = [
    "# MapPatch Apply Report",
    "",
    `Applied routine operations: ${result.appliedCount}`,
    `Backup: ${result.backupId ?? "none"}`,
    `Audit: ${result.auditPath ?? "none"}`,
    `Inbox: ${result.inboxPath ?? "none"}`,
    "",
    ...renderEvaluationGroups(result.evaluations)
  ];
  return lines.join("\n");
}

async function evaluateOperation(
  cwd: string,
  operation: MapPatchOperation,
  policy: ContextPolicy
): Promise<EvaluatedMapPatchOperation> {
  const target = defaultTarget(operation);
  if (policy.blocked[operation.op]) {
    return {
      operation,
      target,
      action: "reject",
      reason: "operation is blocked by policy",
      missingEvidence: []
    };
  }
  const rejected = await validateTarget(cwd, target);
  const missingEvidence = await collectMissingEvidence(cwd, operation.evidence ?? []);
  if (rejected) {
    return {
      operation,
      target,
      action: "reject",
      reason: rejected,
      missingEvidence
    };
  }
  if (missingEvidence.length > 0) {
    return {
      operation,
      target,
      action: "inbox",
      reason: "file evidence is missing, so this needs review",
      missingEvidence
    };
  }
  if (operation.op === "checkpoint.write") {
    const fields = operation.fields ?? {};
    const task = stringField(fields.task);
    const next = stringField(fields.next) ?? stringField(fields.next_step);
    const confidence = operation.confidence ?? 0.5;
    if (operation.risk === "high") {
      return { operation, target, action: "inbox", reason: "operation is marked high risk", missingEvidence };
    }
    if (!policy.autoApply.checkpointWrite) {
      return { operation, target, action: "inbox", reason: "checkpoint.write is disabled by policy", missingEvidence };
    }
    if (confidence < policy.thresholds.routineConfidence) {
      return { operation, target, action: "inbox", reason: `confidence below routine threshold ${policy.thresholds.routineConfidence}`, missingEvidence };
    }
    if (!task || !next) {
      return { operation, target, action: "inbox", reason: "checkpoint.write requires fields.task and fields.next", missingEvidence };
    }
    return { operation, target, action: "apply", reason: "low-risk checkpoint state with explicit task and next step", missingEvidence };
  }

  if (operation.op === "checkpoint.close") {
    const fields = operation.fields ?? {};
    const confidence = operation.confidence ?? 0.5;
    if (!policy.autoApply.checkpointClose) {
      return { operation, target, action: "inbox", reason: "checkpoint.close is disabled by policy", missingEvidence };
    }
    if (operation.risk === "high") {
      return { operation, target, action: "inbox", reason: "operation is marked high risk", missingEvidence };
    }
    if (confidence < policy.thresholds.routineConfidence) {
      return { operation, target, action: "inbox", reason: `confidence below routine threshold ${policy.thresholds.routineConfidence}`, missingEvidence };
    }
    if (!stringField(fields.verified)) {
      return { operation, target, action: "inbox", reason: "checkpoint.close requires fields.verified", missingEvidence };
    }
    return { operation, target, action: "apply", reason: "low-risk checkpoint close with verification evidence", missingEvidence };
  }

  if (operation.op === "evidence.append") {
    const fields = operation.fields ?? {};
    const confidence = operation.confidence ?? 0.5;
    const moduleId = stringField(fields.module) ?? stringField(fields.moduleId);
    const summary = stringField(fields.summary) ?? operation.summary;
    const files = stringArrayField(fields.files) ?? stringArrayField(fields.file ? [fields.file] : undefined);
    if (!policy.autoApply.evidenceAppend) {
      return { operation, target, action: "inbox", reason: "evidence.append is disabled by policy", missingEvidence };
    }
    if (confidence < policy.thresholds.evidenceConfidence) {
      return { operation, target, action: "inbox", reason: `confidence below evidence threshold ${policy.thresholds.evidenceConfidence}`, missingEvidence };
    }
    if (!moduleId || !summary || !files || files.length === 0) {
      return { operation, target, action: "inbox", reason: "evidence.append requires fields.module, fields.summary, and fields.files", missingEvidence };
    }
    return { operation, target: `.context/generated/evidence/modules/${moduleId}.jsonl`, action: "apply", reason: "generated evidence is auto-applicable support data", missingEvidence };
  }

  if (operation.op === "verification.evidence" || operation.op === "verification.record") {
    const fields = operation.fields ?? {};
    const confidence = operation.confidence ?? 0.5;
    const summary = stringField(fields.summary) ?? operation.summary;
    const files = stringArrayField(fields.files) ?? [];
    if (!policy.autoApply.verificationEvidence) {
      return { operation, target, action: "inbox", reason: "verification.evidence is disabled by policy", missingEvidence };
    }
    if (confidence < policy.thresholds.evidenceConfidence) {
      return { operation, target, action: "inbox", reason: `confidence below evidence threshold ${policy.thresholds.evidenceConfidence}`, missingEvidence };
    }
    if (!summary) {
      return { operation, target, action: "inbox", reason: "verification.evidence requires fields.summary or operation.summary", missingEvidence };
    }
    return { operation, target: ".context/generated/evidence/verification.jsonl", action: "apply", reason: "verification evidence is generated support data", missingEvidence };
  }

  if (operation.op === "stats.update") {
    const confidence = operation.confidence ?? 0.5;
    if (!policy.autoApply.statsUpdate) {
      return { operation, target, action: "inbox", reason: "stats.update is disabled by policy", missingEvidence };
    }
    if (confidence < policy.thresholds.routineConfidence) {
      return { operation, target, action: "inbox", reason: `confidence below routine threshold ${policy.thresholds.routineConfidence}`, missingEvidence };
    }
    return { operation, target: ".context/generated/stats/events.jsonl", action: "apply", reason: "generated stats event is auto-applicable support data", missingEvidence };
  }

  if (operation.op === "status.update") {
    return { operation, target, action: "inbox", reason: "STATUS.md auto-write is held for P1", missingEvidence };
  }
  if (operation.op === "verification.record") {
    return { operation, target, action: "inbox", reason: "VERIFY.md is canonical verification policy", missingEvidence };
  }
  if (operation.op === "module.alias.add" || operation.op === "module.path.add") {
    return { operation, target, action: "inbox", reason: "low-risk module metadata requires inbox promotion review", missingEvidence };
  }
  if (operation.op === "module.semantic.update" || operation.op === "module.update" || operation.op.startsWith("candidate.module")) {
    return { operation, target, action: "inbox", reason: "module semantics and boundaries require candidate review", missingEvidence };
  }
  if (operation.op === "decision.record" || operation.op.startsWith("candidate.decision")) {
    return { operation, target, action: "inbox", reason: "DECISIONS.md is never auto-written from agent proposals", missingEvidence };
  }

  return { operation, target, action: "inbox", reason: "unknown or semantic operation is candidate-only in P0", missingEvidence };
}

async function validateTarget(cwd: string, target: string): Promise<string | undefined> {
  if (path.isAbsolute(target)) {
    return "absolute targets are not allowed";
  }
  try {
    const absolute = await resolveInsideRoot(cwd, target);
    const relative = projectRelative(cwd, absolute);
    if (relative !== target.split(path.sep).join("/")) {
      return "target must resolve to its project-relative path";
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  if (target === ".context/CHECKPOINT.md") {
    return undefined;
  }
  if (target === ".context/STATUS.md") {
    return undefined;
  }
  if (target === ".context/VERIFY.md") {
    return undefined;
  }
  if (target === ".context/DECISIONS.md") {
    return undefined;
  }
  if (/^\.context\/modules\/[^/]+\.md$/.test(target)) {
    return undefined;
  }
  if (/^\.context\/generated\/.+/.test(target)) {
    return undefined;
  }
  return "target is outside the MapPatch canonical whitelist";
}

async function collectMissingEvidence(cwd: string, evidence: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const item of evidence) {
    if (!looksLikeFileEvidence(item)) {
      continue;
    }
    const absolute = await resolveInsideRoot(cwd, item);
    if (!(await fileExists(absolute))) {
      missing.push(item);
    }
  }
  return missing;
}

function looksLikeFileEvidence(value: string): boolean {
  if (/^https?:\/\//i.test(value) || value.startsWith("cmd:")) {
    return false;
  }
  if (/\s/.test(value)) {
    return false;
  }
  return value.includes("/") || value.startsWith(".") || /\.[a-z0-9]+$/i.test(value);
}

function defaultTarget(operation: MapPatchOperation): string {
  if (operation.target) {
    return operation.target;
  }
  if (operation.op === "checkpoint.write") {
    return ".context/CHECKPOINT.md";
  }
  if (operation.op === "status.update") {
    return ".context/STATUS.md";
  }
  if (operation.op === "verification.record") {
    return ".context/VERIFY.md";
  }
  if (operation.op === "verification.evidence") {
    return ".context/generated/evidence/verification.jsonl";
  }
  if (operation.op === "evidence.append") {
    const fields = operation.fields ?? {};
    const moduleId = stringField(fields.module) ?? stringField(fields.moduleId) ?? "unknown";
    return `.context/generated/evidence/modules/${moduleId}.jsonl`;
  }
  if (operation.op === "stats.update") {
    return ".context/generated/stats/events.jsonl";
  }
  if (operation.op === "decision.record") {
    return ".context/DECISIONS.md";
  }
  if (operation.op === "module.alias.add" || operation.op === "module.path.add" || operation.op === "module.semantic.update") {
    const fields = operation.fields ?? {};
    const moduleId = stringField(fields.module) ?? stringField(fields.moduleId) ?? "unknown";
    return `.context/modules/${moduleId}.md`;
  }
  return ".context/inbox/agent.md";
}

async function closeCheckpointFromOperation(cwd: string, patch: MapPatch, operation: MapPatchOperation): Promise<void> {
  const checkpointPath = path.join(cwd, ".context", "CHECKPOINT.md");
  const current = await readFile(checkpointPath, "utf8");
  const parsed = matter(current);
  const data = {
    ...parsed.data,
    context_type: "checkpoint",
    status: "closed",
    source: "cmap update --agent",
    updated_at: new Date().toISOString()
  };
  const body = `# Current Checkpoint

## Current Task
${patch.task ?? operation.summary ?? "Closed checkpoint"}

## Current Hypothesis
Checkpoint closed by MapPatch operation with explicit verification.

## Changed Files
None recorded.

## Verified
${stringField(operation.fields?.verified) ?? "Not recorded."}

## Failed / Pending
None recorded.

## Next Step
${stringField(operation.fields?.next) ?? "Start the next task."}

## Do Not Redo
${stringField(operation.fields?.do_not_redo ?? operation.fields?.doNotRedo) ?? "None recorded."}
`;
  await writeFile(checkpointPath, ensureTrailingNewline(matter.stringify(body, data)), "utf8");
}

async function writeGeneratedEvidenceFromOperation(cwd: string, operation: MapPatchOperation): Promise<void> {
  const policy = await loadContextPolicy(cwd);
  const fields = operation.fields ?? {};
  const moduleId = stringField(fields.module) ?? stringField(fields.moduleId) ?? "unknown";
  await appendModuleEvidence(cwd, {
    moduleId,
    summary: stringField(fields.summary) ?? operation.summary ?? "Generated evidence from MapPatch.",
    files: stringArrayField(fields.files) ?? stringArrayField(fields.file ? [fields.file] : undefined) ?? [],
    commands: stringArrayField(fields.commands),
    source: "mappatch",
    confidence: operation.confidence ?? 1
  }, policy.generatedEvidence.maxEntries);
}

async function writeVerificationEvidenceFromOperation(cwd: string, operation: MapPatchOperation): Promise<void> {
  const fields = operation.fields ?? {};
  await appendVerificationEvidence(cwd, {
    summary: stringField(fields.summary) ?? operation.summary ?? "Verification evidence from MapPatch.",
    files: stringArrayField(fields.files) ?? [],
    commands: stringArrayField(fields.commands),
    source: "mappatch",
    confidence: operation.confidence ?? 1
  });
}

async function writeStatsEventFromOperation(cwd: string, operation: MapPatchOperation): Promise<void> {
  await appendGeneratedStatsEvent(cwd, {
    type: stringField(operation.fields?.type) ?? "mappatch.stats.update",
    summary: operation.summary ?? "Stats update from MapPatch.",
    fields: operation.fields ?? {}
  });
}

async function writeCheckpointFromOperation(cwd: string, patch: MapPatch, operation: MapPatchOperation): Promise<void> {
  const checkpointPath = path.join(cwd, ".context", "CHECKPOINT.md");
  const current = await readFile(checkpointPath, "utf8");
  const parsed = matter(current);
  const fields = operation.fields ?? {};
  const data = {
    ...parsed.data,
    context_type: "checkpoint",
    status: stringField(fields.status) ?? "active",
    source: "cmap update --agent",
    updated_at: new Date().toISOString()
  };
  const task = stringField(fields.task) ?? patch.task ?? operation.summary;
  const next = stringField(fields.next) ?? stringField(fields.next_step) ?? "Review current MapPatch results.";
  const body = `# Current Checkpoint

## Current Task
${task}

## Current Hypothesis
${stringField(fields.hypothesis) ?? "Auto-generated from explicit MapPatch fields and evidence. No semantic hypothesis recorded."}

## Changed Files
${formatList(fields.files ?? fields.changed_files ?? fields.changedFiles)}

## Verified
${stringField(fields.verified) ?? "Not recorded."}

## Failed / Pending
${stringField(fields.failed) ?? "None recorded."}

## Next Step
${next}

## Do Not Redo
${stringField(fields.do_not_redo ?? fields.doNotRedo) ?? "None recorded."}
`;
  await writeFile(checkpointPath, ensureTrailingNewline(matter.stringify(body, data)), "utf8");
}

async function writeInboxReport(cwd: string, patch: MapPatch, evaluations: EvaluatedMapPatchOperation[]): Promise<string> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  await mkdir(inboxRoot, { recursive: true });
  const target = path.join(inboxRoot, `update-${timeStamp()}.md`);
  await writeFile(target, renderInboxReport(patch, evaluations), "utf8");
  return projectRelative(cwd, target);
}

async function writeAudit(
  cwd: string,
  patch: MapPatch,
  evaluations: EvaluatedMapPatchOperation[],
  backupId: string | undefined,
  inboxPath: string | undefined
): Promise<string> {
  const auditRoot = path.join(cwd, ".context", "audit");
  await mkdir(auditRoot, { recursive: true });
  const target = path.join(auditRoot, `update-${timeStamp()}.md`);
  const lines = [
    "# MapPatch Audit",
    "",
    `Created: ${new Date().toISOString()}`,
    `Agent: ${patch.agent ?? "unknown"}`,
    `Summary: ${patch.summary}`,
    `Backup: ${backupId ?? "none"}`,
    `Inbox: ${inboxPath ?? "none"}`,
    "",
    ...renderEvaluationGroups(evaluations)
  ];
  await writeFile(target, lines.join("\n"), "utf8");
  return projectRelative(cwd, target);
}

function renderInboxReport(patch: MapPatch, evaluations: EvaluatedMapPatchOperation[]): string {
  const lines = [
    "# Agent MapPatch Inbox",
    "",
    `Agent: ${patch.agent ?? "unknown"}`,
    `Summary: ${patch.summary}`,
    "",
    "This file is candidate input only. It does not modify canonical `.context` facts.",
    "",
    ...renderEvaluationGroups(evaluations.filter((evaluation) => evaluation.action !== "apply"))
  ];
  return lines.join("\n");
}

function renderEvaluationGroups(evaluations: EvaluatedMapPatchOperation[]): string[] {
  const groups: Array<[string, "apply" | "inbox" | "reject"]> = [
    ["Routine Auto-Apply", "apply"],
    ["Routed to Inbox", "inbox"],
    ["Rejected", "reject"]
  ];
  const lines: string[] = [];
  for (const [title, action] of groups) {
    const group = evaluations.filter((evaluation) => evaluation.action === action);
    lines.push(`## ${title}`, "");
    if (group.length === 0) {
      lines.push("- None");
    } else {
      for (const evaluation of group) {
        lines.push(`- ${evaluation.operation.op} -> \`${evaluation.target}\``);
        lines.push(`  - summary: ${evaluation.operation.summary ?? stringField(evaluation.operation.fields?.summary) ?? "not recorded"}`);
        lines.push(`  - reason: ${evaluation.reason}`);
        if (evaluation.missingEvidence.length > 0) {
          lines.push(`  - missing evidence: ${evaluation.missingEvidence.map((item) => `\`${item}\``).join(", ")}`);
        }
      }
    }
    lines.push("");
  }
  return lines;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArrayField(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const values = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function formatList(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
    return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "None recorded.";
  }
  const text = stringField(value);
  if (!text) {
    return "None recorded.";
  }
  const items = text.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "None recorded.";
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function timeStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").toLowerCase();
}
