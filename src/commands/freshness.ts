import { CmapCommandError } from "../errors.js";
import {
  diffFreshness,
  freshnessPath,
  markModuleReviewed,
  snapshotFreshness
} from "../core/freshness.js";
import { projectRelative } from "../fs/safe-path.js";

type MarkReviewedOptions = {
  module?: string;
  evidence?: string;
};

export async function runFreshnessSnapshot(cwd: string): Promise<void> {
  const index = await snapshotFreshness(cwd);
  process.stdout.write(`Wrote ${projectRelative(cwd, freshnessPath(cwd))}\n`);
  process.stdout.write(`Modules: ${Object.keys(index.modules).length}\n`);
}

export async function runFreshnessDiff(cwd: string): Promise<void> {
  const lines = await diffFreshness(cwd);
  process.stdout.write(["# Freshness Diff", "", ...lines.map((line) => `- ${line}`), ""].join("\n"));
}

export async function runFreshnessMarkReviewed(cwd: string, options: MarkReviewedOptions): Promise<void> {
  const moduleId = options.module?.trim();
  if (!moduleId) {
    throw new CmapCommandError("freshness mark-reviewed requires --module <id>", 2);
  }
  await markModuleReviewed(cwd, moduleId, options.evidence);
  process.stdout.write(`Marked reviewed: ${moduleId}\n`);
}
