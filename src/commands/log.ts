import { appendFile } from "node:fs/promises";
import path from "node:path";

export async function runLogAdd(cwd: string, text: string): Promise<void> {
  const target = path.join(cwd, ".context", "logs", "current.md");
  const today = new Date().toISOString().slice(0, 10);
  const entry = `
## ${today} — Work Log

**Goal:** Not recorded.
**Changed:** Not recorded.
**Tried:** Not recorded.
**Result:** ${text}
**Verification:** Not recorded.
**Memory Impact:** Work log only; not canonical project memory.
**Next:** Not recorded.
`;

  await appendFile(target, entry, "utf8");
  process.stdout.write("Appended .context/logs/current.md\n");
}
