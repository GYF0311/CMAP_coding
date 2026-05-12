import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

export async function recordModuleActivity(
  cwd: string,
  input: { moduleId: string; file: string; summary: string; command?: string; at?: string }
): Promise<void> {
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
