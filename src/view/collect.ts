import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";
import { parseCmapCandidate } from "../core/candidate-store.js";
import { generatedRoot, listModuleEvidence, type ModuleEvidence } from "../core/generated-store.js";
import { readFreshnessIndex, type FreshnessIndex } from "../core/freshness.js";
import { loadModuleIndex, loadProjectInfo, type ContextModule } from "../core/module-index.js";
import { projectRelative } from "../fs/safe-path.js";
import { type CmapViewData, viewDataSchemaId } from "./schema.js";

const MAX_EVIDENCE = 50;
const MAX_CANDIDATES = 100;
const execFileAsync = promisify(execFile);

type InboxCandidateView = CmapViewData["candidates"][number];
type RelationCandidateView = CmapViewData["relationCandidates"][number];

export type CollectViewOptions = {
  includeGenerated?: boolean;
  includeInbox?: boolean;
  includeFreshness?: boolean;
  generatedAt?: string;
};

export async function collectViewData(cwd: string, options: CollectViewOptions = {}): Promise<CmapViewData> {
  const warnings: string[] = [];
  const [project, modules] = await Promise.all([loadProjectInfo(cwd), loadModuleIndex(cwd)]);
  const included = {
    generated: Boolean(options.includeGenerated),
    inbox: Boolean(options.includeInbox),
    freshness: Boolean(options.includeFreshness)
  };
  const freshness = included.freshness ? await maybeReadFreshness(cwd, warnings) : undefined;
  const evidence = included.generated ? await collectEvidence(cwd, modules, warnings) : [];
  const { candidates, relationCandidates } = included.inbox
    ? await collectInboxCandidates(cwd, warnings)
    : { candidates: [], relationCandidates: [] };
  await checkRelationData(modules, warnings);

  return {
    schema: viewDataSchemaId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceCommit: await maybeSourceCommit(cwd),
    projectRootName: path.basename(cwd),
    included,
    project: {
      id: project.projectId,
      name: project.projectName
    },
    overview: await collectOverview(cwd),
    verify: await collectVerify(cwd),
    summary: {
      moduleCount: modules.length,
      evidenceCount: evidence.length,
      candidateCount: candidates.length + relationCandidates.length,
      warningCount: warnings.length
    },
    modules: modules.map((module) => toModuleView(module, freshness)),
    evidence,
    candidates,
    relationCandidates,
    warnings
  };
}

function toModuleView(
  module: ContextModule,
  freshness: FreshnessIndex | undefined
): CmapViewData["modules"][number] {
  const freshnessModule = freshness?.modules[module.id];
  return {
    id: module.id,
    name: module.name,
    docPath: module.docPath,
    status: module.status ?? "active",
    layer: module.layer ?? "Not available",
    risk: module.risk ?? "Not available",
    aliases: module.aliases,
    paths: module.pathsInclude,
    description: extractModuleDescription(module.body),
    relations: Object.entries(module.relations).flatMap(([type, targets]) => targets.map((target) => ({
      type,
      target,
      ...module.relationExplanations[type]?.[target]
    }))),
    freshness: {
      state: freshnessModule?.reviewState ?? "Not available",
      lastReviewedAt: freshnessModule?.lastSemanticReviewedAt ?? "Not available",
      newestGeneratedEvidenceAt: freshnessModule?.newestGeneratedEvidenceAt ?? "Not available",
      pendingInboxCandidates: freshnessModule?.pendingInboxCandidates ?? []
    },
    suggestedCommands: [
      { label: "Review module", command: `cmap freshness review --module ${module.id}` },
      { label: "Mark reviewed", command: `cmap freshness mark-reviewed --module ${module.id} --evidence "Reviewed ${module.id}"` }
    ]
  };
}

function extractModuleDescription(body: string): string | undefined {
  const sections = parseMarkdownSections(body);
  const preferred = sections.get("purpose");
  const summary = firstNonEmptyParagraph(preferred ?? body);
  return summary;
}

function parseMarkdownSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | undefined;
  let buffer: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (current) {
        sections.set(current.toLocaleLowerCase(), buffer.join("\n"));
      }
      current = match[1].trim();
      buffer = [];
      continue;
    }
    if (current) {
      buffer.push(line);
    }
  }
  if (current) {
    sections.set(current.toLocaleLowerCase(), buffer.join("\n"));
  }
  return sections;
}

function firstNonEmptyParagraph(value: string): string | undefined {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((paragraph) => !paragraph.startsWith("#"))[0];
}

async function maybeReadFreshness(cwd: string, warnings: string[]): Promise<FreshnessIndex | undefined> {
  const freshness = await readFreshnessIndex(cwd);
  if (!freshness) {
    warnings.push("Freshness data: Not available");
  }
  return freshness;
}

async function collectEvidence(
  cwd: string,
  modules: ContextModule[],
  warnings: string[]
): Promise<CmapViewData["evidence"]> {
  if (!(await fileExists(path.join(generatedRoot(cwd), "evidence")))) {
    warnings.push("Generated evidence: Not available");
    return [];
  }

  const entries: ModuleEvidence[] = [];
  for (const module of modules) {
    entries.push(...await listModuleEvidence(cwd, module.id));
  }
  const sorted = entries
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_EVIDENCE);
  if (entries.length > MAX_EVIDENCE) {
    warnings.push(`Generated evidence omitted: ${entries.length - MAX_EVIDENCE}`);
  }
  return sorted
    .map((entry) => ({
      moduleId: entry.moduleId,
      createdAt: entry.createdAt,
      source: entry.source,
      summary: entry.summary,
      files: entry.files.slice(0, 8),
      commands: entry.commands?.slice(0, 4) ?? []
    }));
}

async function collectInboxCandidates(
  cwd: string,
  warnings: string[]
): Promise<{ candidates: InboxCandidateView[]; relationCandidates: RelationCandidateView[] }> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  if (!(await fileExists(inboxRoot))) {
    warnings.push("Inbox candidates: Not available");
    return { candidates: [], relationCandidates: [] };
  }

  const topLevelFiles = (await readdir(inboxRoot))
    .filter((entry) => entry.endsWith(".md"))
    .sort();
  const files = topLevelFiles.slice(0, MAX_CANDIDATES);
  const candidates: InboxCandidateView[] = [];
  const relationCandidates: RelationCandidateView[] = [];
  for (const file of files) {
    const absolutePath = path.join(inboxRoot, file);
    const parsed = matter(await readFile(absolutePath, "utf8"));
    const data = parsed.data as Record<string, unknown>;
    const type = stringField(data.type) || inferCandidateType(parsed.content);
    const base = {
      id: path.basename(file, ".md"),
      file: projectRelative(cwd, absolutePath),
      type,
      risk: stringField(data.risk) || "Not available",
      moduleId: stringField(data.module) || stringField(data.moduleId) || "Not available",
      summary: firstSummary(parsed.content),
      suggestedCommands: [
        { label: "Dry run", command: `cmap inbox promote ${path.basename(file, ".md")} --dry-run` }
      ]
    };
    candidates.push(base);
    if (type.includes("relation")) {
      relationCandidates.push({
        id: base.id,
        file: base.file,
        from: stringField(data.from) || stringField(data.source) || base.moduleId,
        to: stringField(data.to) || stringField(data.target) || "Not available",
        relation: stringField(data.relation) || type,
        summary: base.summary,
        suggestedCommands: [
          { label: "Dry run", command: `cmap relate promote ${base.id} --dry-run` }
        ]
      });
    }
  }
  // v0.2 candidate-store: read structured candidates under .context/inbox/candidates/*.json.
  // Without this, the HTML review dashboard cannot see candidates produced by
  // `cmap update --agent --write-inbox` / relate ingest — defeating the whole
  // "human review layer" purpose of the v0.2 trust boundary.
  const structured = await collectStructuredCandidates(cwd, candidates.length);
  candidates.push(...structured.candidates);
  relationCandidates.push(...structured.relationCandidates);
  if (structured.omitted > 0) {
    warnings.push(`Structured candidates omitted: ${structured.omitted}`);
  }

  relationCandidates.push(...await collectRelationCandidateFiles(cwd, warnings));
  if (topLevelFiles.length > MAX_CANDIDATES) {
    warnings.push(`Inbox candidates omitted: ${topLevelFiles.length - MAX_CANDIDATES}`);
  }

  if (candidates.length === 0) {
    warnings.push("Inbox candidates: Not available");
  }
  if (relationCandidates.length === 0) {
    warnings.push("Relation candidates: Not available");
  }

  return { candidates, relationCandidates };
}

