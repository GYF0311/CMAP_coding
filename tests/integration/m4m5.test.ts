import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

describe("M4/M5 adopt/add-module/doctor/hooks", () => {
  test("adopt creates an adoption workspace with candidate signals but no trusted module facts", async () => {
    const cwd = await createTempProject("m4-adopt");
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify({ scripts: { test: "vitest run", build: "vite build" }, dependencies: { vite: "latest" } }),
      "utf8"
    );
    await mkdir(path.join(cwd, "src/features/chat"), { recursive: true });
    await writeFile(path.join(cwd, "README.md"), "# Existing App\n", "utf8");

    const result = await runCmap(["adopt"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Created .context adoption workspace");
    const adoption = await expectFile(path.join(cwd, ".context/ADOPTION.md"));
    expect(adoption).toContain("Detected stack");
    expect(adoption).toContain("package.json");
    expect(adoption).toContain("src/features/chat");
    expect(adoption).toContain("confidence: candidate");
    const map = await expectFile(path.join(cwd, ".context/MAP.md"));
    expect(map).toContain("TODO(ai-fill)");
    expect(map).not.toContain("src/features/chat |");
  });

  test("add-module creates a candidate module doc without editing MAP", async () => {
    const cwd = await createTempProject("m4-add-module");
    await runCmap(["init", "--auto"], cwd);
    const mapBefore = await readFile(path.join(cwd, ".context/MAP.md"), "utf8");

    const result = await runCmap(
      ["add-module", "chat", "--path", "src/features/chat", "--alias", "聊天", "--alias", "message"],
      cwd
    );

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Created .context/modules/chat.md");
    const moduleDoc = await expectFile(path.join(cwd, ".context/modules/chat.md"));
    expect(moduleDoc).toContain("module: chat");
    expect(moduleDoc).toContain("confidence: candidate");
    expect(moduleDoc).toContain("- src/features/chat");
    expect(moduleDoc).toContain("- 聊天");
    expect(moduleDoc).toContain("## Heading Contract");
    expect(moduleDoc).toContain("## Key Contracts");
    expect(moduleDoc).toContain("## Read Next");
    await expect(readFile(path.join(cwd, ".context/MAP.md"), "utf8")).resolves.toBe(mapBefore);
  });

  test("install --hooks reminder writes project-local hook templates and doctor sees them", async () => {
    const cwd = await createTempProject("m5-hooks");
    await runCmap(["init", "--auto"], cwd);

    const install = await runCmap(["install", "--host", "both", "--hooks", "reminder"], cwd);

    expect(install).toMatchObject({ code: 0 });
    expect(install.stdout).toContain("Installed hook templates");
    const claudeHook = await expectFile(path.join(cwd, ".context/hooks/claude-reminder.json"));
    const codexHook = await expectFile(path.join(cwd, ".context/hooks/codex-reminder.json"));
    expect(claudeHook).toContain("cmap hooks session-start --profile reminder");
    expect(codexHook).toContain("statusMessage");

    const doctor = await runCmap(["doctor"], cwd);

    expect(doctor).toMatchObject({ code: 0 });
    expect(doctor.stdout).toContain("Context: present");
    expect(doctor.stdout).toContain("Entrypoints: AGENTS.md and CLAUDE.md match");
    expect(doctor.stdout).toContain("Hooks: reminder templates present");
  });

  test("hooks output reminders and never modify trusted memory", async () => {
    const cwd = await createTempProject("m5-hooks-output");
    await runCmap(["init", "--auto"], cwd);
    const mapBefore = await readFile(path.join(cwd, ".context/MAP.md"), "utf8");

    const start = await runCmap(["hooks", "session-start", "--profile", "reminder"], cwd);
    const stop = await runCmap(["hooks", "stop", "--profile", "maintain"], cwd);

    expect(start).toMatchObject({ code: 0 });
    expect(start.stdout).toContain("Read .context/MAP.md");
    expect(stop).toMatchObject({ code: 0 });
    expect(stop.stdout).toContain("cmap maintain reminder");
    expect(stop.stdout).toContain("cmap verify --changed");
    await expect(readFile(path.join(cwd, ".context/MAP.md"), "utf8")).resolves.toBe(mapBefore);
  });
});
