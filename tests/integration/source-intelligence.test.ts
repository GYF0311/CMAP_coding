import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

describe("source intelligence P0", () => {
  test("builds generated source index, reports freshness, and does not edit canonical context", async () => {
    const cwd = await createSourceProject("p0-index");
    await runCmap(["init", "--auto"], cwd);
    const canonicalBefore = await readCanonicalContext(cwd);
    const contextFilesBefore = await readContextFilePaths(cwd);

    const indexResult = await runCmap(["source", "index", "--json"], cwd);

    expect(indexResult).toMatchObject({ code: 0, stderr: "" });
    const indexJson = JSON.parse(indexResult.stdout) as {
      generated: boolean;
      canonical: boolean;
      label: string;
      status: string;
      meta: { fileCount: number; symbolCount: number; edgeCount: number };
      metrics: { files: number; symbols: number; edges: number; unresolvedRefs: number };
    };
    expect(indexJson).toMatchObject({
      generated: true,
      canonical: false,
      label: "generated source evidence; non-canonical",
      status: "indexed"
    });
    expect(indexJson.meta.fileCount).toBeGreaterThanOrEqual(3);
    expect(indexJson.metrics.symbols).toBeGreaterThan(0);
    expect(indexJson.metrics.edges).toBeGreaterThan(0);

    for (const relative of [
      ".context/generated/source-index/source-index.meta.json",
      ".context/generated/source-index/files.json",
      ".context/generated/source-index/symbols.json",
      ".context/generated/source-index/edges.json",
      ".context/generated/source-index/unresolved-refs.json"
    ]) {
      await expectFile(path.join(cwd, relative));
    }

    const statusResult = await runCmap(["source", "status", "--json"], cwd);
    expect(statusResult).toMatchObject({ code: 0, stderr: "" });
    const statusJson = JSON.parse(statusResult.stdout) as {
      generated: boolean;
      canonical: boolean;
      status: {
        exists: boolean;
        freshFiles: string[];
        staleFiles: string[];
        newFiles: string[];
      };
    };
    expect(statusJson.generated).toBe(true);
    expect(statusJson.canonical).toBe(false);
    expect(statusJson.status.exists).toBe(true);
    expect(statusJson.status.freshFiles).toContain("src/a.ts");
    expect(statusJson.status.staleFiles).not.toContain("src/a.ts");

    await writeFile(path.join(cwd, "src", "a.ts"), "export function target() { return 2; }\n");
    const staleResult = await runCmap(["source", "status", "--json"], cwd);
    const staleJson = JSON.parse(staleResult.stdout) as { status: { staleFiles: string[] } };
    expect(staleJson.status.staleFiles).toContain("src/a.ts");

    expect(await readCanonicalContext(cwd)).toEqual(canonicalBefore);
    expect(await addedContextFiles(cwd, contextFilesBefore)).toSatisfy((files: string[]) =>
      files.every((file) => file.startsWith(".context/generated/source-index/"))
    );
  });

  test("reports file impact as generated evidence and writes only generated source evidence", async () => {
    const cwd = await createSourceProject("p0-impact");
    await runCmap(["init", "--auto"], cwd);
    const canonicalBefore = await readCanonicalContext(cwd);
    const contextFilesBefore = await readContextFilePaths(cwd);
    await runCmap(["source", "index"], cwd);

    const impactResult = await runCmap(["impact", "file", "src/a.ts", "--json"], cwd);

    expect(impactResult).toMatchObject({ code: 0, stderr: "" });
    const report = JSON.parse(impactResult.stdout) as {
      generated: boolean;
      canonical: boolean;
      label: string;
      query: { matched: boolean; normalizedPath: string };
      changedFiles: string[];
      changedSymbols: Array<{ qualifiedName: string; filePath: string }>;
      impactedFiles: string[];
      likelyTests: string[];
      freshness: { generated: boolean; canonical: boolean; status: string };
      evidencePath?: string;
      nextCommands: string[];
    };
    expect(report).toMatchObject({
      generated: true,
      canonical: false,
      label: "generated source evidence; non-canonical"
    });
    expect(report.query).toMatchObject({ matched: true, normalizedPath: "src/a.ts" });
    expect(report.changedFiles).toEqual(["src/a.ts"]);
    expect(report.changedSymbols.some((symbol) => symbol.qualifiedName.includes("target"))).toBe(true);
    expect(report.impactedFiles).toContain("src/b.ts");
    expect(report.likelyTests).toContain("tests/a.test.ts");
    expect(report.likelyTests).not.toContain("tests/unrelated.test.ts");
    expect(report.freshness).toMatchObject({ generated: true, canonical: false, status: "fresh" });
    expect(report.nextCommands).toContain("cmap source status");
    expect(report.evidencePath).toMatch(/^\.context\/generated\/source-index\/evidence\/impact-file-/);
    await expectFile(path.join(cwd, report.evidencePath ?? ""));

    expect(await readCanonicalContext(cwd)).toEqual(canonicalBefore);
    expect(await addedContextFiles(cwd, contextFilesBefore)).toSatisfy((files: string[]) =>
      files.every((file) => file.startsWith(".context/generated/source-index/"))
    );
  });

  test("marks impact reports stale when source files changed after indexing", async () => {
    const cwd = await createSourceProject("p0-impact-stale");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);
    await writeFile(path.join(cwd, "src", "a.ts"), "export function target() { return 42; }\n");

    const impactResult = await runCmap(["impact", "file", "src/a.ts", "--json"], cwd);

    expect(impactResult).toMatchObject({ code: 0, stderr: "" });
    const report = JSON.parse(impactResult.stdout) as {
      freshness: { status: string; staleFiles: string[]; explanations: string[] };
      riskFactors: Array<{ kind: string; evidence: string[] }>;
      confidence: string;
    };
    expect(report.freshness.status).toBe("stale");
    expect(report.freshness.staleFiles).toContain("src/a.ts");
    expect(report.freshness.explanations).not.toContain("No current file-state snapshot was supplied; freshness is based on index metadata only.");
    expect(report.riskFactors.some((risk) => risk.kind === "stale-index" && risk.evidence.includes("src/a.ts"))).toBe(true);
    expect(report.confidence).not.toBe("high");
  });

  test("respects wildcard .gitignore rules when discovering source files", async () => {
    const cwd = await createSourceProject("p0-gitignore");
    await runCmap(["init", "--auto"], cwd);
    await mkdir(path.join(cwd, "src", "generated"), { recursive: true });
    await mkdir(path.join(cwd, "private"), { recursive: true });
    await writeFile(path.join(cwd, ".gitignore"), "*.secret.ts\n**/*.secret.ts\nsrc/generated/*.ts\n");
    await writeFile(path.join(cwd, ".codexignore"), "private/*.ts\n");
    await writeFile(path.join(cwd, "root.secret.ts"), "export const rootSecret = true;\n");
    await writeFile(path.join(cwd, "src", "hidden.secret.ts"), "export const secret = true;\n");
    await writeFile(path.join(cwd, "src", "generated", "model.ts"), "export const generated = true;\n");
    await writeFile(path.join(cwd, "private", "agent-hidden.ts"), "export const hiddenFromAgents = true;\n");

    await runCmap(["source", "index"], cwd);
    const files = JSON.parse(await readFile(path.join(cwd, ".context", "generated", "source-index", "files.json"), "utf8")) as Array<{ path: string }>;
    const meta = JSON.parse(await readFile(path.join(cwd, ".context", "generated", "source-index", "source-index.meta.json"), "utf8")) as {
      discovery: { ignoreFiles?: string[] };
    };
    const indexedPaths = files.map((file) => file.path);

    expect(indexedPaths).toContain("src/a.ts");
    expect(indexedPaths).not.toContain("root.secret.ts");
    expect(indexedPaths).not.toContain("src/hidden.secret.ts");
    expect(indexedPaths).not.toContain("src/generated/model.ts");
    expect(indexedPaths).not.toContain("private/agent-hidden.ts");
    expect(meta.discovery.ignoreFiles).toEqual([".gitignore", ".codexignore"]);
  });

  test("rejects impact paths that escape the project root", async () => {
    const cwd = await createSourceProject("p0-path-escape");
    await runCmap(["init", "--auto"], cwd);

    const result = await runCmap(["impact", "file", "../outside.ts", "--json"], cwd);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Path escapes project root");
  });
});

