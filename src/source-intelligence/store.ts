import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { assertGeneratedSourceIndexPath, sourceIndexRoot } from "./guards.js";
import { buildSourceIndex } from "./indexer.js";
import type { SourceIndex, SourceIndexBuildOptions } from "./schema.js";

export type SourceIndexStorePaths = {
  root: string;
  meta: string;
  files: string;
  symbols: string;
  edges: string;
  unresolvedRefs: string;
};

export function sourceIndexStorePaths(cwd: string): SourceIndexStorePaths {
  const root = sourceIndexRoot(cwd);
  return {
    root,
    meta: path.join(root, "source-index.meta.json"),
    files: path.join(root, "files.json"),
    symbols: path.join(root, "symbols.json"),
    edges: path.join(root, "edges.json"),
    unresolvedRefs: path.join(root, "unresolved-refs.json")
  };
}

export async function writeSourceIndex(cwd: string, index: SourceIndex): Promise<SourceIndexStorePaths> {
  const paths = sourceIndexStorePaths(cwd);
  await mkdir(assertGeneratedSourceIndexPath(cwd, paths.root), { recursive: true });
  await writeJson(assertGeneratedSourceIndexPath(cwd, paths.meta), index.meta);
  await writeJson(assertGeneratedSourceIndexPath(cwd, paths.files), index.files);
  await writeJson(assertGeneratedSourceIndexPath(cwd, paths.symbols), index.symbols);
  await writeJson(assertGeneratedSourceIndexPath(cwd, paths.edges), index.edges);
  await writeJson(assertGeneratedSourceIndexPath(cwd, paths.unresolvedRefs), index.unresolvedRefs);
  return paths;
}

export async function readSourceIndex(cwd: string): Promise<SourceIndex | undefined> {
  const paths = sourceIndexStorePaths(cwd);
  if (!(await sourceIndexExists(cwd))) {
    return undefined;
  }
  return {
    meta: JSON.parse(await readFile(paths.meta, "utf8")) as SourceIndex["meta"],
    files: JSON.parse(await readFile(paths.files, "utf8")) as SourceIndex["files"],
    symbols: JSON.parse(await readFile(paths.symbols, "utf8")) as SourceIndex["symbols"],
    edges: JSON.parse(await readFile(paths.edges, "utf8")) as SourceIndex["edges"],
    unresolvedRefs: JSON.parse(await readFile(paths.unresolvedRefs, "utf8")) as SourceIndex["unresolvedRefs"]
  };
}

export async function sourceIndexExists(cwd: string): Promise<boolean> {
  const paths = sourceIndexStorePaths(cwd);
  return (await fileExists(paths.meta))
    && (await fileExists(paths.files))
    && (await fileExists(paths.symbols))
    && (await fileExists(paths.edges))
    && (await fileExists(paths.unresolvedRefs));
}

export async function buildAndWriteSourceIndex(
  cwd: string,
  options: SourceIndexBuildOptions = {}
): Promise<{ index: SourceIndex; paths: SourceIndexStorePaths }> {
  const index = await buildSourceIndex(cwd, options);
  const paths = await writeSourceIndex(cwd, index);
  return { index, paths };
}

async function writeJson(target: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
