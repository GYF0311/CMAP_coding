import { readFile, writeFile } from "node:fs/promises";
import { CmapCommandError } from "../errors.js";
import { fileExists } from "../context/scanner.js";
import { loadContextPolicy } from "../context/policy.js";
import { recordModuleActivity } from "../core/generated-stats.js";
import { loadModuleIndex, type ContextModule } from "../core/module-index.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";

type EvidenceAppendOptions = {
  module: string;
  file: string;
  summary: string;
  command?: string;
};

const startMarker = "<!-- cmap:generated:evidence:start -->";
const endMarker = "<!-- cmap:generated:evidence:end -->";
export async function runEvidenceAppend(cwd: string, options: EvidenceAppendOptions): Promise<void> {
  const moduleId = requiredText(options.module, "--module");
  const evidenceFile = requiredText(options.file, "--file");
  const summary = requiredText(options.summary, "--summary");
  const modules = await loadModuleIndex(cwd);
  const targetModule = modules.find((candidate) =>
    candidate.id === moduleId || candidate.aliases.some((alias) => alias.toLocaleLowerCase() === moduleId.toLocaleLowerCase())
  );

  if (!targetModule) {
    throw new CmapCommandError(`Unknown module: ${moduleId}`, 2);
  }

  const absoluteEvidence = await resolveInsideRoot(cwd, evidenceFile);
  if (!(await fileExists(absoluteEvidence))) {
    throw new CmapCommandError(`Evidence file does not exist: ${evidenceFile}`, 2);
  }

  await appendEvidenceToModule(cwd, targetModule, {
    file: projectRelative(cwd, absoluteEvidence),
    summary,
    command: optionalText(options.command)
  });
  process.stdout.write(`Updated ${targetModule.docPath}\n`);
}

export async function appendEvidenceToModule(
  cwd: string,
  targetModule: ContextModule,
  evidence: { file: string; summary: string; command?: string }
): Promise<void> {
  const policy = await loadContextPolicy(cwd);
  const createdAt = new Date().toISOString();
  const current = await readFile(targetModule.absolutePath, "utf8");
  const next = upsertGeneratedEvidence(current, {
    ...evidence,
    createdAt
  }, policy.generatedEvidence.maxEntries);
  await writeFile(targetModule.absolutePath, next, "utf8");
  if (policy.autoApply.statsUpdate) {
    await recordModuleActivity(cwd, {
      moduleId: targetModule.id,
      file: evidence.file,
      summary: evidence.summary,
      command: evidence.command,
      at: createdAt
    });
  }
}

function upsertGeneratedEvidence(
  raw: string,
  evidence: { file: string; summary: string; command?: string; createdAt: string },
  maxEvidenceItems: number
): string {
  const entry = renderEntry(evidence);
  const existingBlock = extractBlock(raw);
  const existingEntries = existingBlock
    ? existingBlock.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("- "))
    : [];
  const entries = [entry, ...existingEntries.filter((line) => line !== entry)].slice(0, maxEvidenceItems);
  const block = [
    startMarker,
    "## Generated Evidence",
    "",
    "This section is generated support evidence. It is not a semantic source of truth.",
    "",
    ...entries,
    endMarker
  ].join("\n");

  if (existingBlock !== undefined) {
    return ensureTrailingNewline(raw.replace(new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`), block));
  }

  return ensureTrailingNewline(`${raw.trimEnd()}\n\n${block}`);
}

function extractBlock(raw: string): string | undefined {
  const start = raw.indexOf(startMarker);
  const end = raw.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    return undefined;
  }
  return raw.slice(start + startMarker.length, end);
}

function renderEntry(evidence: { file: string; summary: string; command?: string; createdAt: string }): string {
  const command = evidence.command ? `; command: \`${evidence.command}\`` : "";
  return `- ${evidence.createdAt}: ${evidence.summary} Evidence: \`${evidence.file}\`${command}`;
}

function requiredText(value: string | undefined, flag: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new CmapCommandError(`Missing required ${flag}`, 2);
  }
  return trimmed;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
