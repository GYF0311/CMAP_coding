import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { loadModuleIndex, mapChangedFilesToModules } from "../core/module-index.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative } from "../fs/safe-path.js";

const execFileAsync = promisify(execFile);

type FinishOptions = {
  changed?: string;
  agent?: boolean;
  task?: string;
  verified?: string;
  compact?: boolean;
  maxFiles?: string | number;
};

const DEFAULT_COMPACT_MAX_FILES = 8;
const MAX_COMPACT_FILES_LIMIT = 20;
const MAX_COMPACT_ITEM_LENGTH = 96;

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

  const lines = options.compact
    ? compactFinishLines({
      changedFiles,
      affectedModules: affectedModules.map((module) => module.id),
      unmappedFiles: mapping.unmapped,
      canonicalContextChanged,
      agentRequestPath,
      maxFiles: parseMaxFiles(options.maxFiles)
    })
    : fullFinishLines({
      changedFiles,
      affectedModules,
      unmappedFiles: mapping.unmapped,
      canonicalContextChanged,
      agentRequestPath
    });

  process.stdout.write(lines.join("\n"));
}

function fullFinishLines(input: {
  changedFiles: string[];
  affectedModules: Awaited<ReturnType<typeof loadModuleIndex>>;
  unmappedFiles: string[];
  canonicalContextChanged: boolean;
  agentRequestPath?: string;
}): string[] {
  return [
    "# Finish Report",
    "",
    "## Changed Files",
    ...(input.changedFiles.length ? input.changedFiles.map((file) => `- ${file}`) : ["- None detected"]),
    "",
    "## Changed Modules",
    ...(input.affectedModules.length ? input.affectedModules.map((module) => `- ${module.id}`) : ["- None detected"]),
    "",
    "## Unmapped Changed Files",
    ...(input.unmappedFiles.length ? input.unmappedFiles.map((file) => `- ${file}`) : ["- None"]),
    "",
    "## Context Updates Needed",
    "- STATUS.md: check whether current main thread changed",
    "- CHECKPOINT.md: update, close, or clear the current handoff state",
    ...(input.affectedModules.length
      ? input.affectedModules.map((module) => `- ${module.docPath}: maybe, if responsibilities/dependencies/data flow changed`)
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
    ...(input.agentRequestPath
      ? [
        `- MapPatch request: ${input.agentRequestPath}`,
        "- Next command after an AI fills it: cmap update --agent --from <file> --apply-routine",
        "- Routine updates may write CHECKPOINT.md with backup/audit; semantic changes go to .context/inbox/"
      ]
      : ["- None generated automatically in v0.1"]),
    "",
    ...(input.canonicalContextChanged
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
}

function compactFinishLines(input: {
  changedFiles: string[];
  affectedModules: string[];
  unmappedFiles: string[];
  canonicalContextChanged: boolean;
  agentRequestPath?: string;
  maxFiles: number;
}): string[] {
  const modules = boundedItems(input.affectedModules, input.maxFiles);
  const unmapped = boundedItems(input.unmappedFiles, input.maxFiles);
  return [
    "# Finish Summary",
    "",
    `- Changed files: ${input.changedFiles.length}`,
    `- Changed modules: ${input.affectedModules.length}`,
    `- Unmapped files: ${input.unmappedFiles.length}`,
    `- Context refresh: ${input.canonicalContextChanged ? "required" : "not detected"}`,
    "",
    "## Changed Modules",
    ...(modules.items.length ? modules.items.map((item) => `- ${item}`) : ["- None"]),
    ...(modules.omitted > 0 ? [`- ... and ${modules.omitted} more`] : []),
    "",
    `## Unmapped Files (first ${input.maxFiles})`,
    ...(unmapped.items.length ? unmapped.items.map((item) => `- ${item}`) : ["- None"]),
    ...(unmapped.omitted > 0 ? [`- ... and ${unmapped.omitted} more`] : []),
    "",
    "## Next Action",
    "- Suggested verification: cmap verify --changed",
    ...(input.agentRequestPath ? [`- MapPatch request: ${input.agentRequestPath}`] : []),
    "- Full details: cmap finish",
    ""
  ];
}

function boundedItems(items: string[], limit: number): { items: string[]; omitted: number } {
  return {
    items: items.slice(0, limit).map((item) => truncateMiddle(item, MAX_COMPACT_ITEM_LENGTH)),
    omitted: Math.max(0, items.length - limit)
  };
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  const side = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, side)}...${value.slice(value.length - side)}`;
}

function parseMaxFiles(value: string | number | undefined): number {
  const parsed = value === undefined ? DEFAULT_COMPACT_MAX_FILES : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_COMPACT_FILES_LIMIT) {
    throw new CmapCommandError(`--max-files must be an integer between 1 and ${MAX_COMPACT_FILES_LIMIT}`, 2);
  }
  return parsed;
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
