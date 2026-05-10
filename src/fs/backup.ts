import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRelative } from "./safe-path.js";

type BackupFile = {
  path: string;
  content: string;
};

type BackupRecord = {
  id: string;
  createdAt: string;
  files: BackupFile[];
};

export async function createBackup(root: string, files: string[]): Promise<string> {
  const backupRoot = path.join(root, ".context", "backups");
  await mkdir(backupRoot, { recursive: true });
  const id = backupId();
  const uniqueFiles = [...new Set(files)];
  const record: BackupRecord = {
    id,
    createdAt: new Date().toISOString(),
    files: await Promise.all(
      uniqueFiles.map(async (file) => ({
        path: projectRelative(root, file),
        content: await readFile(file, "utf8")
      }))
    )
  };

  await writeFile(path.join(backupRoot, `${id}.json`), JSON.stringify(record, null, 2), "utf8");
  return id;
}

export async function restoreBackup(root: string, id: string): Promise<number> {
  const backupPath = path.join(root, ".context", "backups", `${id}.json`);
  const record = JSON.parse(await readFile(backupPath, "utf8")) as BackupRecord;
  for (const file of record.files) {
    await writeFile(path.join(root, file.path), file.content, "utf8");
  }
  return record.files.length;
}

function backupId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").toLowerCase();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${suffix}`;
}
