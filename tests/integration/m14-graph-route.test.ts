import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createGraphProject(name: string): Promise<string> {
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
relation_explanations:
  depends_on:
    auth:
      why: Chat sends need authenticated sessions.
      produces: Authenticated chat delivery.
      impact: Auth changes can affect chat routing.
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
  return cwd;
}

describe("M14 graph build and graph-aware route", () => {
  test("graph build writes module, file, edge, and meta projections", async () => {
    const cwd = await createGraphProject("m14-graph-build");

    const result = await runCmap(["graph", "build"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote .context/graph/modules.json");
    const modules = JSON.parse(await expectFile(path.join(cwd, ".context/graph/modules.json"))) as Record<string, { doc: string }>;
    const files = JSON.parse(await expectFile(path.join(cwd, ".context/graph/files.json"))) as Record<string, { modules: string[] }>;
    const edges = JSON.parse(await expectFile(path.join(cwd, ".context/graph/edges.json"))) as Array<{ from: string; to: string; type: string }>;
    const meta = JSON.parse(await expectFile(path.join(cwd, ".context/graph/graph.meta.json"))) as { module_count: number; edge_count: number };
    expect(modules.chat.doc).toBe(".context/modules/chat.md");
    expect(files["src/features/chat"].modules).toContain("chat");
    expect(edges).toContainEqual(expect.objectContaining({ from: "chat", to: "auth", type: "depends_on" }));
    expect(meta.module_count).toBe(2);
    expect(meta.edge_count).toBe(1);
  });

  test("graph explain reports module files and typed relations", async () => {
    const cwd = await createGraphProject("m14-graph-explain");

    const result = await runCmap(["graph", "explain", "chat"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# Graph Explain: chat");
    expect(result.stdout).toContain("src/features/chat");
    expect(result.stdout).toContain("depends_on -> auth");
  });

  test("route --graph exposes graph mode without changing direct route labels", async () => {
    const cwd = await createGraphProject("m14-route-graph");

    const result = await runCmap(["route", "聊天发送失败", "--graph", "--format", "json"], cwd);

    expect(result.code).toBe(0);
    const json = JSON.parse(result.stdout) as {
      graphMode: boolean;
      modules: Array<{ id: string }>;
      contextModules: Array<{ id: string; source: string; relation?: { type: string; from: string } }>;
    };
    expect(json.graphMode).toBe(true);
    expect(json.modules.map((item) => item.id)).toEqual(["chat"]);
    expect(json.contextModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "auth", source: "related", relation: { type: "depends_on", from: "chat" } })
      ])
    );
  });
});
