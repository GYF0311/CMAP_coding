import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative } from "../fs/safe-path.js";
import { generatedRoot, latestModuleEvidenceAt } from "./generated-store.js";
import { loadModuleIndex, type ContextModule } from "./module-index.js";

const execFileAsync = promisify(execFile);

export type FreshnessIndexV1 = {
  version: 1;
  updatedAt: string;
  modules: Record<string, FreshnessModuleV1>;
};

export type FreshnessIndexV2 = {
  version: 2;
  updatedAt: string;
  modules: Record<string, FreshnessModule>;
};

export type FreshnessIndex = FreshnessIndexV2;

export type FreshnessModuleV1 = {
  doc: string;
  semanticHash: string;
  reviewState: "baseline" | "reviewed";
  lastSemanticReviewedAt?: string;
  reviewEvidence?: string;
  ownedFiles: Record<string, {
    mtimeMs: number;
    hash?: string;
  }>;
  newestGeneratedEvidenceAt?: string;
  pendingInboxCandidates: string[];
};

export type SourceSignalChangedFile = {
  path: string;
  oldPath?: string;
  status: "committed" | "modified" | "staged" | "untracked" | "renamed" | "deleted" | "test";
  score: number;
};

export type SourceSignals = {
  computedAt: string;
  baseCommit?: string;
  headCommit?: string;
  driftScore: number;
  reasons: string[];
  changedFiles: SourceSignalChangedFile[];
  debug?: {
    routeExposureScore?: number;
    moduleRiskScore?: number;
    structureScore?: number;
  };
};

export type FreshnessModule = FreshnessModuleV1 & {
  lastReviewedCommit?: string;
  sourceSignals?: SourceSignals;
};

export type FreshnessWarning = {
  moduleId: string;
  message: string;
};

export type FreshnessReviewOptions = {
  moduleId?: string;
  all?: boolean;
};

export type FreshnessReviewModule = {
  moduleId: string;
  reasons: string[];
  readFirst: string[];
  suggestedCommand: string;
};

export type FreshnessReview = {
  modules: FreshnessReviewModule[];
};

export function freshnessPath(cwd: string): string {
  return path.join(generatedRoot(cwd), "freshness.json");
}

export function freshnessLockPath(cwd: string): string {
  return `${freshnessPath(cwd)}.lock`;
}

export async function buildFreshnessIndex(cwd: string, previous?: FreshnessIndex): Promise<FreshnessIndex> {
  const modules = await loadModuleIndex(cwd);
  const updatedAt = new Date().toISOString();
  const next: FreshnessIndex = { version: 2, updatedAt, modules: {} };
  for (const module of modules) {
    next.modules[module.id] = await buildFreshnessModule(cwd, module, previous?.modules[module.id]);
  }
  return next;
}

export async function readFreshnessIndex(cwd: string): Promise<FreshnessIndex | undefined> {
  const target = freshnessPath(cwd);
  if (!(await fileExists(target))) {
    return undefined;
  }
  return normalizeFreshnessIndex(JSON.parse(await readFile(target, "utf8")) as FreshnessIndexV1 | FreshnessIndexV2);
}

export async function writeFreshnessIndex(cwd: string, index: FreshnessIndex): Promise<void> {
  await writeFreshnessIndexAtomic(cwd, index);
}

export async function updateFreshnessIndexLocked(
  cwd: string,
  updater: (current: FreshnessIndex | undefined) => Promise<FreshnessIndex>
): Promise<FreshnessIndex> {
  return withFreshnessLock(cwd, async () => {
    const current = await readFreshnessIndex(cwd);
    const next = await updater(current);
    await writeFreshnessIndexAtomic(cwd, next);
    return next;
  });
}

export async function snapshotFreshness(cwd: string): Promise<FreshnessIndex> {
  return updateFreshnessIndexLocked(cwd, (previous) => buildFreshnessIndex(cwd, previous));
}

export async function migrateFreshnessIndex(cwd: string): Promise<FreshnessIndex> {
  return updateFreshnessIndexLocked(cwd, (previous) => buildFreshnessIndex(cwd, previous));
}

