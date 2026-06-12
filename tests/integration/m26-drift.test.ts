import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return result.stdout.trim();
}

async function createDriftProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/commands"), { recursive: true });
  await mkdir(path.join(cwd, "tests/integration"), { recursive: true });
  await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = 'initial';\n", "utf8");
  await writeFile(path.join(cwd, "src/commands/brief.ts"), "export const brief = 'initial';\n", "utf8");
  await writeFile(path.join(cwd, "src/commands/route-stage.ts"), "export const staged = 'initial';\n", "utf8");
  await writeFile(path.join(cwd, "tests/integration/route.test.ts"), "test('route', () => true);\n", "utf8");
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(
    path.join(cwd, ".context/modules/route.md"),
    moduleDoc("route", ["src/commands/route.ts", "src/commands/route-stage.ts", "tests/integration/route.test.ts"]),
    "utf8"
  );
  await writeFile(path.join(cwd, ".context/modules/brief.md"), moduleDoc("brief", ["src/commands/brief.ts"]), "utf8");
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "cmap@example.test"]);
  await git(cwd, ["config", "user.name", "CMAP Test"]);
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "initial"]);
  return cwd;
}

function moduleDoc(moduleId: string, paths: string[]): string {
  return `---
context_type: module
module: ${moduleId}
paths:
${paths.map((item) => `  - ${item}`).join("\n")}
aliases:
  - ${moduleId}
confidence: ai-drafted
---
# Module: ${moduleId}

## Purpose
Own ${moduleId}.

## Tests / Verification
- pnpm test tests/integration/${moduleId}.test.ts
`;
}

async function readFreshnessBytes(cwd: string): Promise<string> {
  return readFile(path.join(cwd, ".context/generated/freshness.json"), "utf8");
}

