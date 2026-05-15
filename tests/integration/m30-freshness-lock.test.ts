import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { cliPath, createTempProject, runCmap, tsxBin } from "../helpers.js";

const execFileAsync = promisify(execFile);

async function createFreshnessProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/commands"), { recursive: true });
  await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = true;\n", "utf8");
  await writeFile(path.join(cwd, "src/commands/view.ts"), "export const view = true;\n", "utf8");
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeModule(cwd, "route", "src/commands/route.ts");
  await writeModule(cwd, "view", "src/commands/view.ts");
  const snapshot = await runCmap(["freshness", "snapshot"], cwd);
  expect(snapshot).toMatchObject({ code: 0 });
  return cwd;
}

describe("freshness lock and atomic writes", () => {
  test("concurrent mark-reviewed commands preserve both module updates", async () => {
    const cwd = await createFreshnessProject("freshness-concurrent");

    const [route, view] = await Promise.all([
      runCmap(["freshness", "mark-reviewed", "--module", "route", "--evidence", "route-review"], cwd),
      runCmap(["freshness", "mark-reviewed", "--module", "view", "--evidence", "view-review"], cwd)
    ]);

    expect(route).toMatchObject({ code: 0 });
    expect(view).toMatchObject({ code: 0 });
    const freshness = JSON.parse(await readFile(path.join(cwd, ".context/generated/freshness.json"), "utf8")) as {
      modules: Record<string, { reviewState: string; reviewEvidence?: string }>;
    };
    expect(freshness.modules.route.reviewState).toBe("reviewed");
    expect(freshness.modules.route.reviewEvidence).toBe("route-review");
    expect(freshness.modules.view.reviewState).toBe("reviewed");
    expect(freshness.modules.view.reviewEvidence).toBe("view-review");
  });

  test("existing freshness lock times out with a clear error", async () => {
    const cwd = await createFreshnessProject("freshness-locked");
    await writeFile(path.join(cwd, ".context/generated/freshness.json.lock"), "test-lock\n", "utf8");

    const result = await runCmapWithEnv(
      ["freshness", "mark-reviewed", "--module", "route", "--evidence", "route-review"],
      cwd,
      { CMAP_LOCK_TIMEOUT_MS: "100" }
    );

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("freshness.json is locked by another cmap process");
  });

  test("successful mark-reviewed leaves no lock or temporary freshness files behind", async () => {
    const cwd = await createFreshnessProject("freshness-cleanup");

    const result = await runCmap(["freshness", "mark-reviewed", "--module", "route", "--evidence", "route-review"], cwd);

    expect(result).toMatchObject({ code: 0 });
    const generatedEntries = await readdir(path.join(cwd, ".context/generated"));
    expect(generatedEntries).not.toContain("freshness.json.lock");
    expect(generatedEntries.filter((entry) => entry.endsWith(".tmp"))).toEqual([]);
  });
});

async function writeModule(cwd: string, moduleId: string, ownedPath: string): Promise<void> {
  await writeFile(
    path.join(cwd, ".context/modules", `${moduleId}.md`),
    `---
context_type: module
module: ${moduleId}
paths:
  - ${ownedPath}
aliases:
  - ${moduleId}
confidence: ai-drafted
---
# Module: ${moduleId}

## Purpose
Test ${moduleId} freshness.
`,
    "utf8"
  );
}

async function runCmapWithEnv(
  args: string[],
  cwd: string,
  env: Record<string, string>
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(tsxBin, [cliPath, ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...env }
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as Error & { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message
    };
  }
}
