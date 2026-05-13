import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { loadContextPolicy } from "../context/policy.js";
import { fileExists } from "../context/scanner.js";
import { appendModuleEvidence, appendVerificationEvidence } from "../core/generated-store.js";
import { loadModuleIndex } from "../core/module-index.js";
import { CmapCommandError } from "../errors.js";
import { createBackup, restoreBackup } from "../fs/backup.js";
import { projectRelative } from "../fs/safe-path.js";
import { verifyContext } from "./verify.js";

type InboxCandidate = {
  id: string;
  file: string;
  absolutePath: string;
  raw: string;
  risk: "high" | "routine";
  type: string;
  data: Record<string, unknown>;
  mtimeMs: number;
};

export async function runInboxStatus(cwd: string): Promise<void> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  const files = await listInboxFiles(inboxRoot);
  let highRisk = 0;

  for (const file of files) {
    const raw = await readFile(path.join(inboxRoot, file), "utf8");
    if (isHighRiskCandidate(raw)) {
      highRisk += 1;
    }
  }

  const lines = [
    "# Inbox Status",
    "",
    `Total candidates: ${files.length}`,
    `High-risk candidates: ${highRisk}`,
    "",
    "Inbox files are candidate input only; they are not canonical `.context` facts.",
    "",
    "Suggested commands:",
    "- Re-check backlog: `cmap inbox status`",
    "- Review backlog: `cmap inbox triage`",
    "- Preview promotion: `cmap inbox promote <id> --dry-run`",
    "- Apply low-risk metadata/evidence: `cmap inbox promote <id> --apply`",
    "- Reject after review: `cmap inbox reject <id> --reason \"...\"`",
    "- Archive after review: `cmap inbox archive <id>`",
    "- Save agent candidates: `cmap update --agent --from <file> --write-inbox`",
    "- Promote semantic facts manually only after review: edit canonical `.context` files with evidence",
    ""
  ];

  process.stdout.write(lines.join("\n"));
}

export async function runInboxTriage(cwd: string): Promise<void> {
  const candidates = await loadInboxCandidates(cwd);
  const highRisk = candidates.filter((candidate) => candidate.risk === "high").length;
  const byType = countBy(candidates.map((candidate) => candidate.type));
  const oldest = candidates.slice().sort((a, b) => a.mtimeMs - b.mtimeMs)[0];
  const lines = [
    "# Inbox Triage",
    "",
    `Pending candidates: ${candidates.length}`,
    `High-risk candidates: ${highRisk}`,
    `Oldest candidate: ${oldest ? `${oldest.id} (${oldest.file})` : "none"}`,
    "",
    "## By Type",
    "",
    ...renderCounts(byType),
    "",
    "## Candidates",
    "",
    ...renderCandidateList(candidates),
    "",
    "## Recommended Action",
    "",
    highRisk > 0
      ? "Review high-risk candidates first with `cmap inbox promote <id> --dry-run`."
      : "Review oldest candidates first with `cmap inbox promote <id> --dry-run`.",
    "Reject false candidates with `cmap inbox reject <id> --reason \"...\"`; archive obsolete candidates with `cmap inbox archive <id>`.",
    ""
  ];
  process.stdout.write(lines.join("\n"));
}

export async function runInboxArchive(cwd: string, id: string): Promise<void> {
  const candidate = await loadInboxCandidate(cwd, id);
  const archiveRoot = path.join(cwd, ".context", "inbox", "archive");
  await mkdir(archiveRoot, { recursive: true });
  const archivePath = await nextArchivePath(archiveRoot, `${candidate.id}.md`);
  await rename(candidate.absolutePath, archivePath);
  process.stdout.write(`Archived ${candidate.file} -> ${projectRelative(cwd, archivePath)}\n`);
}

