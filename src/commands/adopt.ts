import { writeFile } from "node:fs/promises";
import path from "node:path";
import { scanAdoptionSignals } from "../context/adoption-scanner.js";
import { runInit } from "./init.js";

export async function runAdopt(cwd: string): Promise<void> {
  await runInit(cwd, { auto: true });
  const signals = await scanAdoptionSignals(cwd);
  const adoption = `---
cmap_version: 0.1
context_type: pending
project: ${path.basename(cwd)}
source: auto-adopt
confidence: candidate
needs_review: true
---
# Adoption Guide

This project is being adopted into cmap.

## Deterministic Signals

Detected stack:
${listOrNone(signals.stack)}

Detected files:
${listOrNone(signals.files)}

Detected scripts:
${listOrNone(signals.scripts)}

Candidate module directories:
${listOrNone(signals.candidateDirectories)}

Existing entrypoints:
${listOrNone(signals.entrypoints)}

## Important

These are only candidates.
Do not treat them as trusted project facts.

AI must:
1. Read README and package files.
2. Inspect representative source files.
3. Confirm module boundaries.
4. Fill MAP.md.
5. Create or complete modules/*.md.
6. Update STATUS.md.
7. Update VERIFY.md.
8. Run cmap verify.
`;

  await writeFile(path.join(cwd, ".context", "ADOPTION.md"), adoption, "utf8");
  process.stdout.write("Created .context adoption workspace\n");
}

function listOrNone(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None detected";
}
