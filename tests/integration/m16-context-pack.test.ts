import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createPackProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/chat"), { recursive: true });
  await mkdir(path.join(cwd, "src/auth"), { recursive: true });
  await mkdir(path.join(cwd, "src/billing"), { recursive: true });
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(path.join(cwd, "src/chat/send.ts"), "export const send = true;\n", "utf8");
  await writeFile(path.join(cwd, "src/auth/session.ts"), "export const session = true;\n", "utf8");
  await writeFile(path.join(cwd, "src/billing/pay.ts"), "export const pay = true;\n", "utf8");
  await writeFile(
    path.join(cwd, ".context/CHECKPOINT.md"),
    "# Current Checkpoint\n\n## Current Task\n\nFix chat send failure.\n\n## Next Step\n\nRead chat and auth modules.\n",
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/DECISIONS.md"),
    "# Decisions\n\napi_key: SECRET_VALUE_SHOULD_NOT_LEAK\n\nAuth failures can look like chat send failures.\n",
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/modules/chat.md"),
    `---
context_type: module
module: chat
paths:
  - src/chat
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
- \`pnpm test tests/chat-send.test.ts\`
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/modules/auth.md"),
    `---
context_type: module
module: auth
paths:
  - src/auth
aliases:
  - auth
  - 登录
confidence: ai-drafted
---
# Module: auth

## Purpose
Own auth session state.

## Tests / Verification
- \`pnpm test tests/auth-session.test.ts\`
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/modules/billing.md"),
    `---
context_type: module
module: billing
paths:
  - src/billing
aliases:
  - billing
confidence: ai-drafted
---
# Module: billing

## Purpose
Billing module should not be packed for chat tasks.
`,
    "utf8"
  );
  return cwd;
}

describe("M16 context pack", () => {
  test("pack writes a budgeted routed graph neighborhood with redacted secrets", async () => {
    const cwd = await createPackProject("m16-pack");

    const result = await runCmap([
      "pack",
      "聊天消息发不出去",
      "--budget",
      "900",
      "--format",
      "markdown",
      "--out",
      ".context/out/pack.md"
    ], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote .context/out/pack.md");
    const pack = await expectFile(path.join(cwd, ".context/out/pack.md"));
    expect(pack).toContain("# cmap Context Pack");
    expect(pack).toContain("Approx token budget: 900");
    expect(pack).toContain("## Current Checkpoint");
    expect(pack).toContain("### chat");
    expect(pack).toContain("Own chat message sending.");
    expect(pack).toContain("### auth");
    expect(pack).toContain("Own auth session state.");
    expect(pack).toContain("pnpm test tests/chat-send.test.ts");
    expect(pack).toContain("pnpm test tests/auth-session.test.ts");
    expect(pack).not.toContain("Billing module should not be packed");
    expect(pack).not.toContain("SECRET_VALUE_SHOULD_NOT_LEAK");
    expect(pack).toContain("api_key: [REDACTED]");
  });

  test("pack enforces a deterministic approximate token budget", async () => {
    const cwd = await createPackProject("m16-pack-budget");

    const result = await runCmap(["pack", "聊天消息发不出去", "--budget", "70"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout.length).toBeLessThanOrEqual(70 * 4);
    expect(result.stdout).toContain("Truncated to fit budget");
  });
});
