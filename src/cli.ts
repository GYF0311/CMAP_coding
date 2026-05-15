#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { runAddModule } from "./commands/add-module.js";
import { runAdopt } from "./commands/adopt.js";
import { runBenchmarkRoute } from "./commands/benchmark.js";
import { runBrief } from "./commands/brief.js";
import { runBootstrap } from "./commands/bootstrap.js";
import { runCheckpoint } from "./commands/checkpoint.js";
import { runCodexFinish, runCodexGuard, runCodexHandoff, runCodexStart } from "./commands/codex.js";
import { runCpCopy, runCpDelete, runCpMove, runCpRestore } from "./commands/cp.js";
import { runDoctor } from "./commands/doctor.js";
import { runFinish } from "./commands/finish.js";
import { runFreshnessDiff, runFreshnessMarkReviewed, runFreshnessReview, runFreshnessSnapshot } from "./commands/freshness.js";
import { runGraphBuild, runGraphExplain } from "./commands/graph.js";
import { runEvidenceAppend, runEvidenceList, runEvidenceMigrate } from "./commands/evidence.js";
import { runHookIngest, runHookRender, runHookSessionStart, runHookStop, runHookTest } from "./commands/hooks.js";
import { runInboxArchive, runInboxPromote, runInboxReject, runInboxStatus, runInboxTriage } from "./commands/inbox.js";
import { runIdeaAdd } from "./commands/idea.js";
import { runInit } from "./commands/init.js";
import { runInstall } from "./commands/install.js";
import { runLogAdd } from "./commands/log.js";
import { runObsidianExport, runObsidianOpen, runObsidianPull } from "./commands/obsidian.js";
import { runPack } from "./commands/pack.js";
import { runPolicyShow, runPolicyValidate } from "./commands/policy.js";
import { runReconcile } from "./commands/reconcile.js";
import { runRelateIngest, runRelatePromote, runRelateRequest } from "./commands/relate.js";
import { runRoute } from "./commands/route.js";
import { runSkillExport } from "./commands/skill.js";
import { runStatus } from "./commands/status.js";
import { runUpdate, runUpdateRollback } from "./commands/update.js";
import { runVerify } from "./commands/verify.js";
import { runViewExport, runViewOpen } from "./commands/view.js";
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
  .option("--changed", "Check tracked changed file coverage when git is available")
  .option("--changed-files <csv>", "Changed files to check, comma-separated")
  .option("--coverage", "Check map coverage signals")
  .option("--stale", "Warn when module docs appear older than owned files or inbox has pending candidates")
  .option("--freshness", "Warn when freshness review metadata is older than code, generated evidence, or inbox candidates")
  .option("--policy", "Validate .context/policy.yml and include policy warnings/errors")
  .option("--ci", "Render CI-friendly report")
  .option("--format <format>", "Output format: text, json, or markdown", "text")
  .action(async (options: { changed?: boolean; changedFiles?: string; coverage?: boolean; stale?: boolean; freshness?: boolean; policy?: boolean; ci?: boolean; format?: string }) => {
    const code = await runVerify(process.cwd(), options);
    process.exitCode = code;
  });

program
  .command("route")
  .description("Recommend context files to read for a task")
  .argument("<task>", "Natural-language task description")
  .option("--format <format>", "Output format: text or json", "text")
  .option("--max-context <n>", "Maximum context modules to include in the route context pack", "6")
  .option("--graph", "Enable graph-aware route explanation")
  .option("--write-alias-candidate", "Write a candidate-only alias request when no high-confidence module matches")
  .action(async (task: string, options: { format?: string; maxContext?: string; graph?: boolean; writeAliasCandidate?: boolean }) => {
    await runRoute(process.cwd(), task, options);
  });

const graph = program.command("graph").description("Build and explain deterministic context graph projections");
graph
  .command("build")
  .description("Write .context/graph JSON projections from module docs")
  .action(async () => {
    await runGraphBuild(process.cwd());
  });
graph
  .command("explain")
  .description("Explain one module's graph files and typed relations")
  .argument("<module>", "Module id")
  .action(async (module: string) => {
    await runGraphExplain(process.cwd(), module);
  });

const freshness = program.command("freshness").description("Maintain generated freshness review metadata");
freshness
  .command("snapshot")
  .description("Write .context/generated/freshness.json")
  .action(async () => {
    await runFreshnessSnapshot(process.cwd());
  });
