import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

function countMatches(raw: string, pattern: RegExp): number {
  return raw.match(pattern)?.length ?? 0;
}

describe("non-destructive install", () => {
  test("install --host both merges a cmap block without overwriting existing entrypoints", async () => {
    const cwd = await createTempProject("install-merge");
    await runCmap(["init", "--auto"], cwd);
    await writeFile(path.join(cwd, "AGENTS.md"), "# Existing Agent Rules\n\nKeep this rule.\n", "utf8");
    await writeFile(path.join(cwd, "CLAUDE.md"), "# Existing Claude Rules\n\nKeep this Claude rule.\n", "utf8");

    const result = await runCmap(["install", "--host", "both"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("AGENTS.md: merged cmap block, original content preserved");
    expect(result.stdout).toContain("CLAUDE.md: merged cmap block, original content preserved");

    const agents = await expectFile(path.join(cwd, "AGENTS.md"));
    const claude = await expectFile(path.join(cwd, "CLAUDE.md"));
    expect(agents).toContain("Keep this rule.");
    expect(claude).toContain("Keep this Claude rule.");
    expect(agents).toContain("<!-- cmap:start -->");
    expect(agents).toContain("<!-- cmap:end -->");
    expect(agents).toContain("cmap route \"<task>\"");
    expect(agents).toContain("## Git Safety Rules");
    expect(agents).toContain("section headings in stable English anchors");
    expect(claude).toContain("cmap verify --changed");
    expect(claude).toContain("## Git Safety Rules");

    await runCmap(["install", "--host", "both"], cwd);
    const agentsAgain = await expectFile(path.join(cwd, "AGENTS.md"));
    const claudeAgain = await expectFile(path.join(cwd, "CLAUDE.md"));
    expect(countMatches(agentsAgain, /<!-- cmap:start -->/g)).toBe(1);
    expect(countMatches(agentsAgain, /<!-- cmap:end -->/g)).toBe(1);
    expect(countMatches(claudeAgain, /<!-- cmap:start -->/g)).toBe(1);
    expect(countMatches(claudeAgain, /<!-- cmap:end -->/g)).toBe(1);
  });

  test("install supports print-only, force overwrite, and backups", async () => {
    const cwd = await createTempProject("install-modes");
    await runCmap(["init", "--auto"], cwd);
    await writeFile(path.join(cwd, "AGENTS.md"), "# Existing\n\nDo not lose me.\n", "utf8");

    const printed = await runCmap(["install", "--host", "codex", "--mode", "print"], cwd);

    expect(printed).toMatchObject({ code: 0 });
    expect(printed.stdout).toContain("# AGENTS.md");
    expect(printed.stdout).toContain("<!-- cmap:start -->");
    expect(await expectFile(path.join(cwd, "AGENTS.md"))).toBe("# Existing\n\nDo not lose me.\n");

    const merged = await runCmap(["install", "--host", "codex", "--backup"], cwd);
    expect(merged).toMatchObject({ code: 0 });
    expect(merged.stdout).toContain("AGENTS.md: merged cmap block, original content preserved");
    const backupRoots = await readdir(path.join(cwd, ".context", "backups"));
    const installBackup = backupRoots.find((entry) => entry.startsWith("install-"));
    expect(installBackup).toBeTruthy();
    expect(await expectFile(path.join(cwd, ".context", "backups", installBackup ?? "", "AGENTS.md"))).toContain("Do not lose me.");

    const forced = await runCmap(["install", "--host", "codex", "--force"], cwd);
    expect(forced).toMatchObject({ code: 0 });
    expect(forced.stdout).toContain("AGENTS.md: overwritten by --force");
    const agents = await expectFile(path.join(cwd, "AGENTS.md"));
    expect(agents).not.toContain("Do not lose me.");
    expect(agents).toContain("# Project: ");
    expect(agents).toContain("<!-- cmap:start -->");
  });
});
