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

  test("MapPatch v2 applies generated evidence and verification evidence without changing canonical docs", async () => {
    const cwd = await createUpdateProject("m7-v2-generated");
    const beforeRouteDoc = await expectFile(path.join(cwd, ".context/modules/route.md"));
    const patchPath = await writePatch(cwd, "patch.json", {
      schema: "cmap.map_patch.v2",
      agent: "codex",
      task: "Generated evidence migration",
      summary: "Record generated support signals.",
      operations: [
        {
          op: "evidence.append",
          risk: "routine",
          confidence: 0.9,
          summary: "Route implementation inspected.",
          fields: {
            module: "route",
            summary: "Route implementation inspected.",
            files: ["src/commands/update.ts"],
            commands: ["pnpm test tests/integration/m7-update-agent.test.ts"]
          },
          evidence: ["src/commands/update.ts"]
        },
        {
          op: "verification.evidence",
          risk: "routine",
          confidence: 0.9,
          summary: "Update-agent tests passed.",
          fields: {
            summary: "Update-agent tests passed.",
            files: ["src/commands/update.ts"],
            commands: ["pnpm test tests/integration/m7-update-agent.test.ts"]
          },
          evidence: ["src/commands/update.ts"]
        },
        {
          op: "decision.record",
          risk: "high",
          confidence: 0.9,
          summary: "Decisions stay candidate-only.",
          evidence: ["src/commands/update.ts"],
          fields: {}
        }
      ]
    });

    const result = await runCmap(["update", "--agent", "--from", patchPath, "--apply-routine"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Applied routine operations: 2");
    expect(result.stdout).toContain("evidence.append -> `.context/generated/evidence/modules/route.jsonl`");
    expect(result.stdout).toContain("verification.evidence -> `.context/generated/evidence/verification.jsonl`");
    expect(result.stdout).toContain("decision.record -> `.context/DECISIONS.md`");
    await expect(expectFile(path.join(cwd, ".context/modules/route.md"))).resolves.toBe(beforeRouteDoc);
    const moduleEvidence = await expectFile(path.join(cwd, ".context/generated/evidence/modules/route.jsonl"));
    expect(moduleEvidence).toContain("Route implementation inspected.");
    const verificationEvidence = await expectFile(path.join(cwd, ".context/generated/evidence/verification.jsonl"));
    expect(verificationEvidence).toContain("Update-agent tests passed.");
    const inboxFiles = await readdir(path.join(cwd, ".context/inbox"));
    expect(inboxFiles.some((file) => file.startsWith("update-") && file.endsWith(".md"))).toBe(true);
  });

  test("MapPatch v2 policy disables evidence auto-apply and blocks code writes", async () => {
    const cwd = await createUpdateProject("m7-v2-policy");
    await writeFile(
      path.join(cwd, ".context/policy.yml"),
      [
        "version: 2",
        "auto_apply:",
        "  evidence.append: false",
        "  stats.update: true",
        "thresholds:",
        "  routine_confidence: 0.75",
        "  evidence_confidence: 0.70",
        ""
      ].join("\n"),
      "utf8"
    );
    const patchPath = await writePatch(cwd, "patch.json", {
      schema: "cmap.map_patch.v2",
      agent: "codex",
      summary: "Policy alignment.",
      operations: [
        {
          op: "evidence.append",
          risk: "routine",
          confidence: 0.9,
          summary: "Should go to inbox when disabled.",
          evidence: ["src/commands/update.ts"],
          fields: {
            module: "route",
            summary: "Should go to inbox when disabled.",
            files: ["src/commands/update.ts"]
          }
        },
        {
          op: "code.write",
          target: "src/commands/update.ts",
          risk: "high",
          confidence: 1,
          summary: "Never allowed.",
          evidence: ["src/commands/update.ts"],
          fields: {}
        }
      ]
    });

    const result = await runCmap(["update", "--agent", "--from", patchPath, "--apply-routine"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Applied routine operations: 0");
    expect(result.stdout).toContain("evidence.append is disabled by policy");
    expect(result.stdout).toContain("code.write -> `src/commands/update.ts`");
    expect(result.stdout).toContain("operation is blocked by policy");
    await expect(expectFile(path.join(cwd, ".context/generated/evidence/modules/route.jsonl"))).rejects.toThrow();
  });
});
