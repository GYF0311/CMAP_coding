import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createInitializedProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  return cwd;
}

describe("M3 cp/log/idea/finish", () => {
  test("cp copy copies an existing line range to the target end", async () => {
    const cwd = await createInitializedProject("m3-cp-copy");
    await writeFile(path.join(cwd, "source.md"), "alpha\nbeta\ngamma\n", "utf8");
    await writeFile(path.join(cwd, "target.md"), "one\n", "utf8");

    const result = await runCmap(["cp", "copy", "source.md:2-3", "target.md:end"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Copied 2 lines");
    await expect(readFile(path.join(cwd, "source.md"), "utf8")).resolves.toBe("alpha\nbeta\ngamma\n");
    await expect(readFile(path.join(cwd, "target.md"), "utf8")).resolves.toBe("one\nbeta\ngamma\n");
  });

  test("cp move removes source lines, inserts them, and can restore from backup", async () => {
    const cwd = await createInitializedProject("m3-cp-move");
    await writeFile(path.join(cwd, "source.md"), "alpha\nbeta\ngamma\n", "utf8");
    await writeFile(path.join(cwd, "target.md"), "one\n", "utf8");

    const move = await runCmap(["cp", "move", "source.md:2-2", "target.md:end"], cwd);

    expect(move).toMatchObject({ code: 0 });
    expect(move.stdout).toContain("Moved 1 lines");
    const backupId = /Backup: ([a-z0-9-]+)/.exec(move.stdout)?.[1];
    expect(backupId).toBeTruthy();
    await expect(readFile(path.join(cwd, "source.md"), "utf8")).resolves.toBe("alpha\ngamma\n");
    await expect(readFile(path.join(cwd, "target.md"), "utf8")).resolves.toBe("one\nbeta\n");

    const restore = await runCmap(["cp", "restore", backupId!], cwd);

    expect(restore).toMatchObject({ code: 0 });
    expect(restore.stdout).toContain("Restored backup");
    await expect(readFile(path.join(cwd, "source.md"), "utf8")).resolves.toBe("alpha\nbeta\ngamma\n");
    await expect(readFile(path.join(cwd, "target.md"), "utf8")).resolves.toBe("one\n");
  });

  test("cp delete refuses paths outside the project", async () => {
    const cwd = await createInitializedProject("m3-cp-safe-path");

    const result = await runCmap(["cp", "delete", "../outside.md:1-1"], cwd);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Path escapes project root");
  });

  test("log add appends an explicit work log entry", async () => {
    const cwd = await createInitializedProject("m3-log");

    const result = await runCmap(["log", "add", "Fixed chat retry handling"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Appended .context/logs/current.md");
    const log = await expectFile(path.join(cwd, ".context/logs/current.md"));
    expect(log).toContain("Fixed chat retry handling");
    expect(log).toContain("**Result:** Fixed chat retry handling");
  });

  test("idea add appends to ideas inbox without changing MAP", async () => {
    const cwd = await createInitializedProject("m3-idea");
    const mapBefore = await readFile(path.join(cwd, ".context/MAP.md"), "utf8");

    const result = await runCmap(["idea", "add", "Generate Mermaid graph from MAP"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Appended .context/ideas/_inbox.md");
    const inbox = await expectFile(path.join(cwd, ".context/ideas/_inbox.md"));
    expect(inbox).toContain("Generate Mermaid graph from MAP");
    await expect(readFile(path.join(cwd, ".context/MAP.md"), "utf8")).resolves.toBe(mapBefore);
  });

  test("finish prints a QA-lite context report without modifying trusted memory", async () => {
    const cwd = await createInitializedProject("m3-finish");
    await mkdir(path.join(cwd, "src/features/chat"), { recursive: true });
    await writeFile(path.join(cwd, "src/features/chat/send.ts"), "export const send = () => true;\n", "utf8");
    await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/modules/chat.md"),
      `---
context_type: module
module: chat
paths:
  - src/features/chat
aliases:
  - chat
confidence: ai-drafted
---
# Module: chat
`,
      "utf8"
    );
    const statusBefore = await readFile(path.join(cwd, ".context/STATUS.md"), "utf8");

    const result = await runCmap(["finish", "--changed", "src/features/chat/send.ts"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("# Finish Report");
    expect(result.stdout).toContain("chat");
    expect(result.stdout).toContain("STATUS.md");
    expect(result.stdout).toContain("CHECKPOINT.md");
    expect(result.stdout).toContain("cmap checkpoint close");
    expect(result.stdout).toContain("cmap verify --changed");
    await expect(readFile(path.join(cwd, ".context/STATUS.md"), "utf8")).resolves.toBe(statusBefore);
  });
});