async function collectStructuredCandidates(
  cwd: string,
  alreadyCollected: number
): Promise<{ candidates: InboxCandidateView[]; relationCandidates: RelationCandidateView[]; omitted: number }> {
  const root = path.join(cwd, ".context", "inbox", "candidates");
  if (!(await fileExists(root))) {
    return { candidates: [], relationCandidates: [], omitted: 0 };
  }
  const entries = (await readdir(root)).filter((entry) => entry.endsWith(".json")).sort();
  const budget = Math.max(0, MAX_CANDIDATES - alreadyCollected);
  const accepted = entries.slice(0, budget);
  const omitted = entries.length - accepted.length;
  const candidates: InboxCandidateView[] = [];
  const relationCandidates: RelationCandidateView[] = [];
  for (const entry of accepted) {
    const absolutePath = path.join(root, entry);
    const parsed = parseCmapCandidate(await readFile(absolutePath, "utf8"));
    if (!parsed) {
      continue;
    }
    const moduleId =
      stringField((parsed.fields as Record<string, unknown>).module) ||
      stringField((parsed.fields as Record<string, unknown>).moduleId) ||
      parsed.target ||
      "Not available";
    const base: InboxCandidateView = {
      id: parsed.id,
      file: projectRelative(cwd, absolutePath),
      type: parsed.type,
      risk: parsed.risk,
      moduleId,
      summary: parsed.summary,
      suggestedCommands: [
        { label: "Dry run", command: `cmap inbox promote ${parsed.id} --dry-run` }
      ]
    };
    candidates.push(base);
    if (parsed.type.includes("relation")) {
      relationCandidates.push({
        id: parsed.id,
        file: base.file,
        from: stringField((parsed.fields as Record<string, unknown>).from) || moduleId,
        to: stringField((parsed.fields as Record<string, unknown>).to) || "Not available",
        relation: stringField((parsed.fields as Record<string, unknown>).relation) || parsed.type,
        summary: parsed.summary,
        suggestedCommands: [
          { label: "Dry run", command: `cmap relate promote ${parsed.id} --dry-run` }
        ]
      });
    }
  }
  return { candidates, relationCandidates, omitted };
}

async function collectRelationCandidateFiles(cwd: string, warnings: string[]): Promise<RelationCandidateView[]> {
  const root = path.join(cwd, ".context", "inbox", "relations");
  if (!(await fileExists(root))) {
    return [];
  }
  const entries = (await readdir(root)).filter((entry) => entry.endsWith(".json")).sort().slice(0, MAX_CANDIDATES);
  const result: RelationCandidateView[] = [];
  for (const entry of entries) {
    try {
      const absolutePath = path.join(root, entry);
      const parsed = JSON.parse(await readFile(absolutePath, "utf8")) as Record<string, unknown>;
      result.push({
        id: stringField(parsed.id) || path.basename(entry, ".json"),
        file: projectRelative(cwd, absolutePath),
        from: stringField(parsed.from) || "Not available",
        to: stringField(parsed.to) || "Not available",
        relation: stringField(parsed.relation) || stringField(parsed.operation) || "relation.candidate.add",
        summary: stringField(parsed.summary) || "Candidate / Non-canonical",
        suggestedCommands: [
          { label: "Dry run", command: `cmap relate promote ${stringField(parsed.id) || path.basename(entry, ".json")} --dry-run` }
        ]
      });
    } catch {
      warnings.push(`Relation candidate unreadable: .context/inbox/relations/${entry}`);
    }
  }
  return result;
}

