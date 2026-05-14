import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

describe("skill export and bootstrap", () => {
  test("skill export writes a reusable cmap skill pack and can check staleness", async () => {
    const cwd = await createTempProject("skill-export");

    const result = await runCmap(["skill", "export", "--host", "codex"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Exported cmap skill to .cmap/skills/cmap");
    const skill = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "SKILL.md"));
    const commands = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "commands.md"));
    const boundaries = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "boundaries.md"));
    expect(skill).toContain("CMAP Project Map Skill");
    expect(skill).toContain("Canonical Facts");
    expect(skill).toContain("AGENTS.md");
    expect(commands).toContain("cmap route \"<task>\"");
    expect(boundaries).toContain(".context/generated/");

    const check = await runCmap(["skill", "export", "--host", "codex", "--check"], cwd);
    expect(check).toMatchObject({ code: 0 });
    expect(check.stdout).toContain("Skill export is up to date");

    await writeFile(path.join(cwd, ".cmap", "skills", "cmap", "SKILL.md"), "# stale\n", "utf8");
    const stale = await runCmap(["skill", "export", "--host", "codex", "--check"], cwd);
    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain("Skill export is stale");
  });

  test("bootstrap initializes context, merges entrypoints, exports skill, and writes start-here", async () => {
    const cwd = await createTempProject("bootstrap");
    await writeFile(path.join(cwd, "AGENTS.md"), "# Existing Agent Rules\n\nKeep the old rule.\n", "utf8");

    const result = await runCmap(["bootstrap", "--host", "both", "--lang", "zh-CN"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Created .context skeleton");
    expect(result.stdout).toContain("AGENTS.md: merged cmap block, original content preserved");
    expect(result.stdout).toContain("Exported cmap skill to .cmap/skills/cmap/zh-CN");
    const agents = await expectFile(path.join(cwd, "AGENTS.md"));
    const claude = await expectFile(path.join(cwd, "CLAUDE.md"));
    const skill = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "zh-CN", "SKILL.md"));
    const startHere = await expectFile(path.join(cwd, ".context", "out", "start-here.md"));
    expect(agents).toContain("Keep the old rule.");
    expect(agents).toContain("<!-- cmap:start -->");
    expect(claude).toContain("<!-- cmap:start -->");
    expect(skill).toContain("CMAP 项目地图 Skill");
    expect(startHere).toContain("这个项目使用 CMAP 项目地图");
    expect(startHere).toContain("cmap route \"<task>\"");
  });
});
