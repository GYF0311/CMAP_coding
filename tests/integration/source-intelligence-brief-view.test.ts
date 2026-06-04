import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { runBrief } from "../../src/commands/brief.js";
import { runViewExport } from "../../src/commands/view.js";
import { readEmbeddedViewData } from "../../src/view/check.js";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

describe("source intelligence brief/view integration", () => {
  test("brief handler appends bounded generated source evidence after reviewed context", async () => {
    const cwd = await createSourceBriefViewProject("p1-brief");
    await runCmap(["source", "index"], cwd);
    await runCmap(["impact", "file", "src/a.ts"], cwd);

    await runBrief(cwd, "change target source behavior", {
      out: ".context/out/source-brief.md",
      withSourceEvidence: true,
      sourceBudget: "160",
      sourceTarget: "target"
    });

    const brief = await expectFile(path.join(cwd, ".context/out/source-brief.md"));
    expect(brief).toContain("## Module Context");
    expect(brief).toContain("## Generated Source Evidence");
    expect(brief.indexOf("## Module Context")).toBeLessThan(brief.indexOf("## Generated Source Evidence"));
    expect(brief).toContain("Generated source evidence. Non-canonical");
    expect(brief).toContain("Label: generated=true; canonical=false; freshness=fresh;");
    expect(brief).toContain("Requested source budget: 160 tokens");
    expect(brief).toContain("Effective snippet body budget: 160 tokens");
    expect(brief).toContain("Budget note: source budget bounds snippet body text");
    expect(brief).toContain("Metrics: files=");
    expect(brief).toContain("impact.file");
    expect(brief).toContain("#### `src/a.ts:");
    expect(brief).toContain("truncated=");
    expect(brief).not.toContain("should-not-leak-1234567890");
  });

  test("Review HTML support layer renders source-index summary and recent source records", async () => {
    const cwd = await createSourceBriefViewProject("p1-view");
    await runCmap(["source", "index"], cwd);
    await runCmap(["impact", "file", "src/a.ts"], cwd);

    await runViewExport(cwd, { out: ".context/out/default.html" });
    const defaultHtml = await readFile(path.join(cwd, ".context/out/default.html"), "utf8");
    expect(defaultHtml).not.toContain("Source Index Summary");

    await runViewExport(cwd, { out: ".context/out/support.html", includeSupport: true });
    const html = await expectFile(path.join(cwd, ".context/out/support.html"));
    expect(html).toContain("Source Evidence");
    expect(html).toContain("Source Index Summary");
    expect(html).toContain("Generated / Non-canonical");
    expect(html).toContain("Recent Generated Source Evidence");

    const data = await readEmbeddedViewData(path.join(cwd, ".context/out/support.html"));
    const sourceEvidence = data?.sourceEvidence;
    expect(sourceEvidence).toBeDefined();
    if (!sourceEvidence) {
      throw new Error("Expected sourceEvidence in embedded view data");
    }
    expect(sourceEvidence).toMatchObject({
      included: true,
      available: true,
      generated: true,
      canonical: false,
      label: "generated source evidence; non-canonical"
    });
    expect(sourceEvidence.index?.files).toBeGreaterThanOrEqual(3);
    expect(sourceEvidence.index?.symbols).toBeGreaterThan(0);
    expect(sourceEvidence.freshness?.status).toBe("fresh");
    expect(sourceEvidence.records[0]).toMatchObject({
      kind: "impact.file",
      freshnessStatus: "fresh",
      truncated: false
    });

    await writeFile(path.join(cwd, "src", "a.ts"), [
      "export const api_key = \"should-not-leak-1234567890\";",
      "export function target() {",
      "  return 2;",
      "}",
      ""
    ].join("\n"), "utf8");
    await runViewExport(cwd, { out: ".context/out/stale-support.html", includeSupport: true });
    const staleData = await readEmbeddedViewData(path.join(cwd, ".context/out/stale-support.html"));
    expect(staleData?.sourceEvidence?.freshness?.status).toBe("stale");
    expect(staleData?.sourceEvidence?.freshness?.staleFiles).toContain("src/a.ts");
  });
});

async function createSourceBriefViewProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await mkdir(path.join(cwd, "tests"), { recursive: true });
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
  await writeFile(path.join(cwd, "src", "a.ts"), [
    "export const api_key = \"should-not-leak-1234567890\";",
    "export function target() {",
    "  return 1;",
    "}",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(cwd, "src", "b.ts"), [
    "import { target } from './a';",
    "export function caller() {",
    "  return target();",
    "}",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(cwd, "tests", "a.test.ts"), [
    "import { target } from '../src/a';",
    "export function testTarget() {",
    "  return target();",
    "}",
    ""
  ].join("\n"), "utf8");
  await writeFile(
    path.join(cwd, ".context/modules/source.md"),
    `---
context_type: module
module: source
paths:
  - src
aliases:
  - source
  - target
relations: {}
confidence: ai-drafted
---
# Module: source

## Purpose
Own source behavior for this fixture.

## Tests / Verification
- \`pnpm test\`
`,
    "utf8"
  );
  await runCmap(
    [
      "checkpoint",
      "write",
      "--task",
      "Change target source behavior",
      "--hypothesis",
      "Source module has reviewed context before generated evidence.",
      "--next",
      "Use source-aware brief",
      "--verified",
      "Not yet"
    ],
    cwd
  );
  return cwd;
}
