import { CmapCommandError } from "../errors.js";
import {
  buildFreshnessReview,
  diffFreshness,
  freshnessPath,
  markModuleReviewed,
  renderFreshnessReviewMarkdown,
  snapshotFreshness
} from "../core/freshness.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";

type MarkReviewedOptions = {
  module?: string;
  evidence?: string;
};

type ReviewOptions = {
  module?: string;
  all?: boolean;
  out?: string;
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

export async function runFreshnessReview(cwd: string, options: ReviewOptions): Promise<void> {
  const moduleId = options.module?.trim();
  if (!options.all && !moduleId) {
    throw new CmapCommandError("freshness review requires --module <id> or --all", 2);
  }
  if (options.all && moduleId) {
    throw new CmapCommandError("freshness review accepts either --module <id> or --all, not both", 2);
  }

  const review = await buildFreshnessReview(cwd, {
    all: Boolean(options.all),
    moduleId
  });
  const markdown = renderFreshnessReviewMarkdown(review);
  if (options.out) {
    const target = await resolveInsideRoot(cwd, options.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, markdown, "utf8");
    process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
    return;
  }
  process.stdout.write(markdown);
}
