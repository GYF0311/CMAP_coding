import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";

type VerifyOptions = {
  changed?: boolean;
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
  "VERIFY.md": ["# Verification", "## Required Commands", "## Manual Verification"]
};

export async function runVerify(cwd: string, options: VerifyOptions): Promise<number> {
  const report = await verifyContext(cwd);

  if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatVerifyReport(report));
  }

  return report.issues.some((issue) => issue.level === "error") ? 1 : 0;
}

export async function verifyContext(cwd: string): Promise<VerifyReport> {
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

  await checkModuleReferences(contextRoot, report);

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

async function checkModuleReferences(contextRoot: string, report: VerifyReport): Promise<void> {
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
    const modulePath = path.join(modulesRoot, entry);
    const raw = await readFile(modulePath, "utf8");
    const parsed = matter(raw);
    const paths = parsed.data.paths;
    if (Array.isArray(paths)) {
      for (const moduleRelativePath of paths) {
        if (typeof moduleRelativePath !== "string") {
          continue;
        }
        const candidate = path.resolve(path.dirname(contextRoot), moduleRelativePath);
        if (!(await isInside(path.dirname(contextRoot), candidate)) || !(await fileExists(candidate))) {
          report.issues.push({
            level: "error",
            message: `.context/modules/${entry} points to missing path ${moduleRelativePath}`
          });
        }
      }
    }
  }
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
