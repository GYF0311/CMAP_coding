import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CmapCommandError } from "../errors.js";
import { createBackup, restoreBackup } from "../fs/backup.js";
import {
  insertLines,
  parseDocument,
  parseLineRange,
  removeLines,
  selectLines,
  serializeDocument
} from "../fs/line-block.js";
import { resolveInsideRoot } from "../fs/safe-path.js";

type FileRangeRef = {
  file: string;
  range: {
    start: number;
    end: number;
  };
};

type FilePositionRef = {
  file: string;
  position: string;
};

export async function runCpCopy(cwd: string, from: string, to: string): Promise<void> {
  const sourceRef = parseFileRangeRef(from);
  const targetRef = parseFilePositionRef(to);
  const sourceFile = await resolveInsideRoot(cwd, sourceRef.file);
  const targetFile = await resolveInsideRoot(cwd, targetRef.file);
  const sourceDoc = parseDocument(await readFile(sourceFile, "utf8"));
  const targetDoc = parseDocument(await readFile(targetFile, "utf8"));
  const selected = selectLines(sourceDoc, sourceRef.range);
  const updatedTarget = insertLines(targetDoc, targetRef.position, selected);

  await writeFile(targetFile, serializeDocument(updatedTarget), "utf8");
  process.stdout.write(`Copied ${selected.length} lines\n`);
}

export async function runCpMove(cwd: string, from: string, to: string): Promise<void> {
  const sourceRef = parseFileRangeRef(from);
  const targetRef = parseFilePositionRef(to);
  const sourceFile = await resolveInsideRoot(cwd, sourceRef.file);
  const targetFile = await resolveInsideRoot(cwd, targetRef.file);
  const backup = await createBackup(cwd, [sourceFile, targetFile]);

  const sourceDoc = parseDocument(await readFile(sourceFile, "utf8"));
  const targetDoc = parseDocument(await readFile(targetFile, "utf8"));
  const selected = selectLines(sourceDoc, sourceRef.range);
  const updatedSource = removeLines(sourceDoc, sourceRef.range);
  const updatedTarget = insertLines(targetDoc, targetRef.position, selected);

  await writeFile(sourceFile, serializeDocument(updatedSource), "utf8");
  await writeFile(targetFile, serializeDocument(updatedTarget), "utf8");
  process.stdout.write(`Moved ${selected.length} lines\nBackup: ${backup}\n`);
}

export async function runCpDelete(cwd: string, target: string): Promise<void> {
  const targetRef = parseFileRangeRef(target);
  const targetFile = await resolveInsideRoot(cwd, targetRef.file);
  const backup = await createBackup(cwd, [targetFile]);
  const doc = parseDocument(await readFile(targetFile, "utf8"));
  const selected = selectLines(doc, targetRef.range);
  const updated = removeLines(doc, targetRef.range);

  await writeFile(targetFile, serializeDocument(updated), "utf8");
  process.stdout.write(`Deleted ${selected.length} lines\nBackup: ${backup}\n`);
}

export async function runCpRestore(cwd: string, backupId: string): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(backupId)) {
    throw new CmapCommandError(`Invalid backup id: ${backupId}`);
  }
  const count = await restoreBackup(cwd, backupId);
  process.stdout.write(`Restored backup ${backupId} (${count} files)\n`);
}

function parseFileRangeRef(raw: string): FileRangeRef {
  const match = /^(.+):(\d+-\d+)$/.exec(raw);
  if (!match) {
    throw new CmapCommandError(`Invalid file range "${raw}". Expected file:start-end.`);
  }
  return {
    file: match[1],
    range: parseLineRange(match[2])
  };
}

function parseFilePositionRef(raw: string): FilePositionRef {
  const index = raw.lastIndexOf(":");
  if (index <= 0 || index === raw.length - 1) {
    throw new CmapCommandError(`Invalid target "${raw}". Expected file:position.`);
  }
  return {
    file: raw.slice(0, index),
    position: raw.slice(index + 1)
  };
}