export async function markModuleReviewed(
  cwd: string,
  moduleId: string,
  evidence: string | undefined
): Promise<FreshnessIndex> {
  return updateFreshnessIndexLocked(cwd, async (previous) => {
    const index = await buildFreshnessIndex(cwd, previous);
    const module = index.modules[moduleId];
    if (!module) {
      throw new Error(`Unknown module: ${moduleId}`);
    }
    module.reviewState = "reviewed";
    module.lastSemanticReviewedAt = reviewedAtFor(module);
    module.reviewEvidence = evidence?.trim() || undefined;
    module.lastReviewedCommit = await currentHeadCommit(cwd);
    module.sourceSignals = undefined;
    return index;
  });
}

async function withFreshnessLock<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = freshnessLockPath(cwd);
  await mkdir(path.dirname(lockPath), { recursive: true });
  const timeoutMs = freshnessLockTimeoutMs();
  const retryMs = freshnessLockRetryMs();
  const started = Date.now();

  while (true) {
    let handle;
    try {
      handle = await open(lockPath, "wx");
    } catch (error) {
      if (!isFileExistsError(error)) {
        throw error;
      }
      if (Date.now() - started >= timeoutMs) {
        throw new CmapCommandError(
          "freshness.json is locked by another cmap process. Retry after it finishes.",
          2
        );
      }
      await sleep(retryMs);
      continue;
    }

    try {
      await handle.writeFile(`${process.pid}\n`, "utf8");
      return await fn();
    } finally {
      await handle.close();
      await rm(lockPath, { force: true });
    }
  }
}

