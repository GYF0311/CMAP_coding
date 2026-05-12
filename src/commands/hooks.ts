import { execFile } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { recordRouteUsage } from "../core/generated-stats.js";
import { loadModuleIndex, mapChangedFilesToModules } from "../core/module-index.js";
import { resolveInsideRoot, projectRelative } from "../fs/safe-path.js";
import { claudeLifecycleSettings, type HookMode } from "../hooks/templates.js";
import { appendEvidenceToModule } from "./evidence.js";
import { routeTask, type RouteReport } from "./route.js";

const execFileAsync = promisify(execFile);

type HookProfile = "reminder" | "maintain" | "observe" | "assist" | "strict";

type HookOptions = {
  profile: HookProfile;
  changed?: string;
  summary?: string;
};

type HookRenderOptions = {
  host?: string;
  mode?: string;
  out?: string;
};

type HookTestOptions = {
  event: string;
  mode?: string;
  tool?: string;
  file?: string;
  command?: string;
  prompt?: string;
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

  if (options.profile === "strict") {
    const changedFiles = options.changed ? splitCsv(options.changed) : await readGitChangedFiles(cwd);
    await writeHookEvent(cwd, {
      event: "stop",
      profile: options.profile,
      summary: options.summary?.trim() || "cmap hooks strict stop event",
      changedFiles
    });
    process.stdout.write(`## cmap strict hook

Changed files: ${changedFiles.length}
Run verification before finishing:
- cmap finish --changed <files>
- cmap verify --changed
- cmap verify --stale
`);
    return;
  }

  process.stdout.write(`## cmap reminder

Before ending work, consider:
- cmap checkpoint write --task "current task" --next "next step"
- cmap finish
- cmap verify --changed
`);
}

export async function runHookRender(cwd: string, options: HookRenderOptions): Promise<void> {
  const host = options.host ?? "claude";
  const mode = parseHookMode(options.mode ?? "assist");
  if (host !== "claude") {
    throw new CmapCommandError("hooks render currently supports --host claude");
  }
  const out = options.out ?? ".context/hooks/claude.settings.generated.json";
  const target = await resolveInsideRoot(cwd, out);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(claudeLifecycleSettings(mode), null, 2)}\n`, "utf8");
  process.stdout.write(`Rendered hook settings: ${projectRelative(cwd, target)}\n`);
}

export async function runHookTest(cwd: string, options: HookTestOptions): Promise<number> {
  const mode = parseHookMode(options.mode ?? "assist");
  if (options.event === "SessionStart") {
    await runHookSessionStart(cwd, { profile: mode });
    return 0;
  }
  if (options.event === "UserPromptSubmit") {
    await writeSessionEvent(cwd, { event: options.event, mode, tool: "prompt", file: undefined, command: undefined, prompt: options.prompt });
    const prompt = options.prompt?.trim();
    if (mode === "assist" && prompt) {
      const route = await routeTask(cwd, prompt, { maxContext: "6", graph: true });
      await writeSessionBrief(cwd, prompt, route);
      await recordRouteUsage(cwd, {
        source: "hook",
        task: prompt,
        modules: route.modules.map((module) => module.id),
        contextModules: route.contextModules.map((module) => module.id)
      });
      process.stdout.write("Recorded UserPromptSubmit event\nWrote .context/out/session-brief.md\n");
      return 0;
    }
    process.stdout.write("Recorded UserPromptSubmit event\nSuggested command: cmap brief \"<task>\"\n");
    return 0;
  }
  if (options.event === "PostToolUse") {
    await writeSessionEvent(cwd, {
      event: options.event,
      mode,
      tool: options.tool ?? "unknown",
      file: options.file,
      command: options.command,
      prompt: undefined
    });
    process.stdout.write("Recorded PostToolUse event\nLog: .context/logs/session-events.jsonl\n");
    return 0;
  }
  if (options.event === "PreToolUse") {
    const tool = options.tool ?? "unknown";
    const file = options.file;
    if (mode === "strict" && isDirectSemanticCanonicalWrite(tool, file)) {
      await writeSessionEvent(cwd, { event: options.event, mode, tool, file, command: options.command, prompt: undefined });
      process.stdout.write("Decision: block\nReason: direct semantic canonical writes are blocked; use cmap update/evidence/cp or inbox review.\n");
      return 1;
    }
    await writeSessionEvent(cwd, { event: options.event, mode, tool, file, command: options.command, prompt: undefined });
    process.stdout.write("Decision: allow\n");
    return 0;
  }
  if (options.event === "Stop") {
    await runHookStop(cwd, { profile: mode });
    return 0;
  }
  throw new CmapCommandError(`Unsupported hook test event: ${options.event}`);
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

async function writeSessionEvent(
  cwd: string,
  input: { event: string; mode: HookMode; tool?: string; file?: string; command?: string; prompt?: string }
): Promise<void> {
  const logsRoot = path.join(cwd, ".context", "logs");
  await mkdir(logsRoot, { recursive: true });
  const line = JSON.stringify({
    created_at: new Date().toISOString(),
    event: input.event,
    mode: input.mode,
    tool: input.tool,
    file: input.file,
    command: input.command,
    prompt: input.prompt
  });
  await appendFile(path.join(logsRoot, "session-events.jsonl"), `${line}\n`, "utf8");
}

async function writeSessionBrief(cwd: string, task: string, route: RouteReport): Promise<void> {
  const outRoot = path.join(cwd, ".context", "out");
  await mkdir(outRoot, { recursive: true });
  const lines = [
    "# cmap Session Brief",
    "",
    "## Task",
    "",
    task,
    "",
    "## Likely Modules",
    ""
  ];
  if (route.modules.length === 0) {
    lines.push("- No direct module match. Read `.context/MAP.md` first.");
  } else {
    for (const module of route.modules.slice(0, 3)) {
      lines.push(`- ${module.id}: ${module.docPath}`);
    }
  }
  lines.push("", "## Read First", "");
  for (const file of route.readFirst) {
    lines.push(`- \`${file}\``);
  }
  if (route.verifyCommands.length > 0) {
    lines.push("", "## Suggested Verify", "");
    for (const command of route.verifyCommands.slice(0, 8)) {
      lines.push(`- \`${command}\``);
    }
  }
  lines.push(
    "",
    "## Boundaries",
    "",
    "- This file is generated from a hook event and is not canonical project memory.",
    "- Use `cmap pack \"<task>\"` when the next AI needs a fuller budgeted context package."
  );
  await writeFile(path.join(outRoot, "session-brief.md"), `${lines.join("\n")}\n`, "utf8");
}

function parseHookMode(value: string): HookMode {
  if (value === "observe" || value === "assist" || value === "strict") {
    return value;
  }
  throw new CmapCommandError(`Invalid hook mode "${value}". Expected observe, assist, or strict.`);
}

function isDirectSemanticCanonicalWrite(tool: string, file: string | undefined): boolean {
  if (!["Write", "Edit", "MultiEdit"].includes(tool) || !file) {
    return false;
  }
  return (
    file === ".context/MAP.md" ||
    file === ".context/DECISIONS.md" ||
    file === ".context/VERIFY.md" ||
    /^\.context\/modules\/[^/]+\.md$/.test(file)
  );
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
