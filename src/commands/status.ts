import { readFile } from "node:fs/promises";
import path from "node:path";

export async function runStatus(cwd: string): Promise<void> {
  const statusPath = path.join(cwd, ".context", "STATUS.md");
  const status = await readFile(statusPath, "utf8");
  process.stdout.write(status.endsWith("\n") ? status : `${status}\n`);
}
