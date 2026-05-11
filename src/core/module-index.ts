import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";

export type ContextModule = {
  id: string;
  name: string;
  docPath: string;
  absolutePath: string;
  body: string;
  aliases: string[];
  pathsInclude: string[];
  pathsExclude: string[];
  tags: string[];
  layer?: string;
  risk?: string;
  status?: string;
  relations: Record<string, string[]>;
};

export type ProjectInfo = {
  projectId: string;
  projectName: string;
};

export type ChangedFileMatch = {
  file: string;
  modules: ContextModule[];
};

export type ChangedFileMapping = {
  affectedModules: ContextModule[];
  matches: ChangedFileMatch[];
  unmapped: string[];
};

export async function loadProjectInfo(cwd: string): Promise<ProjectInfo> {
  const fallback = path.basename(cwd);
  const mapPath = path.join(cwd, ".context", "MAP.md");
  if (!(await fileExists(mapPath))) {
    return { projectId: fallback, projectName: fallback };
  }

  try {
    const parsed = matter(await readFile(mapPath, "utf8"));
    const project = typeof parsed.data.project === "string" ? parsed.data.project.trim() : "";
    const projectId = project || fallback;
    return { projectId, projectName: projectId };
  } catch {
    return { projectId: fallback, projectName: fallback };
  }
}

export async function loadModuleIndex(cwd: string): Promise<ContextModule[]> {
  const modulesRoot = path.join(cwd, ".context", "modules");
  if (!(await fileExists(modulesRoot))) {
    return [];
  }

  const entries = await readdir(modulesRoot);
  const modules: ContextModule[] = [];
  for (const entry of entries.filter((file) => file.endsWith(".md")).sort()) {
    const absolutePath = path.join(modulesRoot, entry);
    const raw = await readFile(absolutePath, "utf8");
    const parsed = matter(raw);
    const fallbackId = path.basename(entry, ".md");
    const id = normalizeId(parsed.data.id) || normalizeId(parsed.data.module) || fallbackId;
    const name = typeof parsed.data.name === "string" && parsed.data.name.trim()
      ? parsed.data.name.trim()
      : titleize(id);
    const { include, exclude } = normalizePaths(parsed.data.paths);

    modules.push({
      id,
      name,
      docPath: `.context/modules/${entry}`,
      absolutePath,
      body: parsed.content,
      aliases: normalizeStringArray(parsed.data.aliases),
      pathsInclude: include,
      pathsExclude: exclude,
      tags: normalizeStringArray(parsed.data.tags),
      layer: normalizeOptionalString(parsed.data.layer),
      risk: normalizeOptionalString(parsed.data.risk),
      status: normalizeOptionalString(parsed.data.status),
      relations: normalizeRelations(parsed.data.relations)
    });
  }

  return modules;
}

export function moduleNoteTitle(module: ContextModule): string {
  return titleize(module.name || module.id);
}

export function mapChangedFilesToModules(changedFiles: string[], modules: ContextModule[]): ChangedFileMapping {
  const matches: ChangedFileMatch[] = [];
  const affected = new Map<string, ContextModule>();
  const unmapped: string[] = [];

  for (const rawFile of changedFiles) {
    const file = normalizePath(rawFile);
    const matched = modules
      .filter((module) => moduleOwnsFile(module, file))
      .sort((left, right) => longestPath(right.pathsInclude) - longestPath(left.pathsInclude));
    matches.push({ file, modules: matched });
    if (matched.length === 0) {
      unmapped.push(file);
      continue;
    }
    for (const module of matched) {
      affected.set(module.id, module);
    }
  }

  return {
    affectedModules: [...affected.values()].sort((left, right) => left.id.localeCompare(right.id)),
    matches,
    unmapped
  };
}

export function moduleById(modules: ContextModule[]): Map<string, ContextModule> {
  return new Map(modules.map((module) => [module.id, module]));
}

function moduleOwnsFile(module: ContextModule, file: string): boolean {
  if (module.pathsInclude.length === 0) {
    return false;
  }
  if (module.pathsExclude.some((candidate) => pathPatternMatches(candidate, file))) {
    return false;
  }
  return module.pathsInclude.some((candidate) => pathPatternMatches(candidate, file));
}

function normalizePaths(value: unknown): { include: string[]; exclude: string[] } {
  if (Array.isArray(value)) {
    return { include: normalizeStringArray(value), exclude: [] };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      include: normalizeStringArray(record.include),
      exclude: normalizeStringArray(record.exclude)
    };
  }
  return { include: [], exclude: [] };
}

function normalizeRelations(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const values = normalizeStringArray(raw);
    if (values.length > 0) {
      normalized[key] = values;
    }
  }
  return normalized;
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function pathPatternMatches(pattern: string, file: string): boolean {
  const normalizedPattern = normalizePath(pattern).replace(/\/$/, "");
  if (!normalizedPattern) {
    return false;
  }
  if (normalizedPattern.includes("*")) {
    return globToRegExp(normalizedPattern).test(file);
  }
  return file === normalizedPattern || file.startsWith(`${normalizedPattern}/`);
}

function globToRegExp(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function longestPath(paths: string[]): number {
  return Math.max(0, ...paths.map((item) => item.length));
}

function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ");
}