freshness
  .command("diff")
  .description("Compare current files to the generated freshness snapshot")
  .action(async () => {
    await runFreshnessDiff(process.cwd());
  });
freshness
  .command("mark-reviewed")
  .requiredOption("--module <id>", "Module id")
  .option("--evidence <text>", "Review evidence summary")
  .action(async (options: { module?: string; evidence?: string }) => {
    await runFreshnessMarkReviewed(process.cwd(), options);
  });
freshness
  .command("review")
  .description("Render freshness review material for stale modules")
  .option("--module <id>", "Module id")
  .option("--all", "Render review material for all modules")
  .option("--out <path>", "Write review markdown to a project-relative file")
  .action(async (options: { module?: string; all?: boolean; out?: string }) => {
    await runFreshnessReview(process.cwd(), options);
  });

program
  .command("brief")
  .description("Render an AI coding brief from route, status, and module docs")
  .argument("<task>", "Natural-language task description")
  .option("--out <path>", "Write brief to a project-relative file")
  .option("--obsidian", "Include Obsidian open links for routed module notes")
  .option("--vault-name <name>", "Obsidian vault name for obsidian:// links", "corpus")
  .option("--max-context <n>", "Maximum context modules to include in the brief", "6")
  .action(async (task: string, options: { out?: string; obsidian?: boolean; vaultName?: string; maxContext?: string }) => {
    await runBrief(process.cwd(), task, options);
  });

program
  .command("pack")
  .description("Render a budgeted routed context pack for an AI coding task")
  .argument("<task>", "Natural-language task description")
  .option("--budget <tokens>", "Approximate token budget", "4000")
  .option("--format <format>", "Output format: markdown", "markdown")
  .option("--max-context <n>", "Maximum context modules to include", "8")
  .option("--out <path>", "Write pack to a project-relative file")
  .action(async (task: string, options: { budget?: string; format?: string; maxContext?: string; out?: string }) => {
    await runPack(process.cwd(), task, options);
  });

program
  .command("status")
  .description("Print the current cmap status")
  .action(async () => {
    await runStatus(process.cwd());
  });

