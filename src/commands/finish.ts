import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";

const execFileAsync = promisify(execFile);

type FinishOptions = {
  changed?: string;
};

type ModuleInfo = {
  name: string;
  docPath: string;
  paths: string[];
};

export async function runFinish(cwd: string, options: FinishOptions): Promise<void> {
  const changedFiles = options.changed
    ? splitCsv(options.changed)
    : await readGitChangedFiles(cwd);
  const modules = await readModules(cwd);
  const affectedModules = affectedByChangedFiles(changedFiles, modules);

  const lines = [
    "# Finish Report",
    "",
    "## Changed Files",
    ...(changedFiles.length ? changedFiles.map((file) => `- ${file}`) : ["- None detected"]),
    "",
    "## Changed Modules",
    ...(affectedModules.length ? affectedModules.map((module) => `- ${module.name}`) : ["- None detected"]),
    "",
    "## Context Updates Needed",
    "- STATUS.md: check whether current main thread changed",
    ...(affectedModules.length
      ? affectedModules.map((module) => `- ${module.docPath}: maybe, if responsibilities/dependencies/data flow changed`)
      : ["- modules/*.md: no changed module detected"]),
    "- DECISIONS.md: only if a long-lived design tradeoff was made",
    "- traps/: only if a repeatable pitfall was discovered",
    "- logs/current.md: consider `cmap log add \"...\"` for task-end summaries",
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

async function readModules(cwd: string): Promise<ModuleInfo[]> {
  const modulesRoot = path.join(cwd, ".context", "modules");
  if (!(await fileExists(modulesRoot))) {
    return [];
  }

  const entries = await readdir(modulesRoot);
  const modules: ModuleInfo[] = [];
  for (const entry of entries.filter((file) => file.endsWith(".md"))) {
    const raw = await readFile(path.join(modulesRoot, entry), "utf8");
    const parsed = matter(raw);
    const name = typeof parsed.data.module === "string" ? parsed.data.module : path.basename(entry, ".md");
    const paths = Array.isArray(parsed.data.paths)
      ? parsed.data.paths.filter((item: unknown): item is string => typeof item === "string")
      : [];
    modules.push({ name, docPath: `.context/modules/${entry}`, paths });
  }
  return modules;
}

function affectedByChangedFiles(changedFiles: string[], modules: ModuleInfo[]): ModuleInfo[] {
  return modules.filter((module) =>
    changedFiles.some((file) => module.paths.some((modulePath) => file === modulePath || file.startsWith(`${modulePath}/`)))
  );
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
