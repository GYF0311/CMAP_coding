import { execFile } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileExists } from "../context/scanner.js";
import { loadModuleIndex, mapChangedFilesToModules } from "../core/module-index.js";
import { appendEvidenceToModule } from "./evidence.js";

const execFileAsync = promisify(execFile);

type HookProfile = "reminder" | "maintain" | "observe" | "assist";

type HookOptions = {
  profile: HookProfile;
  changed?: string;
  summary?: string;
};

export async function runHookSessionStart(_cwd: string, options: HookOptions): Promise<void> {
  process.stdout.write(`# cmap session reminder

- Read .context/MAP.md for the project map.
- Read .context/CHECKPOINT.md for the current handoff, then .context/STATUS.md for durable status.
- Use cmap route "<task>" before editing modules.
- Treat logs/, ideas/, and pending/ as non-canonical.

Profile: ${options.profile}
`);
}

export async function runHookStop(_cwd: string, options: HookOptions): Promise<void> {
  const cwd = _cwd;
  if (options.profile === "maintain") {
    process.stdout.write(`## cmap maintain reminder

Changed files may affect project context.

Please check:
1. Did module responsibility change?
2. Did module dependency change?
3. Did data flow change?
4. Was a new trap discovered?
5. Should CHECKPOINT.md or STATUS.md be updated?
6. Should a work log be added?

Suggested commands:
- cmap route "current task"
- cmap checkpoint write --task "current task" --next "next step"
- cmap verify --changed
- cmap verify --stale
- cmap inbox status
`);
    return;
  }

  if (options.profile === "observe" || options.profile === "assist") {
    const changedFiles = options.changed ? splitCsv(options.changed) : await readGitChangedFiles(cwd);
    const summary = options.summary?.trim() || `cmap hooks ${options.profile} stop event`;
    await writeHookEvent(cwd, {
      event: "stop",
      profile: options.profile,
      summary,
      changedFiles
    });

    if (options.profile === "observe") {
      process.stdout.write(`## cmap observe hook

Observed hook event: stop
Changed files: ${changedFiles.length}
Log: .context/logs/hooks.jsonl
`);
      return;
    }

    const result = await appendAssistEvidence(cwd, changedFiles, summary);
    process.stdout.write(`## cmap assist hook

Observed hook event: stop
Changed files: ${changedFiles.length}
Generated evidence updates: ${result.updated.length}
`);
    if (result.updated.length > 0) {
      process.stdout.write("\nUpdated evidence:\n");
      for (const item of result.updated) {
        process.stdout.write(`- ${item.file} -> ${item.module}\n`);
      }
    }
    if (result.unmapped.length > 0) {
      process.stdout.write("\nUnmapped changed files:\n");
      for (const file of result.unmapped) {
        process.stdout.write(`- ${file}\n`);
      }
    }
    process.stdout.write("\nSuggested commands:\n- cmap verify --stale\n- cmap inbox status\n");
    return;
  }

  process.stdout.write(`## cmap reminder

Before ending work, consider:
- cmap checkpoint write --task "current task" --next "next step"
- cmap finish
- cmap verify --changed
`);
}

async function appendAssistEvidence(
  cwd: string,
  changedFiles: string[],
  summary: string
): Promise<{ updated: Array<{ file: string; module: string }>; unmapped: string[] }> {
  const modules = await loadModuleIndex(cwd);
  const mapping = mapChangedFilesToModules(changedFiles, modules);
  const updated: Array<{ file: string; module: string }> = [];

  for (const match of mapping.matches) {
    if (match.modules.length === 0) {
      continue;
    }
    if (!(await fileExists(path.join(cwd, match.file)))) {
      continue;
    }
    for (const module of match.modules) {
      await appendEvidenceToModule(cwd, module, {
        file: match.file,
        summary,
        command: "cmap hooks stop --profile assist"
      });
      updated.push({ file: match.file, module: module.id });
    }
  }

  return { updated, unmapped: mapping.unmapped };
}

async function writeHookEvent(
  cwd: string,
  input: { event: string; profile: HookProfile; summary: string; changedFiles: string[] }
): Promise<void> {
  const logsRoot = path.join(cwd, ".context", "logs");
  await mkdir(logsRoot, { recursive: true });
  const line = JSON.stringify({
    created_at: new Date().toISOString(),
    event: input.event,
    profile: input.profile,
    summary: input.summary,
    changed_files: input.changedFiles
  });
  await appendFile(path.join(logsRoot, "hooks.jsonl"), `${line}\n`, "utf8");
}

async function readGitChangedFiles(cwd: string): Promise<string[]> {
  try {
    const result = await execFileAsync("git", ["status", "--short"], { cwd, encoding: "utf8" });
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.slice(3).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
