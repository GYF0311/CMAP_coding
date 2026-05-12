import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createUpdateProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/commands"), { recursive: true });
  await writeFile(path.join(cwd, "src/commands/update.ts"), "export const update = true;\n", "utf8");
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

async function writePatch(cwd: string, name: string, patch: unknown): Promise<string> {
  const target = path.join(cwd, name);
  await writeFile(target, JSON.stringify(patch, null, 2), "utf8");
  return name;
}

function routinePatch(): unknown {
  return {
    schema: "cmap.map_patch.v1",
    agent: "codex",
    summary: "Update routine checkpoint and route a semantic decision candidate.",
    task: "Ship MapPatch intake",
    operations: [
      {
        op: "checkpoint.write",
        target: ".context/CHECKPOINT.md",
        risk: "routine",
        confidence: 0.9,
        summary: "Record explicit task handoff.",
        evidence: ["src/commands/update.ts"],
        fields: {
          task: "Ship MapPatch intake",
          next: "Run focused update-agent tests.",
          files: ["src/commands/update.ts"],
          verified: "pnpm typecheck"
        }
      },
      {
        op: "decision.record",
        target: ".context/DECISIONS.md",
        risk: "high",
        confidence: 0.8,
        summary: "Keep semantic decisions out of automatic writes.",
        evidence: ["src/commands/update.ts"],
        fields: {}
      }
    ]
  };
}

describe("M7 agent MapPatch update", () => {
  test("update --agent dry-run classifies routine and high-risk operations without writing canonical facts", async () => {
    const cwd = await createUpdateProject("m7-dry-run");
    const patchPath = await writePatch(cwd, "patch.json", routinePatch());
    const before = await expectFile(path.join(cwd, ".context/CHECKPOINT.md"));

    const result = await runCmap(["update", "--agent", "--from", patchPath, "--dry-run"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("# MapPatch Dry Run");
    expect(result.stdout).toContain("This report classifies AI-authored updates");
    expect(result.stdout).toContain("## Routine Auto-Apply");
    expect(result.stdout).toContain("checkpoint.write -> `.context/CHECKPOINT.md`");
    expect(result.stdout).toContain("## Routed to Inbox");
    expect(result.stdout).toContain("decision.record -> `.context/DECISIONS.md`");
    await expect(expectFile(path.join(cwd, ".context/CHECKPOINT.md"))).resolves.toBe(before);
  });

  test("update --agent --apply-routine writes checkpoint, audit, backup, and routes semantic candidates to inbox", async () => {
    const cwd = await createUpdateProject("m7-apply");
    const patchPath = await writePatch(cwd, "patch.json", routinePatch());

    const result = await runCmap(["update", "--agent", "--from", patchPath, "--apply-routine"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("# MapPatch Apply Report");
    expect(result.stdout).toContain("Applied routine operations: 1");
    expect(result.stdout).toContain("Backup: ");
    expect(result.stdout).toContain("Audit: .context/audit/update-");
    expect(result.stdout).toContain("Inbox: .context/inbox/update-");
    expect(result.stdout).toContain("Post-verify: no new errors");

    const checkpoint = await expectFile(path.join(cwd, ".context/CHECKPOINT.md"));
    expect(checkpoint).toContain("Ship MapPatch intake");
    expect(checkpoint).toContain("Run focused update-agent tests.");
    expect(checkpoint).toContain("src/commands/update.ts");

    const inboxFiles = await readdir(path.join(cwd, ".context/inbox"));
    expect(inboxFiles.some((file) => file.startsWith("update-") && file.endsWith(".md"))).toBe(true);
    const auditFiles = await readdir(path.join(cwd, ".context/audit"));
    expect(auditFiles.some((file) => file.startsWith("update-") && file.endsWith(".md"))).toBe(true);
  });

  test("low-confidence routine operations are routed to inbox instead of canonical writes", async () => {
    const cwd = await createUpdateProject("m7-low-confidence");
    const patchPath = await writePatch(cwd, "patch.json", {
      schema: "cmap.map_patch.v1",
      agent: "codex",
      summary: "Low confidence checkpoint proposal.",
      operations: [
        {
          op: "checkpoint.write",
          target: ".context/CHECKPOINT.md",
          risk: "routine",
          confidence: 0.4,
          summary: "This should not auto-apply.",
          evidence: ["src/commands/update.ts"],
          fields: {
            task: "Low confidence task",
            next: "Review manually."
          }
        }
      ]
    });
    const before = await expectFile(path.join(cwd, ".context/CHECKPOINT.md"));

    const result = await runCmap(["update", "--agent", "--from", patchPath, "--apply-routine"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Applied routine operations: 0");
    expect(result.stdout).toContain("confidence below routine threshold 0.75");
    await expect(expectFile(path.join(cwd, ".context/CHECKPOINT.md"))).resolves.toBe(before);
    const inboxFiles = await readdir(path.join(cwd, ".context/inbox"));
    expect(inboxFiles.some((file) => file.startsWith("update-") && file.endsWith(".md"))).toBe(true);
  });

  test("update rollback restores files from the printed backup id", async () => {
    const cwd = await createUpdateProject("m7-rollback");
    const patchPath = await writePatch(cwd, "patch.json", routinePatch());
    const before = await expectFile(path.join(cwd, ".context/CHECKPOINT.md"));

    const apply = await runCmap(["update", "--agent", "--from", patchPath, "--apply-routine"], cwd);

    const backupId = apply.stdout.match(/Backup: ([^\n]+)/)?.[1]?.trim();
    expect(backupId).toBeTruthy();

    const rollback = await runCmap(["update", "rollback", backupId as string], cwd);

    expect(rollback).toMatchObject({ code: 0 });
    expect(rollback.stdout).toContain(`Restored 1 files from backup ${backupId}`);
    await expect(expectFile(path.join(cwd, ".context/CHECKPOINT.md"))).resolves.toBe(before);
  });

  test("finish --agent writes a MapPatch request artifact without applying it", async () => {
    const cwd = await createUpdateProject("m7-finish-agent");

    const result = await runCmap(
      [
        "finish",
        "--changed",
        "src/commands/update.ts",
        "--agent",
        "--task",
        "Prepare agent map update",
        "--verified",
        "pnpm typecheck"
      ],
      cwd
    );

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("# Finish Report");
    expect(result.stdout).toContain("MapPatch request: .context/out/update-request-");
    expect(result.stdout).toContain("cmap update --agent --from <file> --apply-routine");
    const outFiles = await readdir(path.join(cwd, ".context/out"));
    const request = outFiles.find((file) => file.startsWith("update-request-") && file.endsWith(".md"));
    expect(request).toBeTruthy();
    const body = await expectFile(path.join(cwd, ".context/out", request as string));
    expect(body).toContain("Prepare agent map update");
    expect(body).toContain('"schema": "cmap.map_patch.v1"');
    expect(body).toContain("src/commands/update.ts");

    const dryRun = await runCmap(["update", "--agent", "--from", path.join(".context/out", request as string)], cwd);
    expect(dryRun).toMatchObject({ code: 0 });
    expect(dryRun.stdout).toContain("# MapPatch Dry Run");
  });
});
