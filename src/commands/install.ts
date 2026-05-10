import { writeFile } from "node:fs/promises";
import path from "node:path";
import { hostEntrypoint } from "../host/entrypoint-template.js";
import { writeHookTemplates, type HookHost, type HookProfile } from "../hooks/templates.js";

type InstallOptions = {
  host: string;
  hooks: string;
};

const validHosts = new Set(["claude", "codex", "both"]);
const validHooks = new Set(["none", "reminder", "maintain"]);

export async function runInstall(cwd: string, options: InstallOptions): Promise<void> {
  if (!validHosts.has(options.host)) {
    throw new Error(`Invalid host "${options.host}". Expected claude, codex, or both.`);
  }
  if (!validHooks.has(options.hooks)) {
    throw new Error(`Invalid hooks profile "${options.hooks}". Expected none, reminder, or maintain.`);
  }

  const content = hostEntrypoint(path.basename(cwd));
  const targets =
    options.host === "both"
      ? ["AGENTS.md", "CLAUDE.md"]
      : options.host === "codex"
        ? ["AGENTS.md"]
        : ["CLAUDE.md"];

  for (const target of targets) {
    await writeFile(path.join(cwd, target), content, "utf8");
  }

  process.stdout.write(`Installed ${targets.join(", ")}\n`);
  if (options.hooks !== "none") {
    const written = await writeHookTemplates(cwd, options.host as HookHost, options.hooks as Exclude<HookProfile, "none">);
    process.stdout.write(`Installed hook templates: ${written.join(", ")}\n`);
  }
}
