import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { loadContextPolicy, type ContextPolicy } from "../context/policy.js";
import { buildFreshnessIndex, readFreshnessIndex, type FreshnessIndex, type SourceSignalChangedFile, type SourceSignals } from "./freshness.js";
import { loadModuleIndex, type ContextModule } from "./module-index.js";

const execFileAsync = promisify(execFile);

export type DriftCheckOptions = {
  moduleId?: string;
};

export type DriftModuleReport = {
  moduleId: string;
  doc: string;
  threshold: number;
  sourceSignals: SourceSignals;
};

export type DriftReport = {
  schema: "cmap.drift.v1";
  computedAt: string;
  threshold: number;
  modules: DriftModuleReport[];
};

type GitNameStatus = {
  path: string;
  oldPath?: string;
  status: "committed" | "modified" | "staged" | "untracked" | "renamed" | "deleted";
};

export async function computeDriftReport(cwd: string, options: DriftCheckOptions = {}): Promise<DriftReport> {
  const [policy, modules, previous] = await Promise.all([
    loadContextPolicy(cwd),
    loadModuleIndex(cwd),
    readFreshnessIndex(cwd)
  ]);
  const freshness = await buildFreshnessIndex(cwd, previous);
  const selected = options.moduleId ? modules.filter((module) => module.id === options.moduleId) : modules;
  const computedAt = new Date().toISOString();
  if (!policy.drift.enabled) {
    return {
      schema: "cmap.drift.v1",
      computedAt,
      threshold: policy.drift.threshold,
      modules: selected.map((module) => ({
        moduleId: module.id,
        doc: module.docPath,
        threshold: policy.drift.threshold,
        sourceSignals: {
          computedAt,
          driftScore: 0,
          reasons: ["drift disabled by policy"],
          changedFiles: [],
          debug: {
            routeExposureScore: 0,
            moduleRiskScore: 0,
            structureScore: freshness.modules[module.id]?.sourceSignals?.debug?.structureScore ?? 0
          }
        }
      }))
    };
  }
  const headCommit = await gitOutput(cwd, ["rev-parse", "HEAD"]);
  const [staged, modified, untracked] = await Promise.all([
    gitNameStatus(cwd, ["diff", "--cached", "--name-status", "-M"], "staged"),
    gitNameStatus(cwd, ["diff", "--name-status", "-M"], "modified"),
    gitUntracked(cwd)
  ]);

  return {
    schema: "cmap.drift.v1",
    computedAt,
    threshold: policy.drift.threshold,
    modules: await Promise.all(selected.map(async (module) => {
      const previousModule = previous?.modules[module.id];
      const currentModule = freshness.modules[module.id];
      const baseCommit = previousModule?.lastReviewedCommit;
      const committed = baseCommit ? await gitNameStatus(cwd, ["diff", "--name-status", "-M", `${baseCommit}..HEAD`], "committed") : [];
      const sourceSignals = buildModuleSignals({
        module,
        previous,
        freshness,
        computedAt,
        headCommit,
        baseCommit,
        policy,
        changes: [...committed, ...staged, ...modified, ...untracked],
        hasCommitBaseline: Boolean(baseCommit),
        hasSnapshot: Boolean(previous),
        pendingInboxCandidates: currentModule?.pendingInboxCandidates ?? previousModule?.pendingInboxCandidates ?? []
      });
      return {
        moduleId: module.id,
        doc: module.docPath,
        threshold: policy.drift.threshold,
        sourceSignals
      };
    }))
  };
}

