import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createRoutableProject(): Promise<string> {
  const cwd = await createTempProject("m2-route");
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/features/chat"), { recursive: true });
  await mkdir(path.join(cwd, "src/features/notification"), { recursive: true });
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(
    path.join(cwd, ".context/modules/chat.md"),
    `---
context_type: module
module: chat
paths:
  - src/features/chat
aliases:
  - 多人对话
  - 聊天
  - 消息
  - conversation
  - message
confidence: ai-drafted
---
# Module: chat

## Purpose
Chat and message sending.
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/modules/notification.md"),
    `---
context_type: module
module: notification
paths:
  - src/features/notification
aliases:
  - 通知
  - 未读数
  - unread
confidence: ai-drafted
---
# Module: notification

## Purpose
Unread counters and notifications.
`,
    "utf8"
  );
  return cwd;
}

describe("M2 route/status/checkpoint", () => {
  test("route recommends modules by aliases and read-first files", async () => {
    const cwd = await createRoutableProject();

    const result = await runCmap(["route", "多人对话页面消息发不出去"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("## Route Result");
    expect(result.stdout).toContain("Task: 多人对话页面消息发不出去");
    expect(result.stdout).toContain("1. chat");
    expect(result.stdout).toContain("matched aliases: 多人对话, 消息");
    expect(result.stdout).toContain(".context/modules/chat.md");
    expect(result.stdout).not.toContain("billing");
  });

  test("route stays low confidence instead of inventing modules", async () => {
    const cwd = await createRoutableProject();

    const result = await runCmap(["route", "结算发票税率不对"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("No high-confidence module match");
    expect(result.stdout).toContain(".context/MAP.md");
    expect(result.stdout).toContain("update MAP.md aliases");
    expect(result.stdout).not.toContain("billing");
  });

  test("route does not match short ASCII aliases inside longer words", async () => {
    const cwd = await createRoutableProject();
    await writeFile(
      path.join(cwd, ".context/modules/verify.md"),
      `---
context_type: module
module: verify
paths:
  - src/commands/verify.ts
aliases:
  - check
confidence: ai-drafted
---
# Module: verify
`,
      "utf8"
    );

    const result = await runCmap(["route", "checkpoint should update status"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("No high-confidence module match");
    expect(result.stdout).not.toContain("1. verify");
  });

  test("status prints the current main thread from STATUS.md", async () => {
    const cwd = await createTempProject("m2-status");
    await runCmap(["init", "--auto"], cwd);
    const statusPath = path.join(cwd, ".context/STATUS.md");
    const status = await readFile(statusPath, "utf8");
    await writeFile(
      statusPath,
      status
        .replace("TODO(ai-fill)", "Implement route and checkpoint")
        .replace("TODO(ai-fill)", "M1 complete")
        .replace("TODO(ai-fill)", "Before M2 implementation")
        .replace("TODO(ai-fill)", "Write failing M2 tests"),
      "utf8"
    );

    const result = await runCmap(["status"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("# Status");
    expect(result.stdout).toContain("Implement route and checkpoint");
    expect(result.stdout).toContain("Write failing M2 tests");
  });

  test("checkpoint updates STATUS.md from explicit fields", async () => {
    const cwd = await createTempProject("m2-checkpoint");
    await runCmap(["init", "--auto"], cwd);

    const result = await runCmap(
      [
        "checkpoint",
        "--goal",
        "Implement route",
        "--done",
        "M1 complete",
        "--left-off",
        "Route tests are red",
        "--next",
        "Parse module aliases",
        "--files",
        "src/commands/route.ts,tests/integration/m2.test.ts",
        "--risks",
        "Do not infer project semantics",
        "--verified",
        "M2 tests red before implementation"
      ],
      cwd
    );

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Updated .context/STATUS.md");
    const updated = await expectFile(path.join(cwd, ".context/STATUS.md"));
    expect(updated).toContain("## Active Goal\nImplement route");
    expect(updated).toContain("## Done Recently\nM1 complete");
    expect(updated).toContain("## Left Off\nRoute tests are red");
    expect(updated).toContain("- src/commands/route.ts");
    expect(updated).toContain("- tests/integration/m2.test.ts");
    expect(updated).toContain("M2 tests red before implementation");
  });

  test("checkpoint write/read/close maintains CHECKPOINT.md without touching STATUS.md", async () => {
    const cwd = await createTempProject("m2-current-checkpoint");
    await runCmap(["init", "--auto"], cwd);
    const statusBefore = await expectFile(path.join(cwd, ".context/STATUS.md"));

    const writeResult = await runCmap(
      [
        "checkpoint",
        "write",
        "--task",
        "Implement explicit checkpoint workflow",
        "--hypothesis",
        "Briefs should prefer CHECKPOINT.md over STATUS.md",
        "--files",
        "src/commands/checkpoint.ts,src/commands/brief.ts",
        "--verified",
        "Targeted tests pending",
        "--failed",
        "Full suite not run yet",
        "--next",
        "Update project map docs",
        "--do-not-redo",
        "Do not regenerate the Obsidian view as canonical facts"
      ],
      cwd
    );

    expect(writeResult).toMatchObject({ code: 0 });
    expect(writeResult.stdout).toContain("Updated .context/CHECKPOINT.md");
    expect(await expectFile(path.join(cwd, ".context/STATUS.md"))).toBe(statusBefore);

    const checkpoint = await expectFile(path.join(cwd, ".context/CHECKPOINT.md"));
    expect(checkpoint).toContain("context_type: checkpoint");
    expect(checkpoint).toContain("status: active");
    expect(checkpoint).toContain("## Current Task\nImplement explicit checkpoint workflow");
    expect(checkpoint).toContain("- src/commands/checkpoint.ts");
    expect(checkpoint).toContain("- src/commands/brief.ts");
    expect(checkpoint).toContain("## Next Step\nUpdate project map docs");
    expect(checkpoint).toContain("Do not regenerate the Obsidian view as canonical facts");

    const readResult = await runCmap(["checkpoint", "read"], cwd);
    expect(readResult).toMatchObject({ code: 0 });
    expect(readResult.stdout).toContain("# Current Checkpoint");
    expect(readResult.stdout).toContain("Implement explicit checkpoint workflow");

    const closeResult = await runCmap(["checkpoint", "close"], cwd);
    expect(closeResult).toMatchObject({ code: 0 });
    expect(closeResult.stdout).toContain("Closed .context/CHECKPOINT.md");
    const closed = await expectFile(path.join(cwd, ".context/CHECKPOINT.md"));
    expect(closed).toContain("status: closed");
    expect(closed).toContain("Implement explicit checkpoint workflow");
  });

  test("checkpoint rejects unknown actions", async () => {
    const cwd = await createTempProject("m2-checkpoint-unknown");
    await runCmap(["init", "--auto"], cwd);

    const result = await runCmap(["checkpoint", "unknown"], cwd);

    expect(result).toMatchObject({ code: 2 });
    expect(result.stderr).toContain("unknown checkpoint action: unknown");
  });
});
