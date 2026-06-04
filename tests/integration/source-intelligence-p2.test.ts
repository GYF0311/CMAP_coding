import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runImpactDiff, runImpactSymbol } from "../../src/commands/impact.js";
import { runSourceArchitecture } from "../../src/commands/source.js";
import { createTempProject, runCmap } from "../helpers.js";

const execFileAsync = promisify(execFile);

describe("source intelligence P2 impact and architecture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("aggregates explicit file diff impact as generated advisory with module and freshness detail", async () => {
    const cwd = await createP2Project("p2-impact-diff-files");
    await runCmap(["source", "index"], cwd);

    const stdout = await captureStdout(() =>
      runImpactDiff(cwd, { json: true, files: "src/core.ts", maxResults: "20" })
    );

    const payload = JSON.parse(stdout) as {
      generated: boolean;
      canonical: boolean;
      label: string;
      query: { kind: string; source: string; files: string[] };
      changedFiles: string[];
      changedSymbols: Array<{ qualifiedName: string; filePath: string }>;
      impactedSymbols: Array<{ qualifiedName: string; filePath: string }>;
      impactedFiles: string[];
      likelyTests: string[];
      relatedModules: Array<{ module: string; files: string[] }>;
      riskFactors: Array<{ kind: string }>;
      fileReports: unknown[];
      freshness: { generated: true; canonical: false; status: string };
      confidence: string;
      truncated: boolean;
    };

    expect(payload).toMatchObject({
      generated: true,
      canonical: false,
      label: "generated source evidence; non-canonical"
    });
    expect(payload.query).toMatchObject({ kind: "diff", source: "files", files: ["src/core.ts"] });
    expect(payload.changedFiles).toEqual(["src/core.ts"]);
    expect(payload.changedSymbols.some((symbol) => symbol.qualifiedName === "src/core.ts#target")).toBe(true);
    expect(payload.impactedSymbols.some((symbol) => symbol.qualifiedName === "src/consumer.ts#caller")).toBe(true);
    expect(payload.impactedFiles).toContain("src/consumer.ts");
    expect(payload.likelyTests).toContain("tests/core.test.ts");
    expect(payload.likelyTests).not.toContain("tests/unrelated.test.ts");
    expect(payload.relatedModules.some((module) => module.module === "source" && module.files.includes("src/core.ts"))).toBe(true);
    expect(payload.fileReports).toHaveLength(1);
    expect(payload.freshness).toMatchObject({ generated: true, canonical: false, status: "fresh" });
    expect(payload.confidence).toBe("high");
    expect(payload.truncated).toBe(false);
    expect(payload.riskFactors.every((risk) => risk.kind !== "canonical-context-write")).toBe(true);
  });

  test("reads staged git diff files and marks stale source index confidence", async () => {
    const cwd = await createP2Project("p2-impact-diff-staged");
    await initGit(cwd);
    await runCmap(["source", "index"], cwd);
    await writeFile(path.join(cwd, "src", "core.ts"), [
      "export function target() {",
      "  return helper() + 42;",
      "}",
      "function helper() {",
      "  return 1;",
      "}",
      ""
    ].join("\n"));
    await execFileAsync("git", ["add", "src/core.ts"], { cwd });

    const stdout = await captureStdout(() =>
      runImpactDiff(cwd, { json: true, staged: true, maxResults: "20" })
    );
    const payload = JSON.parse(stdout) as {
      query: { source: string; staged: boolean };
      changedFiles: string[];
      freshness: { status: string; staleFiles: string[] };
      confidence: string;
      riskFactors: Array<{ kind: string; evidence: string[] }>;
    };

    expect(payload.query).toMatchObject({ source: "staged", staged: true });
    expect(payload.changedFiles).toEqual(["src/core.ts"]);
    expect(payload.freshness.status).toBe("stale");
    expect(payload.freshness.staleFiles).toContain("src/core.ts");
    expect(payload.confidence).not.toBe("high");
    expect(payload.riskFactors.some((risk) => risk.kind === "stale-index" && risk.evidence.includes("src/core.ts"))).toBe(true);
  });

  test("reports symbol-level impact with callers, callees, and file-impact fallback", async () => {
    const cwd = await createP2Project("p2-impact-symbol");
    await runCmap(["source", "index"], cwd);

    const stdout = await captureStdout(() =>
      runImpactSymbol(cwd, "src/core.ts#target", { json: true, maxResults: "20" })
    );
    const payload = JSON.parse(stdout) as {
      generated: boolean;
      canonical: boolean;
      label: string;
      status: string;
      advisory: string;
      symbol: { qualifiedName: string; filePath: string };
      callers: Array<{ qualifiedName: string; filePath: string }>;
      callees: Array<{ qualifiedName: string; filePath: string }>;
      changedSymbols: Array<{ qualifiedName: string }>;
      impactedFiles: string[];
      likelyTests: string[];
      fileImpact: { query: { normalizedPath: string }; generated: true; canonical: false };
      freshness: { generated: true; canonical: false; status: string };
    };

    expect(payload).toMatchObject({
      generated: true,
      canonical: false,
      label: "generated source evidence; non-canonical",
      status: "ok"
    });
    expect(payload.advisory).toContain("generated");
    expect(payload.symbol).toMatchObject({ qualifiedName: "src/core.ts#target", filePath: "src/core.ts" });
    expect(payload.callers.some((caller) => caller.qualifiedName === "src/consumer.ts#caller")).toBe(true);
    expect(payload.callees.some((callee) => callee.qualifiedName === "src/core.ts#helper")).toBe(true);
    expect(payload.changedSymbols).toEqual([expect.objectContaining({ qualifiedName: "src/core.ts#target" })]);
    expect(payload.impactedFiles).toContain("src/consumer.ts");
    expect(payload.likelyTests).toContain("tests/core.test.ts");
    expect(payload.likelyTests).not.toContain("tests/unrelated.test.ts");
    expect(payload.fileImpact).toMatchObject({
      generated: true,
      canonical: false,
      query: { normalizedPath: "src/core.ts" }
    });
    expect(payload.freshness).toMatchObject({ generated: true, canonical: false, status: "fresh" });
  });

  test("renders source architecture advisory with freshness, unresolved areas, tests, and candidate hints", async () => {
    const cwd = await createP2Project("p2-architecture");
    await runCmap(["source", "index"], cwd);

    const stdout = await captureStdout(() =>
      runSourceArchitecture(cwd, { json: true, maxItems: "50", includeCandidates: true })
    );
    const payload = JSON.parse(stdout) as {
      generated: boolean;
      canonical: boolean;
      label: string;
      freshness: { generated: true; canonical: false; status: string };
      entrypoints: Array<{ filePath: string; reason: string }>;
      hotFiles: Array<{ filePath: string; score: number; reason: string }>;
      hubSymbols: Array<{ symbol: { qualifiedName: string }; score: number; reason: string }>;
      unresolvedAreas: Array<{ filePath: string; reason: string; targets: string[] }>;
      testCoverageHints: Array<{ filePath: string; hasLikelyTest: boolean; likelyTests: string[] }>;
      architectureCandidateHints: Array<{ kind: string; reason: string; evidence: string[]; candidateOnly: true }>;
      confidence: string;
      omitted: { architectureCandidateHints: number };
      truncated: boolean;
    };

    expect(payload).toMatchObject({
      generated: true,
      canonical: false,
      label: "generated source architecture advisory; non-canonical"
    });
    expect(payload.freshness).toMatchObject({ generated: true, canonical: false, status: "fresh" });
    expect(payload.entrypoints.some((item) => item.filePath === "src/cli.ts")).toBe(true);
    expect(payload.hotFiles.some((item) => item.filePath === "src/core.ts" && item.score > 0 && item.reason)).toBe(true);
    expect(payload.hubSymbols.some((item) => item.symbol.qualifiedName === "src/core.ts#target" && item.score > 0 && item.reason)).toBe(true);
    expect(payload.unresolvedAreas.some((item) =>
      item.filePath === "src/unresolved.ts" &&
      item.reason.includes("external-module") &&
      item.targets.includes("external-lib")
    )).toBe(true);
    expect(payload.testCoverageHints.some((item) =>
      item.filePath === "src/core.ts" &&
      item.hasLikelyTest &&
      item.likelyTests.includes("tests/core.test.ts")
    )).toBe(true);
    expect(payload.architectureCandidateHints.some((hint) =>
      hint.candidateOnly && hint.kind === "hub-symbol" && hint.evidence.includes("src/core.ts#target")
    )).toBe(true);
    expect(["high", "medium", "low"]).toContain(payload.confidence);
    expect(payload.omitted.architectureCandidateHints).toBe(0);
    expect(payload.truncated).toBe(false);

    const defaultStdout = await captureStdout(() =>
      runSourceArchitecture(cwd, { json: true, maxItems: "50" })
    );
    const defaultPayload = JSON.parse(defaultStdout) as {
      architectureCandidateHints: unknown[];
      candidateHints: string[];
    };
    expect(defaultPayload.architectureCandidateHints).toEqual([]);
    expect(defaultPayload.candidateHints.length).toBeGreaterThan(0);
  });
});

