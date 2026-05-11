import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadModuleIndex, mapChangedFilesToModules } from "../core/module-index.js";

const execFileAsync = promisify(execFile);

type FinishOptions = {
  changed?: string;
};

export async function runFinish(cwd: string, options: FinishOptions): Promise<void> {
  const changedFiles = options.changed
    ? splitCsv(options.changed)
    : await readGitChangedFiles(cwd);
  const modules = await loadModuleIndex(cwd);
  const mapping = mapChangedFilesToModules(changedFiles, modules);
  const affectedModules = mapping.affectedModules;

  const lines = [
    "# Finish Report",
    "",
    "## Changed Files",
    ...(changedFiles.length ? changedFiles.map((file) => `- ${file}`) : ["- None detected"]),
    "",
    "## Changed Modules",
    ...(affectedModules.length ? affectedModules.map((module) => `- ${module.id}`) : ["- None detected"]),
    "",
    "## Unmapped Changed Files",
    ...(mapping.unmapped.length ? mapping.unmapped.map((file) => `- ${file}`) : ["- None"]),
    "",
    "## Context Updates Needed",
    "- STATUS.md: check whether current main thread changed",
    "- CHECKPOINT.md: update, close, or clear the current handoff state",
    ...(affectedModules.length
      ? affectedModules.map((module) => `- ${module.docPath}: maybe, if responsibilities/dependencies/data flow changed`)
      : ["- modules/*.md: no changed module detected"]),
    "- DECISIONS.md: only if a long-lived design tradeoff was made",
    "- traps/: only if a repeatable pitfall was discovered",
    "- logs/current.md: consider `cmap log add \"...\"` for task-end summaries",
    "",
    "## Handoff Actions",
    "- Suggested: cmap checkpoint write --task \"current task\" --next \"next step\" if work continues",
    "- Suggested: cmap checkpoint close if the task is complete",
    "",
    "## Pending Updates",
    "- None generated automatically in v0.1",
    "",
    "## Verification",
    "- Suggested: cmap verify --changed",
    "- Also run project commands listed in .context/VERIFY.md before claiming done",
    ""
  ];

  process.stdout.write(lines.join("\n"));
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
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