export async function runInboxReject(cwd: string, id: string, options: { reason?: string }): Promise<void> {
  const reason = stringField(options.reason);
  if (!reason) {
    throw new CmapCommandError("inbox reject requires --reason <text>", 2);
  }
  const candidate = await loadInboxCandidate(cwd, id);
  const archiveRoot = path.join(cwd, ".context", "inbox", "archive");
  await mkdir(archiveRoot, { recursive: true });
  const archivePath = await nextArchivePath(archiveRoot, `rejected-${candidate.id}.md`);
  await writeFile(
    candidate.absolutePath,
    [
      "# Rejected Inbox Candidate",
      "",
      `Rejected: ${new Date().toISOString()}`,
      `Reason: ${reason}`,
      "",
      "## Original Candidate",
      "",
      candidate.raw
    ].join("\n"),
    "utf8"
  );
  await rename(candidate.absolutePath, archivePath);
  process.stdout.write(`Rejected ${candidate.file} -> ${projectRelative(cwd, archivePath)}\n`);
}

export async function runInboxPromote(cwd: string, id: string, options: { dryRun?: boolean; apply?: boolean }): Promise<void> {
  const candidate = await loadInboxCandidate(cwd, id);
  if (options.apply) {
    await applyInboxCandidate(cwd, candidate);
    return;
  }
  const lines = [
    "# Inbox Promote Dry Run",
    "",
    `Candidate: ${candidate.id}`,
    `File: ${candidate.file}`,
    `Candidate type: ${candidate.type}`,
    `Risk: ${candidate.risk}`,
    `Suggested target: ${suggestedTarget(candidate.type)}`,
    "",
    "No canonical files changed.",
    "",
    "## Review Checklist",
    "",
    "- Confirm the candidate has concrete file, command, or decision evidence.",
    "- Edit the suggested canonical file manually only if the fact should become durable.",
    "- Archive this candidate after accepting or rejecting it.",
    "",
    "## Candidate Preview",
    "",
    ...candidate.raw.split(/\r?\n/).slice(0, 40),
    ""
  ];
  process.stdout.write(lines.join("\n"));
}

async function listInboxFiles(inboxRoot: string): Promise<string[]> {
  if (!(await fileExists(inboxRoot))) {
    return [];
  }
  const entries = await readdir(inboxRoot);
  return entries.filter((entry) => entry.endsWith(".md")).sort();
}

async function loadInboxCandidates(cwd: string): Promise<InboxCandidate[]> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  const files = await listInboxFiles(inboxRoot);
  const candidates: InboxCandidate[] = [];
  for (const file of files) {
    const absolutePath = path.join(inboxRoot, file);
    const raw = await readFile(absolutePath, "utf8");
    const info = await stat(absolutePath);
    candidates.push({
      id: path.basename(file, ".md"),
      file: projectRelative(cwd, absolutePath),
      absolutePath,
      raw,
      risk: isHighRiskCandidate(raw) ? "high" : "routine",
      data: matter(raw).data,
      type: candidateType(raw, file),
      mtimeMs: info.mtimeMs
    });
  }
  return candidates;
}

async function loadInboxCandidate(cwd: string, id: string): Promise<InboxCandidate> {
  const safeId = normalizeCandidateId(id);
  const candidates = await loadInboxCandidates(cwd);
  const candidate = candidates.find((item) => item.id === safeId);
  if (!candidate) {
    throw new CmapCommandError(`Inbox candidate not found: ${id}`);
  }
  return candidate;
}

function normalizeCandidateId(id: string): string {
  const normalized = id.endsWith(".md") ? id.slice(0, -3) : id;
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    throw new CmapCommandError("Inbox candidate id must be a filename id, not a path");
  }
  return normalized;
}

function isHighRiskCandidate(raw: string): boolean {
  return /risk:\s*high/i.test(raw) || /high-risk/i.test(raw) || /operation is marked high risk/i.test(raw);
}

function candidateType(raw: string, file: string): string {
  const parsedType = matter(raw).data.type;
  if (typeof parsedType === "string" && parsedType.trim()) {
    return parsedType.trim();
  }
  const haystack = `${file}\n${raw}`.toLowerCase();
  if (haystack.includes("alias")) {
    return "alias";
  }
  if (haystack.includes("decision")) {
    return "decision";
  }
  if (haystack.includes("verification") || haystack.includes("verify")) {
    return "verify";
  }
  if (haystack.includes("ownership") || haystack.includes("path")) {
    return "path";
  }
  if (haystack.includes("module")) {
    return "module";
  }
  return "semantic";
}