async function createP2Project(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await mkdir(path.join(cwd, "tests"), { recursive: true });
  await mkdir(path.join(cwd, ".context", "modules"), { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
  await writeFile(path.join(cwd, "src", "core.ts"), [
    "export function target() {",
    "  return helper();",
    "}",
    "function helper() {",
    "  return 1;",
    "}",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(cwd, "src", "consumer.ts"), [
    "import { target } from './core';",
    "export function caller() {",
    "  return target();",
    "}",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(cwd, "src", "cli.ts"), [
    "import { caller } from './consumer';",
    "export function main() {",
    "  return caller();",
    "}",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(cwd, "src", "unresolved.ts"), [
    "import { externalThing } from 'external-lib';",
    "export function usesExternal() {",
    "  return externalThing();",
    "}",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(cwd, "tests", "core.test.ts"), [
    "import { target } from '../src/core';",
    "test('target', () => {",
    "  target();",
    "});",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(cwd, "tests", "unrelated.test.ts"), [
    "test('unrelated', () => {",
    "  expect(1).toBe(1);",
    "});",
    ""
  ].join("\n"), "utf8");
  await writeFile(
    path.join(cwd, ".context", "modules", "source.md"),
    [
      "---",
      "context_type: module",
      "module: source",
      "paths:",
      "  - src",
      "aliases:",
      "  - source",
      "relations: {}",
      "confidence: ai-drafted",
      "---",
      "# Module: source",
      "",
      "## Purpose",
      "Own source fixture behavior.",
      ""
    ].join("\n"),
    "utf8"
  );
  return cwd;
}

async function initGit(cwd: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd });
  await execFileAsync("git", ["config", "user.email", "p2@example.com"], { cwd });
  await execFileAsync("git", ["config", "user.name", "P2 Test"], { cwd });
  await execFileAsync("git", ["add", "."], { cwd });
  await execFileAsync("git", ["commit", "-m", "initial"], { cwd });
}

async function captureStdout(action: () => Promise<void>): Promise<string> {
  let stdout = "";
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  });
  await action();
  write.mockRestore();
  return stdout;
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
