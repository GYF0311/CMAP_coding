import { appendFile } from "node:fs/promises";
import path from "node:path";

export async function runIdeaAdd(cwd: string, text: string): Promise<void> {
  const target = path.join(cwd, ".context", "ideas", "_inbox.md");
  const today = new Date().toISOString().slice(0, 10);
  const entry = `
## ${today} — Idea

**Idea:** ${text}
**Status:** raw
**Source:** explicit command
**Why interesting:** Not recorded.
**Why not now:** Not in current main thread.
**Revisit if:** The idea becomes relevant to the active goal.
`;

  await appendFile(target, entry, "utf8");
  process.stdout.write("Appended .context/ideas/_inbox.md\n");
}
