#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { runAddModule } from "./commands/add-module.js";
import { runAdopt } from "./commands/adopt.js";
import { runBrief } from "./commands/brief.js";
import { runCheckpoint } from "./commands/checkpoint.js";
import { runCpCopy, runCpDelete, runCpMove, runCpRestore } from "./commands/cp.js";
import { runDoctor } from "./commands/doctor.js";
import { runFinish } from "./commands/finish.js";
import { runHookSessionStart, runHookStop } from "./commands/hooks.js";
import { runIdeaAdd } from "./commands/idea.js";
import { runInit } from "./commands/init.js";
import { runInstall } from "./commands/install.js";
import { runLogAdd } from "./commands/log.js";
import { runObsidianExport, runObsidianOpen } from "./commands/obsidian.js";
import { runRoute } from "./commands/route.js";
import { runStatus } from "./commands/status.js";
import { runVerify } from "./commands/verify.js";
import { CmapCommandError } from "./errors.js";
import { readPackageVersion } from "./version.js";

const program = new Command();

program
  .name("cmap")
  .description("Project map and public project memory for AI coding")
  .showHelpAfterError()
  .exitOverride();

program
  .command("version")
  .description("Print cmap version")
  .action(async () => {
    process.stdout.write(`${await readPackageVersion()}\n`);
  });

program
  .command("init")
  .description("Create the .context project map skeleton")
  .option("--auto", "Create default templates without prompting")
  .action(async (options: { auto?: boolean }) => {
    await runInit(process.cwd(), options);
  });

program
  .command("adopt")
  .description("Create an adoption workspace for an existing project")
  .action(async () => {
    await runAdopt(process.cwd());
  });

program
  .command("verify")
  .description("Check .context structure and trusted map files")
  .option("--changed", "Reserve checks for changed files when git is available")
  .option("--format <format>", "Output format: text or json", "text")
  .action(async (options: { changed?: boolean; format?: string }) => {
    const code = await runVerify(process.cwd(), options);
    process.exitCode = code;
  });

program
  .command("route")
  .description("Recommend context files to read for a task")
  .argument("<task>", "Natural-language task description")
  .option("--format <format>", "Output format: text or json", "text")
  .action(async (task: string, options: { format?: string }) => {
    await runRoute(process.cwd(), task, options);
  });

program
  .command("brief")
  .description("Render an AI coding brief from route, status, and module docs")
  .argument("<task>", "Natural-language task description")
  .option("--out <path>", "Write brief to a project-relative file")
  .option("--obsidian", "Include Obsidian open links for routed module notes")
  .option("--vault-name <name>", "Obsidian vault name for obsidian:// links", "corpus")
  .action(async (task: string, options: { out?: string; obsidian?: boolean; vaultName?: string }) => {
    await runBrief(process.cwd(), task, options);
  });

program
  .command("status")
  .description("Print the current cmap status")
  .action(async () => {
    await runStatus(process.cwd());
  });

program
  .command("checkpoint")
  .description("Update .context/STATUS.md from explicit handoff fields")
  .option("--from-stdin", "Replace STATUS.md with markdown read from stdin")
  .option("--goal <text>", "Active goal")
  .option("--done <text>", "Done recently")
  .option("--left-off <text>", "Where work left off")
  .option("--next <text>", "Next steps")
  .option("--files <csv>", "Changed files, comma-separated")
  .option("--risks <text>", "Risks")
  .option("--verified <text>", "Last verified")
  .action(
    async (options: {
      fromStdin?: boolean;
      goal?: string;
      done?: string;
      leftOff?: string;
      next?: string;
      files?: string;
      risks?: string;
      verified?: string;
    }) => {
      await runCheckpoint(process.cwd(), options);
    }
  );

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

program
  .command("add-module")
  .description("Create a candidate module doc")
  .argument("<name>", "Module name")
  .option("--path <path>", "Code path for this module", collect, [])
  .option("--alias <alias>", "Natural-language alias", collect, [])
  .action(async (name: string, options: { path: string[]; alias: string[] }) => {
    await runAddModule(process.cwd(), name, options);
  });

const cp = program.command("cp").description("Move/copy/delete/restore existing line blocks");

cp.command("copy")
  .argument("<from>", "file:start-end")
  .argument("<to>", "file:start|end|line")
  .action(async (from: string, to: string) => {
    await runCpCopy(process.cwd(), from, to);
  });

cp.command("move")
  .argument("<from>", "file:start-end")
  .argument("<to>", "file:start|end|line")
  .action(async (from: string, to: string) => {
    await runCpMove(process.cwd(), from, to);
  });

cp.command("delete")
  .argument("<target>", "file:start-end")
  .action(async (target: string) => {
    await runCpDelete(process.cwd(), target);
  });

cp.command("restore")
  .argument("<backupId>", "Backup id printed by move/delete")
  .action(async (backupId: string) => {
    await runCpRestore(process.cwd(), backupId);
  });

const log = program.command("log").description("Append work logs");
log
  .command("add")
  .argument("<text>", "Work log summary")
  .action(async (text: string) => {
    await runLogAdd(process.cwd(), text);
  });

const idea = program.command("idea").description("Append non-canonical ideas");
idea
  .command("add")
  .argument("<text>", "Idea summary")
  .action(async (text: string) => {
    await runIdeaAdd(process.cwd(), text);
  });

program
  .command("finish")
  .description("Print a QA-lite context closeout report")
  .option("--changed <csv>", "Changed files, comma-separated")
  .action(async (options: { changed?: string }) => {
    await runFinish(process.cwd(), options);
  });

const hooks = program.command("hooks").description("Print hook reminders");
hooks
  .command("session-start")
  .option("--profile <profile>", "reminder or maintain", "reminder")
  .action(async (options: { profile: "reminder" | "maintain" }) => {
    await runHookSessionStart(process.cwd(), options);
  });
hooks
  .command("stop")
  .option("--profile <profile>", "reminder or maintain", "reminder")
  .action(async (options: { profile: "reminder" | "maintain" }) => {
    await runHookStop(process.cwd(), options);
  });

const obsidian = program.command("obsidian").description("Export and open Obsidian-friendly cmap views");
obsidian
  .command("export")
  .description("Export .context modules to Obsidian-friendly markdown")
  .option("--out <dir>", "Project-relative export directory; defaults to _cmap/<project>")
  .action(async (options: { out?: string }) => {
    await runObsidianExport(process.cwd(), options);
  });
obsidian
  .command("open")
  .description("Print an obsidian:// link for a module note")
  .argument("<module>", "Module id or name")
  .option("--vault-name <name>", "Obsidian vault name", "corpus")
  .action(async (module: string, options: { vaultName?: string }) => {
    await runObsidianOpen(process.cwd(), module, options);
  });

program
  .command("doctor")
  .description("Diagnose cmap context, entrypoints, and hook templates")
  .action(async () => {
    await runDoctor(process.cwd());
  });

program
  .command("install")
  .description("Install short AI host entrypoints")
  .option("--host <host>", "claude, codex, or both", "both")
  .option("--hooks <profile>", "none, reminder, or maintain", "none")
  .action(async (options: { host: string; hooks: string }) => {
    await runInstall(process.cwd(), options);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CmapCommandError) {
    process.exitCode = error.exitCode;
    process.stderr.write(`${error.message}\n`);
  } else if (error instanceof CommanderError) {
    const commanderError = error as { exitCode: number; message: string };
    process.exitCode = commanderError.exitCode === 0 ? 0 : 2;
  } else {
    process.exitCode = 2;
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
}
