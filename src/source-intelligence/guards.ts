import path from "node:path";
import { CmapCommandError } from "../errors.js";

export const SOURCE_INDEX_RELATIVE_ROOT = ".context/generated/source-index";

export const DEFAULT_SOURCE_INDEX_IGNORED_DIRECTORIES = [
  "node_modules",
  "dist",
  ".git",
  ".context/generated",
  ".context/out",
  ".context/backups",
  ".context/audit",
  ".cmap",
  "_cmap",
  "_cmap-view",
  "coverage"
];

export const CANONICAL_CONTEXT_RELATIVE_PATHS = [
  ".context/MAP.md",
  ".context/CHECKPOINT.md",
  ".context/STATUS.md",
  ".context/DECISIONS.md",
  ".context/VERIFY.md"
];

export function toProjectRelative(cwd: string, inputPath: string): string {
  const absolute = path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath);
  return normalizeRelativePath(path.relative(cwd, absolute));
}

export function normalizeRelativePath(inputPath: string): string {
  return inputPath.split(path.sep).join("/");
}

export function isInsideProject(cwd: string, inputPath: string): boolean {
  const absolute = path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath);
  const relative = path.relative(cwd, absolute);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertInsideProject(cwd: string, inputPath: string): string {
  const absolute = path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath);
  if (!isInsideProject(cwd, absolute)) {
    throw new CmapCommandError(`Path escapes project root: ${inputPath}`, 2);
  }
  return absolute;
}

export function sourceIndexRoot(cwd: string): string {
  return path.join(cwd, SOURCE_INDEX_RELATIVE_ROOT);
}

export function assertGeneratedSourceIndexPath(cwd: string, inputPath: string): string {
  const absolute = assertInsideProject(cwd, inputPath);
  const relative = toProjectRelative(cwd, absolute);
  if (!isGeneratedSourceIndexRelativePath(relative)) {
    throw new CmapCommandError(
      `Source index writes must stay under ${SOURCE_INDEX_RELATIVE_ROOT}: ${relative}`
    );
  }
  if (isCanonicalContextPath(relative)) {
    throw new CmapCommandError(`Refusing to write generated source evidence to canonical context path: ${relative}`);
  }
  return absolute;
}

export function isGeneratedSourceIndexRelativePath(relativePath: string): boolean {
  return relativePath === SOURCE_INDEX_RELATIVE_ROOT || relativePath.startsWith(`${SOURCE_INDEX_RELATIVE_ROOT}/`);
}

export function isCanonicalContextPath(relativePath: string): boolean {
  return CANONICAL_CONTEXT_RELATIVE_PATHS.includes(relativePath) || relativePath.startsWith(".context/modules/");
}

export function shouldIgnoreRelativePath(relativePath: string, ignoredDirectories = DEFAULT_SOURCE_INDEX_IGNORED_DIRECTORIES): boolean {
  const normalized = normalizeRelativePath(relativePath).replace(/\/$/, "");
  return ignoredDirectories.some((ignored) => {
    const rule = ignored.replace(/\/$/, "");
    return normalized === rule || normalized.startsWith(`${rule}/`);
  });
}
