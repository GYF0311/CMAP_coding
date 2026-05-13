import { mkdir, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createEvidenceProject(name: string): Promise<string> {
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

describe("M8 evidence, stale verify, and inbox governance", () => {
  test("evidence append writes generated module evidence outside canonical module docs", async () => {
    const cwd = await createEvidenceProject("m8-evidence");
    const before = await expectFile(path.join(cwd, ".context/modules/route.md"));

    const result = await runCmap(
      [
        "evidence",
        "append",
        "--module",
        "route",
        "--file",
        "src/commands/route.ts",
        "--summary",
        "Route command was inspected while improving graph-aware routing.",
        "--command",
        "pnpm test tests/integration/m8-evidence-stale-inbox.test.ts"
      ],
      cwd
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote .context/generated/evidence/modules/route.jsonl");
    await expect(expectFile(path.join(cwd, ".context/modules/route.md"))).resolves.toBe(before);
    const evidence = await expectFile(path.join(cwd, ".context/generated/evidence/modules/route.jsonl"));
    expect(evidence).toContain("Route command was inspected while improving graph-aware routing.");
    expect(evidence).toContain("src/commands/route.ts");
    expect(evidence).toContain("pnpm test tests/integration/m8-evidence-stale-inbox.test.ts");
  });

  test("evidence list prints generated evidence entries", async () => {
    const cwd = await createEvidenceProject("m8-evidence-list");
    await runCmap(
      ["evidence", "append", "--module", "route", "--file", "src/commands/route.ts", "--summary", "Route evidence listed."],
      cwd
    );

    const result = await runCmap(["evidence", "list", "--module", "route"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# Generated Evidence");
    expect(result.stdout).toContain("## route");
    expect(result.stdout).toContain("Route evidence listed.");
  });

  test("evidence migrate moves legacy generated evidence blocks out of module docs", async () => {
    const cwd = await createEvidenceProject("m8-evidence-migrate");
    const moduleDoc = path.join(cwd, ".context/modules/route.md");
    await writeFile(
      moduleDoc,
      `${await expectFile(moduleDoc)}
<!-- cmap:generated:evidence:start -->
## Generated Evidence

This section is generated support evidence. It is not a semantic source of truth.

- 2026-05-12T09:43:47.009Z: Legacy generated block. Evidence: \`src/commands/route.ts\`; command: \`pnpm test\`
<!-- cmap:generated:evidence:end -->
`,
      "utf8"
    );

    const result = await runCmap(["evidence", "migrate", "--from-module-docs", "--apply"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Migrated entries: 1");
    expect(result.stdout).toContain("Backup: ");
    expect(result.stdout).toContain("Audit: .context/audit/evidence-migrate-");
    const backupId = result.stdout.match(/^Backup: (.+)$/m)?.[1]?.trim();
    const auditPath = result.stdout.match(/^Audit: (.+)$/m)?.[1]?.trim();
    expect(backupId).toBeTruthy();
    expect(auditPath).toBeTruthy();
    await expectFile(path.join(cwd, ".context/backups", `${backupId}.json`));
    const audit = await expectFile(path.join(cwd, auditPath!));
    expect(audit).toContain("# Evidence Migration Audit");
    expect(audit).toContain("Migrated entries: 1");
    const routeDoc = await expectFile(moduleDoc);
    expect(routeDoc).not.toContain("cmap:generated:evidence:start");
    const evidence = await expectFile(path.join(cwd, ".context/generated/evidence/modules/route.jsonl"));
    expect(evidence).toContain("Legacy generated block.");
    expect(evidence).toContain("src/commands/route.ts");

    const list = await runCmap(["evidence", "list", "--module", "route"], cwd);
    expect(list.code).toBe(0);
    expect(list.stdout).toContain("# Generated Evidence");
    expect(list.stdout).toContain("Legacy generated block.");
  });

  test("evidence append rejects missing file evidence and does not edit module docs", async () => {
    const cwd = await createEvidenceProject("m8-evidence-missing");
    const before = await expectFile(path.join(cwd, ".context/modules/route.md"));

    const result = await runCmap(
      ["evidence", "append", "--module", "route", "--file", "src/missing.ts", "--summary", "Missing evidence."],
      cwd
    );

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Evidence file does not exist: src/missing.ts");
    await expect(expectFile(path.join(cwd, ".context/modules/route.md"))).resolves.toBe(before);
  });

  test("inbox status reports review backlog and high-risk candidate count", async () => {
    const cwd = await createEvidenceProject("m8-inbox");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(path.join(cwd, ".context/inbox/one.md"), "# Candidate\nrisk: high\n", "utf8");
    await writeFile(path.join(cwd, ".context/inbox/two.md"), "# Candidate\nrisk: routine\n", "utf8");

    const result = await runCmap(["inbox", "status"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Total candidates: 2");
    expect(result.stdout).toContain("High-risk candidates: 1");
    expect(result.stdout).toContain("cmap inbox status");
  });

  test("inbox triage groups candidates by type and recommends the next review action", async () => {
    const cwd = await createEvidenceProject("m8-inbox-triage");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(path.join(cwd, ".context/inbox/alias-one.md"), "# Alias Candidate\nrisk: routine\nalias: route-map\n", "utf8");
    await writeFile(path.join(cwd, ".context/inbox/decision-one.md"), "# Decision Candidate\nrisk: high\ndecision: keep canonical safe\n", "utf8");

    const result = await runCmap(["inbox", "triage"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# Inbox Triage");
    expect(result.stdout).toContain("Pending candidates: 2");
    expect(result.stdout).toContain("High-risk candidates: 1");
    expect(result.stdout).toContain("- alias: 1");
    expect(result.stdout).toContain("- decision: 1");
    expect(result.stdout).toContain("Review high-risk candidates first");
  });

  test("inbox archive moves a candidate into archive without deleting it", async () => {
    const cwd = await createEvidenceProject("m8-inbox-archive");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(path.join(cwd, ".context/inbox/one.md"), "# Candidate\nrisk: routine\n", "utf8");

    const result = await runCmap(["inbox", "archive", "one"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Archived .context/inbox/one.md");
    await expect(stat(path.join(cwd, ".context/inbox/one.md"))).rejects.toThrow();
    await expectFile(path.join(cwd, ".context/inbox/archive/one.md"));
  });

  test("inbox promote is dry-run only and does not edit canonical context", async () => {
    const cwd = await createEvidenceProject("m8-inbox-promote");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(path.join(cwd, ".context/inbox/decision-one.md"), "# Decision Candidate\nrisk: high\ndecision: never auto-write decisions\n", "utf8");
    const before = await expectFile(path.join(cwd, ".context/DECISIONS.md"));

    const result = await runCmap(["inbox", "promote", "decision-one", "--dry-run"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# Inbox Promote Dry Run");
    expect(result.stdout).toContain("Candidate type: decision");
    expect(result.stdout).toContain("No canonical files changed.");
    await expect(expectFile(path.join(cwd, ".context/DECISIONS.md"))).resolves.toBe(before);
  });

  test("verify --stale warns when owned source files are newer than their module doc", async () => {
    const cwd = await createEvidenceProject("m8-stale");
    const moduleDoc = path.join(cwd, ".context/modules/route.md");
    const ownedFile = path.join(cwd, "src/commands/route.ts");
    const oldTime = new Date("2020-01-01T00:00:00Z");
    const newTime = new Date("2020-01-02T00:00:00Z");
    await utimes(moduleDoc, oldTime, oldTime);
    await utimes(ownedFile, newTime, newTime);

    const result = await runCmap(["verify", "--stale"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Module doc may be stale: .context/modules/route.md");
    expect(result.stdout).toContain("src/commands/route.ts");
  });

  test("verify warns for legacy pending, stats, and module-doc evidence locations", async () => {
    const cwd = await createEvidenceProject("m8-legacy-warnings");
    await mkdir(path.join(cwd, ".context/pending"), { recursive: true });
    await mkdir(path.join(cwd, ".context/stats"), { recursive: true });
    await writeFile(path.join(cwd, ".context/pending/old-candidate.md"), "# Old candidate\n", "utf8");
    await writeFile(path.join(cwd, ".context/stats/route.json"), "{}\n", "utf8");
    const moduleDoc = path.join(cwd, ".context/modules/route.md");
    await writeFile(
      moduleDoc,
      `${await expectFile(moduleDoc)}
<!-- cmap:generated:evidence:start -->
- 2026-05-12T09:43:47.009Z: Legacy generated block. Evidence: \`src/commands/route.ts\`
<!-- cmap:generated:evidence:end -->
`,
      "utf8"
    );

    const result = await runCmap(["verify"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Legacy: .context/pending exists with 1 markdown file(s); new candidates should use .context/inbox");
    expect(result.stdout).toContain("Legacy: .context/stats contains 1 file(s); new stats should use .context/generated/stats");
    expect(result.stdout).toContain(
      "Legacy: .context/modules/route.md contains generated evidence block; run cmap evidence migrate --from-module-docs --dry-run"
    );
  });
});