async function writeFreshnessIndexAtomic(cwd: string, index: FreshnessIndex): Promise<void> {
  const target = freshnessPath(cwd);
  await mkdir(path.dirname(target), { recursive: true });
  const tempPath = path.join(
    path.dirname(target),
    `freshness.json.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  );
  try {
    await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    await rename(tempPath, target);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

function freshnessLockTimeoutMs(): number {
  return positiveIntegerFromEnv("CMAP_LOCK_TIMEOUT_MS", 5000);
}

function freshnessLockRetryMs(): number {
  return positiveIntegerFromEnv("CMAP_LOCK_RETRY_MS", 50);
}

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isFileExistsError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "EEXIST");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function buildFreshnessReview(cwd: string, options: FreshnessReviewOptions): Promise<FreshnessReview> {
  const modules = await loadModuleIndex(cwd);
  const moduleIds = new Set(modules.map((module) => module.id));
  if (options.moduleId && !moduleIds.has(options.moduleId)) {
    throw new Error(`Unknown module: ${options.moduleId}`);
  }

  const warnings = await freshnessWarnings(cwd);
  const warningsByModule = new Map<string, string[]>();
  for (const warning of warnings) {
    const bucket = warningsByModule.get(warning.moduleId) ?? [];
    bucket.push(warning.message);
    warningsByModule.set(warning.moduleId, bucket);
  }

  const index = await buildFreshnessIndex(cwd, await readFreshnessIndex(cwd));
  const selected = options.all ? modules : modules.filter((module) => module.id === options.moduleId);
  const reviewModules = await Promise.all(selected.map(async (module) => {
    const freshnessModule = index.modules[module.id];
    const generatedEvidencePath = await generatedEvidencePathForModule(cwd, module.id);
    const readFirst = [
      module.docPath,
      ...Object.keys(freshnessModule?.ownedFiles ?? {}),
      generatedEvidencePath,
      ...(freshnessModule?.pendingInboxCandidates ?? [])
    ].filter((item): item is string => Boolean(item));
    return {
      moduleId: module.id,
      reasons: (warningsByModule.get(module.id) ?? []).map(formatFreshnessReason),
      readFirst: [...new Set(readFirst)],
      suggestedCommand: `cmap freshness mark-reviewed --module ${module.id} --evidence "Reviewed ${module.id} after freshness review"`
    };
  }));
  return {
    modules: reviewModules
  };
}

export function renderFreshnessReviewMarkdown(review: FreshnessReview): string {
  const lines: string[] = [];
  if (review.modules.length !== 1) {
    lines.push("# Freshness Review", "");
  }
  for (const module of review.modules) {
    lines.push(`# Freshness Review: ${module.moduleId}`, "", "## Why stale");
    lines.push(...markdownList(module.reasons.length > 0 ? module.reasons : ["No freshness warnings currently detected."]));
    lines.push("", "## Read first");
    lines.push(...markdownList(module.readFirst.length > 0 ? module.readFirst : ["Not available"]));
    lines.push("", "## Suggested command", module.suggestedCommand, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export async function freshnessWarnings(cwd: string): Promise<FreshnessWarning[]> {
  const previous = await readFreshnessIndex(cwd);
  if (!previous) {
    return [{ moduleId: "project", message: "Freshness: no snapshot found; run cmap freshness snapshot" }];
  }
  const current = await buildFreshnessIndex(cwd, previous);
  const warnings: FreshnessWarning[] = [];
  for (const [moduleId, module] of Object.entries(current.modules)) {
    const reviewMs = module.lastSemanticReviewedAt ? Date.parse(module.lastSemanticReviewedAt) : 0;
    for (const [file, info] of Object.entries(module.ownedFiles)) {
      if (info.mtimeMs > reviewMs + 1000) {
        warnings.push({
          moduleId,
          message: `Freshness: module ${moduleId} may be stale; ${file} is newer than last semantic review`
        });
      }
    }
    if (module.newestGeneratedEvidenceAt && Date.parse(module.newestGeneratedEvidenceAt) > reviewMs + 1000) {
      warnings.push({
        moduleId,
        message: `Freshness: generated evidence for ${moduleId} is newer than reviewed facts`
      });
    }
    if (module.pendingInboxCandidates.length > 0) {
      warnings.push(await pendingCandidateWarning(cwd, moduleId, module.pendingInboxCandidates));
    }
  }
  return warnings;
}

export async function diffFreshness(cwd: string): Promise<string[]> {
  const previous = await readFreshnessIndex(cwd);
  const current = await buildFreshnessIndex(cwd, previous);
  if (!previous) {
    return ["No existing freshness snapshot."];
  }
  const lines: string[] = [];
  for (const [moduleId, module] of Object.entries(current.modules)) {
    const old = previous.modules[moduleId];
    if (!old) {
      lines.push(`added module ${moduleId}`);
      continue;
    }
    if (old.semanticHash !== module.semanticHash) {
      lines.push(`semantic changed ${moduleId}`);
    }
    for (const [file, info] of Object.entries(module.ownedFiles)) {
      if (old.ownedFiles[file]?.hash !== info.hash) {
        lines.push(`owned file changed ${moduleId}: ${file}`);
      }
    }
  }
  return lines.length > 0 ? lines : ["Freshness snapshot is up to date."];
}

async function buildFreshnessModule(
  cwd: string,
  module: ContextModule,
  previous: FreshnessModule | undefined
): Promise<FreshnessModule> {
  const ownedFiles: FreshnessModule["ownedFiles"] = {};
  for (const ownedPath of module.pathsInclude) {
    if (ownedPath.includes("*")) {
      continue;
    }
    const absolute = path.join(cwd, ownedPath);
    if (!(await fileExists(absolute))) {
      continue;
    }
    const info = await stat(absolute);
    if (!info.isFile()) {
      continue;
    }
    ownedFiles[ownedPath] = {
      mtimeMs: info.mtimeMs,
      hash: sha256(await readFile(absolute))
    };
  }

  return {
    doc: module.docPath,
    semanticHash: sha256(JSON.stringify({
      body: module.body,
      aliases: module.aliases,
      pathsInclude: module.pathsInclude,
      pathsExclude: module.pathsExclude,
      relations: module.relations,
      status: module.status,
      layer: module.layer,
      risk: module.risk
    })),
    reviewState: previous?.reviewState ?? "baseline",
    lastSemanticReviewedAt: previous?.lastSemanticReviewedAt ?? new Date().toISOString(),
    reviewEvidence: previous?.reviewEvidence,
    lastReviewedCommit: previous?.lastReviewedCommit,
    sourceSignals: previous?.sourceSignals,
    ownedFiles,
    newestGeneratedEvidenceAt: await latestModuleEvidenceAt(cwd, module.id),
    pendingInboxCandidates: await pendingInboxCandidatesForModule(cwd, module.id)
  };
}

function normalizeFreshnessIndex(index: FreshnessIndexV1 | FreshnessIndexV2): FreshnessIndex {
  if (index.version === 2) {
    return index;
  }
  const modules: Record<string, FreshnessModule> = {};
  for (const [moduleId, module] of Object.entries(index.modules ?? {})) {
    modules[moduleId] = { ...module };
  }
  return {
    version: 2,
    updatedAt: index.updatedAt,
    modules
  };
}

async function currentHeadCommit(cwd: string): Promise<string | undefined> {
  try {
    const result = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
    const commit = result.stdout.trim();
    return commit || undefined;
  } catch {
    return undefined;
  }
}

async function pendingInboxCandidatesForModule(cwd: string, moduleId: string): Promise<string[]> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  if (!(await fileExists(inboxRoot))) {
    return [];
  }
  const entries = await readdir(inboxRoot);
  const matches: string[] = [];
  for (const entry of entries.filter((item) => item.endsWith(".md"))) {
    const absolute = path.join(inboxRoot, entry);
    const raw = await readFile(absolute, "utf8");
    if (raw.includes(`module: ${moduleId}`) || raw.includes(`moduleId: ${moduleId}`) || raw.includes(`.context/modules/${moduleId}.md`)) {
      matches.push(projectRelative(cwd, absolute));
    }
  }
  const relationsRoot = path.join(inboxRoot, "relations");
  if (await fileExists(relationsRoot)) {
    const relationEntries = await readdir(relationsRoot);
    const jsonIds = new Set(relationEntries.filter((entry) => entry.endsWith(".json")).map((entry) => path.basename(entry, ".json")));
    for (const entry of relationEntries.filter((item) => item.endsWith(".json"))) {
      const absolute = path.join(relationsRoot, entry);
      try {
        const parsed = JSON.parse(await readFile(absolute, "utf8")) as Record<string, unknown>;
        if ([parsed.from, parsed.to, parsed.target_module].includes(moduleId)) {
          matches.push(projectRelative(cwd, absolute));
        }
      } catch {
        // Ignore malformed candidate files here; inbox/view checks can surface them separately.
      }
    }
    for (const entry of relationEntries.filter((item) => item.endsWith(".md") && !jsonIds.has(path.basename(item, ".md")))) {
      const absolute = path.join(relationsRoot, entry);
      const raw = await readFile(absolute, "utf8");
      if (
        raw.includes(`module: ${moduleId}`) ||
        raw.includes(`moduleId: ${moduleId}`) ||
        raw.includes(`from: ${moduleId}`) ||
        raw.includes(`to: ${moduleId}`)
      ) {
        matches.push(projectRelative(cwd, absolute));
      }
    }
  }
  return [...new Set(matches)].sort();
}

async function pendingCandidateWarning(cwd: string, moduleId: string, candidates: string[]): Promise<FreshnessWarning> {
  const relation = candidates.find((item) => item.includes("/relations/"));
  if (relation) {
    return {
      moduleId,
      message: `Freshness: relation candidate pending for ${moduleId} (${candidates.join(", ")})`
    };
  }
  for (const candidate of candidates) {
    const raw = await maybeRead(cwd, candidate);
    if (raw && (/risk:\s*high/i.test(raw) || /high-risk/i.test(raw) || /operation is marked high risk/i.test(raw))) {
      return {
        moduleId,
        message: `Freshness: high-risk candidate pending for ${moduleId} (${candidates.join(", ")})`
      };
    }
  }
  return {
    moduleId,
    message: `Freshness: routine candidate pending for ${moduleId} (${candidates.join(", ")})`
  };
}

async function maybeRead(cwd: string, relative: string): Promise<string | undefined> {
  const absolute = path.join(cwd, relative);
  if (!(await fileExists(absolute))) {
    return undefined;
  }
  return readFile(absolute, "utf8");
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function reviewedAtFor(module: FreshnessModule): string {
  const times = [
    Date.now(),
    ...Object.values(module.ownedFiles).map((info) => info.mtimeMs),
    module.newestGeneratedEvidenceAt ? Date.parse(module.newestGeneratedEvidenceAt) : 0
  ];
  return new Date(Math.max(...times.filter((time) => Number.isFinite(time)))).toISOString();
}

async function generatedEvidencePathForModule(cwd: string, moduleId: string): Promise<string | undefined> {
  const relative = `.context/generated/evidence/modules/${moduleId}.jsonl`;
  return (await fileExists(path.join(cwd, relative))) ? relative : undefined;
}

function formatFreshnessReason(message: string): string {
  return message.replace(/^Freshness:\s*/, "").replace(/^module\s+([^\s]+)\s+may be stale;\s+/, "");
}

function markdownList(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}
