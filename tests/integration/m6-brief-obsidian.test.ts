import { mkdir, writeFile } from "node:fs/promises";
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
      "--goal",
      "Ship AI brief workflow",
      "--done",
      "Module docs exist",
      "--left-off",
      "Before brief command",
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
  test("brief writes an AI coding brief with route, status, module docs, and Obsidian links", async () => {
    const cwd = await createWorkflowProject();

    const result = await runCmap(["brief", "路由结果没有推荐模块", "--obsidian", "--out", ".context/out/brief.md"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Wrote .context/out/brief.md");
    const brief = await expectFile(path.join(cwd, ".context/out/brief.md"));
    expect(brief).toContain("# AI Coding Brief");
    expect(brief).toContain("## Route Result");
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

  test("obsidian open prints a module URI without launching external apps", async () => {
    const cwd = await createWorkflowProject();

    const result = await runCmap(["obsidian", "open", "route", "--vault-name", "corpus"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("obsidian://open?");
    expect(result.stdout).toContain("vault=corpus");
    expect(result.stdout).toContain("_cmap%2F");
    expect(result.stdout).toContain("Route.md");
  });
});