async function applyInboxCandidate(cwd: string, candidate: InboxCandidate): Promise<void> {
  const allowed = new Set(["module.alias.add", "module.path.add", "evidence.merge", "verification.evidence"]);
  if (!allowed.has(candidate.type)) {
    throw new CmapCommandError(`Inbox candidate type ${candidate.type} cannot be auto-applied`, 2);
  }

  const policy = await loadContextPolicy(cwd);
  const confidence = numberField(candidate.data.confidence) ?? 0;
  if (confidence < policy.thresholds.evidenceConfidence) {
    throw new CmapCommandError(`Inbox candidate confidence ${confidence} is below threshold ${policy.thresholds.evidenceConfidence}`, 2);
  }

  const evidence = stringArrayField(candidate.data.evidence);
  for (const item of evidence) {
    if (!(await fileExists(path.join(cwd, item)))) {
      throw new CmapCommandError(`Evidence file does not exist: ${item}`, 2);
    }
  }

  const before = await verifyContext(cwd);
  const targetFiles = [candidate.absolutePath];
  const module = await candidateModule(cwd, candidate);
  if ((candidate.type === "module.alias.add" || candidate.type === "module.path.add") && module) {
    targetFiles.push(module.absolutePath);
  }
  const backupId = await createBackup(cwd, targetFiles);

  if (candidate.type === "module.alias.add") {
    if (!module) {
      throw new CmapCommandError("module.alias.add requires module", 2);
    }
    await addModuleAlias(module.absolutePath, stringField(candidate.data.alias) ?? stringField(candidate.data.value));
  } else if (candidate.type === "module.path.add") {
    if (!module) {
      throw new CmapCommandError("module.path.add requires module", 2);
    }
    await addModulePath(module.absolutePath, stringField(candidate.data.path) ?? stringField(candidate.data.include));
  } else if (candidate.type === "evidence.merge") {
    const moduleId = stringField(candidate.data.module) ?? stringField(candidate.data.moduleId);
    if (!moduleId) {
      throw new CmapCommandError("evidence.merge requires module", 2);
    }
    await appendModuleEvidence(cwd, {
      moduleId,
      summary: stringField(candidate.data.summary) ?? firstHeading(candidate.raw) ?? "Inbox evidence merge.",
      files: evidence,
      source: "reconcile",
      confidence
    }, policy.generatedEvidence.maxEntries);
  } else if (candidate.type === "verification.evidence") {
    await appendVerificationEvidence(cwd, {
      summary: stringField(candidate.data.summary) ?? firstHeading(candidate.raw) ?? "Inbox verification evidence.",
      files: evidence,
      source: "reconcile",
      confidence
    });
  }

  const archiveRoot = path.join(cwd, ".context", "inbox", "archive");
  await mkdir(archiveRoot, { recursive: true });
  const archivePath = await nextArchivePath(archiveRoot, `${candidate.id}.md`);
  await rename(candidate.absolutePath, archivePath);
  const auditPath = await writePromoteAudit(cwd, candidate, backupId, projectRelative(cwd, archivePath));
  const after = await verifyContext(cwd);
  const newErrors = findNewErrors(before.issues, after.issues);
  if (newErrors.length > 0) {
    await restoreBackup(cwd, backupId);
    throw new CmapCommandError(
      [`Post-verify found new errors; rolled back backup ${backupId}.`, ...newErrors.map((message) => `- ${message}`)].join("\n"),
      2
    );
  }

  process.stdout.write(`# Inbox Promote Apply

Applied inbox candidate: ${candidate.id}
Type: ${candidate.type}
Backup: ${backupId}
Audit: ${auditPath}
Archived: ${projectRelative(cwd, archivePath)}
Post-verify: no new errors
`);
}

