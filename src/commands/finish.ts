import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { loadModuleIndex, mapChangedFilesToModules } from "../core/module-index.js";
import { projectRelative } from "../fs/safe-path.js";

const execFileAsync = promisify(execFile);

type FinishOptions = {
  changed?: string;
  agent?: boolean;
  task?: string;
  verified?: string;
};

export async function runFinish(cwd: string, options: FinishOptions): Promise<void> {
  const changedFiles = options.changed
    ? splitCsv(options.changed)
    : await readGitChangedFiles(cwd);
  const modules = await loadModuleIndex(cwd);
  const mapping = mapChangedFilesToModules(changedFiles, modules);
  const affectedModules = mapping.affectedModules;
  const canonicalContextChanged = changedFiles.some(isCanonicalContextFile);

  const agentRequestPath = options.agent
    ? await writeAgentUpdateRequest(cwd, {
      task: options.task,
      verified: options.verified,
      changedFiles,
      affectedModules: affectedModules.map((module) => module.id),
      unmappedFiles: mapping.unmapped
    })
    : undefined;

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
    ...(agentRequestPath
      ? [
        `- MapPatch request: ${agentRequestPath}`,
        "- Next command after an AI fills it: cmap update --agent --from <file> --apply-routine",
        "- Routine updates may write CHECKPOINT.md with backup/audit; semantic changes go to .context/inbox/"
      ]
      : ["- None generated automatically in v0.1"]),
    "",
    ...(canonicalContextChanged
      ? [
        "## Generated View Refresh",
        "Canonical context files changed. Refresh generated review layers:",
        "- `cmap graph build`",
        "- `cmap view export --out _cmap-view`",
        "- `cmap obsidian export`",
        "Check generated views:",
        "- `cmap view export --check --out _cmap-view`",
        "- `cmap obsidian export --check`",
        ""
      ]
      : []),
    "## Verification",
    "- Suggested: cmap verify --changed",
    "- Also run project commands listed in .context/VERIFY.md before claiming done",
    ""
  ];

  process.stdout.write(lines.join("\n"));
}

async function writeAgentUpdateRequest(
  cwd: string,
  input: {
    task: string | undefined;
    verified: string | undefined;
    changedFiles: string[];
    affectedModules: string[];
    unmappedFiles: string[];
  }
): Promise<string> {
  const outRoot = path.join(cwd, ".context", "out");
  await mkdir(outRoot, { recursive: true });
  const target = path.join(outRoot, `update-request-${timeStamp()}.md`);
  const task = input.task?.trim() || "Describe the current task explicitly.";
  const patch = {
    schema: "cmap.map_patch.v1",
    agent: "codex",
    summary: "Routine task handoff and candidate context updates after finish.",
    task,
    operations: [
      {
        op: "checkpoint.write",
        target: ".context/CHECKPOINT.md",
        risk: "routine",
        confidence: 0.8,
        summary: "Update current checkpoint from explicit finish evidence.",
        evidence: input.changedFiles,
        fields: {
          task,
          next: "Review this MapPatch request and continue from the latest changed files.",
          files: input.changedFiles,
          verified: input.verified?.trim() || "Not recorded.",
          failed: "None recorded.",
          do_not_redo: "Do not re-scan unrelated modules unless route evidence changes."
        }
      },
      {
        op: "module.update",
        target: ".context/modules/<module>.md",
        risk: "high",
        confidence: 0.5,
        summary: "If responsibilities, dependencies, traps, or verification changed, replace this with a concrete module candidate.",
        evidence: input.changedFiles,
        fields: {}
      }
    ]
  };
  const body = [
    "# Agent MapPatch Request",
    "",
    "Fill the JSON below with explicit evidence. `cmap update --agent` will only auto-apply routine checkpoint state; semantic updates are routed to `.context/inbox/`.",
    "",
    "## Finish Evidence",
    "",
    `Task: ${task}`,
    "",
    "Changed files:",
    ...(input.changedFiles.length ? input.changedFiles.map((file) => `- ${file}`) : ["- None detected"]),
    "",
    "Affected modules:",
    ...(input.affectedModules.length ? input.affectedModules.map((module) => `- ${module}`) : ["- None detected"]),
    "",
    "Unmapped files:",
    ...(input.unmappedFiles.length ? input.unmappedFiles.map((file) => `- ${file}`) : ["- None"]),
    "",
    "## MapPatch JSON",
    "",
    "```json",
    JSON.stringify(patch, null, 2),
    "```",
    ""
  ];
  await writeFile(target, body.join("\n"), "utf8");
  return projectRelative(cwd, target);
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

function isCanonicalContextFile(file: string): boolean {
  return (
    file === ".context/MAP.md" ||
    file === ".context/STATUS.md" ||
    file === ".context/CHECKPOINT.md" ||
    file === ".context/DECISIONS.md" ||
    file === ".context/VERIFY.md" ||
    /^\.context\/modules\/[^/]+\.md$/.test(file)
  );
}

function timeStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").toLowerCase();
}
