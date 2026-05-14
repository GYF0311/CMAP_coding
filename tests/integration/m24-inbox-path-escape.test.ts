import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, runCmap } from "../helpers.js";

async function createMinProject(name: string): Promise<string> {
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

async function writeStructuredCandidate(
  cwd: string,
  id: string,
  evidence: string[]
): Promise<void> {
  const dir = path.join(cwd, ".context", "inbox", "candidates");
  await mkdir(dir, { recursive: true });
  const candidate = {
    schema: "cmap.candidate.v1",
    id,
    fingerprint: id,
    createdAt: "2026-05-14T00:00:00Z",
    source: "manual",
    type: "evidence.merge",
    target: ".context/modules/route.md",
    risk: "routine",
    confidence: 0.9,
    summary: "Test candidate for path-escape rejection.",
    evidence,
    fields: { module: "route", summary: "Test merge." },
    canonical: false
  };
  await writeFile(
    path.join(dir, `${id}.json`),
    JSON.stringify(candidate, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(dir, `${id}.md`),
    `---\ncandidate_schema: cmap.candidate.v1\ncandidate_id: ${id}\nrisk: routine\nconfidence: 0.9\nsummary: Test candidate.\n---\n# Test\n`,
    "utf8"
  );
}

describe("M24 inbox promote evidence path-escape", () => {
  test("rejects evidence with ../ path-escape", async () => {
    const cwd = await createMinProject("m24-escape-relative");
    await writeStructuredCandidate(cwd, "escape-relative", ["../outside-file.txt"]);

    const result = await runCmap(["inbox", "promote", "escape-relative", "--apply"], cwd);

    expect(result.code).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("Path escapes project root");
  });

  test("rejects evidence with absolute path outside the project", async () => {
    const cwd = await createMinProject("m24-escape-absolute");
    await writeStructuredCandidate(cwd, "escape-absolute", ["/etc/passwd"]);

    const result = await runCmap(["inbox", "promote", "escape-absolute", "--apply"], cwd);

    expect(result.code).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("Path escapes project root");
  });

  test("accepts evidence inside the project (sanity check)", async () => {
    const cwd = await createMinProject("m24-inside");
    await writeStructuredCandidate(cwd, "inside-ok", ["src/commands/route.ts"]);

    const result = await runCmap(["inbox", "promote", "inside-ok", "--apply"], cwd);

    // Inside-path evidence should not trigger path-escape rejection; whatever
    // downstream behavior the candidate causes is not the concern of this test.
    expect(result.stderr + result.stdout).not.toContain("Path escapes project root");
  });
});
