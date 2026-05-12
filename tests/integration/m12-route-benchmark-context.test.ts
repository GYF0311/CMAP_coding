import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, runCmap } from "../helpers.js";

async function createBenchmarkProject(name: string): Promise<string> {
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
relations:
  depends_on:
    - auth
confidence: ai-drafted
---
# Module: chat
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
`,
    "utf8"
  );
  await mkdir(path.join(cwd, "bench"), { recursive: true });
  return cwd;
}

describe("M12 route benchmark context metrics", () => {
  test("benchmark route reports expected context module hits separately from direct hits", async () => {
    const cwd = await createBenchmarkProject("m12-context-hit");
    await writeFile(
      path.join(cwd, "bench/tasks.jsonl"),
      [
        JSON.stringify({
          task: "聊天发送失败",
          expected_modules: ["chat"],
          expected_context_modules: ["auth"],
          bad_modules: ["billing"]
        }),
        JSON.stringify({
          task: "auth session broken",
          expected_modules: ["auth"],
          bad_modules: ["chat"]
        })
      ].join("\n"),
      "utf8"
    );

    const result = await runCmap(["benchmark", "route", "--file", "bench/tasks.jsonl"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Cases: 2");
    expect(result.stdout).toContain("context=hit");
    expect(result.stdout).toContain("context=unchecked");
    expect(result.stdout).toContain("Context: 1/1 (100%)");
    expect(result.stdout).toContain("Top-1: 2/2");
    expect(result.stdout).toContain("Bad-module hits: 0/2");
  });
});
