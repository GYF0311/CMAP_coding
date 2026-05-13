import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileExists } from "../context/scanner.js";
import { projectRelative } from "../fs/safe-path.js";
import { runBrief } from "./brief.js";
import { runFinish } from "./finish.js";
import { runInboxStatus } from "./inbox.js";
import { runPack } from "./pack.js";
import { routeTask } from "./route.js";
import { runUpdate } from "./update.js";
import { runVerify } from "./verify.js";

const execFileAsync = promisify(execFile);

type CodexFinishOptions = {
  task?: string;
  verified?: string;
  applyRoutine?: boolean;
};

type CodexGuardOptions = {
  changed?: boolean;
};

type CodexStartOptions = {
  writeBrief?: boolean;
  writePack?: boolean;
};

export async function runCodexStart(cwd: string, task: string, options: CodexStartOptions = {}): Promise<void> {
  const route = await routeTask(cwd, task, { maxContext: "6", graph: true });
  const outRoot = path.join(cwd, ".context", "out");
  await mkdir(outRoot, { recursive: true });
  if (options.writeBrief) {
    await runBrief(cwd, task, { maxContext: "6", out: ".context/out/brief.md" });
  }
  if (options.writePack) {
    await runPack(cwd, task, { budget: "1600", maxContext: "8", out: ".context/out/pack.md" });
  }
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
    "- cmap codex finish --task <task> --verified <commands>",
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
  if (options.applyRoutine) {
    const request = await newestUpdateRequest(cwd);
    if (!request) {
      process.stdout.write("\nNo update request found for --apply-routine.\n");
      return;
    }
    process.stdout.write(`\n## Applying Routine MapPatch\n\n`);
    await runUpdate(cwd, {
      agent: true,
      from: request,
      applyRoutine: true
    });
  }
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

export async function runCodexHandoff(cwd: string): Promise<void> {
  const outRoot = path.join(cwd, ".context", "out");
  await mkdir(outRoot, { recursive: true });
  const target = path.join(outRoot, "codex-handoff.md");
  const [checkpoint, status, inbox] = await Promise.all([
    readOptional(cwd, ".context/CHECKPOINT.md"),
    readOptional(cwd, ".context/STATUS.md"),
    inboxStatusText(cwd)
  ]);
  const body = [
    "# cmap Codex Handoff",
    "",
    "## Checkpoint",
    checkpoint,
    "",
    "## Status",
    status,
    "",
    "## Inbox",
    inbox,
    "",
    "## Suggested Next Commands",
    "- cmap codex guard --changed",
    "- cmap view export --include-generated --include-inbox --include-freshness --out _cmap-view",
    "- cmap freshness review --all --out .context/out/freshness-review.md",
    ""
  ].join("\n");
  await writeFile(target, body, "utf8");
  process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
  process.stdout.write(body);
}

async function printInboxStatus(cwd: string): Promise<void> {
  process.stdout.write(`\n${await inboxStatusText(cwd)}`);
}

async function inboxStatusText(cwd: string): Promise<string> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  if (!(await fileExists(inboxRoot))) {
    return "Inbox: no candidate inbox directory\n";
  }
  return captureStdout(() => runInboxStatus(cwd));
}

async function readOptional(cwd: string, relative: string): Promise<string> {
  const target = path.join(cwd, relative);
  if (!(await fileExists(target))) {
    return "Not available.";
  }
  return readFile(target, "utf8");
}

async function newestUpdateRequest(cwd: string): Promise<string | undefined> {
  const outRoot = path.join(cwd, ".context", "out");
  if (!(await fileExists(outRoot))) {
    return undefined;
  }
  const entries = await readdir(outRoot);
  const requests = await Promise.all(entries
    .filter((entry) => entry.startsWith("update-request-") && entry.endsWith(".md"))
    .map(async (entry) => ({
      entry,
      mtimeMs: (await stat(path.join(outRoot, entry))).mtimeMs
    })));
  const latest = requests.sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  return latest ? path.join(".context", "out", latest.entry) : undefined;
}

async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const original = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return output;
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