program
  .command("checkpoint")
  .description("Read/write CHECKPOINT.md or update STATUS.md from explicit handoff fields")
  .argument("[action]", "read, write, close, or clear")
  .option("--from-stdin", "Replace STATUS.md with markdown read from stdin")
  .option("--task <text>", "Checkpoint task for `checkpoint write`")
  .option("--hypothesis <text>", "Current hypothesis for `checkpoint write`")
  .option("--goal <text>", "Active goal")
  .option("--done <text>", "Done recently")
  .option("--left-off <text>", "Where work left off")
  .option("--next <text>", "Next steps")
  .option("--files <csv>", "Changed files, comma-separated")
  .option("--risks <text>", "Risks")
  .option("--verified <text>", "Last verified")
  .option("--failed <text>", "Failed or pending checks for `checkpoint write`")
  .option("--do-not-redo <text>", "Work that should not be repeated")
  .option("--status <text>", "Checkpoint status", "active")
  .action(
    async (action: string | undefined, options: {
      fromStdin?: boolean;
      task?: string;
      hypothesis?: string;
      goal?: string;
      done?: string;
      leftOff?: string;
      next?: string;
      files?: string;
      risks?: string;
      verified?: string;
      failed?: string;
      doNotRedo?: string;
      status?: string;
    }) => {
      await runCheckpoint(process.cwd(), action, options);
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

const evidence = program.command("evidence").description("Maintain generated evidence notes");
evidence
  .command("append")
  .requiredOption("--module <id>", "Module id or alias")
  .requiredOption("--file <path>", "Project-relative evidence file")
  .requiredOption("--summary <text>", "Evidence summary")
  .option("--command <cmd>", "Verification command or shell evidence")
  .action(async (options: { module: string; file: string; summary: string; command?: string }) => {
    await runEvidenceAppend(process.cwd(), options);
  });
evidence
  .command("list")
  .option("--module <id>", "Module id or alias")
  .action(async (options: { module?: string }) => {
    await runEvidenceList(process.cwd(), options);
  });
evidence
  .command("migrate")
  .option("--from-module-docs", "Move legacy generated evidence blocks out of module docs")
  .option("--dry-run", "Preview migration without editing files")
  .option("--apply", "Apply migration and remove legacy generated blocks")
  .action(async (options: { fromModuleDocs?: boolean; dryRun?: boolean; apply?: boolean }) => {
    await runEvidenceMigrate(process.cwd(), options);
  });

const inbox = program.command("inbox").description("Inspect candidate context updates");
inbox
  .command("status")
  .action(async () => {
    await runInboxStatus(process.cwd());
  });
inbox
  .command("triage")
  .description("Summarize and prioritize candidate context updates")
  .action(async () => {
    await runInboxTriage(process.cwd());
  });
inbox
  .command("archive")
  .description("Move an inbox candidate into .context/inbox/archive")
  .argument("<id>", "Candidate id, usually the filename without .md")
  .action(async (id: string) => {
    await runInboxArchive(process.cwd(), id);
  });
inbox
  .command("reject")
  .description("Reject an inbox candidate and archive it with a reason")
  .argument("<id>", "Candidate id, usually the filename without .md")
  .requiredOption("--reason <text>", "Reason this candidate should not be promoted")
  .action(async (id: string, options: { reason?: string }) => {
    await runInboxReject(process.cwd(), id, options);
  });
inbox
  .command("promote")
  .description("Preview how a candidate could be promoted after review")
  .argument("<id>", "Candidate id, usually the filename without .md")
  .option("--dry-run", "Preview only; do not edit canonical context")
  .option("--apply", "Apply allowed low-risk candidate types with backup/audit/verify")
  .action(async (id: string, options: { dryRun?: boolean; apply?: boolean }) => {
    await runInboxPromote(process.cwd(), id, options);
  });

const policy = program.command("policy").description("Inspect deterministic cmap maintenance policy");
policy
  .command("show")
  .action(async () => {
    await runPolicyShow(process.cwd());
  });
policy
  .command("validate")
  .action(async () => {
    const code = await runPolicyValidate(process.cwd());
    process.exitCode = code;
  });

program
  .command("finish")
  .description("Print a QA-lite context closeout report")
  .option("--changed <csv>", "Changed files, comma-separated")
  .option("--agent", "Write a MapPatch request for agent-maintained context")
  .option("--task <text>", "Task summary for --agent request")
  .option("--verified <text>", "Verification evidence for --agent request")
  .action(async (options: { changed?: string; agent?: boolean; task?: string; verified?: string }) => {
    await runFinish(process.cwd(), options);
  });

const update = program.command("update").description("Process AI-authored MapPatch proposals safely");
update
  .option("--agent", "Accept an external AI-authored MapPatch")
  .option("--from <path>", "Project-relative JSON file, or '-' for stdin")
  .option("--dry-run", "Classify operations without writing files", true)
  .option("--apply-routine", "Apply only routine operations and route the rest to inbox")
  .option("--write-inbox", "Write the classification report to .context/inbox/")
  .action(async (options: { agent?: boolean; from?: string; dryRun?: boolean; applyRoutine?: boolean; writeInbox?: boolean }) => {
    await runUpdate(process.cwd(), options);
  });
update
  .command("rollback")
  .description("Restore files from a MapPatch backup id")
  .argument("<backupId>", "Backup id printed by update --apply-routine")
  .action(async (backupId: string) => {
    await runUpdateRollback(process.cwd(), backupId);
  });

const hooks = program.command("hooks").description("Print hook reminders");
hooks
  .command("session-start")
  .option("--profile <profile>", "reminder, maintain, observe, or assist", "reminder")
  .action(async (options: { profile: "reminder" | "maintain" | "observe" | "assist" }) => {
    await runHookSessionStart(process.cwd(), options);
  });
hooks
  .command("stop")
  .option("--profile <profile>", "reminder, maintain, observe, or assist", "reminder")
  .option("--changed <csv>", "Changed files to observe, comma-separated")
  .option("--summary <text>", "Hook event summary")
  .action(async (options: { profile: "reminder" | "maintain" | "observe" | "assist"; changed?: string; summary?: string }) => {
    await runHookStop(process.cwd(), options);
  });
hooks
  .command("render")
  .option("--host <host>", "Hook host to render for", "codex")
  .option("--mode <mode>", "observe, assist, or strict", "assist")
  .option("--out <path>", "Project-relative output path")
  .action(async (options: { host?: string; mode?: string; out?: string }) => {
    await runHookRender(process.cwd(), options);
  });
hooks
  .command("ingest")
  .description("Ingest a real host hook JSON payload from stdin")
  .option("--host <host>", "Hook host: codex, claude, or generic", "codex")
  .requiredOption("--event <event>", "SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, or Stop")
  .option("--mode <mode>", "observe, assist, or strict", "assist")
  .action(async (options: { host?: string; event: string; mode?: string }) => {
    const code = await runHookIngest(process.cwd(), options);
    process.exitCode = code;
  });
hooks
  .command("test")
  .requiredOption("--event <event>", "SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, or Stop")
  .option("--mode <mode>", "observe, assist, or strict", "assist")
  .option("--tool <tool>", "Simulated tool name")
  .option("--file <path>", "Simulated project-relative file path")
  .option("--command <cmd>", "Simulated shell command")
  .option("--prompt <text>", "Simulated user prompt")
  .action(async (options: { event: string; mode?: string; tool?: string; file?: string; command?: string; prompt?: string }) => {
    const code = await runHookTest(process.cwd(), options);
    process.exitCode = code;
  });

const codex = program.command("codex").description("Run explicit Codex workflows without relying on hook parity");
codex
  .command("start")
  .argument("<task>", "Task to route and start")
  .option("--write-brief", "Write .context/out/brief.md")
  .option("--write-pack", "Write .context/out/pack.md")
  .action(async (task: string, options: { writeBrief?: boolean; writePack?: boolean }) => {
    await runCodexStart(process.cwd(), task, options);
  });
codex
  .command("finish")
  .requiredOption("--task <text>", "Task summary")
  .option("--verified <text>", "Verification evidence")
  .option("--apply-routine", "Apply the newest routine MapPatch request after finish")
  .action(async (options: { task?: string; verified?: string; applyRoutine?: boolean }) => {
    await runCodexFinish(process.cwd(), options);
  });
codex
  .command("guard")
  .option("--changed", "Include changed-file coverage checks")
  .action(async (options: { changed?: boolean }) => {
    const code = await runCodexGuard(process.cwd(), options);
    process.exitCode = code;
  });
codex
  .command("handoff")
  .description("Write a Codex handoff bundle from checkpoint, status, and inbox")
  .action(async () => {
    await runCodexHandoff(process.cwd());
  });

const obsidian = program.command("obsidian").description("Export and open Obsidian-friendly cmap views");
obsidian
  .command("export")
  .description("Export .context modules to Obsidian-friendly markdown")
  .option("--out <dir>", "Project-relative export directory; defaults to _cmap/<project>")
  .option("--check", "Check whether the Obsidian export is up to date without writing files")
  .action(async (options: { out?: string; check?: boolean }) => {
    const code = await runObsidianExport(process.cwd(), options);
    process.exitCode = code;
  });
obsidian
  .command("open")
  .description("Print an obsidian:// link for a module note")
  .argument("<module>", "Module id or name")
  .option("--vault-name <name>", "Obsidian vault name", "corpus")
  .action(async (module: string, options: { vaultName?: string }) => {
    await runObsidianOpen(process.cwd(), module, options);
  });
obsidian
  .command("pull")
  .description("Dry-run candidate updates from an Obsidian export")
  .option("--from <dir>", "Project-relative Obsidian export directory; defaults to _cmap/<project>")
  .option("--dry-run", "Preview candidates without canonical writes", true)
  .option("--write-inbox", "Write the dry-run report to .context/inbox/")
  .action(async (options: { from?: string; dryRun?: boolean; writeInbox?: boolean }) => {
    await runObsidianPull(process.cwd(), options);
  });

const view = program.command("view").description("Export a standalone HTML project map review dashboard");
view
  .command("export")
  .option("--out <path>", "Output directory or HTML file path; defaults to _cmap-view/")
  .option("--single-file", "Write one standalone HTML file")
  .option("--include-generated", "Include generated evidence")
  .option("--include-inbox", "Include inbox candidates")
  .option("--include-freshness", "Include generated freshness data")
  .option("--check", "Check whether the view export is up to date without writing files")
  .action(async (options: { out?: string; singleFile?: boolean; includeGenerated?: boolean; includeInbox?: boolean; includeFreshness?: boolean; check?: boolean }) => {
    const code = await runViewExport(process.cwd(), options);
    process.exitCode = code;
  });
view
  .command("open")
  .option("--out <path>", "Output directory or HTML file path; defaults to _cmap-view/")
  .action(async (options: { out?: string }) => {
    await runViewOpen(process.cwd(), options);
  });

const relate = program.command("relate").description("Manage AI-authored relation candidates");
relate
  .command("request")
  .option("--task <text>", "Task summary for the relation request")
  .option("--changed <csv>", "Changed files to seed the request")
  .option("--from <module>", "Example source module")
  .option("--to <module>", "Example target module")
  .option("--relation <type>", "Example relation type", "depends_on")
  .option("--out <path>", "Write request markdown to this path")
  .action(async (options: { task?: string; changed?: string; from?: string; to?: string; relation?: string; out?: string }) => {
    await runRelateRequest(process.cwd(), options);
  });
relate
  .command("ingest")
  .requiredOption("--from <path>", "RelationPatch JSON file")
  .option("--dry-run", "Preview validation without writing inbox files")
  .option("--write-inbox", "Write accepted candidates into .context/inbox/relations")
  .action(async (options: { from?: string; dryRun?: boolean; writeInbox?: boolean }) => {
    await runRelateIngest(process.cwd(), options);
  });
relate
  .command("promote")
  .argument("<id>", "Relation candidate id")
  .option("--dry-run", "Preview only; relation candidates are candidate-only in v0.2")
  .action(async (id: string, options: { dryRun?: boolean }) => {
    await runRelatePromote(process.cwd(), id, options);
  });

const benchmark = program.command("benchmark").description("Run cmap behavior benchmarks");
benchmark
  .command("route")
  .description("Measure route top-k accuracy from a JSONL task file")
  .option("--file <path>", "Project-relative JSONL file", "bench/tasks.jsonl")
  .option("--min-top1 <percent>", "Fail when Top-1 hit rate is below this percent")
  .option("--min-top3 <percent>", "Fail when Top-3 hit rate is below this percent")
  .option("--min-context <percent>", "Fail when context hit rate is below this percent")
  .option("--max-bad <percent>", "Fail when bad-module hit rate is above this percent")
  .action(async (options: { file?: string; minTop1?: string; minTop3?: string; minContext?: string; maxBad?: string }) => {
    const code = await runBenchmarkRoute(process.cwd(), options);
    process.exitCode = code;
  });

program
  .command("reconcile")
  .description("Dry-run candidate facts from external workflow artifacts")
  .option("--adapter <adapter>", "gsd-v1 or gsd-v2", "gsd-v1")
  .option("--from <dir>", "Project-relative source directory")
  .option("--dry-run", "Preview candidates without canonical writes", true)
  .option("--write-inbox", "Write the dry-run report to .context/inbox/")
  .action(async (options: { adapter?: string; from?: string; dryRun?: boolean; writeInbox?: boolean }) => {
    await runReconcile(process.cwd(), options);
  });

program
  .command("doctor")
  .description("Diagnose cmap context, entrypoints, and hook templates")
  .option("--release", "Check package metadata and release readiness without publishing")
  .action(async (options: { release?: boolean }) => {
    const code = await runDoctor(process.cwd(), options);
    process.exitCode = code;
  });

program
  .command("install")
  .description("Install short AI host entrypoints")
  .option("--host <host>", "claude, codex, or both", "both")
  .option("--hooks <profile>", "none, reminder, maintain, observe, assist, or strict", "none")
  .option("--mode <mode>", "merge or print", "merge")
  .option("--force", "Overwrite the whole entrypoint file instead of merging a cmap block")
  .option("--backup", "Back up existing entrypoint files before writing")
  .action(async (options: { host: string; hooks: string; mode?: string; force?: boolean; backup?: boolean }) => {
    await runInstall(process.cwd(), options);
  });

const skill = program.command("skill").description("Export portable cmap skill packs");
skill
  .command("export")
  .description("Export a project-local cmap Skill instruction pack")
  .option("--out <path>", "Output directory", ".cmap/skills/cmap")
  .option("--host <host>", "generic, codex, or claude", "generic")
  .option("--check", "Check whether the exported skill pack is up to date")
  .action(async (options: { out?: string; host?: string; check?: boolean }) => {
    const code = await runSkillExport(process.cwd(), options);
    process.exitCode = code;
  });

program
  .command("bootstrap")
  .description("Connect a project to cmap entrypoints and optional skill pack")
  .option("--init", "Create the .context skeleton before bootstrapping a new project")
  .option("--host <host>", "claude, codex, or both", "both")
  .option("--skill", "Export .cmap/skills/cmap after installing entrypoints")
  .action(async (options: { host?: string; skill?: boolean; init?: boolean }) => {
    await runBootstrap(process.cwd(), options);
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