async function checkRelationData(modules: ContextModule[], warnings: string[]): Promise<void> {
  const hasRelations = modules.some((module) => Object.values(module.relations).some((targets) => targets.length > 0));
  if (!hasRelations) {
    warnings.push("Reviewed relations: Not available");
  }
}

async function collectOverview(cwd: string): Promise<CmapViewData["overview"]> {
  const [map, status, checkpoint] = await Promise.all([
    maybeReadContextFile(cwd, "MAP.md"),
    maybeReadContextFile(cwd, "STATUS.md"),
    maybeReadContextFile(cwd, "CHECKPOINT.md")
  ]);
  return {
    purpose: firstText(section(map, "Purpose")) ?? firstText(section(map, "Project Purpose")),
    activeGoal: firstText(section(status, "Active Goal")),
    currentTask: firstText(section(checkpoint, "Current Task")),
    nextStep: firstText(section(checkpoint, "Next Step")) ?? firstText(section(status, "Next Steps")),
    verified: firstText(section(checkpoint, "Verified")),
    lastVerified: firstText(section(status, "Last Verified"))
  };
}

async function collectVerify(cwd: string): Promise<CmapViewData["verify"]> {
  const raw = await maybeReadContextFile(cwd, "VERIFY.md");
  if (!raw) {
    return { requiredCommands: [], manualChecks: [] };
  }
  return {
    requiredCommands: parseRequiredCommands(section(raw, "Required Commands") ?? ""),
    manualChecks: bulletItems(section(raw, "Manual Verification") ?? "")
  };
}

async function maybeReadContextFile(cwd: string, relative: string): Promise<string | undefined> {
  const target = path.join(cwd, ".context", relative);
  if (!(await fileExists(target))) {
    return undefined;
  }
  return readFile(target, "utf8");
}

function section(raw: string | undefined, heading: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const lines = raw.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start === -1) {
    return undefined;
  }
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line.trim())) {
      break;
    }
    body.push(line);
  }
  return body.join("\n").trim() || undefined;
}

function firstText(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const line = raw
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*]\s+/, "").trim())
    .find((item) => item && !item.startsWith("|") && !/^---+$/.test(item));
  return line || undefined;
}

function bulletItems(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.match(/^[-*]\s+(.+)$/)?.[1]?.trim() ?? "")
    .filter(Boolean);
}

function parseRequiredCommands(raw: string): CmapViewData["verify"]["requiredCommands"] {
  const rows = raw
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .map(parseTableRow)
    .filter((cells) => cells.length > 0 && !cells.every((cell) => /^-+$/.test(cell)));
  if (rows.length < 2) {
    return [];
  }
  const header = rows[0].map((cell) => cell.toLocaleLowerCase());
  const purposeIndex = header.indexOf("purpose");
  const commandIndex = header.indexOf("command");
  const expectedIndex = header.indexOf("expected");
  const whenIndex = header.indexOf("when");
  if (commandIndex === -1) {
    return [];
  }
  return rows.slice(1)
    .map((cells) => ({
      purpose: uncode(cells[purposeIndex] ?? "Command"),
      command: uncode(cells[commandIndex] ?? ""),
      expected: expectedIndex >= 0 ? optional(uncode(cells[expectedIndex] ?? "")) : undefined,
      when: whenIndex >= 0 ? optional(uncode(cells[whenIndex] ?? "")) : undefined
    }))
    .filter((entry) => entry.command);
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function uncode(value: string): string {
  return value.replace(/`/g, "").trim();
}

function optional(value: string): string | undefined {
  return value || undefined;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferCandidateType(content: string): string {
  const lower = content.toLocaleLowerCase();
  if (lower.includes("relation")) {
    return "relation.candidate";
  }
  if (lower.includes("decision")) {
    return "decision";
  }
  if (lower.includes("alias")) {
    return "alias";
  }
  return "candidate";
}

function firstSummary(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map((item) => item.replace(/^#+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 2);
  return lines.join(" ") || "Not available";
}

export async function fileMtimeIso(target: string): Promise<string> {
  const info = await stat(target);
  return info.mtime.toISOString();
}

async function maybeSourceCommit(cwd: string): Promise<string | undefined> {
  try {
    const result = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8" });
    return result.stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
