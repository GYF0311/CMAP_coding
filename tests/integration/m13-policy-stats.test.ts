import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createPolicyProject(name: string): Promise<string> {
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

describe("M13 policy and generated stats foundations", () => {
  test("init creates a policy file with safe auto-apply defaults", async () => {
    const cwd = await createPolicyProject("m13-policy-init");

    const policy = await expectFile(path.join(cwd, ".context/policy.yml"));

    expect(policy).toContain("checkpoint.write: true");
    expect(policy).toContain("evidence.append: true");
    expect(policy).toContain("verification.evidence: true");
    expect(policy).toContain("stats.update: true");
    expect(policy).toContain("candidate_only:");
    expect(policy).toContain("module.semantic.update: true");
    expect(policy).toContain("decision.record: true");
    expect(policy).toContain("blocked:");
    expect(policy).toContain("code.write: true");
    expect(policy).toContain("routine_confidence: 0.75");
  });

  test("policy show and validate expose policy v2 warnings for unknown keys", async () => {
    const cwd = await createPolicyProject("m13-policy-validate");
    await writeFile(
      path.join(cwd, ".context/policy.yml"),
      [
        "version: 2",
        "auto_apply:",
        "  checkpoint.write: true",
        "  unknown.op: true",
        "thresholds:",
        "  routine_confidence: 0.8",
        ""
      ].join("\n"),
      "utf8"
    );

    const show = await runCmap(["policy", "show"], cwd);
    expect(show.code).toBe(0);
    expect(show.stdout).toContain("\"version\": 2");
    expect(show.stdout).toContain("\"routineConfidence\": 0.8");

    const validate = await runCmap(["policy", "validate"], cwd);
    expect(validate.code).toBe(0);
    expect(validate.stdout).toContain("Warnings: 1");
    expect(validate.stdout).toContain("unknown policy key auto_apply.unknown.op");
  });

  test("evidence append records deterministic module activity stats", async () => {
    const cwd = await createPolicyProject("m13-evidence-stats");

    const result = await runCmap(
      [
        "evidence",
        "append",
        "--module",
        "route",
        "--file",
        "src/commands/route.ts",
        "--summary",
        "Route evidence should update stats.",
        "--command",
        "pnpm test tests/integration/m13-policy-stats.test.ts"
      ],
      cwd
    );

    expect(result.code).toBe(0);
    const stats = JSON.parse(await expectFile(path.join(cwd, ".context/generated/stats/module-activity.json"))) as {
      modules: Record<string, { evidence_count: number; files: Record<string, number>; commands: Record<string, number> }>;
    };
    expect(stats.modules.route.evidence_count).toBe(1);
    expect(stats.modules.route.files["src/commands/route.ts"]).toBe(1);
    expect(stats.modules.route.commands["pnpm test tests/integration/m13-policy-stats.test.ts"]).toBe(1);
  });

  test("route records generated route usage stats when policy allows stats updates", async () => {
    const cwd = await createPolicyProject("m13-route-stats");

    const result = await runCmap(["route", "route 模块定位"], cwd);

    expect(result.code).toBe(0);
    const stats = JSON.parse(await expectFile(path.join(cwd, ".context/generated/stats/route-usage.json"))) as {
      total: number;
      by_source: Record<string, number>;
      modules: Record<string, number>;
      recent: Array<{ task: string; modules: string[] }>;
    };
    expect(stats.total).toBe(1);
    expect(stats.by_source.route).toBe(1);
    expect(stats.modules.route).toBe(1);
    expect(stats.recent[0].task).toBe("route 模块定位");
    expect(stats.recent[0].modules).toEqual(["route"]);
  });

  test("verify stale uses policy inbox thresholds", async () => {
    const cwd = await createPolicyProject("m13-inbox-policy");
    await writeFile(
      path.join(cwd, ".context/policy.yml"),
      [
        "auto_apply:",
        "  stats.update: true",
        "inbox:",
        "  max_pending: 3",
        "  max_high_risk: 0",
        ""
      ].join("\n"),
      "utf8"
    );
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(path.join(cwd, ".context/inbox/one.md"), "# Candidate\nrisk: routine\n", "utf8");
    await writeFile(path.join(cwd, ".context/inbox/two.md"), "# Candidate\nrisk: routine\n", "utf8");

    const withinThreshold = await runCmap(["verify", "--stale"], cwd);

    expect(withinThreshold.code).toBe(0);
    expect(withinThreshold.stdout).toContain("Inbox: 2 pending candidates within policy");
    expect(withinThreshold.stdout).not.toContain("candidate updates need review");

    await writeFile(path.join(cwd, ".context/inbox/high.md"), "# Candidate\nrisk: high\n", "utf8");
    const highRisk = await runCmap(["verify", "--stale"], cwd);

    expect(highRisk.code).toBe(0);
    expect(highRisk.stdout).toContain("Inbox: 3 candidate updates need review (1 high-risk)");
  });
});
