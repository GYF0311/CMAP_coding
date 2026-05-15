import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { hostEntrypoint, hostEntrypointBlock } from "../host/entrypoint-template.js";
import { mergeCmapBlock } from "../host/merge-entrypoint.js";
import { writeHookTemplates, type HookHost, type HookProfile } from "../hooks/templates.js";

type InstallOptions = {
  host: string;
  hooks: string;
  mode?: string;
  force?: boolean;
  backup?: boolean;
};

const validHosts = new Set(["claude", "codex", "both"]);
const validHooks = new Set(["none", "reminder", "maintain", "observe", "assist", "strict"]);
const validModes = new Set(["merge", "print"]);

export async function runInstall(cwd: string, options: InstallOptions): Promise<void> {
  if (!validHosts.has(options.host)) {
    throw new Error(`Invalid host "${options.host}". Expected claude, codex, or both.`);
  }
  if (!validHooks.has(options.hooks)) {
    throw new Error(`Invalid hooks profile "${options.hooks}". Expected none, reminder, maintain, observe, assist, or strict.`);
  }
  const mode = options.mode ?? "merge";
  if (!validModes.has(mode)) {
    throw new Error(`Invalid install mode "${mode}". Expected merge or print.`);
  }

  const content = hostEntrypoint(path.basename(cwd));
  const block = hostEntrypointBlock();
  const targets =
    options.host === "both"
      ? ["AGENTS.md", "CLAUDE.md"]
      : options.host === "codex"
        ? ["AGENTS.md"]
        : ["CLAUDE.md"];

  if (mode === "print") {
    for (const target of targets) {
      process.stdout.write(`# ${target}\n\n${block.trimEnd()}\n\n`);
    }
    return;
  }

  const backupRoot = options.backup ? path.join(cwd, ".context", "backups", `install-${dateStamp()}`) : undefined;
  for (const target of targets) {
    const targetPath = path.join(cwd, target);
    const exists = await fileExists(targetPath);
    const current = exists ? await readFile(targetPath, "utf8") : "";
    let next = content;
    let message = `${target}: created cmap entrypoint`;

    if (options.force) {
      message = `${target}: overwritten by --force`;
    } else if (exists) {
      const merged = mergeCmapBlock(current, block);
      next = merged.content;
      message =
        merged.action === "updated"
          ? `${target}: updated cmap block, original content preserved`
          : `${target}: merged cmap block, original content preserved`;
    }

    if (backupRoot && exists && current !== next) {
      await mkdir(backupRoot, { recursive: true });
      await writeFile(path.join(backupRoot, target), current, "utf8");
    }

    await writeFile(targetPath, next, "utf8");
    process.stdout.write(`${message}\n`);
  }

  if (options.hooks !== "none") {
    const written = await writeHookTemplates(cwd, options.host as HookHost, options.hooks as Exclude<HookProfile, "none">);
    process.stdout.write(`Installed hook templates: ${written.join(", ")}\n`);
  }
}

function dateStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
