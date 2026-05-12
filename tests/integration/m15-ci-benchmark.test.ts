import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, runCmap } from "../helpers.js";

async function createCiProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/auth"), { recursive: true });
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(path.join(cwd, "src/auth/index.ts"), "export const auth = true;\n", "utf8");
  await writeFile(
    path.join(cwd, ".context/modules/auth.md"),
    `---
context_type: module
module: auth
paths:
  - src/auth
aliases:
  - auth
  - login
confidence: ai-drafted
---
# Module: auth
`,
    "utf8"
  );
  return cwd;
}

describe("M15 CI reports and benchmark thresholds", () => {
  test("verify --ci --format markdown renders a stable CI report", async () => {
    const cwd = await createCiProject("m15-ci-report");

    const result = await runCmap(["verify", "--ci", "--format", "markdown"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# cmap CI Report");
    expect(result.stdout).toContain("Errors: 0");
    expect(result.stdout).toContain("Warnings:");
    expect(result.stdout).toContain("## Passing Checks");
  });

  test("benchmark route thresholds fail when hit rate is below the requested minimum", async () => {
    const cwd = await createCiProject("m15-benchmark-threshold");
    await mkdir(path.join(cwd, "bench"), { recursive: true });
    await writeFile(
      path.join(cwd, "bench/tasks.jsonl"),
      `${JSON.stringify({ task: "totally unknown task", expected_modules: ["auth"] })}\n`,
      "utf8"
    );

    const result = await runCmap(["benchmark", "route", "--file", "bench/tasks.jsonl", "--min-top1", "100"], cwd);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("Threshold failures:");
    expect(result.stdout).toContain("Top-1 below 100%");
  });
});
