import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadContextPolicy } from "../context/policy.js";
import { fileExists } from "../context/scanner.js";

type ModuleActivity = {
  evidence_count: number;
  last_seen_at: string;
  last_summary: string;
  files: Record<string, number>;
  commands: Record<string, number>;
};

type ModuleActivityStats = {
  version: 1;
  updated_at: string;
  modules: Record<string, ModuleActivity>;
};

type RouteUsageStats = {
  version: 1;
  updated_at: string;
  total: number;
  by_source: Record<string, number>;
  modules: Record<string, number>;
  context_modules: Record<string, number>;
  recent: Array<{
    at: string;
    source: string;
    task: string;
    modules: string[];
    context_modules: string[];
  }>;
};

export async function recordModuleActivity(
  cwd: string,
  input: { moduleId: string; file: string; summary: string; command?: string; at?: string }
): Promise<void> {
  const policy = await loadContextPolicy(cwd);
  if (!policy.autoApply.statsUpdate) {
    return;
  }
  const statsRoot = path.join(cwd, ".context", "stats");
  await mkdir(statsRoot, { recursive: true });
  const statsPath = path.join(statsRoot, "module-activity.json");
  const now = input.at ?? new Date().toISOString();
  const stats = await readModuleActivityStats(statsPath);
  const current = stats.modules[input.moduleId] ?? {
    evidence_count: 0,
    last_seen_at: now,
    last_summary: "",
    files: {},
    commands: {}
  };

  current.evidence_count += 1;
  current.last_seen_at = now;
  current.last_summary = input.summary;
  current.files[input.file] = (current.files[input.file] ?? 0) + 1;
  if (input.command) {
    current.commands[input.command] = (current.commands[input.command] ?? 0) + 1;
  }
  stats.modules[input.moduleId] = current;
  stats.updated_at = now;
  await writeFile(statsPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
}

export async function recordRouteUsage(
  cwd: string,
  input: { source: "route" | "hook"; task: string; modules: string[]; contextModules: string[]; at?: string }
): Promise<void> {
  const policy = await loadContextPolicy(cwd);
  if (!policy.autoApply.statsUpdate) {
    return;
  }
  const statsRoot = path.join(cwd, ".context", "stats");
  await mkdir(statsRoot, { recursive: true });
  const statsPath = path.join(statsRoot, "route-usage.json");
  const now = input.at ?? new Date().toISOString();
  const stats = await readRouteUsageStats(statsPath);
  stats.total += 1;
  stats.updated_at = now;
  stats.by_source[input.source] = (stats.by_source[input.source] ?? 0) + 1;
  for (const module of input.modules) {
    stats.modules[module] = (stats.modules[module] ?? 0) + 1;
  }
  for (const module of input.contextModules) {
    stats.context_modules[module] = (stats.context_modules[module] ?? 0) + 1;
  }
  stats.recent.unshift({
    at: now,
    source: input.source,
    task: input.task,
    modules: input.modules,
    context_modules: input.contextModules
  });
  stats.recent = stats.recent.slice(0, 20);
  await writeFile(statsPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
}

async function readModuleActivityStats(statsPath: string): Promise<ModuleActivityStats> {
  if (!(await fileExists(statsPath))) {
    return { version: 1, updated_at: new Date().toISOString(), modules: {} };
  }
  const parsed = JSON.parse(await readFile(statsPath, "utf8")) as ModuleActivityStats;
  return {
    version: 1,
    updated_at: parsed.updated_at,
    modules: parsed.modules ?? {}
  };
}

async function readRouteUsageStats(statsPath: string): Promise<RouteUsageStats> {
  if (!(await fileExists(statsPath))) {
    return {
      version: 1,
      updated_at: new Date().toISOString(),
      total: 0,
      by_source: {},
      modules: {},
      context_modules: {},
      recent: []
    };
  }
  const parsed = JSON.parse(await readFile(statsPath, "utf8")) as Partial<RouteUsageStats>;
  return {
    version: 1,
    updated_at: parsed.updated_at ?? new Date().toISOString(),
    total: parsed.total ?? 0,
    by_source: parsed.by_source ?? {},
    modules: parsed.modules ?? {},
    context_modules: parsed.context_modules ?? {},
    recent: parsed.recent ?? []
  };
}
