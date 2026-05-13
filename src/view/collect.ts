import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";
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

export async function collectViewData(cwd: string, generatedAt = new Date().toISOString()): Promise<CmapViewData> {
  const warnings: string[] = [];
  const [project, modules] = await Promise.all([loadProjectInfo(cwd), loadModuleIndex(cwd)]);
  const freshness = await maybeReadFreshness(cwd, warnings);
  const evidence = await collectEvidence(cwd, modules, warnings);
  const { candidates, relationCandidates } = await collectInboxCandidates(cwd, warnings);
  await checkRelationData(modules, warnings);

  return {
    schema: viewDataSchemaId,
    generatedAt,
    sourceCommit: await maybeSourceCommit(cwd),
    projectRootName: path.basename(cwd),
    project: {
      id: project.projectId,
      name: project.projectName
    },
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

function toModuleView(module: ContextModule, freshness: FreshnessIndex | undefined): CmapViewData["modules"][number] {
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
    relations: Object.entries(module.relations).flatMap(([type, targets]) => targets.map((target) => ({ type, target }))),
    freshness: {
      state: freshnessModule?.reviewState ?? "Not available",
      lastReviewedAt: freshnessModule?.lastSemanticReviewedAt ?? "Not available",
      newestGeneratedEvidenceAt: freshnessModule?.newestGeneratedEvidenceAt ?? "Not available",
      pendingInboxCandidates: freshnessModule?.pendingInboxCandidates ?? []
    }
  };
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
      summary: firstSummary(parsed.content)
    };
    candidates.push(base);
    if (type.includes("relation")) {
      relationCandidates.push({
        id: base.id,
        file: base.file,
        from: stringField(data.from) || stringField(data.source) || base.moduleId,
        to: stringField(data.to) || stringField(data.target) || "Not available",
        relation: stringField(data.relation) || type,
        summary: base.summary
      });
    }
  }
  relationCandidates.push(...await collectRelationCandidateFiles(cwd, warnings));
  if (topLevelFiles.length > MAX_CANDIDATES) {
    warnings.push(`Inbox candidates omitted: ${topLevelFiles.length - MAX_CANDIDATES}`);
  }

  if (files.length === 0) {
    warnings.push("Inbox candidates: Not available");
  }
  if (relationCandidates.length === 0) {
    warnings.push("Relation candidates: Not available");
  }

  return { candidates, relationCandidates };
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
        summary: stringField(parsed.summary) || "Candidate / Non-canonical"
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
