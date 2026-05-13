import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createCandidateProject(name: string): Promise<string> {
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

async function writePatch(cwd: string, patch: unknown): Promise<string> {
  const target = path.join(cwd, "patch.json");
  await writeFile(target, JSON.stringify(patch, null, 2), "utf8");
  return "patch.json";
}

function aliasPatch(): unknown {
  return {
    schema: "cmap.map_patch.v2",
    agent: "codex",
    summary: "Propose a low-risk route alias.",
    operations: [
      {
        op: "module.alias.add",
        risk: "routine",
        confidence: 0.92,
        summary: "Route command is also called route-map in this project.",
        evidence: ["src/commands/route.ts"],
        fields: {
          module: "route",
          alias: "route-map"
        }
      }
    ]
  };
}

describe("M21 unified candidate store", () => {
  test("MapPatch module.alias.add writes structured candidate JSON and Markdown", async () => {
    const cwd = await createCandidateProject("m21-write-structured");
    const patchPath = await writePatch(cwd, aliasPatch());

    const result = await runCmap(["update", "--agent", "--from", patchPath, "--write-inbox"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Structured candidates written: 1");
    const candidateRoot = path.join(cwd, ".context/inbox/candidates");
    const files = await readdir(candidateRoot);
    const json = files.find((file) => file.startsWith("candidate-") && file.endsWith(".json"));
    const md = files.find((file) => file.startsWith("candidate-") && file.endsWith(".md"));
    expect(json).toBeTruthy();
    expect(md).toBeTruthy();

    const candidate = JSON.parse(await readFile(path.join(candidateRoot, json!), "utf8")) as {
      schema: string;
      id: string;
      type: string;
      target: string;
      canonical: boolean;
      fields: Record<string, unknown>;
    };
    expect(candidate).toMatchObject({
      schema: "cmap.candidate.v1",
      type: "module.alias.add",
      target: "route",
      canonical: false,
      fields: {
        module: "route",
        alias: "route-map"
      }
    });
    expect(candidate.id).toMatch(/^candidate-\d{4}-\d{2}-\d{2}t.+-[a-f0-9]{10}$/);
    expect(await expectFile(path.join(candidateRoot, md!))).toContain("Candidate / Non-canonical");
  });

  test("MapPatch duplicate fingerprints are skipped instead of spamming candidate inbox", async () => {
    const cwd = await createCandidateProject("m21-duplicate");
    const patchPath = await writePatch(cwd, aliasPatch());

    const first = await runCmap(["update", "--agent", "--from", patchPath, "--write-inbox"], cwd);
    const second = await runCmap(["update", "--agent", "--from", patchPath, "--write-inbox"], cwd);

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain("Structured duplicate candidates skipped: 1");
    const files = await readdir(path.join(cwd, ".context/inbox/candidates"));
    expect(files.filter((file) => file.endsWith(".json"))).toHaveLength(1);
    expect(files.filter((file) => file.endsWith(".md"))).toHaveLength(1);
  });

  test("inbox promote --apply consumes structured module.alias.add candidates", async () => {
    const cwd = await createCandidateProject("m21-promote-structured");
    const patchPath = await writePatch(cwd, aliasPatch());
    await runCmap(["update", "--agent", "--from", patchPath, "--write-inbox"], cwd);
    const json = (await readdir(path.join(cwd, ".context/inbox/candidates"))).find((file) => file.endsWith(".json"));
    expect(json).toBeTruthy();
    const id = path.basename(json!, ".json");

    const result = await runCmap(["inbox", "promote", id, "--apply"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`Applied inbox candidate: ${id}`);
    const routeDoc = await expectFile(path.join(cwd, ".context/modules/route.md"));
    expect(routeDoc).toContain("route-map");
    const inboxFiles = await readdir(path.join(cwd, ".context/inbox/candidates"));
    expect(inboxFiles).not.toContain(`${id}.json`);
    expect(inboxFiles).not.toContain(`${id}.md`);
    const archiveFiles = await readdir(path.join(cwd, ".context/inbox/archive"));
    expect(archiveFiles).toContain(`${id}.json`);
    expect(archiveFiles).toContain(`${id}.md`);
  });

  test("legacy markdown candidates remain readable and warn as legacy", async () => {
    const cwd = await createCandidateProject("m21-legacy-readable");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context/inbox/alias-route.md"),
      `---
type: module.alias.add
risk: routine
module: route
alias: route-legacy
confidence: 0.9
evidence:
  - src/commands/route.ts
---
# Alias candidate
`,
      "utf8"
    );

    const status = await runCmap(["inbox", "status"], cwd);
    const triage = await runCmap(["inbox", "triage"], cwd);

    expect(status.code).toBe(0);
    expect(status.stdout).toContain("Legacy markdown candidates: 1");
    expect(status.stdout).toContain("Warning: legacy top-level inbox markdown is supported");
    expect(triage.code).toBe(0);
    expect(triage.stdout).toContain("alias-route");
    expect(triage.stdout).toContain("Legacy markdown candidates: 1");
  });
});
