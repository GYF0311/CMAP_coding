import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";
import { loadContextPolicy, validateContextPolicy } from "../context/policy.js";
import { loadModuleIndex, mapChangedFilesToModules } from "../core/module-index.js";
import { freshnessWarnings } from "../core/freshness.js";
import { hasLegacyModuleDocEvidence } from "../core/generated-store.js";

const execFileAsync = promisify(execFile);

type VerifyOptions = {
  changed?: boolean;
  changedFiles?: string;
  coverage?: boolean;
  stale?: boolean;
  freshness?: boolean;
  policy?: boolean;
  ci?: boolean;
  format?: string;
};

type VerifyIssue = {
  level: "error" | "warning";
  message: string;
};

type VerifyReport = {
  ok: string[];
  issues: VerifyIssue[];
};

const requiredFiles = [
  "BRIEF.md",
  "MAP.md",
  "STATUS.md",
  "CHECKPOINT.md",
  "DECISIONS.md",
  "VERIFY.md",
  "logs/_index.md",
  "logs/current.md",
  "ideas/_inbox.md"
];

const requiredHeadings: Record<string, string[]> = {
  "BRIEF.md": ["# Project Brief", "## One-liner", "## Non-goals"],
  "MAP.md": ["# Project Map", "## Module Map", "## Natural Language Route"],
  "STATUS.md": ["# Status", "## Active Goal", "## Next Steps", "## Last Verified"],
  "CHECKPOINT.md": ["# Current Checkpoint", "## Current Task", "## Next Step"],
  "VERIFY.md": ["# Verification", "## Required Commands", "## Manual Verification"]
};

export async function runVerify(cwd: string, options: VerifyOptions): Promise<number> {
  const report = await verifyContext(cwd, options);

  if (options.ci && options.format === "markdown") {
    process.stdout.write(formatVerifyCiMarkdown(report));
  } else if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatVerifyReport(report));
  }

  return report.issues.some((issue) => issue.level === "error") ? 1 : 0;
}

export async function verifyContext(cwd: string, options: VerifyOptions = {}): Promise<VerifyReport> {
  const contextRoot = path.join(cwd, ".context");
  const report: VerifyReport = { ok: [], issues: [] };
  const missing: string[] = [];

  for (const relative of requiredFiles) {
    if (!(await fileExists(path.join(contextRoot, relative)))) {
      missing.push(relative);
      report.issues.push({ level: "error", message: `Missing required file: .context/${relative}` });
    }
  }

  if (missing.length === 0) {
    report.ok.push("Structure: all required files exist");
  }

  for (const relative of requiredFiles.filter((file) => !missing.includes(file))) {
    await checkMarkdownFile(path.join(contextRoot, relative), relative, report);
  }

  await checkMapModuleDocs(contextRoot, report);
  const modules = await loadModuleIndex(cwd);
  await checkModuleReferences(cwd, contextRoot, modules, report);
  checkModuleRelations(modules, report);
  await checkEntrypoints(cwd, report);
  await checkVerifyCommands(cwd, contextRoot, report);
  await checkLegacyPending(contextRoot, report);
  await checkLegacyStats(contextRoot, report);
  await checkLegacyModuleEvidence(contextRoot, report);
  if (options.stale) {
    await checkStaleModuleDocs(cwd, modules, report);
    await checkInboxBacklog(cwd, contextRoot, report);
  }
  if (options.freshness) {
    await checkFreshness(cwd, report);
  }
  if (options.policy) {
    await checkPolicy(cwd, report);
  }
  if (options.changed || options.coverage) {
    await checkChangedCoverage(cwd, modules, options, report);
  }

  return report;
}

