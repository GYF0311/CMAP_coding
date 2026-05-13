import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";
import {
  evaluateRelationPatch,
  parseRelationPatch,
  readRelationPatch,
  type RelationCandidate,
  type RelationPatchEvaluation
} from "../core/relation-patch.js";

type RelateRequestOptions = {
  task?: string;
  changed?: string;
  out?: string;
  from?: string;
  to?: string;
  relation?: string;
};

type RelateIngestOptions = {
  from?: string;
  dryRun?: boolean;
  writeInbox?: boolean;
};

type RelatePromoteOptions = {
  dryRun?: boolean;
};

export async function runRelateRequest(cwd: string, options: RelateRequestOptions): Promise<void> {
  const relation = options.relation ?? "depends_on";
  const from = options.from ?? "source-module";
  const to = options.to ?? "target-module";
  const body = [
    "# RelationPatch Request",
    "",
    options.task ? `Task: ${options.task}` : "Task: Not available",
    options.changed ? `Changed: ${options.changed}` : "Changed: Not available",
    "",
    "AI should inspect the changed files and return a candidate-only RelationPatch.",
    "",
    "```json",
    JSON.stringify({
      schema: "cmap.relation_patch.v1",
      agent: "codex",
      task: options.task ?? "",
      summary: "AI reviewed changed files and proposed relation candidates.",
      operations: [
        {
          op: "relation.candidate.add",
          relation,
          from,
          to,
          summary: "Why this reviewed relation might be useful.",
          evidence: options.changed ? options.changed.split(",").map((item) => item.trim()).filter(Boolean) : [],
          confidence: 0.8,
          risk: "medium"
        }
      ]
    }, null, 2),
    "```",
    ""
  ].join("\n");

  if (options.out) {
    const target = await resolveInsideRoot(cwd, options.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body, "utf8");
    process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
    return;
  }

  process.stdout.write(body);
}

export async function runRelateIngest(cwd: string, options: RelateIngestOptions): Promise<void> {
  if (!options.from) {
    throw new CmapCommandError("relate ingest requires --from <path>", 2);
  }
  if (options.dryRun && options.writeInbox) {
    throw new CmapCommandError("Choose either --dry-run or --write-inbox, not both.", 2);
  }

  const patch = await readRelationPatch(cwd, options.from);
  const evaluations = await evaluateRelationPatch(cwd, patch);
  if (options.writeInbox) {
    const result = await writeInboxCandidates(cwd, evaluations);
    process.stdout.write("# RelationPatch Ingest\n\n");
    process.stdout.write(`Written candidates: ${result.written}\n`);
    process.stdout.write(`Rejected candidates: ${result.rejected}\n`);
    process.stdout.write(`Duplicate candidates skipped: ${result.duplicates}\n`);
    if (result.auditPath) {
      process.stdout.write(`Audit: ${result.auditPath}\n`);
    }
    return;
  }

  process.stdout.write("# RelationPatch Dry Run\n\n");
  for (const evaluation of evaluations) {
    process.stdout.write(`- ${evaluation.operation.op}\n`);
    process.stdout.write(`  Fingerprint: ${evaluation.fingerprint}\n`);
    process.stdout.write(`  Action: ${evaluation.action}\n`);
    if (evaluation.reason) {
      process.stdout.write(`  Reason: ${evaluation.reason}\n`);
    }
  }
}

export async function runRelatePromote(cwd: string, id: string, options: RelatePromoteOptions): Promise<void> {
  if (!options.dryRun) {
    throw new CmapCommandError("relation candidates are candidate-only in v0.2; use --dry-run", 2);
  }
  const candidate = await readRelationCandidate(cwd, id);
  process.stdout.write("# Relation Promote Dry Run\n\n");
  process.stdout.write("No canonical files changed.\n\n");
  if (candidate.relation) {
    process.stdout.write(`${candidate.relation}: ${candidate.from} -> ${candidate.to}\n`);
  } else {
    process.stdout.write(`${candidate.operation}: ${candidate.from}\n`);
  }
  process.stdout.write(`Summary: ${candidate.summary}\n`);
  process.stdout.write("\nReview checklist:\n");
  process.stdout.write("- Confirm the relation from code and module docs.\n");
  process.stdout.write("- Edit canonical module docs manually if promoted.\n");
  process.stdout.write("- Run cmap graph build and cmap verify after canonical edits.\n");
}

