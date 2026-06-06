import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

describe("M1 CLI skeleton", () => {
  test("prints the package version", async () => {
    const cwd = await createTempProject("version");

    const result = await runCmap(["version"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout.trim()).toBe("0.3.1");
  });

  test("init --auto creates the required .context skeleton without inventing project semantics", async () => {
    const cwd = await createTempProject("init");
    await writeFile(path.join(cwd, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }));

    const result = await runCmap(["init", "--auto"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Created .context");

    const requiredFiles = [
      "BRIEF.md",
      "MAP.md",
      "STATUS.md",
      "CHECKPOINT.md",
      "DECISIONS.md",
      "VERIFY.md",
      "logs/_index.md",
      "logs/current.md",
      "ideas/_inbox.md",
      "ideas/parking-lot.md",
      "ideas/rejected.md",
      "refs/glossary.md"
    ];

    for (const relative of requiredFiles) {
      await expectFile(path.join(cwd, ".context", relative));
    }

    const map = await expectFile(path.join(cwd, ".context", "MAP.md"));
    expect(map).toContain("TODO(ai-fill)");
    expect(map).toContain("## Natural Language Route");
    expect(map).not.toContain("chat");

    const verify = await expectFile(path.join(cwd, ".context", "VERIFY.md"));
    expect(verify).toContain("| test | `npm test` |");
  });

  test("verify reports missing required files as errors", async () => {
    const cwd = await createTempProject("verify-missing");

    const result = await runCmap(["verify"], cwd);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("Missing required file: .context/BRIEF.md");
    expect(result.stdout).toContain("Errors:");
  });

  test("verify accepts a freshly initialized context and warns about ai-fill placeholders", async () => {
    const cwd = await createTempProject("verify-init");
    await runCmap(["init", "--auto"], cwd);

    const result = await runCmap(["verify"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Structure: all required files exist");
    expect(result.stdout).toContain("TODO(ai-fill)");
    expect(result.stdout).toContain("Warnings:");
  });

  test("install --host both writes matching AGENTS and CLAUDE entrypoints", async () => {
    const cwd = await createTempProject("install");
    await runCmap(["init", "--auto"], cwd);

    const result = await runCmap(["install", "--host", "both"], cwd);

    expect(result).toMatchObject({ code: 0 });
    const agents = await expectFile(path.join(cwd, "AGENTS.md"));
    const claude = await expectFile(path.join(cwd, "CLAUDE.md"));

    expect(agents).toBe(claude);
    expect(agents).toContain("Read `.context/MAP.md`");
    expect(agents).toContain("cmap verify --changed");
  });
});
