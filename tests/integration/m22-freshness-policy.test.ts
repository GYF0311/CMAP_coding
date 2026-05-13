import { mkdir, readFile, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createReviewProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/commands"), { recursive: true });
  await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = true;\n", "utf8");
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(
    path.join(cwd, ".context/modules/route.md"),
    `---
context_type: module
module: route
paths:
  - src/commands/route.ts
aliases:
  - route
confidence: ai-drafted
---
# Module: route

## Purpose
Recommend module docs for a task.
`,
    "utf8"
  );
  return cwd;
}

async function makeRouteStale(cwd: string): Promise<void> {
  await runCmap(["freshness", "snapshot"], cwd);
  await runCmap(["freshness", "mark-reviewed", "--module", "route", "--evidence", "Reviewed route before drift."], cwd);
  await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = 'changed';\n", "utf8");
  const future = new Date(Date.now() + 5000);
  await utimes(path.join(cwd, "src/commands/route.ts"), future, future);
}

describe("M22 freshness review and verify policy integration", () => {
  test("freshness review --module renders stale reasons, read-first files, and suggested command", async () => {
    const cwd = await createReviewProject("m22-freshness-review-module");
    await makeRouteStale(cwd);

    const verify = await runCmap(["verify", "--freshness"], cwd);
    expect(verify.code).toBe(0);
    expect(verify.stdout).toContain("Freshness: module route may be stale");

    const review = await runCmap(["freshness", "review", "--module", "route"], cwd);

    expect(review.code).toBe(0);
    expect(review.stdout).toContain("# Freshness Review: route");
    expect(review.stdout).toContain("## Why stale");
    expect(review.stdout).toContain("src/commands/route.ts is newer than last semantic review");
    expect(review.stdout).toContain("## Read first");
    expect(review.stdout).toContain(".context/modules/route.md");
    expect(review.stdout).toContain("src/commands/route.ts");
    expect(review.stdout).toContain("## Suggested command");
    expect(review.stdout).toContain('cmap freshness mark-reviewed --module route --evidence "Reviewed route after freshness review"');
  });

  test("freshness review --all writes a combined report to --out", async () => {
    const cwd = await createReviewProject("m22-freshness-review-all");
    await makeRouteStale(cwd);

    const result = await runCmap(["freshness", "review", "--all", "--out", ".context/out/freshness-review.md"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote .context/out/freshness-review.md");
    const report = await expectFile(path.join(cwd, ".context/out/freshness-review.md"));
    expect(report).toContain("# Freshness Review");
    expect(report).toContain("# Freshness Review: route");
    expect(report).toContain("## Suggested command");
  });

  test("freshness mark-reviewed clears owned-file warning without changing module docs", async () => {
    const cwd = await createReviewProject("m22-freshness-review-clear");
    await makeRouteStale(cwd);
    const modulePath = path.join(cwd, ".context/modules/route.md");
    const before = await stat(modulePath);

    const reviewed = await runCmap(["freshness", "mark-reviewed", "--module", "route", "--evidence", "Reviewed after drift."], cwd);
    const after = await stat(modulePath);
    const verify = await runCmap(["verify", "--freshness"], cwd);

    expect(reviewed.code).toBe(0);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(verify.code).toBe(0);
    expect(verify.stdout).not.toContain("Freshness: module route may be stale");
  });

  test("verify --policy surfaces unknown policy keys as warnings", async () => {
    const cwd = await createReviewProject("m22-policy-unknown");
    await writeFile(
      path.join(cwd, ".context/policy.yml"),
      ["version: 2", "auto_apply:", "  checkpoint.write: true", "  unknown.op: true", ""].join("\n"),
      "utf8"
    );

    const result = await runCmap(["verify", "--policy"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Policy: checked .context/policy.yml");
    expect(result.stdout).toContain("unknown policy key auto_apply.unknown.op");
    expect(result.stdout).toContain("Errors: 0");
  });

  test("verify --policy reports invalid policy value types as errors", async () => {
    const cwd = await createReviewProject("m22-policy-invalid-type");
    await writeFile(
      path.join(cwd, ".context/policy.yml"),
      ["version: 2", "auto_apply:", "  checkpoint.write: sometimes", ""].join("\n"),
      "utf8"
    );

    const result = await runCmap(["verify", "--policy"], cwd);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("invalid policy type auto_apply.checkpoint.write: expected boolean");
    expect(result.stdout).toContain("Errors: 1");
  });

  test("verify --policy surfaces unsupported policy versions as warnings", async () => {
    const cwd = await createReviewProject("m22-policy-unsupported-version");
    await writeFile(path.join(cwd, ".context/policy.yml"), ["version: 3", "auto_apply:", "  checkpoint.write: true", ""].join("\n"), "utf8");

    const result = await runCmap(["verify", "--policy"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("unsupported policy version 3");
    expect(result.stdout).toContain("Errors: 0");
  });
});