async function createSourceProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await mkdir(path.join(cwd, "tests"), { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }));
  await writeFile(path.join(cwd, "src", "a.ts"), "export function target() { return 1; }\n");
  await writeFile(path.join(cwd, "src", "b.ts"), [
    "import { target } from './a';",
    "export function caller() {",
    "  return target();",
    "}",
    ""
  ].join("\n"));
  await writeFile(path.join(cwd, "tests", "a.test.ts"), [
    "import { target } from '../src/a';",
    "export function testTarget() {",
    "  return target();",
    "}",
    ""
  ].join("\n"));
  await writeFile(path.join(cwd, "tests", "unrelated.test.ts"), [
    "test('unrelated', () => {",
    "  expect(1).toBe(1);",
    "});",
    ""
  ].join("\n"));
  return cwd;
}

async function readCanonicalContext(cwd: string): Promise<Record<string, string>> {
  const files = ["MAP.md", "CHECKPOINT.md", "STATUS.md", "DECISIONS.md", "VERIFY.md"];
  const moduleFiles = await collectRelativeFiles(path.join(cwd, ".context", "modules"), ".context/modules");
  const entries: Record<string, string> = {};
  for (const file of [...files.map((item) => `.context/${item}`), ...moduleFiles].sort()) {
    entries[file] = await readFile(path.join(cwd, file), "utf8");
  }
  return entries;
}

async function readContextFilePaths(cwd: string): Promise<Set<string>> {
  return new Set(await collectRelativeFiles(path.join(cwd, ".context"), ".context"));
}

async function addedContextFiles(cwd: string, before: Set<string>): Promise<string[]> {
  return [...await readContextFilePaths(cwd)]
    .filter((file) => !before.has(file))
    .sort();
}

async function collectRelativeFiles(root: string, relativeRoot: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(relativeRoot, entry.name);
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectRelativeFiles(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}
