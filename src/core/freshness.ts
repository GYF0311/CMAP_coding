import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { projectRelative } from "../fs/safe-path.js";
import { generatedRoot, latestModuleEvidenceAt } from "./generated-store.js";
import { loadModuleIndex, type ContextModule } from "./module-index.js";

export type FreshnessIndex = {
  version: 1;
  updatedAt: string;
  modules: Record<string, FreshnessModule>;
};

export type FreshnessModule = {
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

export type FreshnessWarning = {
  moduleId: string;
  message: string;
};

export function freshnessPath(cwd: string): string {
  return path.join(generatedRoot(cwd), "freshness.json");
}

export async function buildFreshnessIndex(cwd: string, previous?: FreshnessIndex): Promise<FreshnessIndex> {
  const modules = await loadModuleIndex(cwd);
  const updatedAt = new Date().toISOString();
  const next: FreshnessIndex = { version: 1, updatedAt, modules: {} };
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
  return JSON.parse(await readFile(target, "utf8")) as FreshnessIndex;
}

export async function writeFreshnessIndex(cwd: string, index: FreshnessIndex): Promise<void> {
  const target = freshnessPath(cwd);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export async function snapshotFreshness(cwd: string): Promise<FreshnessIndex> {
  const previous = await readFreshnessIndex(cwd);
  const index = await buildFreshnessIndex(cwd, previous);
  await writeFreshnessIndex(cwd, index);
  return index;
}

export async function markModuleReviewed(
  cwd: string,
  moduleId: string,
  evidence: string | undefined
): Promise<FreshnessIndex> {
  const previous = await readFreshnessIndex(cwd);
  const index = await buildFreshnessIndex(cwd, previous);
  const module = index.modules[moduleId];
  if (!module) {
    throw new Error(`Unknown module: ${moduleId}`);
  }
  module.reviewState = "reviewed";
  module.lastSemanticReviewedAt = new Date().toISOString();
  module.reviewEvidence = evidence?.trim() || undefined;
  await writeFreshnessIndex(cwd, index);
  return index;
}

export async function freshnessWarnings(cwd: string): Promise<FreshnessWarning[]> {
  const previous = await readFreshnessIndex(cwd);
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
      warnings.push({
        moduleId,
        message: `Freshness: module ${moduleId} has pending inbox candidates (${module.pendingInboxCandidates.join(", ")})`
      });
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
    semanticHash: sha256(Buffer.from(module.body)),
    reviewState: previous?.reviewState ?? "baseline",
    lastSemanticReviewedAt: previous?.lastSemanticReviewedAt ?? new Date().toISOString(),
    reviewEvidence: previous?.reviewEvidence,
    ownedFiles,
    newestGeneratedEvidenceAt: await latestModuleEvidenceAt(cwd, module.id),
    pendingInboxCandidates: await pendingInboxCandidatesForModule(cwd, module.id)
  };
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
  return matches.sort();
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}
