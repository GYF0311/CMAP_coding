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

    const code = await runViewExport(cwd, { out: ".context/out/view.html" });

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

    await runViewExport(cwd, { out: ".context/out/view.html" });

    const data = await readEmbeddedViewData(path.join(cwd, ".context/out/view.html"));
    expect(data?.warnings).toContain("Generated evidence: Not available");
    expect(data?.warnings).toContain("Inbox candidates: Not available");
    expect(data?.warnings).toContain("Freshness data: Not available");
    expect(data?.warnings).toContain("Reviewed relations: Not available");
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

    await runViewExport(cwd, { out: ".context/out/view.html" });

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
