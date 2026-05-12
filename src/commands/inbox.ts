import { mkdir, readdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative } from "../fs/safe-path.js";

type InboxCandidate = {
  id: string;
  file: string;
  absolutePath: string;
  raw: string;
  risk: "high" | "routine";
  type: string;
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
    "- Archive after review: `cmap inbox archive <id>`",
    "- Save agent candidates: `cmap update --agent --from <file> --write-inbox`",
    "- Promote manually only after review: edit canonical `.context` files with evidence",
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
    "Archive rejected or obsolete candidates with `cmap inbox archive <id>`.",
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

export async function runInboxPromote(cwd: string, id: string, options: { dryRun?: boolean }): Promise<void> {
  if (!options.dryRun) {
    throw new CmapCommandError("inbox promote currently requires --dry-run; canonical promotion remains manual");
  }
  const candidate = await loadInboxCandidate(cwd, id);
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
