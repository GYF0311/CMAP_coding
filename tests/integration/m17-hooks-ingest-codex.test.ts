import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap, cliPath, tsxBin } from "../helpers.js";

async function createCodexHookProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/commands"), { recursive: true });
  await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = true;\n", "utf8");
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(
    path.join(cwd, ".context/modules/route.md"),
    `---
context_type: module
module: route
paths:
  - src/commands/route.ts
aliases:
  - route
confidence: ai-drafted
---
# Module: route

## Purpose
Recommend module docs for a task.
`,
    "utf8"
  );
  return cwd;
}

async function runCmapWithStdin(args: string[], cwd: string, stdin: unknown): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(tsxBin, [cliPath, ...args], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
    child.stdin.end(JSON.stringify(stdin));
  });
}

describe("M17 Codex-first hook ingest", () => {
  test("codex start is an explicit workflow that writes a non-canonical startup brief", async () => {
    const cwd = await createCodexHookProject("m17-codex-start");

    const result = await runCmap(["codex", "start", "route 模块定位"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# cmap Codex Start");
    expect(result.stdout).toContain("explicit Codex workflow entrypoint");
    expect(result.stdout).toContain(".context/modules/route.md");
    const brief = await expectFile(path.join(cwd, ".context/out/codex-start.md"));
    expect(brief).toContain("# cmap Codex Start");
    expect(brief).toContain("route 模块定位");
    expect(brief).toContain("does not depend on Codex hook parity");
  });

  test("hooks render writes Codex lifecycle settings that call hooks ingest", async () => {
    const cwd = await createCodexHookProject("m17-render-codex");

    const result = await runCmap(["hooks", "render", "--host", "codex", "--mode", "assist"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(".codex/hooks.json");
    const settings = await expectFile(path.join(cwd, ".codex/hooks.json"));
    expect(settings).toContain("UserPromptSubmit");
    expect(settings).toContain("PreToolUse");
    expect(settings).toContain("PostToolUse");
    expect(settings).toContain("Stop");
    expect(settings).toContain("cmap hooks ingest --host codex --event UserPromptSubmit --mode assist");
  });

  test("Codex UserPromptSubmit ingest writes session brief and returns additionalContext JSON", async () => {
    const cwd = await createCodexHookProject("m17-user-prompt");

    const result = await runCmapWithStdin(
      ["hooks", "ingest", "--host", "codex", "--event", "UserPromptSubmit", "--mode", "assist"],
      cwd,
      {
        session_id: "s1",
        turn_id: "t1",
        hook_event_name: "UserPromptSubmit",
        cwd,
        model: "gpt-test",
        prompt: "route 模块定位"
      }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    expect(output.hookSpecificOutput?.hookEventName).toBe("UserPromptSubmit");
    expect(output.hookSpecificOutput?.additionalContext).toContain(".context/modules/route.md");
    const brief = await expectFile(path.join(cwd, ".context/out/session-brief.md"));
    expect(brief).toContain("# cmap Session Brief");
    expect(brief).toContain("route 模块定位");
    expect(brief).toContain(".context/modules/route.md");
    const journal = await expectFile(path.join(cwd, ".context/logs/session-events.jsonl"));
    expect(journal).toContain("\"host\":\"codex\"");
    expect(journal).toContain("\"event\":\"UserPromptSubmit\"");
  });

  test("Codex strict PreToolUse denies direct semantic canonical writes", async () => {
    const cwd = await createCodexHookProject("m17-pretool-strict");

    const result = await runCmapWithStdin(
      ["hooks", "ingest", "--host", "codex", "--event", "PreToolUse", "--mode", "strict"],
      cwd,
      {
        session_id: "s1",
        turn_id: "t1",
        hook_event_name: "PreToolUse",
        cwd,
        tool_name: "apply_patch",
        tool_input: {
          command: "*** Begin Patch\n*** Update File: .context/modules/route.md\n+bad\n*** End Patch"
        }
      }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; permissionDecision?: string; permissionDecisionReason?: string };
    };
    expect(output.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
    expect(output.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(output.hookSpecificOutput?.permissionDecisionReason).toContain("direct semantic canonical writes are blocked");
    const journal = await expectFile(path.join(cwd, ".context/logs/session-events.jsonl"));
    expect(journal).toContain("\"tool\":\"apply_patch\"");
  });

  test("Codex PostToolUse ingest records real tool and file details", async () => {
    const cwd = await createCodexHookProject("m17-posttool");

    const result = await runCmapWithStdin(
      ["hooks", "ingest", "--host", "codex", "--event", "PostToolUse", "--mode", "observe"],
      cwd,
      {
        session_id: "s1",
        turn_id: "t1",
        hook_event_name: "PostToolUse",
        cwd,
        tool_name: "Bash",
        tool_input: { command: "sed -n '1,20p' src/commands/route.ts" },
        tool_response: { exit_code: 0 }
      }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout) as { hookSpecificOutput?: { hookEventName?: string; additionalContext?: string } };
    expect(output.hookSpecificOutput?.hookEventName).toBe("PostToolUse");
    expect(output.hookSpecificOutput?.additionalContext).toContain("Recorded Codex PostToolUse");
    const journal = await expectFile(path.join(cwd, ".context/logs/session-events.jsonl"));
    expect(journal).toContain("\"tool\":\"Bash\"");
    expect(journal).toContain("sed -n");
  });

  test("Codex Stop ingest tolerates missing optional payload fields", async () => {
    const cwd = await createCodexHookProject("m17-stop-empty-payload");

    const result = await runCmapWithStdin(
      ["hooks", "ingest", "--host", "codex", "--event", "Stop", "--mode", "assist"],
      cwd,
      {}
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout) as { systemMessage?: string };
    expect(output.systemMessage).toContain("recorded the session closeout");
    const journal = await expectFile(path.join(cwd, ".context/logs/session-events.jsonl"));
    expect(journal).toContain("\"host\":\"codex\"");
    expect(journal).toContain("\"event\":\"Stop\"");
  });
});