async function writeInboxCandidates(
  cwd: string,
  evaluations: RelationPatchEvaluation[]
): Promise<{ written: number; rejected: number; duplicates: number; auditPath?: string }> {
  const root = path.join(cwd, ".context", "inbox", "relations");
  await mkdir(root, { recursive: true });
  let written = 0;
  let rejected = 0;
  let duplicates = 0;
  const writtenIds: string[] = [];

  for (const evaluation of evaluations) {
    if (evaluation.action === "reject") {
      rejected += 1;
      continue;
    }
    if (evaluation.action === "duplicate") {
      duplicates += 1;
      continue;
    }
    if (!evaluation.candidate) {
      continue;
    }
    await writeCandidatePair(root, evaluation.candidate);
    written += 1;
    writtenIds.push(evaluation.candidate.id);
  }

  const auditPath = await writeAudit(cwd, { written, rejected, duplicates, writtenIds });
  return { written, rejected, duplicates, auditPath };
}

async function writeCandidatePair(root: string, candidate: RelationCandidate): Promise<void> {
  const jsonPath = path.join(root, `${candidate.id}.json`);
  const mdPath = path.join(root, `${candidate.id}.md`);
  await writeFile(jsonPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderCandidateMarkdown(candidate), "utf8");
}

function renderCandidateMarkdown(candidate: RelationCandidate): string {
  const relationLine = candidate.relation
    ? `${candidate.relation}: ${candidate.from} -> ${candidate.to}`
    : `${candidate.operation}: ${candidate.from}`;
  return [
    "---",
    "context_type: candidate",
    `id: ${candidate.id}`,
    `type: ${candidate.operation}`,
    `risk: ${candidate.risk}`,
    `from: ${candidate.from}`,
    `to: ${candidate.to}`,
    candidate.relation ? `relation: ${candidate.relation}` : undefined,
    "canonical: false",
    "---",
    `# Relation Candidate: ${candidate.id}`,
    "",
    "Candidate / Non-canonical: candidate input only.",
    "",
    `- ${relationLine}`,
    `- Confidence: ${candidate.confidence}`,
    `- Summary: ${candidate.summary}`,
    "",
    "## Evidence",
    ...(candidate.evidence.length > 0 ? candidate.evidence.map((item) => `- \`${item}\``) : ["- Not available"]),
    ""
  ].filter((line): line is string => line !== undefined).join("\n");
}

async function writeAudit(
  cwd: string,
  input: { written: number; rejected: number; duplicates: number; writtenIds: string[] }
): Promise<string> {
  const root = path.join(cwd, ".context", "audit");
  await mkdir(root, { recursive: true });
  const target = path.join(root, `relation-ingest-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
  await writeFile(
    target,
    [
      "# Relation Ingest Audit",
      "",
      `Created: ${new Date().toISOString()}`,
      `Written candidates: ${input.written}`,
      `Rejected candidates: ${input.rejected}`,
      `Duplicate candidates skipped: ${input.duplicates}`,
      "",
      "## Written IDs",
      ...(input.writtenIds.length > 0 ? input.writtenIds.map((id) => `- ${id}`) : ["- None"]),
      ""
    ].join("\n"),
    "utf8"
  );
  return projectRelative(cwd, target);
}

async function readRelationCandidate(cwd: string, id: string): Promise<RelationCandidate> {
  const target = path.join(cwd, ".context", "inbox", "relations", `${id}.json`);
  if (!(await fileExists(target))) {
    throw new CmapCommandError(`Relation candidate not found: ${id}`, 2);
  }
  return JSON.parse(await readFile(target, "utf8")) as RelationCandidate;
}
