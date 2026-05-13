import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";
import { runRelateIngest, runRelatePromote, runRelateRequest } from "../../src/commands/relate.js";
import { evaluateRelationPatch, parseRelationPatch } from "../../src/core/relation-patch.js";

async function createRelationProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await mkdir(path.join(cwd, "src/commands"), { recursive: true });
  await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = true;\n", "utf8");
  await writeFile(path.join(cwd, "src/commands/auth.ts"), "export const auth = true;\n", "utf8");
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(
    path.join(cwd, ".context/modules/route.md"),
    [
      "---",
      "context_type: module",
      "module: route",
      "paths:",
      "  - src/commands/route.ts",
      "aliases:",
      "  - route",
      "confidence: ai-drafted",
      "---",
      "# Module: route",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(cwd, ".context/modules/auth.md"),
    [
      "---",
      "context_type: module",
      "module: auth",
      "paths:",
      "  - src/commands/auth.ts",
      "aliases:",
      "  - auth",
      "confidence: ai-drafted",
      "---",
      "# Module: auth",
      ""
    ].join("\n"),
    "utf8"
  );
  return cwd;
}

async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const original = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return output;
}

function relationPatch(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(
    {
      schema: "cmap.relation_patch.v1",
      agent: "test-agent",
      summary: "Route depends on auth for relation expansion.",
      operations: [
        {
          op: "relation.candidate.add",
          relation: "depends_on",
          from: "route",
          to: "auth",
          summary: "Route reads reviewed module relations when expanding context.",
          evidence: ["src/commands/route.ts"],
          confidence: 0.9
        }
      ],
      ...overrides
    },
    null,
    2
  );
}

