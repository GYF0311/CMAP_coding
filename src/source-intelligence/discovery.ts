import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import {
  DEFAULT_SOURCE_INDEX_IGNORED_DIRECTORIES,
  normalizeRelativePath,
  shouldIgnoreRelativePath,
  toProjectRelative
} from "./guards.js";
import {
  isSourceFileExtension,
  languageForExtension,
  SOURCE_FILE_EXTENSIONS,
  type SourceFileExtension,
  type SourceFileRecord
} from "./schema.js";

export type SourceDiscoveryOptions = {
  extensions?: SourceFileExtension[];
  ignoredDirectories?: string[];
  respectGitignore?: boolean;
};

export type SourceDiscoveryResult = {
  files: string[];
  ignoredDirectories: string[];
  ignoreFiles: string[];
  discoveredFiles: number;
};

type IgnoreRule = {
  raw: string;
  directoryOnly: boolean;
  anchored: boolean;
};

export async function discoverSourceFiles(cwd: string, options: SourceDiscoveryOptions = {}): Promise<SourceDiscoveryResult> {
  const extensions = new Set(options.extensions ?? SOURCE_FILE_EXTENSIONS);
  const ignoredDirectories = [...new Set([
    ...DEFAULT_SOURCE_INDEX_IGNORED_DIRECTORIES,
    ...(options.ignoredDirectories ?? [])
  ])];
  const ignore = options.respectGitignore === false ? { rules: [], files: [] } : await readSimpleIgnoreRules(cwd);
  const files: string[] = [];

  async function walk(relativeDir: string): Promise<void> {
    if (relativeDir && shouldIgnoreRelativePath(relativeDir, ignoredDirectories)) {
      return;
    }
    if (relativeDir && matchesIgnore(relativeDir, true, ignore.rules)) {
      return;
    }

    const absoluteDir = path.join(cwd, relativeDir);
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const childRelative = normalizeRelativePath(path.join(relativeDir, entry.name));
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(childRelative);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (shouldIgnoreRelativePath(childRelative, ignoredDirectories) || matchesIgnore(childRelative, false, ignore.rules)) {
        continue;
      }
      const extension = path.extname(entry.name);
      if (isSourceFileExtension(extension) && extensions.has(extension)) {
        files.push(childRelative);
      }
    }
  }

  await walk("");
  files.sort();
  return {
    files,
    ignoredDirectories,
    ignoreFiles: ignore.files,
    discoveredFiles: files.length
  };
}

export async function snapshotSourceFile(
  cwd: string,
  relativePath: string,
  indexedAt: string,
  gitHead?: string
): Promise<SourceFileRecord> {
  const absolutePath = path.join(cwd, relativePath);
  const info = await stat(absolutePath);
  const extension = path.extname(relativePath);
  if (!isSourceFileExtension(extension)) {
    throw new Error(`Unsupported source extension for ${relativePath}`);
  }
  return {
    path: toProjectRelative(cwd, absolutePath),
    language: languageForExtension(extension),
    extension,
    hash: await hashFile(absolutePath),
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
    indexedAt,
    gitHead,
    parseErrors: [],
    isTestFile: isLikelyTestFile(relativePath),
    canonical: false
  };
}

export async function hashFile(absolutePath: string): Promise<string> {
  const body = await readFile(absolutePath);
  return createHash("sha256").update(body).digest("hex");
}

export function isLikelyTestFile(relativePath: string): boolean {
  return /(^|\/)(__tests__|tests?)\//.test(relativePath)
    || /\.(test|spec)\.[cm]?[jt]sx?$/.test(relativePath)
    || /(^|\/)vitest\.config\.[cm]?[jt]s$/.test(relativePath);
}

async function readSimpleIgnoreRules(cwd: string): Promise<{ rules: IgnoreRule[]; files: string[] }> {
  const files = [".gitignore", ".codexignore"];
  const loadedFiles: string[] = [];
  const rules: IgnoreRule[] = [];
  for (const file of files) {
    const target = path.join(cwd, file);
    if (!(await fileExists(target))) {
      continue;
    }
    loadedFiles.push(file);
    const raw = await readFile(target, "utf8");
    rules.push(...raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
      .map((line): IgnoreRule => ({
        raw: line.replace(/^\//, "").replace(/\/$/, ""),
        directoryOnly: line.endsWith("/"),
        anchored: line.startsWith("/")
      })));
  }
  return { rules, files: loadedFiles };
}

function matchesIgnore(relativePath: string, isDirectory: boolean, rules: IgnoreRule[]): boolean {
  const normalized = normalizeRelativePath(relativePath).replace(/\/$/, "");
  return rules.some((rule) => {
    if (rule.directoryOnly && !isDirectory) {
      return false;
    }
    if (!rule.raw) {
      return false;
    }
    if (rule.raw.includes("*") || rule.raw.includes("?")) {
      return matchesIgnoreGlob(normalized, rule);
    }
    if (rule.anchored || rule.raw.includes("/")) {
      return normalized === rule.raw || normalized.startsWith(`${rule.raw}/`);
    }
    return normalized.split("/").includes(rule.raw);
  });
}

function matchesIgnoreGlob(normalized: string, rule: IgnoreRule): boolean {
  const regex = new RegExp(`^${ignoreGlobToRegex(rule.raw)}$`);
  if (rule.anchored || rule.raw.includes("/")) {
    return regex.test(normalized);
  }
  return normalized.split("/").some((part) => regex.test(part));
}

function ignoreGlobToRegex(pattern: string): string {
  let output = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    const afterNext = pattern[index + 2];
    if (char === "*" && next === "*" && afterNext === "/") {
      output += "(?:.*/)?";
      index += 2;
      continue;
    }
    if (char === "*" && next === "*") {
      output += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      output += "[^/]*";
      continue;
    }
    if (char === "?") {
      output += "[^/]";
      continue;
    }
    output += escapeRegex(char);
  }
  return output;
}

function escapeRegex(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}
