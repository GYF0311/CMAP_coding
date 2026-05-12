import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";

export async function runDoctor(cwd: string): Promise<void> {
  const lines = ["# cmap Doctor", ""];
  lines.push((await fileExists(path.join(cwd, ".context", "MAP.md"))) ? "✓ Context: present" : "✗ Context: missing");

  const agentsPath = path.join(cwd, "AGENTS.md");
  const claudePath = path.join(cwd, "CLAUDE.md");
  if ((await fileExists(agentsPath)) && (await fileExists(claudePath))) {
    const [agents, claude] = await Promise.all([readFile(agentsPath, "utf8"), readFile(claudePath, "utf8")]);
    lines.push(agents === claude ? "✓ Entrypoints: AGENTS.md and CLAUDE.md match" : "⚠ Entrypoints: AGENTS.md and CLAUDE.md differ");
  } else {
    lines.push("⚠ Entrypoints: missing AGENTS.md or CLAUDE.md");
  }

  const profiles = ["reminder", "maintain", "observe", "assist"];
  let foundProfile: string | undefined;
  for (const profile of profiles) {
    const templates = [
      path.join(cwd, ".context", "hooks", `claude-${profile}.json`),
      path.join(cwd, ".context", "hooks", `codex-${profile}.json`)
    ];
    if (await allExist(templates)) {
      foundProfile = profile;
      break;
    }
  }
  lines.push(foundProfile ? `✓ Hooks: ${foundProfile} templates present` : "ℹ Hooks: none installed");

  process.stdout.write(`${lines.join("\n")}\n`);
}

async function allExist(paths: string[]): Promise<boolean> {
  const results = await Promise.all(paths.map((item) => fileExists(item)));
  return results.every(Boolean);
}
