import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createWorkflowProject(): Promise<string> {
  const cwd = await createTempProject("m6-brief-obsidian");
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/commands"), { recursive: true });
  await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = true;\n", "utf8");
  await writeFile(path.join(cwd, "src/commands/verify.ts"), "export const verify = true;\n", "utf8");
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
  - 路由
relations:
  depends_on:
    - verify
confidence: ai-drafted
---
# Module: route

## Purpose
Recommend module docs for a task.
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/modules/verify.md"),
    `---
context_type: module
module: verify
paths:
  - src/commands/verify.ts
aliases:
  - verify
  - 校验
confidence: ai-drafted
---
# Module: verify

## Purpose
Check project map health.
`,
    "utf8"
  );

  await runCmap(
    [
      "checkpoint",
      "write",
      "--task",
      "Ship AI brief workflow",
      "--hypothesis",
      "Module docs exist before the brief command",
      "--next",
      "Generate brief",
      "--verified",
      "Not yet"
    ],
    cwd
  );

  return cwd;
}

describe("M6 brief and Obsidian export", () => {
  test("brief writes an AI coding brief with route, checkpoint, module docs, and Obsidian links", async () => {
    const cwd = await createWorkflowProject();

    const result = await runCmap(["brief", "路由结果没有推荐模块", "--obsidian", "--out", ".context/out/brief.md"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Wrote .context/out/brief.md");
    const brief = await expectFile(path.join(cwd, ".context/out/brief.md"));
    expect(brief).toContain("# AI Coding Brief");
    expect(brief).toContain("## Route Result");
    expect(brief).toContain("## Current Checkpoint");
    expect(brief).toContain("- route (score");
    expect(brief).toContain(".context/modules/route.md");
    expect(brief).toContain("Ship AI brief workflow");
    expect(brief).toContain("obsidian://open?");
    expect(brief).toContain("## Finish Requirement");
  });

  test("obsidian export creates module notes with properties and relation wikilinks", async () => {
    const cwd = await createWorkflowProject();

    const result = await runCmap(["obsidian", "export", "--out", "_cmap/TestProject"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Exported Obsidian view to _cmap/TestProject");
    const index = await expectFile(path.join(cwd, "_cmap/TestProject/00_INDEX.md"));
    expect(index).toContain("[[modules/Route|route]]");
    const routeNote = await expectFile(path.join(cwd, "_cmap/TestProject/modules/Route.md"));
    expect(routeNote).toContain('type: "cmap-module"');
    expect(routeNote).toContain('module_id: "route"');
    expect(routeNote).toContain("## Relations");
    expect(routeNote).toContain("[[Verify]]");
    expect(routeNote).toContain("## Source Module Doc");
  });

  test("obsidian export --check detects stale view-layer mirrors", async () => {
    const cwd = await createWorkflowProject();
    await runCmap(["obsidian", "export", "--out", "_cmap/TestProject"], cwd);

    const clean = await runCmap(["obsidian", "export", "--out", "_cmap/TestProject", "--check"], cwd);

    expect(clean).toMatchObject({ code: 0 });
    expect(clean.stdout).toContain("Obsidian export is up to date");

    await writeFile(
      path.join(cwd, ".context/modules/route.md"),
      `---
context_type: module
module: route
paths:
  - src/commands/route.ts
aliases:
  - route
  - 路由
relations:
  depends_on:
    - verify
confidence: ai-drafted
---
# Module: route

## Purpose
Recommend updated module docs for a task.
`,
      "utf8"
    );

    const stale = await runCmap(["obsidian", "export", "--out", "_cmap/TestProject", "--check"], cwd);

    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain("# Obsidian Export Check");
    expect(stale.stdout).toContain("would update _cmap/TestProject/modules/Route.md");
  });

  test("obsidian open prints a module URI without launching external apps", async () => {
    const cwd = await createWorkflowProject();

    const result = await runCmap(["obsidian", "open", "route", "--vault-name", "corpus"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("obsidian://open?");
    expect(result.stdout).toContain("vault=corpus");
    expect(result.stdout).toContain("_cmap%2F");
    expect(result.stdout).toContain("Route.md");
  });

  test("obsidian pull reports candidate note edits and can write inbox", async () => {
    const cwd = await createWorkflowProject();
    await runCmap(["obsidian", "export", "--out", "_cmap/TestProject"], cwd);
    const notePath = path.join(cwd, "_cmap/TestProject/modules/Route.md");
    const note = await readFile(notePath, "utf8");
    await writeFile(
      notePath,
      note.replace("Recommend module docs for a task.", "Recommend module docs and Obsidian pull candidates for a task."),
      "utf8"
    );

    const dryRun = await runCmap(["obsidian", "pull", "--from", "_cmap/TestProject"], cwd);

    expect(dryRun).toMatchObject({ code: 0 });
    expect(dryRun.stdout).toContain("# Obsidian Pull Dry Run");
    expect(dryRun.stdout).toContain("_cmap/TestProject/modules/Route.md");
    expect(dryRun.stdout).toContain(".context/modules/route.md");
    expect(dryRun.stdout).toContain("does not modify canonical `.context` facts");

    const writeInbox = await runCmap(["obsidian", "pull", "--from", "_cmap/TestProject", "--write-inbox"], cwd);

    expect(writeInbox).toMatchObject({ code: 0 });
    expect(writeInbox.stdout).toContain("Wrote .context/inbox/obsidian-");
    const inboxFiles = await readdir(path.join(cwd, ".context/inbox"));
    expect(inboxFiles.some((file) => file.startsWith("obsidian-") && file.endsWith(".md"))).toBe(true);
  });

  test("benchmark route reports top-k route accuracy from JSONL tasks", async () => {
    const cwd = await createWorkflowProject();
    await mkdir(path.join(cwd, "bench"), { recursive: true });
    await writeFile(
      path.join(cwd, "bench/tasks.jsonl"),
      [
        JSON.stringify({ task: "路由结果没有推荐模块", expected_modules: ["route"], bad_modules: ["verify"] }),
        JSON.stringify({ task: "校验命令没有检查项目地图", expected_modules: ["verify"], bad_modules: ["route"] })
      ].join("\n"),
      "utf8"
    );

    const result = await runCmap(["benchmark", "route", "--file", "bench/tasks.jsonl"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("# Route Benchmark");
    expect(result.stdout).toContain("Cases: 2");
    expect(result.stdout).toContain("Top-1: 2/2");
    expect(result.stdout).toContain("Top-3: 2/2");
  });

  test("reconcile reports external workflow candidates and can write inbox", async () => {
    const cwd = await createWorkflowProject();
    await mkdir(path.join(cwd, ".planning/phases/01"), { recursive: true });
    await writeFile(
      path.join(cwd, ".planning/phases/01/STATE.md"),
      [
        "# Phase 1 progress",
        "- Decision: keep `.context` as canonical source.",
        "- Module route owns task-to-module routing paths.",
        "- Verified with pnpm test tests/integration/m6-brief-obsidian.test.ts.",
        "- Conflict: GSD note says Obsidian should be source layer."
      ].join("\n"),
      "utf8"
    );

    const dryRun = await runCmap(["reconcile", "--adapter", "gsd-v1", "--from", ".planning"], cwd);

    expect(dryRun).toMatchObject({ code: 0 });
    expect(dryRun.stdout).toContain("# gsd-v1 Reconcile Dry Run");
    expect(dryRun.stdout).toContain("## decision");
    expect(dryRun.stdout).toContain("keep `.context` as canonical source");
    expect(dryRun.stdout).toContain("## module_fact");
    expect(dryRun.stdout).toContain("## verification");
    expect(dryRun.stdout).toContain("## conflict");

    const writeInbox = await runCmap(
      ["reconcile", "--adapter", "gsd-v1", "--from", ".planning", "--write-inbox"],
      cwd
    );

    expect(writeInbox).toMatchObject({ code: 0 });
    expect(writeInbox.stdout).toContain("Wrote .context/inbox/gsd-v1-");
  });
});
