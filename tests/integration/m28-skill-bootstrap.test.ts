import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("skill export and bootstrap", () => {
  test("skill export writes a reusable cmap skill pack and can check staleness", async () => {
    const cwd = await createTempProject("skill-export");

    const result = await runCmap(["skill", "export", "--host", "codex"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Exported cmap skill to .cmap/skills/cmap");
    const skill = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "SKILL.md"));
    const commands = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "commands.md"));
    const boundaries = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "boundaries.md"));
    const examples = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "examples.md"));
    expect(skill).toContain("CMAP Project Map Skill");
    expect(skill).toContain("Canonical Facts");
    expect(skill).toContain("AGENTS.md");
    expect(commands).toContain("cmap route \"<task>\"");
    expect(commands).not.toContain("--lang");
    expect(boundaries).toContain(".context/generated/");
    expect(examples).toContain("cmap verify --changed");

    const check = await runCmap(["skill", "export", "--host", "codex", "--check"], cwd);
    expect(check).toMatchObject({ code: 0 });
    expect(check.stdout).toContain("Skill export is up to date");

    await writeFile(path.join(cwd, ".cmap", "skills", "cmap", "SKILL.md"), "# stale\n", "utf8");
    const stale = await runCmap(["skill", "export", "--host", "codex", "--check"], cwd);
    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain("Skill export is stale");
  });

  test("bootstrap refuses to run before .context exists", async () => {
    const cwd = await createTempProject("bootstrap-missing-context");

    const result = await runCmap(["bootstrap", "--host", "both", "--skill"], cwd);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("cmap bootstrap --init --host both --skill");
    expect(await fileExists(path.join(cwd, "AGENTS.md"))).toBe(false);
    expect(await fileExists(path.join(cwd, ".cmap", "skills", "cmap", "SKILL.md"))).toBe(false);
  });

  test("bootstrap --init creates context before installing entrypoints", async () => {
    const cwd = await createTempProject("bootstrap-init");

    const result = await runCmap(["bootstrap", "--init", "--host", "both", "--skill"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Created .context skeleton");
    expect(result.stdout).toContain("AGENTS.md: created cmap entrypoint");
    expect(result.stdout).toContain("CLAUDE.md: created cmap entrypoint");
    expect(result.stdout).toContain("Exported cmap skill to .cmap/skills/cmap");
    expect(await fileExists(path.join(cwd, ".context", "MAP.md"))).toBe(true);
    expect(await fileExists(path.join(cwd, ".context", "out", "start-here.md"))).toBe(true);
    expect(await fileExists(path.join(cwd, ".cmap", "skills", "cmap", "SKILL.md"))).toBe(true);
  });

  test("bootstrap merges entrypoints, exports skill, and writes start-here", async () => {
    const cwd = await createTempProject("bootstrap");
    await runCmap(["init", "--auto"], cwd);
    await writeFile(path.join(cwd, "AGENTS.md"), "# Existing Agent Rules\n\nKeep the old rule.\n", "utf8");

    const result = await runCmap(["bootstrap", "--host", "both", "--skill"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("AGENTS.md: merged cmap block, original content preserved");
    expect(result.stdout).toContain("CLAUDE.md: created cmap entrypoint");
    expect(result.stdout).toContain("Exported cmap skill to .cmap/skills/cmap");
    const agents = await expectFile(path.join(cwd, "AGENTS.md"));
    const claude = await expectFile(path.join(cwd, "CLAUDE.md"));
    const skill = await expectFile(path.join(cwd, ".cmap", "skills", "cmap", "SKILL.md"));
    const startHere = await expectFile(path.join(cwd, ".context", "out", "start-here.md"));
    expect(agents).toContain("Keep the old rule.");
    expect(agents).toContain("<!-- cmap:start -->");
    expect(claude).toContain("<!-- cmap:start -->");
    expect(skill).toContain("CMAP Project Map Skill");
    expect(startHere).toContain("This project uses CMAP.");
    expect(startHere).toContain("cmap route \"<task>\"");
    expect(startHere).not.toContain("--lang");
  });

  test("bootstrap --init preserves an existing context skeleton", async () => {
    const cwd = await createTempProject("bootstrap-init-existing-context");
    await runCmap(["init", "--auto"], cwd);
    const mapBefore = await expectFile(path.join(cwd, ".context", "MAP.md"));
    await writeFile(path.join(cwd, "AGENTS.md"), "# Existing Agent Rules\n\nKeep the old rule.\n", "utf8");

    const result = await runCmap(["bootstrap", "--init", "--host", "both", "--skill"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).not.toContain("Created .context skeleton");
    expect(result.stdout).toContain("AGENTS.md: merged cmap block, original content preserved");
    expect(await expectFile(path.join(cwd, ".context", "MAP.md"))).toBe(mapBefore);
    expect(await fileExists(path.join(cwd, ".context", "out", "start-here.md"))).toBe(true);
  });
});
