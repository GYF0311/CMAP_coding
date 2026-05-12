import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createLargeContextProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/features/chat"), { recursive: true });
  await mkdir(path.join(cwd, "src/features/auth"), { recursive: true });
  await mkdir(path.join(cwd, "src/features/storage"), { recursive: true });
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(path.join(cwd, "src/features/chat/send.ts"), "export const send = true;\n", "utf8");
  await writeFile(path.join(cwd, "src/features/auth/session.ts"), "export const session = true;\n", "utf8");
  await writeFile(path.join(cwd, "src/features/storage/messages.ts"), "export const messages = true;\n", "utf8");
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
relations:
  depends_on:
    - auth
    - storage
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
confidence: ai-drafted
---
# Module: auth

## Purpose
Own login session state.

## Tests / Verification
- \`pnpm test tests/integration/auth-session.test.ts\`
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/modules/storage.md"),
    `---
context_type: module
module: storage
paths:
  - src/features/storage
aliases:
  - storage
confidence: ai-drafted
---
# Module: storage

## Purpose
Own persisted chat messages.

## Tests / Verification
- \`pnpm test tests/integration/message-storage.test.ts\`
`,
    "utf8"
  );
  return cwd;
}

describe("M11 context size controls", () => {
  test("route --max-context 1 keeps only the direct context module", async () => {
    const cwd = await createLargeContextProject("m11-route-one");

    const result = await runCmap(["route", "聊天发送失败", "--format", "json", "--max-context", "1"], cwd);

    expect(result.code).toBe(0);
    const json = JSON.parse(result.stdout) as {
      contextModules: Array<{ id: string }>;
      readFirst: string[];
      verifyCommands: string[];
    };
    expect(json.contextModules.map((item) => item.id)).toEqual(["chat"]);
    expect(json.readFirst).toContain(".context/modules/chat.md");
    expect(json.readFirst).not.toContain(".context/modules/auth.md");
    expect(json.verifyCommands).toEqual(["pnpm test tests/integration/chat-send.test.ts"]);
  });

  test("route --max-context 2 includes one related module and excludes the rest", async () => {
    const cwd = await createLargeContextProject("m11-route-two");

    const result = await runCmap(["route", "聊天发送失败", "--format", "json", "--max-context", "2"], cwd);

    expect(result.code).toBe(0);
    const json = JSON.parse(result.stdout) as {
      contextModules: Array<{ id: string; source: string }>;
      verifyCommands: string[];
    };
    expect(json.contextModules).toEqual([
      expect.objectContaining({ id: "chat", source: "direct" }),
      expect.objectContaining({ id: "auth", source: "related" })
    ]);
    expect(json.verifyCommands).toContain("pnpm test tests/integration/auth-session.test.ts");
    expect(json.verifyCommands).not.toContain("pnpm test tests/integration/message-storage.test.ts");
  });

  test("brief --max-context 1 includes only the direct module body", async () => {
    const cwd = await createLargeContextProject("m11-brief-one");

    const result = await runCmap(["brief", "聊天发送失败", "--max-context", "1", "--out", ".context/out/brief.md"], cwd);

    expect(result.code).toBe(0);
    const brief = await expectFile(path.join(cwd, ".context/out/brief.md"));
    expect(brief).toContain("### chat");
    expect(brief).toContain("Own chat message sending.");
    expect(brief).not.toContain("### auth");
    expect(brief).not.toContain("### storage");
  });

  test("route rejects invalid max context values", async () => {
    const cwd = await createLargeContextProject("m11-route-invalid");

    const result = await runCmap(["route", "聊天发送失败", "--max-context", "0"], cwd);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Invalid --max-context");
  });
});
