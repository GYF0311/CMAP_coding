import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { createBackup } from "../fs/backup.js";
import { projectRelative } from "../fs/safe-path.js";
import type { ContextModule } from "./module-index.js";

export type ModuleEvidence = {
  version: 1;
  id: string;
  moduleId: string;
  createdAt: string;
  source: "manual" | "hook" | "mappatch" | "reconcile" | "obsidian-pull";
  task?: string;
  summary: string;
  files: string[];
  commands?: string[];
  confidence: number;
  canonical: false;
};

export type VerificationEvidence = {
  version: 1;
  id: string;
  createdAt: string;
  source: "manual" | "hook" | "mappatch" | "reconcile" | "obsidian-pull";
  summary: string;
  files: string[];
  commands?: string[];
  confidence: number;
  canonical: false;
};

export type EvidenceMigrationResult = {
  migrated: number;
  modules: string[];
  backupId?: string;
  auditPath?: string;
};

const startMarker = "<!-- cmap:generated:evidence:start -->";
const endMarker = "<!-- cmap:generated:evidence:end -->";

export function generatedRoot(cwd: string): string {
  return path.join(cwd, ".context", "generated");
}

export function moduleEvidencePath(cwd: string, moduleId: string): string {
  return path.join(generatedRoot(cwd), "evidence", "modules", `${moduleId}.jsonl`);
}

export function verificationEvidencePath(cwd: string): string {
  return path.join(generatedRoot(cwd), "evidence", "verification.jsonl");
}

export function generatedStatsPath(cwd: string, filename: string): string {
  return path.join(generatedRoot(cwd), "stats", filename);
}

export async function appendModuleEvidence(
  cwd: string,
  input: {
    moduleId: string;
    summary: string;
    files: string[];
    commands?: string[];
    source?: ModuleEvidence["source"];
    task?: string;
    confidence?: number;
    createdAt?: string;
  },
  maxEntries: number
): Promise<ModuleEvidence> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const entry: ModuleEvidence = {
    version: 1,
    id: evidenceId(createdAt),
    moduleId: input.moduleId,
    createdAt,
    source: input.source ?? "manual",
    task: input.task,
    summary: input.summary,
    files: input.files,
    commands: input.commands && input.commands.length > 0 ? input.commands : undefined,
    confidence: input.confidence ?? 1,
    canonical: false
  };
  const target = moduleEvidencePath(cwd, input.moduleId);
  const entries = [...await readJsonl<ModuleEvidence>(target), entry].slice(-maxEntries);
  await writeJsonl(target, entries);
  return entry;
}

export async function appendVerificationEvidence(
  cwd: string,
  input: {
    summary: string;
    files: string[];
    commands?: string[];
    source?: VerificationEvidence["source"];
    confidence?: number;
    createdAt?: string;
  }
): Promise<VerificationEvidence> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const entry: VerificationEvidence = {
    version: 1,
    id: evidenceId(createdAt),
    createdAt,
    source: input.source ?? "mappatch",
    summary: input.summary,
    files: input.files,
    commands: input.commands && input.commands.length > 0 ? input.commands : undefined,
    confidence: input.confidence ?? 1,
    canonical: false
  };
  const target = verificationEvidencePath(cwd);
  await appendJsonl(target, entry);
  return entry;
}

export async function listModuleEvidence(cwd: string, moduleId: string): Promise<ModuleEvidence[]> {
  return readJsonl<ModuleEvidence>(moduleEvidencePath(cwd, moduleId));
}

export async function latestModuleEvidenceAt(cwd: string, moduleId: string): Promise<string | undefined> {
  const entries = await listModuleEvidence(cwd, moduleId);
  return entries.map((entry) => entry.createdAt).sort().at(-1);
}

export async function migrateModuleDocEvidence(
  cwd: string,
  modules: ContextModule[],
  apply: boolean
): Promise<EvidenceMigrationResult> {
  const changedModules: string[] = [];
  let migrated = 0;
  const docsToBackup: string[] = [];
  const writes: Array<{ module: ContextModule; next: string; entries: ModuleEvidence[] }> = [];

  for (const module of modules) {
    const raw = await readFile(module.absolutePath, "utf8");
    const block = extractGeneratedBlock(raw);
    if (!block) {
      continue;
    }
    const entries = parseLegacyEntries(module.id, block);
    if (entries.length === 0) {
      continue;
    }
    migrated += entries.length;
    changedModules.push(module.id);
    docsToBackup.push(module.absolutePath);
    writes.push({
      module,
      next: removeGeneratedBlock(raw),
      entries
    });
  }

  if (!apply) {
    return { migrated, modules: changedModules };
  }

  const backupId = docsToBackup.length > 0 ? await createBackup(cwd, docsToBackup) : undefined;
  for (const write of writes) {
    const current = await listModuleEvidence(cwd, write.module.id);
    await writeJsonl(moduleEvidencePath(cwd, write.module.id), [...current, ...write.entries]);
    await writeFile(write.module.absolutePath, ensureTrailingNewline(write.next), "utf8");
  }

  const auditPath = migrated > 0 ? await writeEvidenceMigrationAudit(cwd, { migrated, changedModules, backupId }) : undefined;
  return { migrated, modules: changedModules, backupId, auditPath };
}

