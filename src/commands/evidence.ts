import { CmapCommandError } from "../errors.js";
import { fileExists } from "../context/scanner.js";
import { loadContextPolicy } from "../context/policy.js";
import { recordModuleActivity } from "../core/generated-stats.js";
import { loadModuleIndex, type ContextModule } from "../core/module-index.js";
import {
  appendModuleEvidence,
  listModuleEvidence,
  migrateModuleDocEvidence,
  moduleEvidencePath,
  moduleIdsWithGeneratedEvidence
} from "../core/generated-store.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";

type EvidenceAppendOptions = {
  module: string;
  file: string;
  summary: string;
  command?: string;
};

type EvidenceListOptions = {
  module?: string;
};

type EvidenceMigrateOptions = {
  fromModuleDocs?: boolean;
  dryRun?: boolean;
  apply?: boolean;
};

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
  process.stdout.write(`Wrote ${projectRelative(cwd, moduleEvidencePath(cwd, targetModule.id))}\n`);
}

export async function appendEvidenceToModule(
  cwd: string,
  targetModule: ContextModule,
  evidence: { file: string; summary: string; command?: string }
): Promise<void> {
  const policy = await loadContextPolicy(cwd);
  const createdAt = new Date().toISOString();
  await appendModuleEvidence(cwd, {
    moduleId: targetModule.id,
    files: [evidence.file],
    summary: evidence.summary,
    commands: evidence.command ? [evidence.command] : undefined,
    source: evidence.command?.startsWith("cmap hooks") ? "hook" : "manual",
    confidence: 1,
    createdAt
  }, policy.generatedEvidence.maxEntries);
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

export async function runEvidenceList(cwd: string, options: EvidenceListOptions): Promise<void> {
  const moduleIds = options.module ? [options.module] : await moduleIdsWithGeneratedEvidence(cwd);
  const lines = ["# Generated Evidence", ""];
  if (moduleIds.length === 0) {
    lines.push("- No generated module evidence found.");
  }
  for (const moduleId of moduleIds) {
    const entries = await listModuleEvidence(cwd, moduleId);
    lines.push(`## ${moduleId}`, "");
    if (entries.length === 0) {
      lines.push("- No entries.");
    } else {
      for (const entry of entries.slice().reverse()) {
        const commands = entry.commands && entry.commands.length > 0 ? `; commands: ${entry.commands.join(", ")}` : "";
        lines.push(`- ${entry.createdAt}: ${entry.summary} (${entry.files.join(", ")}${commands})`);
      }
    }
    lines.push("");
  }
  process.stdout.write(lines.join("\n"));
}

export async function runEvidenceMigrate(cwd: string, options: EvidenceMigrateOptions): Promise<void> {
  if (!options.fromModuleDocs) {
    throw new CmapCommandError("evidence migrate currently requires --from-module-docs", 2);
  }
  if (options.apply && options.dryRun) {
    throw new CmapCommandError("Use either --dry-run or --apply, not both", 2);
  }
  const apply = Boolean(options.apply);
  const modules = await loadModuleIndex(cwd);
  const result = await migrateModuleDocEvidence(cwd, modules, apply);
  process.stdout.write(`# Evidence Migration ${apply ? "Apply" : "Dry Run"}\n\n`);
  process.stdout.write(`Migrated entries: ${result.migrated}\n`);
  process.stdout.write(`Modules: ${result.modules.length > 0 ? result.modules.join(", ") : "none"}\n`);
  if (result.backupId) {
    process.stdout.write(`Backup: ${result.backupId}\n`);
  }
  if (result.auditPath) {
    process.stdout.write(`Audit: ${result.auditPath}\n`);
  }
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
