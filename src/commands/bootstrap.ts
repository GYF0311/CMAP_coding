import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative } from "../fs/safe-path.js";
import { runInstall } from "./install.js";
import { runSkillExport } from "./skill.js";

type BootstrapOptions = {
  host?: string;
  skill?: boolean;
};

const validHosts = new Set(["claude", "codex", "both"]);

export async function runBootstrap(cwd: string, options: BootstrapOptions): Promise<void> {
  const host = options.host ?? "both";
  if (!validHosts.has(host)) {
    throw new CmapCommandError(`Invalid bootstrap host "${host}". Expected claude, codex, or both.`, 2);
  }

  if (!(await fileExists(path.join(cwd, ".context")))) {
    throw new CmapCommandError("Missing .context. Run `cmap init --auto` first, then rerun `cmap bootstrap`.", 1);
  }

  await runInstall(cwd, {
    host,
    hooks: "none",
    mode: "merge"
  });

  if (options.skill) {
    await runSkillExport(cwd, {
      host: skillHostForInstallHost(host)
    });
  }

  const startHerePath = path.join(cwd, ".context", "out", "start-here.md");
  await mkdir(path.dirname(startHerePath), { recursive: true });
  await writeFile(startHerePath, renderStartHere(), "utf8");
  process.stdout.write(`Wrote ${projectRelative(cwd, startHerePath)}\n`);
}

function skillHostForInstallHost(host: string): string {
  if (host === "codex" || host === "claude") {
    return host;
  }
  return "generic";
}

function renderStartHere(): string {
  return `# Start Here with CMAP

This project uses CMAP.

For AI agent:
1. Read \`AGENTS.md\` or \`CLAUDE.md\`.
2. Read \`.context/CHECKPOINT.md\`.
3. Read \`.context/MAP.md\`.
4. Run \`cmap route "<task>"\`.
5. Read routed module docs.
6. Run \`cmap verify --changed\` before done.

For human:
- Run \`cmap view export --out _cmap-view\`
- Open \`_cmap-view/index.html\`
`;
}
