import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, runCmap } from "../helpers.js";

async function setupProject(name: string): Promise<string> {
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
Route module docs.
`,
    "utf8"
  );
  return cwd;
}

async function writeStructuredCandidate(
  cwd: string,
  id: string,
  type: string
): Promise<void> {
  const dir = path.join(cwd, ".context", "inbox", "candidates");
  await mkdir(dir, { recursive: true });
  const candidate = {
    schema: "cmap.candidate.v1",
    id,
    fingerprint: id,
    createdAt: "2026-05-14T00:00:00Z",
    source: "manual",
    type,
    target: ".context/modules/route.md",
    risk: "medium",
    confidence: 0.85,
    summary: `Structured candidate ${id} summary for view dashboard test.`,
    evidence: ["src/commands/route.ts"],
    fields: { module: "route", alias: "route-map" },
    canonical: false
  };
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify(candidate, null, 2), "utf8");
  await writeFile(
    path.join(dir, `${id}.md`),
    `---\ncandidate_schema: cmap.candidate.v1\ncandidate_id: ${id}\nrisk: medium\nsummary: Stub.\n---\n# Stub\n`,
    "utf8"
  );
}

describe("M25 view dashboard reads structured candidates", () => {
  test("view export --include-inbox surfaces .context/inbox/candidates/*.json", async () => {
    const cwd = await setupProject("m25-structured");
    await writeStructuredCandidate(cwd, "cand-A", "module.alias.add");

    const result = await runCmap(
      ["view", "export", "--include-inbox", "--out", "_cmap-view"],
      cwd
    );
    expect(result.code).toBe(0);

    const html = await readFile(path.join(cwd, "_cmap-view/index.html"), "utf8");
    // Structured candidate id and summary should appear in the rendered dashboard.
    expect(html).toContain("cand-A");
    expect(html).toContain("Structured candidate cand-A summary");
  });

  test("dashboard shows summary + suggested dry-run command for structured candidates", async () => {
    const cwd = await setupProject("m25-suggested-cmd");
    await writeStructuredCandidate(cwd, "cand-B", "evidence.merge");

    const result = await runCmap(
      ["view", "export", "--include-inbox", "--out", "_cmap-view"],
      cwd
    );
    expect(result.code).toBe(0);

    const html = await readFile(path.join(cwd, "_cmap-view/index.html"), "utf8");
    expect(html).toContain("cand-B");
    // Reviewer should be able to copy the dry-run command directly from the dashboard.
    expect(html).toContain("cmap inbox promote cand-B --dry-run");
  });
});
