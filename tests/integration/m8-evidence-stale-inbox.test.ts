import { mkdir, utimes, writeFile } from "node:fs/promises";
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
  test("evidence append writes a bounded generated evidence block to a module doc", async () => {
    const cwd = await createEvidenceProject("m8-evidence");

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
    expect(result.stdout).toContain("Updated .context/modules/route.md");
    const routeDoc = await expectFile(path.join(cwd, ".context/modules/route.md"));
    expect(routeDoc).toContain("<!-- cmap:generated:evidence:start -->");
    expect(routeDoc).toContain("Route command was inspected while improving graph-aware routing.");
    expect(routeDoc).toContain("src/commands/route.ts");
    expect(routeDoc).toContain("pnpm test tests/integration/m8-evidence-stale-inbox.test.ts");
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
});