describe("M20 relation candidate workflow", () => {
  test("validates RelationPatch v1 and rejects unknown relation types", async () => {
    const patch = parseRelationPatch(relationPatch());

    expect(patch.operations[0].relation).toBe("depends_on");

    expect(() =>
      parseRelationPatch(
        relationPatch({
          operations: [
            {
              op: "relation.candidate.add",
              relation: "invented_by",
              from: "route",
              to: "auth",
              summary: "Invalid relation.",
              evidence: ["src/commands/route.ts"]
            }
          ]
        })
      )
    ).toThrow(/Unknown relation type: invented_by/);
  });

  test("rejects missing modules and missing file evidence before inbox writes", async () => {
    const cwd = await createRelationProject("m20-validate");
    const missingModule = parseRelationPatch(
      relationPatch({
        operations: [
          {
            op: "relation.candidate.add",
            relation: "depends_on",
            from: "route",
            to: "missing",
            summary: "Missing target module.",
            evidence: ["src/commands/route.ts"]
          }
        ]
      })
    );
    const missingEvidence = parseRelationPatch(
      relationPatch({
        operations: [
          {
            op: "relation.candidate.add",
            relation: "depends_on",
            from: "route",
            to: "auth",
            summary: "Missing evidence file.",
            evidence: ["src/commands/missing.ts"]
          }
        ]
      })
    );

    const moduleEvaluations = await evaluateRelationPatch(cwd, missingModule);
    const evidenceEvaluations = await evaluateRelationPatch(cwd, missingEvidence);

    expect(moduleEvaluations[0]).toMatchObject({ action: "reject", reason: "missing module: missing" });
    expect(evidenceEvaluations[0]).toMatchObject({ action: "reject", reason: "missing evidence: src/commands/missing.ts" });
  });

  test("ingest dry-run renders stable fingerprint without writing inbox files", async () => {
    const cwd = await createRelationProject("m20-dry-run");
    const input = path.join(cwd, "relation.json");
    await writeFile(input, relationPatch(), "utf8");

    const output = await captureStdout(() => runRelateIngest(cwd, { from: "relation.json", dryRun: true }));

    expect(output).toContain("# RelationPatch Dry Run");
    expect(output).toContain("relation.candidate.add");
    expect(output).toContain("Fingerprint:");
    expect(output).toContain("Action: inbox");
    await expect(readdir(path.join(cwd, ".context/inbox/relations"))).rejects.toThrow();
  });

  test("write-inbox writes JSON Markdown audit files and skips duplicate fingerprints", async () => {
    const cwd = await createRelationProject("m20-write-inbox");
    await writeFile(path.join(cwd, "relation.json"), relationPatch(), "utf8");

    const first = await captureStdout(() => runRelateIngest(cwd, { from: "relation.json", writeInbox: true }));
    const second = await captureStdout(() => runRelateIngest(cwd, { from: "relation.json", writeInbox: true }));

    expect(first).toContain("Written candidates: 1");
    expect(second).toContain("Duplicate candidates skipped: 1");
    const relationFiles = await readdir(path.join(cwd, ".context/inbox/relations"));
    const jsonFiles = relationFiles.filter((file) => file.endsWith(".json"));
    const mdFiles = relationFiles.filter((file) => file.endsWith(".md"));
    expect(jsonFiles).toHaveLength(1);
    expect(mdFiles).toHaveLength(1);
    expect(jsonFiles[0].replace(/\.json$/, "")).toBe(mdFiles[0].replace(/\.md$/, ""));

    const candidate = JSON.parse(await readFile(path.join(cwd, ".context/inbox/relations", jsonFiles[0]), "utf8")) as {
      id: string;
      fingerprint: string;
      relation: string;
      from: string;
      to: string;
    };
    expect(candidate.id).toMatch(/^relation-\d{4}-\d{2}-\d{2}t.+-[a-f0-9]{10}$/);
    expect(candidate.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate).toMatchObject({ relation: "depends_on", from: "route", to: "auth" });
    expect(await expectFile(path.join(cwd, ".context/inbox/relations", mdFiles[0]))).toContain("candidate input only");
    const auditFiles = await readdir(path.join(cwd, ".context/audit"));
    expect(auditFiles.some((file) => file.startsWith("relation-ingest-") && file.endsWith(".md"))).toBe(true);
  });

  test("promote dry-run is candidate-only and does not edit canonical module relations", async () => {
    const cwd = await createRelationProject("m20-promote");
    await writeFile(path.join(cwd, "relation.json"), relationPatch(), "utf8");
    await captureStdout(() => runRelateIngest(cwd, { from: "relation.json", writeInbox: true }));
    const files = await readdir(path.join(cwd, ".context/inbox/relations"));
    const id = files.find((file) => file.endsWith(".json"))?.replace(/\.json$/, "");
    if (!id) {
      throw new Error("Expected relation candidate id");
    }

    const output = await captureStdout(() => runRelatePromote(cwd, id, { dryRun: true }));

    expect(output).toContain("# Relation Promote Dry Run");
    expect(output).toContain("No canonical files changed.");
    expect(output).toContain("depends_on: route -> auth");
    expect(await expectFile(path.join(cwd, ".context/modules/route.md"))).not.toContain("depends_on:");
  });

  test("request prints a RelationPatch v1 template for human review workflow", async () => {
    const output = await captureStdout(() => runRelateRequest("/tmp", { from: "route", to: "auth", relation: "depends_on" }));

    expect(output).toContain("cmap.relation_patch.v1");
    expect(output).toContain("\"relation\": \"depends_on\"");
    expect(output).toContain("\"from\": \"route\"");
    expect(output).toContain("\"to\": \"auth\"");
  });

  test("route warns about relation candidates without consuming them as canonical context", async () => {
    const cwd = await createRelationProject("m20-route-warning");
    await writeFile(path.join(cwd, "relation.json"), relationPatch(), "utf8");
    await captureStdout(() => runRelateIngest(cwd, { from: "relation.json", writeInbox: true }));

    const result = await runCmap(["route", "route"], cwd);
    const json = await runCmap(["route", "route", "--format", "json"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Pending relation candidates exist");
    expect(result.stdout).toContain("Route does not consume unpromoted candidates");
    const parsed = JSON.parse(json.stdout) as {
      modules: Array<{ id: string }>;
      contextModules: Array<{ id: string }>;
      warnings: string[];
    };
    expect(parsed.modules.map((module) => module.id)).toEqual(["route"]);
    expect(parsed.contextModules.map((module) => module.id)).toEqual(["route"]);
    expect(parsed.warnings[0]).toContain("Pending relation candidates exist");
  });
});
