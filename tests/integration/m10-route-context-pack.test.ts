import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createContextPackProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/features/chat"), { recursive: true });
  await mkdir(path.join(cwd, "src/features/auth"), { recursive: true });
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(path.join(cwd, "src/features/chat/send.ts"), "export const send = true;\n", "utf8");
  await writeFile(path.join(cwd, "src/features/auth/session.ts"), "export const session = true;\n", "utf8");
  await writeFile(
    path.join(cwd, ".context/modules/chat.md"),
    `---
context_type: module
module: chat
paths:
  - src/features/chat
aliases:
  - chat
  - 聊天
  - 消息
relations:
  depends_on:
    - auth
confidence: ai-drafted
---
# Module: chat

## Purpose
Own chat message sending.

## Tests / Verification
- \`pnpm test tests/integration/chat-send.test.ts\`
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/modules/auth.md"),
    `---
context_type: module
module: auth
paths:
  - src/features/auth
aliases:
  - auth
  - 登录
confidence: ai-drafted
---
# Module: auth

## Purpose
Own login and session state.

## Tests / Verification
- \`pnpm test tests/integration/auth-session.test.ts\`
`,
    "utf8"
  );
  return cwd;
}

describe("M10 route context pack", () => {
  test("route keeps direct matches separate from graph-related context modules", async () => {
    const cwd = await createContextPackProject("m10-route-context");

    const result = await runCmap(["route", "聊天消息发不出去"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Likely modules:");
    expect(result.stdout).toContain("1. chat");
    expect(result.stdout).not.toContain("2. auth");
    expect(result.stdout).toContain("Related context:");
    expect(result.stdout).toContain("auth — related via depends_on from chat");
    expect(result.stdout).toContain(".context/modules/auth.md");
  });

  test("route json exposes contextModules and suggested verification commands", async () => {
    const cwd = await createContextPackProject("m10-route-json");

    const result = await runCmap(["route", "聊天消息发不出去", "--format", "json"], cwd);

    expect(result.code).toBe(0);
    const json = JSON.parse(result.stdout) as {
      modules: Array<{ id: string }>;
      contextModules: Array<{ id: string; source: string; relation?: { type: string; from: string } }>;
      verifyCommands: string[];
      readFirst: string[];
    };
    expect(json.modules.map((item) => item.id)).toEqual(["chat"]);
    expect(json.contextModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "chat", source: "direct" }),
        expect.objectContaining({ id: "auth", source: "related", relation: { type: "depends_on", from: "chat" } })
      ])
    );
    expect(json.verifyCommands).toContain("pnpm test tests/integration/chat-send.test.ts");
    expect(json.verifyCommands).toContain("pnpm test tests/integration/auth-session.test.ts");
    expect(json.readFirst).toContain(".context/modules/auth.md");
  });

  test("brief includes graph-related module context and suggested verification commands", async () => {
    const cwd = await createContextPackProject("m10-brief-context");

    const result = await runCmap(["brief", "聊天消息发不出去", "--out", ".context/out/brief.md"], cwd);

    expect(result.code).toBe(0);
    const brief = await expectFile(path.join(cwd, ".context/out/brief.md"));
    expect(brief).toContain("### chat");
    expect(brief).toContain("Own chat message sending.");
    expect(brief).toContain("### auth");
    expect(brief).toContain("Own login and session state.");
    expect(brief).toContain("pnpm test tests/integration/chat-send.test.ts");
    expect(brief).toContain("pnpm test tests/integration/auth-session.test.ts");
  });
});
