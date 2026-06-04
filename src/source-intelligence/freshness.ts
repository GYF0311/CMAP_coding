import { readSourceIndex } from "./store.js";
import { discoverSourceFiles, hashFile } from "./discovery.js";
import type { SourceIndex } from "./schema.js";
import path from "node:path";
import { stat } from "node:fs/promises";
import type { CurrentSourceFileState } from "./impact.js";

export type SourceIndexStatus = {
  exists: boolean;
  generatedAt?: string;
  gitHead?: string;
  fileCount: number;
  symbolCount: number;
  edgeCount: number;
  unresolvedRefCount: number;
  parseErrorCount: number;
  freshFiles: string[];
  staleFiles: string[];
  newFiles: string[];
  deletedFiles: string[];
  canonical: false;
};

export async function sourceIndexStatus(cwd: string, index?: SourceIndex): Promise<SourceIndexStatus> {
  const current = index ?? await readSourceIndex(cwd);
  if (!current) {
    const discovery = await discoverSourceFiles(cwd);
    return {
      exists: false,
      fileCount: discovery.files.length,
      symbolCount: 0,
      edgeCount: 0,
      unresolvedRefCount: 0,
      parseErrorCount: 0,
      freshFiles: [],
      staleFiles: [],
      newFiles: discovery.files,
      deletedFiles: [],
      canonical: false
    };
  }

  const discovery = await discoverSourceFiles(cwd);
  const indexedFiles = new Map(current.files.map((file) => [file.path, file]));
  const discovered = new Set(discovery.files);
  const freshFiles: string[] = [];
  const staleFiles: string[] = [];
  const newFiles: string[] = [];

  for (const filePath of discovery.files) {
    const indexed = indexedFiles.get(filePath);
    if (!indexed) {
      newFiles.push(filePath);
      continue;
    }
    const currentHash = await hashFile(path.join(cwd, filePath));
    if (currentHash === indexed.hash) {
      freshFiles.push(filePath);
    } else {
      staleFiles.push(filePath);
    }
  }

  return {
    exists: true,
    generatedAt: current.meta.generatedAt,
    gitHead: current.meta.gitHead,
    fileCount: current.files.length,
    symbolCount: current.symbols.length,
    edgeCount: current.edges.length,
    unresolvedRefCount: current.unresolvedRefs.length,
    parseErrorCount: current.files.reduce((total, file) => total + file.parseErrors.length, 0),
    freshFiles,
    staleFiles,
    newFiles,
    deletedFiles: current.files.map((file) => file.path).filter((filePath) => !discovered.has(filePath)).sort(),
    canonical: false
  };
}

export async function currentSourceFileStates(cwd: string, index?: SourceIndex): Promise<CurrentSourceFileState[]> {
  const discovery = await discoverSourceFiles(cwd);
  const discovered = new Set(discovery.files);
  const indexed = new Set(index?.files.map((file) => file.path) ?? []);
  const paths = [...new Set([...discovery.files, ...indexed])].sort();
  const states: CurrentSourceFileState[] = [];

  for (const relativePath of paths) {
    if (!discovered.has(relativePath)) {
      states.push({ path: relativePath, exists: false });
      continue;
    }

    const absolutePath = path.join(cwd, relativePath);
    try {
      const info = await stat(absolutePath);
      states.push({
        path: relativePath,
        exists: true,
        hash: await hashFile(absolutePath),
        modifiedAt: info.mtime.toISOString(),
        mtimeMs: info.mtimeMs
      });
    } catch (error) {
      states.push({
        path: relativePath,
        exists: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return states;
}