describe("M26 drift schema and read/write boundaries", () => {
  test("v1 freshness is normalized in memory and read commands do not rewrite bytes", async () => {
    const cwd = await createDriftProject("m26-v1-readonly");
    await runCmap(["freshness", "snapshot"], cwd);
    const v2 = JSON.parse(await readFreshnessBytes(cwd)) as Record<string, unknown>;
    await writeFile(path.join(cwd, ".context/generated/freshness.json"), `${JSON.stringify({ ...v2, version: 1 }, null, 2)}\n`, "utf8");
    const before = await readFreshnessBytes(cwd);

    const verify = await runCmap(["verify", "--freshness"], cwd);
    const view = await runCmap(["view", "export", "--include-freshness", "--check", "--out", ".context/out/view.html"], cwd);
    const after = await readFreshnessBytes(cwd);

    expect(verify.code).toBe(0);
    expect(view.code).toBe(1);
    expect(after).toBe(before);
  });

  test("policy accepts drift scalar config and rejects wrong scalar types", async () => {
    const cwd = await createDriftProject("m26-policy-drift");
    await writeFile(
      path.join(cwd, ".context/policy.yml"),
      [
        "version: 2",
        "drift:",
        "  enabled: true",
        "  threshold: 0.35",
        "  write_signals: false",
        "  test_weight: 0.05",
        "  exclude_globs: \"dist/**,.context/generated/**\"",
        ""
      ].join("\n"),
      "utf8"
    );

    const valid = await runCmap(["verify", "--policy"], cwd);
    expect(valid.code).toBe(0);
    expect(valid.stdout).toContain("Policy: checked .context/policy.yml");
    expect(valid.stdout).toContain("Errors: 0");
    expect(valid.stdout).not.toContain("unknown policy section drift");

    await writeFile(path.join(cwd, ".context/policy.yml"), ["version: 2", "drift:", "  exclude_globs: false", ""].join("\n"), "utf8");
    const invalid = await runCmap(["verify", "--policy"], cwd);
    expect(invalid.code).toBe(1);
    expect(invalid.stdout).toContain("invalid policy type drift.exclude_globs: expected string");
  });

  test("drift check is read-only and reports committed staged unstaged untracked rename delete and test signals", async () => {
    const cwd = await createDriftProject("m26-git-signals");
    await runCmap(["freshness", "snapshot"], cwd);
    await runCmap(["drift", "mark-reviewed", "--module", "route", "--evidence", "Reviewed baseline"], cwd);
    const before = await readFreshnessBytes(cwd);

    await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = 'committed';\n", "utf8");
    await git(cwd, ["add", "src/commands/route.ts"]);
    await git(cwd, ["commit", "-m", "route committed drift"]);
    await writeFile(path.join(cwd, "src/commands/route-stage.ts"), "export const staged = 'changed';\n", "utf8");
    await git(cwd, ["add", "src/commands/route-stage.ts"]);
    await writeFile(path.join(cwd, "tests/integration/route.test.ts"), "test('route changed', () => true);\n", "utf8");
    await writeFile(path.join(cwd, "src/commands/route-extra.ts"), "export const extra = true;\n", "utf8");
    await git(cwd, ["mv", "src/commands/brief.ts", "src/commands/brief-renamed.ts"]);
    await writeFile(path.join(cwd, "src/commands/brief-renamed.ts"), "export const brief = 'renamed';\n", "utf8");
    await git(cwd, ["rm", "-f", "src/commands/route.ts"]);

    const result = await runCmap(["drift", "check", "--module", "route", "--json"], cwd);
    const after = await readFreshnessBytes(cwd);
    const report = JSON.parse(result.stdout) as {
      modules: Array<{
        moduleId: string;
        sourceSignals: {
          driftScore: number;
          reasons: string[];
          changedFiles: Array<{ path: string; oldPath?: string; status: string; score: number }>;
        };
      }>;
    };
    const route = report.modules.find((module) => module.moduleId === "route");

    expect(result.code).toBe(0);
    expect(after).toBe(before);
    expect(route?.sourceSignals.driftScore).toBeGreaterThan(0);
    expect(route?.sourceSignals.reasons.join("\n")).toContain("owned path changed");
    expect(route?.sourceSignals.changedFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "src/commands/route.ts", status: "committed" }),
      expect.objectContaining({ path: "src/commands/route-stage.ts", status: "staged" }),
      expect.objectContaining({ path: "tests/integration/route.test.ts", status: "test" }),
      expect.objectContaining({ path: "src/commands/route-extra.ts", status: "untracked" }),
      expect.objectContaining({ path: "src/commands/route.ts", status: "deleted" })
    ]));
  });

  test("rename and delete are mapped from previous ownedFiles when current module paths no longer match", async () => {
    const cwd = await createDriftProject("m26-rename-delete-owned");
    await runCmap(["freshness", "snapshot"], cwd);
    await runCmap(["drift", "mark-reviewed", "--module", "brief", "--evidence", "Reviewed brief baseline"], cwd);

    await git(cwd, ["mv", "src/commands/brief.ts", "src/commands/brief-new.ts"]);
    const rename = await runCmap(["drift", "check", "--module", "brief", "--json"], cwd);
    const renameReport = JSON.parse(rename.stdout) as { modules: Array<{ sourceSignals: { changedFiles: Array<{ path: string; oldPath?: string; status: string }> } }> };
    expect(renameReport.modules[0].sourceSignals.changedFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ oldPath: "src/commands/brief.ts", path: "src/commands/brief-new.ts", status: "renamed" })
    ]));

    await git(cwd, ["rm", "-f", "src/commands/brief-new.ts"]);
    const deletion = await runCmap(["drift", "check", "--module", "brief", "--json"], cwd);
    const deletionReport = JSON.parse(deletion.stdout) as { modules: Array<{ sourceSignals: { changedFiles: Array<{ path: string; status: string }> } }> };
    expect(deletionReport.modules[0].sourceSignals.changedFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "src/commands/brief.ts", status: "deleted" })
    ]));
  });

  test("first run without lastReviewedCommit only considers working tree changes", async () => {
    const cwd = await createDriftProject("m26-first-run");
    await runCmap(["freshness", "snapshot"], cwd);

    const clean = await runCmap(["drift", "check", "--module", "route", "--json"], cwd);
    const cleanReport = JSON.parse(clean.stdout) as { modules: Array<{ sourceSignals: { driftScore: number; reasons: string[] } }> };
    expect(cleanReport.modules[0].sourceSignals.driftScore).toBe(0);
    expect(cleanReport.modules[0].sourceSignals.reasons).toContain("no semantic review commit baseline; committed history was not scanned");

    await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = 'working tree';\n", "utf8");
    const dirty = await runCmap(["drift", "check", "--module", "route", "--json"], cwd);
    const dirtyReport = JSON.parse(dirty.stdout) as { modules: Array<{ sourceSignals: { driftScore: number; changedFiles: Array<{ status: string }> } }> };
    expect(dirtyReport.modules[0].sourceSignals.driftScore).toBeGreaterThan(0);
    expect(dirtyReport.modules[0].sourceSignals.changedFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "modified" })
    ]));
  });

  test("snapshot stores the same sourceSignals shape emitted by check json", async () => {
    const cwd = await createDriftProject("m26-snapshot-shape");
    await runCmap(["freshness", "snapshot"], cwd);
    await runCmap(["drift", "mark-reviewed", "--module", "route", "--evidence", "Reviewed route baseline"], cwd);
    await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = 'changed';\n", "utf8");

    const check = await runCmap(["drift", "check", "--module", "route", "--json"], cwd);
    const checkReport = JSON.parse(check.stdout) as { modules: Array<{ sourceSignals: unknown }> };
    const snapshot = await runCmap(["drift", "snapshot", "--module", "route"], cwd);
    const stored = JSON.parse(await readFreshnessBytes(cwd)) as { modules: Record<string, { sourceSignals: Record<string, unknown> }> };
    const checkSignals = checkReport.modules[0].sourceSignals as Record<string, unknown>;

    expect(snapshot.code).toBe(0);
    expect(Object.keys(stored.modules.route.sourceSignals).sort()).toEqual(Object.keys(checkSignals).sort());
    expect(stored.modules.route.sourceSignals.changedFiles).toEqual(checkSignals.changedFiles);
    expect(stored.modules.route.sourceSignals.reasons).toEqual(checkSignals.reasons);
  });

  test("route brief and UserPromptSubmit show drift block without writing freshness sourceSignals", async () => {
    const cwd = await createDriftProject("m26-route-brief-hook-readonly");
    await runCmap(["freshness", "snapshot"], cwd);
    await runCmap(["drift", "mark-reviewed", "--module", "route", "--evidence", "Reviewed route baseline"], cwd);
    await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = 'changed';\n", "utf8");
    const before = await readFreshnessBytes(cwd);

    const route = await runCmap(["route", "route 模块定位"], cwd);
    const brief = await runCmap(["brief", "route 模块定位"], cwd);
    const hook = await runCmap(["hooks", "test", "--event", "UserPromptSubmit", "--mode", "assist", "--prompt", "route 模块定位"], cwd);
    const after = await readFreshnessBytes(cwd);
    const parsed = JSON.parse(after) as { modules: Record<string, { sourceSignals?: unknown }> };

    expect(route.stdout).toContain("## Drift Review Signals");
    expect(brief.stdout).toContain("## Drift Review Signals");
    expect(hook.stdout).toContain("Wrote .context/out/session-brief.md");
    expect(await expectFile(path.join(cwd, ".context/out/session-brief.md"))).toContain("## Drift Review Signals");
    expect(after).toBe(before);
    expect(parsed.modules.route.sourceSignals).toBeUndefined();
  });

  test("drift migrate is explicit and freshness mark-reviewed without evidence remains compatible", async () => {
    const cwd = await createDriftProject("m26-migrate-compat");
    await runCmap(["freshness", "snapshot"], cwd);

    const legacy = await runCmap(["freshness", "mark-reviewed", "--module", "route"], cwd);
    expect(legacy.code).toBe(0);

    const v2 = JSON.parse(await readFreshnessBytes(cwd)) as Record<string, unknown>;
    await writeFile(path.join(cwd, ".context/generated/freshness.json"), `${JSON.stringify({ ...v2, version: 1 }, null, 2)}\n`, "utf8");
    const migratedBefore = JSON.parse(await readFreshnessBytes(cwd)) as { version: number };
    expect(migratedBefore.version).toBe(1);
    const migrate = await runCmap(["drift", "migrate"], cwd);
    const migratedAfter = JSON.parse(await readFreshnessBytes(cwd)) as { version: number };

    expect(migrate.code).toBe(0);
    expect(migratedAfter.version).toBe(2);
  });
});
