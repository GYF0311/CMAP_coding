import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";
import { runViewExport, runViewOpen } from "../../src/commands/view.js";
import { readEmbeddedViewData } from "../../src/view/check.js";

async function createViewProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/view"), { recursive: true });
  await writeFile(path.join(cwd, "src/view/render.ts"), "export const render = true;\n", "utf8");
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(
    path.join(cwd, ".context/modules/view.md"),
    `---
context_type: module
module: view
name: View
paths:
  - src/view
aliases:
  - view
  - dashboard
relations:
  depends_on:
    - evidence
confidence: ai-drafted
---
# Module: view

## Purpose
Render a human review dashboard.
`,
    "utf8"
  );
  return cwd;
}

describe("M19 view export", () => {
  test("exports a single-file escaped HTML dashboard with embedded cmap.view_data.v1", async () => {
    const cwd = await createViewProject("m19-export");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/relation-view.md"),
      `---
type: module.relation.add
risk: routine
module: view
from: view
to: evidence
relation: depends_on
---
# Relation <candidate>
token: should-not-leak-1234567890
`,
      "utf8"
    );

    const code = await runViewExport(cwd, { out: ".context/out/view.html", includeInbox: true });

    expect(code).toBe(0);
    const html = await expectFile(path.join(cwd, ".context/out/view.html"));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("cmap.view_data.v1");
    expect(html).not.toContain("<candidate>");
    expect(html).not.toContain("should-not-leak-1234567890");
    expect(html).toContain("token: [REDACTED]");
    expect(html).not.toContain("https://");
    expect(html).not.toContain("eval(");
    const embedded = await readEmbeddedViewData(path.join(cwd, ".context/out/view.html"));
    expect(embedded?.schema).toBe("cmap.view_data.v1");
    expect(embedded?.modules[0].id).toBe("view");
  });

  test("check reports missing, pass, and stale while ignoring generatedAt", async () => {
    const cwd = await createViewProject("m19-check");

    const missing = await runViewExport(cwd, { out: ".context/out/view.html", check: true });
    expect(missing).toBe(1);

    await runViewExport(cwd, { out: ".context/out/view.html" });
    const clean = await runViewExport(cwd, { out: ".context/out/view.html", check: true });
    expect(clean).toBe(0);

    await writeFile(
      path.join(cwd, ".context/modules/view.md"),
      `---
context_type: module
module: view
paths:
  - src/view
aliases:
  - view
  - dashboard
  - review-ui
confidence: ai-drafted
---
# Module: view
`,
      "utf8"
    );
    const stale = await runViewExport(cwd, { out: ".context/out/view.html", check: true });
    expect(stale).toBe(1);
  });

  test("check fails when the HTML template is changed even if embedded data is unchanged", async () => {
    const cwd = await createViewProject("m19-check-template");
    const target = path.join(cwd, ".context/out/view.html");

    await runViewExport(cwd, {
      out: ".context/out/view.html",
      includeGenerated: true,
      includeInbox: true,
      includeFreshness: true
    });
    const current = await readFile(target, "utf8");
    await writeFile(target, current.replace(/<title>[^<]+<\/title>/, "<title>tampered cmap view</title>"), "utf8");

    const stale = await runViewExport(cwd, { out: ".context/out/view.html", check: true });
    expect(stale).toBe(1);
  });

  test("missing generated inbox freshness and relation data degrade to warnings", async () => {
    const cwd = await createTempProject("m19-missing");
    await runCmap(["init", "--auto"], cwd);
    await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/modules/solo.md"),
      `---
context_type: module
module: solo
paths:
  - src/solo.ts
confidence: ai-drafted
---
# Module: solo
`,
      "utf8"
    );

    await runViewExport(cwd, {
      out: ".context/out/view.html",
      includeGenerated: true,
      includeInbox: true,
      includeFreshness: true
    });

    const data = await readEmbeddedViewData(path.join(cwd, ".context/out/view.html"));
    expect(data?.warnings).toContain("Generated evidence: Not available");
    expect(data?.warnings).toContain("Inbox candidates: Not available");
    expect(data?.warnings).toContain("Freshness data: Not available");
    expect(data?.warnings).toContain("Reviewed relations: Not available");
  });

  test("include flags gate generated inbox and freshness detail sections", async () => {
    const cwd = await createViewProject("m19-flags");
    await mkdir(path.join(cwd, ".context/generated/evidence/modules"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/generated/evidence/modules/view.jsonl"),
      `${JSON.stringify({
        version: 1,
        id: "evidence-one",
        moduleId: "view",
        createdAt: "2026-05-13T00:00:00.000Z",
        source: "manual",
        summary: "Generated evidence should be opt-in.",
        files: ["src/view/render.ts"],
        confidence: 1,
        canonical: false
      })}\n`,
      "utf8"
    );
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/view-alias.md"),
      `---
type: module.alias.add
risk: routine
module: view
alias: review dashboard
confidence: 0.9
---
# Alias candidate
`,
      "utf8"
    );
    await runCmap(["freshness", "snapshot"], cwd);

    await runViewExport(cwd, { out: ".context/out/default.html" });
    const defaultHtml = await expectFile(path.join(cwd, ".context/out/default.html"));
    const defaultData = await readEmbeddedViewData(path.join(cwd, ".context/out/default.html"));
    expect(defaultHtml).toContain("Overview");
    expect(defaultHtml).toContain("Verification");
    expect(defaultHtml).not.toContain("Generated Evidence");
    expect(defaultHtml).not.toContain("Review Candidates");
    expect(defaultData?.evidence).toHaveLength(0);
    expect(defaultData?.candidates).toHaveLength(0);
    expect(defaultData?.modules[0].freshness.state).toBe("Not available");

    await runViewExport(cwd, {
      out: ".context/out/full.html",
      includeGenerated: true,
      includeInbox: true,
      includeFreshness: true
    });
    const fullHtml = await expectFile(path.join(cwd, ".context/out/full.html"));
    const fullData = await readEmbeddedViewData(path.join(cwd, ".context/out/full.html"));
    expect(fullHtml).toContain("Generated Evidence");
    expect(fullHtml).toContain("Review Candidates");
    expect(fullHtml).toContain("Freshness");
    expect(fullData?.evidence[0].summary).toBe("Generated evidence should be opt-in.");
    expect(fullData?.candidates[0].id).toBe("view-alias");
    expect(fullData?.modules[0].freshness.state).toBe("baseline");
  });

  test("renders review controls, filters, copy commands, and module detail hooks", async () => {
    const cwd = await createViewProject("m19-interactions");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/high-risk-view.md"),
      `---
type: module.semantic.update
risk: high
module: view
confidence: 0.9
---
# Semantic candidate
`,
      "utf8"
    );
    await runCmap(["freshness", "snapshot"], cwd);

    await runViewExport(cwd, {
      out: ".context/out/view.html",
      includeInbox: true,
      includeFreshness: true
    });

    const html = await expectFile(path.join(cwd, ".context/out/view.html"));
    expect(html).toContain("id=\"view-search\"");
    expect(html).toContain("id=\"filter-high-risk\"");
    expect(html).toContain("data-copy-command=\"cmap inbox promote high-risk-view --dry-run\"");
    expect(html).toContain("data-open-module=\"view\"");
    expect(html).toContain("module-dialog");
    expect(html).toContain("navigator.clipboard.writeText");
    expect(html).not.toContain("innerHTML");
    expect(html).not.toContain("eval(");
  });

  test("overview and verification data are parsed into the view contract", async () => {
    const cwd = await createViewProject("m19-overview");
    await writeFile(
      path.join(cwd, ".context/STATUS.md"),
      `---
context_type: status
---
# Status

## Active Goal
Ship the review dashboard.

## Next Steps
- Harden view export.

## Last Verified
pnpm test
`,
      "utf8"
    );
    await writeFile(
      path.join(cwd, ".context/CHECKPOINT.md"),
      `---
context_type: checkpoint
---
# Current Checkpoint

## Current Task
Implement view hardening.

## Verified
Targeted view tests.

## Next Step
Run full verification.
`,
      "utf8"
    );
    await writeFile(
      path.join(cwd, ".context/VERIFY.md"),
      `---
context_type: verify
---
# Verification

## Required Commands

| Purpose | Command | Expected | When |
| --- | --- | --- | --- |
| Tests | \`pnpm test\` | pass | before commit |

## Manual Verification
- Open the HTML view and inspect Overview.
`,
      "utf8"
    );

    await runViewExport(cwd, { out: ".context/out/view.html" });

    const html = await expectFile(path.join(cwd, ".context/out/view.html"));
    const data = await readEmbeddedViewData(path.join(cwd, ".context/out/view.html"));
    expect(data?.overview.activeGoal).toBe("Ship the review dashboard.");
    expect(data?.overview.currentTask).toBe("Implement view hardening.");
    expect(data?.overview.nextStep).toBe("Run full verification.");
    expect(data?.verify.requiredCommands[0]).toMatchObject({ purpose: "Tests", command: "pnpm test" });
    expect(data?.verify.manualChecks).toContain("Open the HTML view and inspect Overview.");
    expect(html).toContain("Ship the review dashboard.");
    expect(html).toContain("pnpm test");
  });

  test("caps generated evidence at 50 and inbox candidates at 100", async () => {
    const cwd = await createViewProject("m19-caps");
    await mkdir(path.join(cwd, ".context/generated/evidence/modules"), { recursive: true });
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    const evidence = Array.from({ length: 60 }, (_item, index) => ({
      version: 1,
      id: `evidence-${index}`,
      moduleId: "view",
      createdAt: `2026-05-13T00:${String(index).padStart(2, "0")}:00.000Z`,
      source: "manual",
      summary: `Evidence ${index}`,
      files: ["src/view/render.ts"],
      confidence: 1,
      canonical: false
    }));
    await writeFile(
      path.join(cwd, ".context/generated/evidence/modules/view.jsonl"),
      `${evidence.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      "utf8"
    );
    for (let index = 0; index < 120; index += 1) {
      await writeFile(path.join(cwd, ".context/inbox", `candidate-${String(index).padStart(3, "0")}.md`), "# Candidate\n", "utf8");
    }

    await runViewExport(cwd, { out: ".context/out/view.html", includeGenerated: true, includeInbox: true });

    const data = await readEmbeddedViewData(path.join(cwd, ".context/out/view.html"));
    expect(data?.evidence).toHaveLength(50);
    expect(data?.candidates).toHaveLength(100);
  });

  test("open prints a file URL for an existing view export", async () => {
    const cwd = await createViewProject("m19-open");
    await runViewExport(cwd, { out: ".context/out/view.html" });

    await expect(runViewOpen(cwd, { out: ".context/out/view.html" })).resolves.toBeUndefined();
    expect(await readFile(path.join(cwd, ".context/out/view.html"), "utf8")).toContain("cmap-view-data");
  });
});
