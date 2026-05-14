import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";
import {
  DEFAULT_SKILL_OUT,
  renderSkillFiles,
  skillOutputDir,
  type SkillHost,
  type SkillLocale
} from "../skill/templates.js";

type SkillExportOptions = {
  out?: string;
  host?: string;
  lang?: string;
  check?: boolean;
};

const validHosts = new Set<SkillHost>(["generic", "codex", "claude", "cursor"]);
const validLocales = new Set<SkillLocale>(["en", "zh-CN"]);

export async function runSkillExport(cwd: string, options: SkillExportOptions): Promise<number> {
  const host = parseHost(options.host ?? "generic");
  const locale = parseLocale(options.lang ?? "en");
  const outputDir = await resolveInsideRoot(cwd, skillOutputDir(options.out, locale));
  const files = renderSkillFiles({ host, locale }).map((file) => ({
    target: path.join(outputDir, file.relativePath),
    content: file.content
  }));

  if (options.check) {
    return checkSkillExport(cwd, outputDir, files);
  }

  for (const file of files) {
    await mkdir(path.dirname(file.target), { recursive: true });
    await writeFile(file.target, file.content, "utf8");
  }

  process.stdout.write(`Exported cmap skill to ${projectRelative(cwd, outputDir)} (${files.length} files)\n`);
  return 0;
}

async function checkSkillExport(
  cwd: string,
  outputDir: string,
  files: Array<{ target: string; content: string }>
): Promise<number> {
  const issues: string[] = [];
  for (const file of files) {
    if (!(await fileExists(file.target))) {
      issues.push(`would create ${projectRelative(cwd, file.target)}`);
      continue;
    }
    const current = await readFile(file.target, "utf8");
    if (current !== file.content) {
      issues.push(`would update ${projectRelative(cwd, file.target)}`);
    }
  }

  if (issues.length === 0) {
    process.stdout.write(`Skill export is up to date: ${projectRelative(cwd, outputDir)}\n`);
    return 0;
  }

  process.stdout.write(["# Skill Export Check", "", "Skill export is stale.", "", ...issues.map((issue) => `- ${issue}`), ""].join("\n"));
  return 1;
}

function parseHost(raw: string): SkillHost {
  if (validHosts.has(raw as SkillHost)) {
    return raw as SkillHost;
  }
  throw new CmapCommandError(`Invalid skill host "${raw}". Expected generic, codex, claude, or cursor.`, 2);
}

function parseLocale(raw: string): SkillLocale {
  if (validLocales.has(raw as SkillLocale)) {
    return raw as SkillLocale;
  }
  throw new CmapCommandError(`Invalid skill language "${raw}". Expected en or zh-CN.`, 2);
}

export { DEFAULT_SKILL_OUT };