async function checkMarkdownFile(filePath: string, relative: string, report: VerifyReport): Promise<void> {
  const raw = await readFile(filePath, "utf8");
  try {
    const parsed = matter(raw);
    if (!parsed.data.context_type) {
      report.issues.push({ level: "warning", message: `.context/${relative} is missing context_type frontmatter` });
    }
  } catch (error) {
    report.issues.push({
      level: "error",
      message: `.context/${relative} has invalid frontmatter: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  for (const heading of requiredHeadings[relative] ?? []) {
    if (!raw.includes(heading)) {
      report.issues.push({ level: "error", message: `.context/${relative} is missing heading: ${heading}` });
    }
  }

  if (raw.includes("TODO(ai-fill)")) {
    report.issues.push({ level: "warning", message: `.context/${relative} contains TODO(ai-fill)` });
  }
}

async function checkModuleReferences(
  cwd: string,
  contextRoot: string,
  modules: Awaited<ReturnType<typeof loadModuleIndex>>,
  report: VerifyReport
): Promise<void> {
  const modulesRoot = path.join(contextRoot, "modules");
  if (!(await fileExists(modulesRoot))) {
    return;
  }

  let entries: string[] = [];
  try {
    entries = await readdir(modulesRoot);
  } catch {
    return;
  }

  for (const entry of entries.filter((item) => item.endsWith(".md"))) {
    const raw = await readFile(path.join(modulesRoot, entry), "utf8");
    if (raw.includes("TODO(ai-fill)")) {
      report.issues.push({ level: "warning", message: `.context/modules/${entry} contains TODO(ai-fill)` });
    }
  }

  for (const module of modules) {
    for (const moduleRelativePath of module.pathsInclude) {
      if (moduleRelativePath.includes("*")) {
        continue;
      }
      const candidate = path.resolve(cwd, moduleRelativePath);
      if (!(await isInside(cwd, candidate)) || !(await fileExists(candidate))) {
        report.issues.push({
          level: "error",
          message: `${module.docPath} points to missing path ${moduleRelativePath}`
        });
      }
    }
  }
}

function checkModuleRelations(modules: Awaited<ReturnType<typeof loadModuleIndex>>, report: VerifyReport): void {
  const ids = new Set(modules.map((module) => module.id));
  let checked = 0;

  for (const module of modules) {
    for (const [relation, targets] of Object.entries(module.relations)) {
      for (const target of targets) {
        checked += 1;
        if (!ids.has(target)) {
          report.issues.push({
            level: "error",
            message: `${module.docPath} relation ${relation} points to missing module: ${target}`
          });
        }
      }
    }
  }

  if (checked > 0) {
    report.ok.push(`Relations: ${checked} typed relation targets checked`);
  }
}

async function checkMapModuleDocs(contextRoot: string, report: VerifyReport): Promise<void> {
  const mapPath = path.join(contextRoot, "MAP.md");
  if (!(await fileExists(mapPath))) {
    return;
  }

  const map = await readFile(mapPath, "utf8");
  for (const moduleDoc of moduleDocsFromMapTable(map)) {
    const absoluteDoc = path.resolve(path.dirname(contextRoot), moduleDoc);
    if (!(await isInside(path.dirname(contextRoot), absoluteDoc)) || !(await fileExists(absoluteDoc))) {
      report.issues.push({ level: "error", message: `MAP.md references missing module doc: ${moduleDoc}` });
    }
  }
}

function moduleDocsFromMapTable(map: string): string[] {
  const docs: string[] = [];
  const lines = map.split(/\r?\n/);
  let inModuleMap = false;
  let docIndex = -1;

  for (const line of lines) {
    if (line.trim() === "## Module Map") {
      inModuleMap = true;
      continue;
    }
    if (inModuleMap && line.startsWith("## ")) {
      break;
    }
    if (!inModuleMap || !line.trim().startsWith("|")) {
      continue;
    }

    const cells = parseMarkdownTableRow(line);
    if (cells.length === 0 || cells.every((cell) => /^-+$/.test(cell))) {
      continue;
    }
    if (docIndex === -1) {
      docIndex = cells.findIndex((cell) => cell.toLocaleLowerCase() === "doc");
      continue;
    }
    const doc = cells[docIndex]?.replace(/`/g, "").trim();
    if (doc && !doc.includes("TODO(ai-fill)") && doc.startsWith(".context/modules/")) {
      docs.push(doc);
    }
  }

  return docs;
}

function parseMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

async function checkEntrypoints(cwd: string, report: VerifyReport): Promise<void> {
  const agentsPath = path.join(cwd, "AGENTS.md");
  const claudePath = path.join(cwd, "CLAUDE.md");
  if (!(await fileExists(agentsPath)) || !(await fileExists(claudePath))) {
    return;
  }

  const [agents, claude] = await Promise.all([readFile(agentsPath, "utf8"), readFile(claudePath, "utf8")]);
  if (agents !== claude) {
    report.issues.push({ level: "warning", message: "AGENTS.md and CLAUDE.md differ" });
  }
}

async function checkVerifyCommands(cwd: string, contextRoot: string, report: VerifyReport): Promise<void> {
  const packagePath = path.join(cwd, "package.json");
  const verifyPath = path.join(contextRoot, "VERIFY.md");
  if (!(await fileExists(packagePath)) || !(await fileExists(verifyPath))) {
    return;
  }

  const rawPackage = await readFile(packagePath, "utf8");
  const parsed = JSON.parse(rawPackage) as { scripts?: Record<string, string> };
  const scripts = Object.keys(parsed.scripts ?? {}).filter((script) =>
    ["test", "typecheck", "lint", "build", "smoke"].includes(script)
  );
  if (scripts.length === 0) {
    return;
  }

  const verify = await readFile(verifyPath, "utf8");
  for (const script of scripts) {
    if (!verifyMentionsScript(verify, script)) {
      report.issues.push({ level: "warning", message: `VERIFY.md does not mention package script: ${script}` });
    }
  }
}

function verifyMentionsScript(verify: string, script: string): boolean {
  const commands = commandCellsFromVerify(verify);
  const accepted = script === "test" ? ["npm test", "pnpm test", "yarn test"] : [`npm run ${script}`, `pnpm ${script}`, `yarn ${script}`];
  return commands.some((command) => accepted.includes(command));
}

function commandCellsFromVerify(verify: string): string[] {
  const commands: string[] = [];
  let inRequiredCommands = false;
  let commandIndex = -1;

  for (const line of verify.split(/\r?\n/)) {
    if (line.trim() === "## Required Commands") {
      inRequiredCommands = true;
      continue;
    }
    if (inRequiredCommands && line.startsWith("## ")) {
      break;
    }
    if (!inRequiredCommands || !line.trim().startsWith("|")) {
      continue;
    }
    const cells = parseMarkdownTableRow(line);
    if (cells.length === 0 || cells.every((cell) => /^-+$/.test(cell))) {
      continue;
    }
    if (commandIndex === -1) {
      commandIndex = cells.findIndex((cell) => cell.toLocaleLowerCase() === "command");
      continue;
    }
    const command = cells[commandIndex]?.replace(/`/g, "").trim();
    if (command) {
      commands.push(command);
    }
  }

  return commands;
}

async function checkLegacyPending(contextRoot: string, report: VerifyReport): Promise<void> {
  const pendingRoot = path.join(contextRoot, "pending");
  if (!(await fileExists(pendingRoot))) {
    return;
  }

  const entries = await readdir(pendingRoot);
  const pendingFiles = entries.filter((entry) => entry.endsWith(".md"));
  report.issues.push({
    level: "warning",
    message: `Legacy: .context/pending exists with ${pendingFiles.length} markdown file(s); new candidates should use .context/inbox`
  });
}

async function checkLegacyStats(contextRoot: string, report: VerifyReport): Promise<void> {
  const statsRoot = path.join(contextRoot, "stats");
  if (!(await fileExists(statsRoot))) {
    return;
  }
  const entries = await readdir(statsRoot);
  const statsFiles = entries.filter((entry) => entry.endsWith(".json"));
  if (statsFiles.length > 0) {
    report.issues.push({
      level: "warning",
      message: `Legacy: .context/stats contains ${statsFiles.length} file(s); new stats should use .context/generated/stats`
    });
  }
}

async function checkLegacyModuleEvidence(contextRoot: string, report: VerifyReport): Promise<void> {
  const modulesRoot = path.join(contextRoot, "modules");
  if (!(await fileExists(modulesRoot))) {
    return;
  }
  const entries = await readdir(modulesRoot);
  for (const entry of entries.filter((item) => item.endsWith(".md"))) {
    const raw = await readFile(path.join(modulesRoot, entry), "utf8");
    if (hasLegacyModuleDocEvidence(raw)) {
      report.issues.push({
        level: "warning",
        message: `Legacy: .context/modules/${entry} contains generated evidence block; run cmap evidence migrate --from-module-docs --dry-run`
      });
    }
  }
}

async function checkStaleModuleDocs(
  cwd: string,
  modules: Awaited<ReturnType<typeof loadModuleIndex>>,
  report: VerifyReport
): Promise<void> {
  let checked = 0;
  for (const module of modules) {
    let moduleStat;
    try {
      moduleStat = await stat(module.absolutePath);
    } catch {
      continue;
    }

    for (const moduleRelativePath of module.pathsInclude) {
      if (moduleRelativePath.includes("*")) {
        continue;
      }
      const candidate = path.resolve(cwd, moduleRelativePath);
      if (!(await isInside(cwd, candidate)) || !(await fileExists(candidate))) {
        continue;
      }
      checked += 1;
      const targetStat = await stat(candidate);
      if (targetStat.mtimeMs > moduleStat.mtimeMs + 1000) {
        report.issues.push({
          level: "warning",
          message: `Module doc may be stale: ${module.docPath} is older than ${moduleRelativePath}`
        });
      }
    }
  }

  if (checked > 0) {
    report.ok.push(`Stale check: ${checked} owned paths checked`);
  }
}

async function checkInboxBacklog(cwd: string, contextRoot: string, report: VerifyReport): Promise<void> {
  const inboxRoot = path.join(contextRoot, "inbox");
  if (!(await fileExists(inboxRoot))) {
    report.ok.push("Inbox: no candidate inbox directory");
    return;
  }

  const entries = await readdir(inboxRoot);
  const inboxFiles = entries.filter((entry) => entry.endsWith(".md")).sort();
  if (inboxFiles.length === 0) {
    report.ok.push("Inbox: no pending candidates");
    return;
  }

  let highRisk = 0;
  for (const file of inboxFiles) {
    const raw = await readFile(path.join(inboxRoot, file), "utf8");
    if (/risk:\s*high/i.test(raw) || /high-risk/i.test(raw) || /operation is marked high risk/i.test(raw)) {
      highRisk += 1;
    }
  }

  const policy = await loadContextPolicy(cwd);
  if (inboxFiles.length <= policy.inbox.maxPending && highRisk <= policy.inbox.maxHighRisk) {
    report.ok.push(`Inbox: ${inboxFiles.length} pending candidates within policy`);
    return;
  }

  report.issues.push({
    level: "warning",
    message: `Inbox: ${inboxFiles.length} candidate updates need review${highRisk > 0 ? ` (${highRisk} high-risk)` : ""}`
  });
}

async function checkFreshness(cwd: string, report: VerifyReport): Promise<void> {
  const warnings = await freshnessWarnings(cwd);
  report.ok.push("Freshness: generated freshness index checked");
  for (const warning of warnings) {
    report.issues.push({ level: "warning", message: warning.message });
  }
}

async function checkPolicy(cwd: string, report: VerifyReport): Promise<void> {
  const result = await validateContextPolicy(cwd);
  report.ok.push("Policy: checked .context/policy.yml");
  for (const error of result.errors) {
    report.issues.push({ level: "error", message: error });
  }
  for (const warning of result.warnings) {
    report.issues.push({ level: "warning", message: warning });
  }
}

async function checkChangedCoverage(
  cwd: string,
  modules: Awaited<ReturnType<typeof loadModuleIndex>>,
  options: VerifyOptions,
  report: VerifyReport
): Promise<void> {
  const changedFiles = options.changedFiles ? splitCsv(options.changedFiles) : await readTrackedChangedFiles(cwd);
  if (changedFiles.length === 0) {
    report.ok.push("Changed file coverage: no changed tracked files detected");
    return;
  }

  const mapping = mapChangedFilesToModules(changedFiles, modules);
  if (mapping.unmapped.length === 0) {
    report.ok.push(`Changed file coverage: ${changedFiles.length}/${changedFiles.length} files mapped`);
    return;
  }

  for (const file of mapping.unmapped) {
    report.issues.push({ level: "warning", message: `Changed file is not mapped to a module: ${file}` });
  }
  report.ok.push(
    `Changed file coverage: ${changedFiles.length - mapping.unmapped.length}/${changedFiles.length} files mapped`
  );
}

async function readTrackedChangedFiles(cwd: string): Promise<string[]> {
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

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function isInside(root: string, target: string): Promise<boolean> {
  const relative = path.relative(root, target);
  try {
    await stat(root);
  } catch {
    return false;
  }
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function formatVerifyReport(report: VerifyReport): string {
  const lines: string[] = [];
  for (const ok of report.ok) {
    lines.push(`✓ ${ok}`);
  }
  for (const issue of report.issues) {
    lines.push(`${issue.level === "error" ? "✗" : "⚠"} ${issue.message}`);
  }
  const errors = report.issues.filter((issue) => issue.level === "error").length;
  const warnings = report.issues.filter((issue) => issue.level === "warning").length;
  lines.push("");
  lines.push(`Errors: ${errors}, Warnings: ${warnings}`);
  return `${lines.join("\n")}\n`;
}

export function formatVerifyCiMarkdown(report: VerifyReport): string {
  const errors = report.issues.filter((issue) => issue.level === "error");
  const warnings = report.issues.filter((issue) => issue.level === "warning");
  const lines = [
    "# cmap CI Report",
    "",
    `Errors: ${errors.length}`,
    `Warnings: ${warnings.length}`,
    "",
    "## Passing Checks",
    "",
    ...markdownList(report.ok),
    "",
    "## Issues",
    "",
    ...markdownList(report.issues.map((issue) => `${issue.level}: ${issue.message}`)),
    ""
  ];
  return `${lines.join("\n")}\n`;
}

function markdownList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- None"];
}
