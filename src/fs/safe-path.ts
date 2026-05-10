import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { CmapCommandError } from "../errors.js";

export async function resolveInsideRoot(root: string, inputPath: string): Promise<string> {
  const absolute = path.resolve(root, inputPath);
  if (!isInside(root, absolute)) {
    throw new CmapCommandError(`Path escapes project root: ${inputPath}`);
  }

  try {
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) {
      const resolved = await realpath(absolute);
      if (!isInside(root, resolved)) {
        throw new CmapCommandError(`Symlink escapes project root: ${inputPath}`);
      }
    }
  } catch (error) {
    if (error instanceof CmapCommandError) {
      throw error;
    }
    // Let the command reading the path produce the missing-file error.
  }

  return absolute;
}

export function projectRelative(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function isInside(root: string, absolutePath: string): boolean {
  const relative = path.relative(root, absolutePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
