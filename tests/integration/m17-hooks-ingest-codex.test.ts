import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap, cliPath, tsxBin } from "../helpers.js";

const execFileAsync = promisify(execFile);

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

  test("codex start can write brief and pack artifacts for one-command startup context", async () => {
    const cwd = await createCodexHookProject("m17-codex-start-artifacts");

    const result = await runCmap(["codex", "start", "route 模块定位", "--write-brief", "--write-pack"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote .context/out/brief.md");
    expect(result.stdout).toContain("Wrote .context/out/pack.md");
    expect(await expectFile(path.join(cwd, ".context/out/brief.md"))).toContain("# AI Coding Brief");
    expect(await expectFile(path.join(cwd, ".context/out/pack.md"))).toContain("# cmap Context Pack");
  });

  test("codex handoff writes checkpoint status and inbox snapshot", async () => {
    const cwd = await createCodexHookProject("m17-codex-handoff");

    const result = await runCmap(["codex", "handoff"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# cmap Codex Handoff");
    expect(result.stdout).toContain("Suggested Next Commands");
    const handoff = await expectFile(path.join(cwd, ".context/out/codex-handoff.md"));
    expect(handoff).toContain("# cmap Codex Handoff");
    expect(handoff).toContain("cmap codex guard --changed");
  });

  test("codex finish uses compact output and recommends one aggregated guard", async () => {
    const cwd = await createCodexHookProject("m17-codex-finish-compact");
    await execFileAsync("git", ["init", "-q"], { cwd });
    await execFileAsync("git", ["config", "user.name", "CMAP Test"], { cwd });
    await execFileAsync("git", ["config", "user.email", "cmap-test@example.invalid"], { cwd });
    await execFileAsync("git", ["add", "."], { cwd });
    await execFileAsync("git", ["commit", "-qm", "baseline"], { cwd });
    await Promise.all(Array.from({ length: 100 }, (_, index) =>
      writeFile(
        path.join(cwd, `unmapped-${String(index + 1).padStart(3, "0")}-representative-long-file-name.ts`),
        "export {};\n",
        "utf8"
      )
    ));

    const result = await runCmap(["codex", "finish", "--task", "Bound AI closeout output"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# Finish Summary");
    expect(result.stdout).toContain("Changed files: 100");
    expect(result.stdout).toContain("Unmapped files: 100");
    expect(result.stdout).toContain("cmap codex guard --changed");
    expect(result.stdout).not.toContain("cmap verify --stale");
    expect(result.stdout).not.toContain("cmap verify --freshness");
    expect(result.stdout).not.toContain("cmap inbox status");
    expect(result.stdout.split("\n").length).toBeLessThan(40);
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThan(2048);

    const guard = await runCmap(["codex", "guard", "--changed"], cwd);

    expect(guard.code).toBe(0);
    expect(guard.stdout).toContain("# Codex Guard Summary");
    expect(guard.stdout).toContain("Changed coverage:");
    expect(guard.stdout).toContain("Stale:");
    expect(guard.stdout).toContain("Freshness:");
    expect(guard.stdout).toContain("Full details: cmap codex guard --changed --verbose");
    expect(guard.stdout.split("\n").length).toBeLessThan(20);
    expect(Buffer.byteLength(guard.stdout, "utf8")).toBeLessThan(1024);
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
    expect(output.hookSpecificOutput?.additionalContext).toBeUndefined();
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThan(100);
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
