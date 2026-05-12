import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";

export async function runInboxStatus(cwd: string): Promise<void> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  const files = await listInboxFiles(inboxRoot);
  let highRisk = 0;

  for (const file of files) {
    const raw = await readFile(path.join(inboxRoot, file), "utf8");
    if (isHighRiskCandidate(raw)) {
      highRisk += 1;
    }
  }

  const lines = [
    "# Inbox Status",
    "",
    `Total candidates: ${files.length}`,
    `High-risk candidates: ${highRisk}`,
    "",
    "Inbox files are candidate input only; they are not canonical `.context` facts.",
    "",
    "Suggested commands:",
    "- Review backlog: `cmap inbox status`",
    "- Save agent candidates: `cmap update --agent --from <file> --write-inbox`",
    "- Promote manually only after review: edit canonical `.context` files with evidence",
    ""
  ];

  process.stdout.write(lines.join("\n"));
}

async function listInboxFiles(inboxRoot: string): Promise<string[]> {
  if (!(await fileExists(inboxRoot))) {
    return [];
  }
  const entries = await readdir(inboxRoot);
  return entries.filter((entry) => entry.endsWith(".md")).sort();
}

function isHighRiskCandidate(raw: string): boolean {
  return /risk:\s*high/i.test(raw) || /high-risk/i.test(raw) || /operation is marked high risk/i.test(raw);
}
