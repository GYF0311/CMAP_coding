import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFreshnessIndex, freshnessPath, markModuleReviewed, migrateFreshnessIndex, updateFreshnessIndexLocked } from "../core/freshness.js";
import { computeDriftReport, type DriftReport } from "../core/drift.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";

type DriftCheckOptions = {
  module?: string;
  json?: boolean;
  writeSignals?: boolean;
};

type DriftSnapshotOptions = {
  module?: string;
};

type DriftMarkReviewedOptions = {
  module?: string;
  evidence?: string;
};

type DriftReviewOptions = {
  module?: string;
  out?: string;
};

export async function runDriftCheck(cwd: string, options: DriftCheckOptions): Promise<void> {
  if (options.writeSignals) {
    await runDriftSnapshot(cwd, { module: options.module });
    return;
  }
  const report = await computeDriftReport(cwd, { moduleId: options.module });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(renderDriftCheck(report));
}

export async function runDriftSnapshot(cwd: string, options: DriftSnapshotOptions): Promise<void> {
  const report = await computeDriftReport(cwd, { moduleId: options.module });
  await updateFreshnessIndexLocked(cwd, async (previous) => {
    const index = await buildFreshnessIndex(cwd, previous);
    for (const module of report.modules) {
      if (index.modules[module.moduleId]) {
        index.modules[module.moduleId].sourceSignals = module.sourceSignals;
      }
    }
    return index;
  });
  process.stdout.write(`Wrote ${projectRelative(cwd, freshnessPath(cwd))}\n`);
}

export async function runDriftMarkReviewed(cwd: string, options: DriftMarkReviewedOptions): Promise<void> {
  if (!options.module) {
    throw new CmapCommandError("drift mark-reviewed requires --module <id>", 2);
  }
  const evidence = options.evidence?.trim();
  if (!evidence) {
    throw new CmapCommandError("drift mark-reviewed requires --evidence <text>", 2);
  }
  await markModuleReviewed(cwd, options.module, evidence);
  process.stdout.write([
    "# Drift Review Updated",
    "",
    `Module: ${options.module}`,
    `Index: ${projectRelative(cwd, freshnessPath(cwd))}`,
    "This updates generated freshness review metadata only.",
    ""
  ].join("\n"));
}

export async function runDriftMigrate(cwd: string): Promise<void> {
  await migrateFreshnessIndex(cwd);
  process.stdout.write(`Migrated ${projectRelative(cwd, freshnessPath(cwd))} to freshness v2\n`);
}

export async function runDriftReview(cwd: string, options: DriftReviewOptions): Promise<void> {
  if (!options.module) {
    throw new CmapCommandError("drift review requires --module <id>", 2);
  }
  const report = await computeDriftReport(cwd, { moduleId: options.module });
  const markdown = renderDriftReview(report);
  if (options.out) {
    const target = await resolveInsideRoot(cwd, options.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, markdown, "utf8");
    process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
    return;
  }
  process.stdout.write(markdown);
}

function renderDriftCheck(report: DriftReport): string {
  const lines = ["# Drift Check", ""];
  if (report.modules.length === 0) {
    lines.push("No modules matched.");
  }
  for (const module of report.modules) {
    lines.push(`## ${module.moduleId}`, "", `Score: ${module.sourceSignals.driftScore}`);
    lines.push("", "Reasons:");
    lines.push(...markdownList(module.sourceSignals.reasons.length > 0 ? module.sourceSignals.reasons : ["No drift signals."]));
    lines.push("", "Changed files:");
    lines.push(...markdownList(module.sourceSignals.changedFiles.map(formatChangedFile)));
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderDriftReview(report: DriftReport): string {
  const lines: string[] = [];
  for (const module of report.modules) {
    lines.push(`# Drift Review: ${module.moduleId}`, "", "## Why review");
    lines.push(...markdownList(module.sourceSignals.reasons.length > 0 ? module.sourceSignals.reasons : ["No drift signals currently detected."]));
    lines.push("", "## Read first", `- ${module.doc}`);
    for (const file of module.sourceSignals.changedFiles) {
      if (file.oldPath) {
        lines.push(`- ${file.oldPath}`);
      }
      lines.push(`- ${file.path}`);
    }
    lines.push("", "## Suggested command", `cmap drift mark-reviewed --module ${module.moduleId} --evidence "Reviewed ${module.moduleId} after drift review"`, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function formatChangedFile(file: { path: string; oldPath?: string; status: string; score: number }): string {
  return file.oldPath
    ? `${file.status} ${file.oldPath} -> ${file.path} (${file.score})`
    : `${file.status} ${file.path} (${file.score})`;
}

function markdownList(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}
