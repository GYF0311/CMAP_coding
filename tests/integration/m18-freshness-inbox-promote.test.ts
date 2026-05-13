import { mkdir, readFile, readdir, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createMaintenanceProject(name: string): Promise<string> {
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

describe("M18 freshness v2 and inbox promotion", () => {
  test("freshness mark-reviewed clears owned-file freshness warning until code changes again", async () => {
    const cwd = await createMaintenanceProject("m18-freshness-code");

    const snapshot = await runCmap(["freshness", "snapshot"], cwd);
    expect(snapshot.code).toBe(0);
    expect(snapshot.stdout).toContain(".context/generated/freshness.json");
    const baseline = JSON.parse(await readFile(path.join(cwd, ".context/generated/freshness.json"), "utf8")) as {
      modules: Record<string, { reviewState: string; reviewEvidence?: string }>;
    };
    expect(baseline.modules.route.reviewState).toBe("baseline");
    expect(baseline.modules.route.reviewEvidence).toBeUndefined();

    const reviewed = await runCmap(["freshness", "mark-reviewed", "--module", "route", "--evidence", "Reviewed route."], cwd);
    expect(reviewed.code).toBe(0);
    const reviewedIndex = JSON.parse(await readFile(path.join(cwd, ".context/generated/freshness.json"), "utf8")) as {
      modules: Record<string, { reviewState: string; reviewEvidence?: string }>;
    };
    expect(reviewedIndex.modules.route.reviewState).toBe("reviewed");
    expect(reviewedIndex.modules.route.reviewEvidence).toBe("Reviewed route.");

    const clean = await runCmap(["verify", "--freshness"], cwd);
    expect(clean.code).toBe(0);
    expect(clean.stdout).not.toContain("module route may be stale");

    await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = 'changed';\n", "utf8");
    const future = new Date(Date.now() + 5000);
    await utimes(path.join(cwd, "src/commands/route.ts"), future, future);
    const stale = await runCmap(["verify", "--freshness"], cwd);

    expect(stale.code).toBe(0);
    expect(stale.stdout).toContain("Freshness: module route may be stale");
    expect(stale.stdout).toContain("src/commands/route.ts");
  });

  test("freshness review does not fall back to module doc mtime", async () => {
    const cwd = await createMaintenanceProject("m18-freshness-doc-mtime");

    await runCmap(["freshness", "snapshot"], cwd);
    await runCmap(["freshness", "mark-reviewed", "--module", "route", "--evidence", "Reviewed route."], cwd);

    await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = 'changed';\n", "utf8");
    const codeFuture = new Date(Date.now() + 5000);
    await utimes(path.join(cwd, "src/commands/route.ts"), codeFuture, codeFuture);
    const docFuture = new Date(Date.now() + 10000);
    await utimes(path.join(cwd, ".context/modules/route.md"), docFuture, docFuture);

    const result = await runCmap(["verify", "--freshness"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Freshness: module route may be stale");
    expect(result.stdout).toContain("src/commands/route.ts");
  });

  test("freshness snapshot skips directory ownership paths", async () => {
    const cwd = await createMaintenanceProject("m18-freshness-directory");
    await writeFile(
      path.join(cwd, ".context/modules/cli.md"),
      `---
context_type: module
module: cli
paths:
  - src/commands
aliases:
  - cli
confidence: ai-drafted
---
# Module: cli

## Purpose
Own CLI command wiring.
`,
      "utf8"
    );

    const snapshot = await runCmap(["freshness", "snapshot"], cwd);

    expect(snapshot.code).toBe(0);
    const index = JSON.parse(await readFile(path.join(cwd, ".context/generated/freshness.json"), "utf8")) as {
      modules: Record<string, { ownedFiles: Record<string, unknown> }>;
    };
    expect(index.modules.cli.ownedFiles).toEqual({});
  });

  test("freshness warns when generated evidence is newer than reviewed facts", async () => {
    const cwd = await createMaintenanceProject("m18-freshness-evidence");
    await runCmap(["freshness", "snapshot"], cwd);
    await runCmap(["freshness", "mark-reviewed", "--module", "route", "--evidence", "Reviewed route."], cwd);

    const freshnessPath = path.join(cwd, ".context/generated/freshness.json");
    const freshness = JSON.parse(await readFile(freshnessPath, "utf8")) as {
      modules: Record<string, { lastSemanticReviewedAt?: string }>;
    };
    freshness.modules.route.lastSemanticReviewedAt = "2020-01-01T00:00:00.000Z";
    await writeFile(freshnessPath, `${JSON.stringify(freshness, null, 2)}\n`, "utf8");
    const append = await runCmap(
      ["evidence", "append", "--module", "route", "--file", "src/commands/route.ts", "--summary", "New generated evidence."],
      cwd
    );
    expect(append.code).toBe(0);

    const result = await runCmap(["verify", "--freshness"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Freshness: generated evidence for route is newer than reviewed facts");
  });

  test("freshness warns when a module has a pending high-risk inbox candidate", async () => {
    const cwd = await createMaintenanceProject("m18-freshness-high-risk-inbox");
    await runCmap(["freshness", "snapshot"], cwd);
    await runCmap(["freshness", "mark-reviewed", "--module", "route", "--evidence", "Reviewed route."], cwd);
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/route-decision.md"),
      `---
type: decision.record
risk: high
module: route
confidence: 0.9
evidence:
  - src/commands/route.ts
---
# Route decision candidate
`,
      "utf8"
    );

    const result = await runCmap(["verify", "--freshness"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Freshness: module route has pending inbox candidates");
    expect(result.stdout).toContain(".context/inbox/route-decision.md");
  });

  test("freshness mode leaves missing paths and missing relations as verify errors", async () => {
    const cwd = await createMaintenanceProject("m18-freshness-verify-errors");
    await writeFile(
      path.join(cwd, ".context/modules/route.md"),
      `---
context_type: module
module: route
paths:
  - src/commands/missing-route.ts
relations:
  depends_on:
    - missing-module
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

    const result = await runCmap(["verify", "--freshness"], cwd);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain(".context/modules/route.md points to missing path src/commands/missing-route.ts");
    expect(result.stdout).toContain(".context/modules/route.md relation depends_on points to missing module: missing-module");
  });

  test("inbox promote --apply applies low-risk module aliases with backup audit verify and archive", async () => {
    const cwd = await createMaintenanceProject("m18-promote-alias");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/alias-route.md"),
      `---
type: module.alias.add
risk: routine
module: route
alias: route-map
confidence: 0.9
evidence:
  - src/commands/route.ts
---
# Alias candidate
`,
      "utf8"
    );

    const result = await runCmap(["inbox", "promote", "alias-route", "--apply"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Applied inbox candidate: alias-route");
    expect(result.stdout).toContain("Backup: ");
    expect(result.stdout).toContain("Audit: .context/audit/inbox-promote-");
    expect(result.stdout).toContain("Post-verify: no new errors");
    const routeDoc = await expectFile(path.join(cwd, ".context/modules/route.md"));
    expect(routeDoc).toContain("route-map");
    const archive = await readdir(path.join(cwd, ".context/inbox/archive"));
    expect(archive.some((file) => file.startsWith("alias-route") && file.endsWith(".md"))).toBe(true);
  });

  test("inbox promote --apply applies low-risk module paths", async () => {
    const cwd = await createMaintenanceProject("m18-promote-path");
    await writeFile(path.join(cwd, "src/commands/extra-route.ts"), "export const extra = true;\n", "utf8");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/path-route.md"),
      `---
type: module.path.add
risk: routine
module: route
path: src/commands/extra-route.ts
confidence: 0.9
evidence:
  - src/commands/route.ts
---
# Path candidate
`,
      "utf8"
    );

    const result = await runCmap(["inbox", "promote", "path-route", "--apply"], cwd);

    expect(result.code).toBe(0);
    const routeDoc = await expectFile(path.join(cwd, ".context/modules/route.md"));
    expect(routeDoc).toContain("src/commands/extra-route.ts");
    const verify = await runCmap(["verify"], cwd);
    expect(verify.code).toBe(0);
  });

  test("inbox promote --apply merges generated module and verification evidence", async () => {
    const cwd = await createMaintenanceProject("m18-promote-evidence");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/evidence-route.md"),
      `---
type: evidence.merge
risk: routine
module: route
summary: Merged generated route evidence.
confidence: 0.9
evidence:
  - src/commands/route.ts
---
# Evidence candidate
`,
      "utf8"
    );
    await writeFile(
      path.join(cwd, ".context/inbox/verification-route.md"),
      `---
type: verification.evidence
risk: routine
summary: Verified generated evidence promotion.
confidence: 0.9
evidence:
  - src/commands/route.ts
---
# Verification evidence candidate
`,
      "utf8"
    );

    const evidence = await runCmap(["inbox", "promote", "evidence-route", "--apply"], cwd);
    const verification = await runCmap(["inbox", "promote", "verification-route", "--apply"], cwd);

    expect(evidence.code).toBe(0);
    expect(verification.code).toBe(0);
    expect(await expectFile(path.join(cwd, ".context/generated/evidence/modules/route.jsonl"))).toContain(
      "Merged generated route evidence."
    );
    expect(await expectFile(path.join(cwd, ".context/generated/evidence/verification.jsonl"))).toContain(
      "Verified generated evidence promotion."
    );
  });

  test("inbox promote --apply rejects semantic and decision candidates", async () => {
    const cwd = await createMaintenanceProject("m18-promote-reject");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/decision-one.md"),
      `---
type: decision.record
risk: high
confidence: 0.9
evidence:
  - src/commands/route.ts
---
# Decision candidate
`,
      "utf8"
    );

    const result = await runCmap(["inbox", "promote", "decision-one", "--apply"], cwd);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("cannot be auto-applied");
    const inboxFiles = await readdir(path.join(cwd, ".context/inbox"));
    expect(inboxFiles).toContain("decision-one.md");
  });

  test("inbox reject archives a candidate with an explicit reason", async () => {
    const cwd = await createMaintenanceProject("m18-inbox-reject");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/alias-false.md"),
      `---
type: module.alias.add
risk: routine
module: route
alias: wrong-route-name
confidence: 0.9
evidence:
  - src/commands/route.ts
---
# Alias candidate
`,
      "utf8"
    );

    const result = await runCmap(["inbox", "reject", "alias-false", "--reason", "Not an actual user-facing name."], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Rejected .context/inbox/alias-false.md");
    const inboxFiles = await readdir(path.join(cwd, ".context/inbox"));
    expect(inboxFiles).not.toContain("alias-false.md");
    const archiveFiles = await readdir(path.join(cwd, ".context/inbox/archive"));
    const rejected = archiveFiles.find((file) => file.startsWith("rejected-alias-false"));
    expect(rejected).toBeTruthy();
    const archived = await readFile(path.join(cwd, ".context/inbox/archive", rejected!), "utf8");
    expect(archived).toContain("Reason: Not an actual user-facing name.");
    expect(archived).toContain("## Original Candidate");
  });
});
