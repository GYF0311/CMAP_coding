import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createHookProject(name: string): Promise<string> {
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

describe("M9 hooks observe and assist profiles", () => {
  test("install --hooks assist writes project-local assist templates and doctor detects them", async () => {
    const cwd = await createHookProject("m9-install-assist");

    const install = await runCmap(["install", "--host", "both", "--hooks", "assist"], cwd);

    expect(install.code).toBe(0);
    expect(install.stdout).toContain("Installed hook templates");
    const claudeHook = await expectFile(path.join(cwd, ".context/hooks/claude-assist.json"));
    const codexHook = await expectFile(path.join(cwd, ".context/hooks/codex-assist.json"));
    expect(claudeHook).toContain("cmap hooks stop --profile assist");
    expect(codexHook).toContain("cmap hooks stop --profile assist");

    const doctor = await runCmap(["doctor"], cwd);

    expect(doctor.code).toBe(0);
    expect(doctor.stdout).toContain("Hooks: assist templates present");
  });

  test("hooks stop --profile observe writes a non-canonical hook event log", async () => {
    const cwd = await createHookProject("m9-observe");
    const mapBefore = await readFile(path.join(cwd, ".context/MAP.md"), "utf8");

    const result = await runCmap(
      ["hooks", "stop", "--profile", "observe", "--changed", "src/commands/route.ts", "--summary", "Observed route work"],
      cwd
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Observed hook event");
    const log = await expectFile(path.join(cwd, ".context/logs/hooks.jsonl"));
    expect(log).toContain("\"profile\":\"observe\"");
    expect(log).toContain("src/commands/route.ts");
    await expect(readFile(path.join(cwd, ".context/MAP.md"), "utf8")).resolves.toBe(mapBefore);
  });

  test("hooks stop --profile assist appends generated evidence for mapped changed files", async () => {
    const cwd = await createHookProject("m9-assist");

    const result = await runCmap(
      ["hooks", "stop", "--profile", "assist", "--changed", "src/commands/route.ts", "--summary", "Assist captured route change"],
      cwd
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Generated evidence updates: 1");
    expect(result.stdout).toContain("src/commands/route.ts -> route");
    const routeDoc = await expectFile(path.join(cwd, ".context/modules/route.md"));
    expect(routeDoc).toContain("<!-- cmap:generated:evidence:start -->");
    expect(routeDoc).toContain("Assist captured route change");
    expect(routeDoc).toContain("src/commands/route.ts");
  });

  test("hooks stop --profile assist reports unmapped changed files without writing module evidence", async () => {
    const cwd = await createHookProject("m9-assist-unmapped");
    await writeFile(path.join(cwd, "README.md"), "# temp\n", "utf8");
    const routeBefore = await expectFile(path.join(cwd, ".context/modules/route.md"));

    const result = await runCmap(
      ["hooks", "stop", "--profile", "assist", "--changed", "README.md", "--summary", "Assist captured unmapped change"],
      cwd
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Generated evidence updates: 0");
    expect(result.stdout).toContain("Unmapped changed files");
    await expect(expectFile(path.join(cwd, ".context/modules/route.md"))).resolves.toBe(routeBefore);
  });

  test("hooks render writes Claude lifecycle settings for assist mode", async () => {
    const cwd = await createHookProject("m9-render");

    const result = await runCmap(
      ["hooks", "render", "--host", "claude", "--mode", "assist", "--out", ".context/hooks/claude.settings.generated.json"],
      cwd
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Rendered hook settings");
    const settings = await expectFile(path.join(cwd, ".context/hooks/claude.settings.generated.json"));
    expect(settings).toContain("SessionStart");
    expect(settings).toContain("UserPromptSubmit");
    expect(settings).toContain("PreToolUse");
    expect(settings).toContain("PostToolUse");
    expect(settings).toContain("Stop");
    expect(settings).toContain("cmap hooks test --event PreToolUse --mode assist");
  });

  test("hooks test records PostToolUse events to the session event journal", async () => {
    const cwd = await createHookProject("m9-post-tool-use");

    const result = await runCmap(
      ["hooks", "test", "--event", "PostToolUse", "--mode", "observe", "--tool", "Read", "--file", "src/commands/route.ts"],
      cwd
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Recorded PostToolUse event");
    const journal = await expectFile(path.join(cwd, ".context/logs/session-events.jsonl"));
    expect(journal).toContain("\"event\":\"PostToolUse\"");
    expect(journal).toContain("\"tool\":\"Read\"");
    expect(journal).toContain("src/commands/route.ts");
  });

  test("hooks test strict PreToolUse blocks direct semantic canonical writes", async () => {
    const cwd = await createHookProject("m9-pre-tool-use-strict");

    const result = await runCmap(
      ["hooks", "test", "--event", "PreToolUse", "--mode", "strict", "--tool", "Write", "--file", ".context/DECISIONS.md"],
      cwd
    );

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("Decision: block");
    expect(result.stdout).toContain("direct semantic canonical writes are blocked");
  });
});