async function candidateModule(cwd: string, candidate: InboxCandidate) {
  const moduleId = stringField(candidate.data.module) ?? stringField(candidate.data.moduleId);
  if (!moduleId) {
    return undefined;
  }
  const modules = await loadModuleIndex(cwd);
  return modules.find((module) => module.id === moduleId || module.aliases.includes(moduleId));
}

async function addModuleAlias(modulePath: string, alias: string | undefined): Promise<void> {
  if (!alias) {
    throw new CmapCommandError("module.alias.add requires alias", 2);
  }
  const parsed = matter(await readFile(modulePath, "utf8"));
  const aliases = uniqueStrings([...(Array.isArray(parsed.data.aliases) ? parsed.data.aliases : []), alias]);
  parsed.data.aliases = aliases;
  await writeFile(modulePath, matter.stringify(parsed.content, parsed.data), "utf8");
}

async function addModulePath(modulePath: string, includePath: string | undefined): Promise<void> {
  if (!includePath) {
    throw new CmapCommandError("module.path.add requires path", 2);
  }
  const parsed = matter(await readFile(modulePath, "utf8"));
  if (Array.isArray(parsed.data.paths)) {
    parsed.data.paths = uniqueStrings([...parsed.data.paths, includePath]);
  } else if (parsed.data.paths && typeof parsed.data.paths === "object") {
    const paths = parsed.data.paths as Record<string, unknown>;
    paths.include = uniqueStrings([...(Array.isArray(paths.include) ? paths.include : []), includePath]);
    parsed.data.paths = paths;
  } else {
    parsed.data.paths = [includePath];
  }
  await writeFile(modulePath, matter.stringify(parsed.content, parsed.data), "utf8");
}

async function writePromoteAudit(cwd: string, candidate: InboxCandidate, backupId: string, archivePath: string): Promise<string> {
  const auditRoot = path.join(cwd, ".context", "audit");
  await mkdir(auditRoot, { recursive: true });
  const target = path.join(auditRoot, `inbox-promote-${new Date().toISOString().replace(/[:.]/g, "-").toLowerCase()}.md`);
  await writeFile(
    target,
    [
      "# Inbox Promote Audit",
      "",
      `Candidate: ${candidate.id}`,
      `Type: ${candidate.type}`,
      `Backup: ${backupId}`,
      `Archive: ${archivePath}`,
      `Created: ${new Date().toISOString()}`,
      ""
    ].join("\n"),
    "utf8"
  );
  return projectRelative(cwd, target);
}

function findNewErrors(
  before: Array<{ level: "error" | "warning"; message: string }>,
  after: Array<{ level: "error" | "warning"; message: string }>
): string[] {
  const beforeErrors = new Set(before.filter((issue) => issue.level === "error").map((issue) => issue.message));
  return after
    .filter((issue) => issue.level === "error")
    .map((issue) => issue.message)
    .filter((message) => !beforeErrors.has(message));
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

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
}

function firstHeading(raw: string): string | undefined {
  return raw.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim();
}

function countBy(items: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

function renderCounts(counts: Map<string, number>): string[] {
  if (counts.size === 0) {
    return ["- none: 0"];
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => `- ${type}: ${count}`);
}

function renderCandidateList(candidates: InboxCandidate[]): string[] {
  if (candidates.length === 0) {
    return ["- None"];
  }
  return candidates.map((candidate) => `- ${candidate.id}: ${candidate.type}, ${candidate.risk}, ${candidate.file}`);
}

function suggestedTarget(type: string): string {
  if (type === "decision") {
    return ".context/DECISIONS.md";
  }
  if (type === "verify") {
    return ".context/VERIFY.md";
  }
  if (type === "alias" || type === "module" || type === "path") {
    return ".context/modules/<module>.md";
  }
  return ".context/MAP.md or a module doc after review";
}

async function nextArchivePath(archiveRoot: string, filename: string): Promise<string> {
  const first = path.join(archiveRoot, filename);
  if (!(await fileExists(first))) {
    return first;
  }
  const parsed = path.parse(filename);
  return path.join(archiveRoot, `${parsed.name}-${new Date().toISOString().replace(/[:.]/g, "-")}${parsed.ext}`);
}
