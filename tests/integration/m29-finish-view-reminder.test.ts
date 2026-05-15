import { describe, expect, test } from "vitest";
import { createTempProject, runCmap } from "../helpers.js";

async function createInitializedProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  return cwd;
}

describe("finish generated view refresh reminder", () => {
  test("reminds to refresh generated review layers when canonical context changes", async () => {
    const cwd = await createInitializedProject("finish-context-refresh");

    const result = await runCmap(["finish", "--changed", ".context/modules/route.md"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("## Generated View Refresh");
    expect(result.stdout).toContain("cmap graph build");
    expect(result.stdout).toContain("cmap view export --out _cmap-view");
    expect(result.stdout).toContain("cmap obsidian export");
    expect(result.stdout).toContain("cmap view export --check --out _cmap-view");
    expect(result.stdout).toContain("cmap obsidian export --check");
  });

  test("does not show generated view refresh reminder for source-only changes", async () => {
    const cwd = await createInitializedProject("finish-source-only");

    const result = await runCmap(["finish", "--changed", "src/commands/route.ts"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).not.toContain("## Generated View Refresh");
  });
});