function buildModuleSignals(input: {
  module: ContextModule;
  previous: FreshnessIndex | undefined;
  freshness: FreshnessIndex;
  computedAt: string;
  headCommit?: string;
  baseCommit?: string;
  policy: ContextPolicy;
  changes: GitNameStatus[];
  hasCommitBaseline: boolean;
  hasSnapshot: boolean;
  pendingInboxCandidates: string[];
}): SourceSignals {
  const changedFiles: SourceSignalChangedFile[] = [];
  const reasons: string[] = [];
  const seen = new Set<string>();
  const previousModule = input.previous?.modules[input.module.id];
  const currentModule = input.freshness.modules[input.module.id];

  if (!input.hasSnapshot) {
    reasons.push("no freshness snapshot; run cmap freshness snapshot to establish generated review metadata");
  } else if (!input.hasCommitBaseline) {
    reasons.push("no semantic review commit baseline; committed history was not scanned");
  }

  for (const change of input.changes) {
    if (isExcluded(input.policy, change.path) || (change.oldPath && isExcluded(input.policy, change.oldPath))) {
      continue;
    }
    if (!matchesModule(input.module, previousModule, change.path, change.oldPath)) {
      continue;
    }
    const status = normalizeSignalStatus(change);
    const score = scoreForStatus(status, input.policy);
    const key = `${status}:${change.oldPath ?? ""}:${change.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    changedFiles.push({
      path: change.path,
      oldPath: change.oldPath,
      status,
      score
    });
    if (status === "renamed") {
      reasons.push(`owned path changed: ${change.oldPath ?? change.path} renamed to ${change.path}`);
    } else if (status === "deleted") {
      reasons.push(`owned path changed: ${change.oldPath ?? change.path} deleted`);
    } else {
      reasons.push(`source changed: ${status} ${change.path}`);
    }
  }

  const pendingScore = input.pendingInboxCandidates.length > 0 ? 0.2 : 0;
  if (input.pendingInboxCandidates.length > 0) {
    reasons.push(`pending candidate review: ${input.pendingInboxCandidates.join(", ")}`);
  }

  return {
    computedAt: input.computedAt,
    baseCommit: input.baseCommit,
    headCommit: input.headCommit,
    driftScore: roundScore(changedFiles.reduce((sum, file) => sum + file.score, 0) + pendingScore),
    reasons: [...new Set(reasons)],
    changedFiles,
    debug: {
      routeExposureScore: 0,
      moduleRiskScore: 0,
      structureScore: currentModule?.sourceSignals?.debug?.structureScore ?? 0
    }
  };
}

export function renderDriftBlock(report: DriftReport | DriftModuleReport[]): string {
  const modules = Array.isArray(report) ? report : report.modules;
  const active = modules.filter((module) => module.sourceSignals.driftScore >= module.threshold);
  if (active.length === 0) {
    return "";
  }
  const lines = ["## Drift Review Signals", ""];
  for (const module of active) {
    lines.push(`- ${module.moduleId}: score ${module.sourceSignals.driftScore}`);
    for (const reason of module.sourceSignals.reasons.slice(0, 4)) {
      lines.push(`  - ${reason}`);
    }
    lines.push(`  - review: cmap drift review --module ${module.moduleId}`);
    lines.push(`  - mark reviewed: cmap drift mark-reviewed --module ${module.moduleId} --evidence "..."`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeSignalStatus(change: GitNameStatus): SourceSignalChangedFile["status"] {
  if (change.status === "renamed" || change.status === "deleted") {
    return change.status;
  }
  if (isTestPath(change.path)) {
    return "test";
  }
  if (change.status === "committed" || change.status === "staged" || change.status === "untracked") {
    return change.status;
  }
  return "modified";
}

function scoreForStatus(status: SourceSignalChangedFile["status"], policy: ContextPolicy): number {
  if (status === "renamed" || status === "deleted") {
    return 0.8;
  }
  if (status === "staged") {
    return 0.35;
  }
  if (status === "modified") {
    return 0.3;
  }
  if (status === "committed" || status === "untracked") {
    return 0.2;
  }
  return policy.drift.testWeight;
}

function matchesModule(module: ContextModule, previousModule: FreshnessIndex["modules"][string] | undefined, file: string, oldPath?: string): boolean {
  const candidates = [file, oldPath].filter((item): item is string => Boolean(item));
  const previousOwned = new Set(Object.keys(previousModule?.ownedFiles ?? {}));
  for (const candidate of candidates) {
    if (previousOwned.has(candidate)) {
      return true;
    }
    if (module.pathsExclude.some((pattern) => pathPatternMatches(pattern, candidate))) {
      continue;
    }
    if (module.pathsInclude.some((pattern) => pathPatternMatches(pattern, candidate))) {
      return true;
    }
    if (matchesSiblingModulePath(module, previousOwned, candidate)) {
      return true;
    }
  }
  return false;
}

function matchesSiblingModulePath(module: ContextModule, previousOwned: Set<string>, file: string): boolean {
  const base = path.basename(file).toLowerCase();
  if (!base.includes(module.id.toLowerCase())) {
    return false;
  }
  const directories = new Set([
    ...module.pathsInclude.filter((item) => !item.includes("*")).map((item) => path.posix.dirname(normalizePath(item))),
    ...[...previousOwned].map((item) => path.posix.dirname(normalizePath(item)))
  ]);
  return [...directories].some((directory) => directory !== "." && normalizePath(file).startsWith(`${directory}/`));
}

async function gitNameStatus(
  cwd: string,
  args: string[],
  defaultStatus: "committed" | "modified" | "staged"
): Promise<GitNameStatus[]> {
  const output = await gitOutput(cwd, args);
  if (!output) {
    return [];
  }
  const changes: GitNameStatus[] = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [rawStatus, first, second] = line.split("\t");
    if (!rawStatus || !first) {
      continue;
    }
    if (rawStatus.startsWith("R")) {
      changes.push({ status: "renamed", oldPath: normalizePath(first), path: normalizePath(second ?? first) });
    } else if (rawStatus.startsWith("D")) {
      changes.push({ status: "deleted", path: normalizePath(first) });
    } else {
      changes.push({ status: defaultStatus, path: normalizePath(first) });
    }
  }
  return changes;
}

async function gitUntracked(cwd: string): Promise<GitNameStatus[]> {
  const output = await gitOutput(cwd, ["ls-files", "--others", "--exclude-standard"]);
  return output
    ? output.split(/\r?\n/).filter(Boolean).map((file) => ({ status: "untracked" as const, path: normalizePath(file) }))
    : [];
}

async function gitOutput(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
    return result.stdout.trim();
  } catch {
    return undefined;
  }
}

function isExcluded(policy: ContextPolicy, file: string): boolean {
  const patterns = policy.drift.excludeGlobs.split(",").map((item) => item.trim()).filter(Boolean);
  return patterns.some((pattern) => pathPatternMatches(pattern, file));
}

function isTestPath(file: string): boolean {
  return /(^|\/)(test|tests|__tests__)\//.test(file) || /\.(test|spec)\.[jt]sx?$/.test(file);
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function pathPatternMatches(pattern: string, file: string): boolean {
  const normalizedPattern = normalizePath(pattern).replace(/\/$/, "");
  const normalizedFile = normalizePath(file);
  if (!normalizedPattern) {
    return false;
  }
  if (normalizedPattern.includes("*")) {
    return globToRegExp(normalizedPattern).test(normalizedFile);
  }
  return normalizedFile === normalizedPattern || normalizedFile.startsWith(`${normalizedPattern}/`);
}

function globToRegExp(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}
