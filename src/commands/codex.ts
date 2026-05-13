import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileExists } from "../context/scanner.js";
import { projectRelative } from "../fs/safe-path.js";
import { runFinish } from "./finish.js";
import { routeTask } from "./route.js";
import { runVerify } from "./verify.js";

const execFileAsync = promisify(execFile);

type CodexFinishOptions = {
  task?: string;
  verified?: string;
};

type CodexGuardOptions = {
  changed?: boolean;
};

export async function runCodexStart(cwd: string, task: string): Promise<void> {
  const route = await routeTask(cwd, task, { maxContext: "6", graph: true });
  const outRoot = path.join(cwd, ".context", "out");
  await mkdir(outRoot, { recursive: true });
  const target = path.join(outRoot, "codex-start.md");
  const lines = [
    "# cmap Codex Start",
    "",
    `Task: ${task}`,
    "",
    "## Read First",
    ...route.readFirst.map((item) => `- ${item}`),
    "",
    "## Likely Modules",
    ...(route.modules.length ? route.modules.slice(0, 3).map((module) => `- ${module.id}: ${module.docPath}`) : ["- No high-confidence module match."]),
    "",
    "## Suggested Commands",
    `- cmap brief ${JSON.stringify(task)} --max-context 6 --out .context/out/brief.md`,
    `- cmap pack ${JSON.stringify(task)} --budget 1600 --out .context/out/pack.md`,
    "- cmap verify --changed",
    "",
    "## Boundary",
    "- This is an explicit Codex workflow entrypoint; it does not depend on Codex hook parity.",
    "- Generated files under `.context/out/` are not canonical project memory.",
    ""
  ];
  await writeFile(target, lines.join("\n"), "utf8");
  process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
  process.stdout.write(lines.join("\n"));
}

export async function runCodexFinish(cwd: string, options: CodexFinishOptions): Promise<void> {
  const changed = await readGitChangedFiles(cwd);
  await runFinish(cwd, {
    changed: changed.join(","),
    agent: true,
    task: options.task,
    verified: options.verified
  });
  process.stdout.write("\n## Codex Finish Next Checks\n");
  process.stdout.write("- cmap update --agent --from .context/out/update-request-<timestamp>.md --dry-run\n");
  process.stdout.write("- cmap verify --changed\n");
  process.stdout.write("- cmap verify --stale\n");
  process.stdout.write("- cmap verify --freshness\n");
  process.stdout.write("- cmap inbox status\n");
}

export async function runCodexGuard(cwd: string, options: CodexGuardOptions): Promise<number> {
  let exitCode = 0;
  const changedFiles = await readGitChangedFiles(cwd);
  const changedArgs = options.changed && changedFiles.length > 0
    ? { changedFiles: changedFiles.join(",") }
    : {};
  process.stdout.write("# Codex Guard\n\n");
  exitCode = Math.max(exitCode, await runVerify(cwd, { changed: Boolean(options.changed), ...changedArgs }));
  exitCode = Math.max(exitCode, await runVerify(cwd, { stale: true }));
  exitCode = Math.max(exitCode, await runVerify(cwd, { freshness: true }));
  await printInboxStatus(cwd);
  return exitCode;
}

async function printInboxStatus(cwd: string): Promise<void> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  if (!(await fileExists(inboxRoot))) {
    process.stdout.write("\nInbox: no candidate inbox directory\n");
    return;
  }
  const result = await execFileAsync(process.execPath, [process.argv[1], "inbox", "status"], { cwd, encoding: "utf8" });
  process.stdout.write(`\n${result.stdout}`);
}

async function readGitChangedFiles(cwd: string): Promise<string[]> {
  try {
    const [unstaged, staged] = await Promise.all([
      execFileAsync("git", ["diff", "--name-only"], { cwd, encoding: "utf8" }),
      execFileAsync("git", ["diff", "--name-only", "--cached"], { cwd, encoding: "utf8" })
    ]);
    return uniqueLines(`${unstaged.stdout}\n${staged.stdout}`);
  } catch {
    return [];
  }
}

function uniqueLines(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}