export async function appendGeneratedStatsEvent(
  cwd: string,
  input: { type: string; summary: string; fields?: Record<string, unknown>; createdAt?: string }
): Promise<string> {
  const target = path.join(generatedRoot(cwd), "stats", "events.jsonl");
  await appendJsonl(target, {
    version: 1,
    createdAt: input.createdAt ?? new Date().toISOString(),
    type: input.type,
    summary: input.summary,
    fields: input.fields ?? {}
  });
  return projectRelative(cwd, target);
}

async function readJsonl<T>(target: string): Promise<T[]> {
  if (!(await fileExists(target))) {
    return [];
  }
  const raw = await readFile(target, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function appendJsonl(target: string, entry: unknown): Promise<void> {
  const current = await readJsonl<unknown>(target);
  await writeJsonl(target, [...current, entry]);
}

async function writeJsonl(target: string, entries: unknown[]): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const body = entries.map((entry) => JSON.stringify(entry)).join("\n");
  await writeFile(target, body ? `${body}\n` : "", "utf8");
}

async function maybeReadDir(target: string): Promise<string[]> {
  if (!(await fileExists(target))) {
    return [];
  }
  return readdir(target);
}

export async function moduleIdsWithGeneratedEvidence(cwd: string): Promise<string[]> {
  const root = path.join(generatedRoot(cwd), "evidence", "modules");
  return (await maybeReadDir(root))
    .filter((entry) => entry.endsWith(".jsonl"))
    .map((entry) => path.basename(entry, ".jsonl"))
    .sort();
}

export function hasLegacyModuleDocEvidence(raw: string): boolean {
  return extractGeneratedBlock(raw) !== undefined;
}

export async function listVerificationEvidence(cwd: string): Promise<VerificationEvidence[]> {
  return readJsonl<VerificationEvidence>(verificationEvidencePath(cwd));
}

function extractGeneratedBlock(raw: string): string | undefined {
  const start = raw.indexOf(startMarker);
  const end = raw.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    return undefined;
  }
  return raw.slice(start + startMarker.length, end);
}

function removeGeneratedBlock(raw: string): string {
  return raw.replace(new RegExp(`\\n*${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n*`), "\n");
}

function parseLegacyEntries(moduleId: string, block: string): ModuleEvidence[] {
  const entries: ModuleEvidence[] = [];
  for (const line of block.split(/\r?\n/).map((item) => item.trim())) {
    if (!line.startsWith("- ")) {
      continue;
    }
    const match = line.match(/^-\s+(\S+):\s+(.+?)\s+Evidence:\s+`([^`]+)`(?:;\s+command:\s+`([^`]+)`)?.*$/);
    if (!match) {
      continue;
    }
    const createdAt = match[1].trim();
    entries.push({
      version: 1,
      id: evidenceId(createdAt),
      moduleId,
      createdAt,
      source: "manual",
      summary: match[2].trim(),
      files: [match[3].trim()],
      commands: match[4] ? [match[4].trim()] : undefined,
      confidence: 1,
      canonical: false
    });
  }
  return entries;
}

function evidenceId(createdAt: string): string {
  return `evidence-${createdAt.replace(/[^0-9a-z]/gi, "-").toLowerCase()}`;
}

async function writeEvidenceMigrationAudit(
  cwd: string,
  input: { migrated: number; changedModules: string[]; backupId?: string }
): Promise<string> {
  const auditRoot = path.join(cwd, ".context", "audit");
  await mkdir(auditRoot, { recursive: true });
  const filename = `evidence-migrate-${new Date().toISOString().replace(/[:.]/g, "-").toLowerCase()}.md`;
  const target = path.join(auditRoot, filename);
  const lines = [
    "# Evidence Migration Audit",
    "",
    `Migrated entries: ${input.migrated}`,
    `Modules: ${input.changedModules.length > 0 ? input.changedModules.join(", ") : "none"}`,
    `Backup: ${input.backupId ?? "none"}`,
    "",
    "Generated evidence was moved out of canonical module docs into `.context/generated/evidence/modules/*.jsonl`."
  ];
  await writeFile(target, `${lines.join("\n")}\n`, "utf8");
  return projectRelative(cwd, target);
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
