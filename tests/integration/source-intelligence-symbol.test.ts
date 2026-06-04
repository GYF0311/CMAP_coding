import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  runSymbolCallees,
  runSymbolCallers,
  runSymbolExplain,
  runSymbolFind
} from "../../src/commands/symbol.js";
import { createTempProject, runCmap } from "../helpers.js";

describe("source intelligence P1 symbol query", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("finds generated symbols with non-canonical JSON boundary labels", async () => {
    const cwd = await createSymbolProject("symbol-find");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);

    const stdout = await captureStdout(() =>
      runSymbolFind(cwd, "target", { json: true, kind: "Function", exportedOnly: true, limit: "5" })
    );

    const payload = JSON.parse(stdout) as {
      generated: boolean;
      canonical: boolean;
      label: string;
      matches: Array<{ name: string; qualifiedName: string; canonical: false }>;
      freshness: { generated: true; canonical: false; status: string };
      queryMetrics: { query: string; totalSymbols: number; returned: number };
    };

    expect(payload).toMatchObject({
      generated: true,
      canonical: false,
      label: "generated source evidence; non-canonical"
    });
    expect(payload.matches.map((match) => match.name)).toContain("target");
    expect(payload.matches.every((match) => match.canonical === false)).toBe(true);
    expect(payload.freshness).toMatchObject({ generated: true, canonical: false, status: "fresh" });
    expect(payload.queryMetrics).toMatchObject({ query: "target", returned: 1 });
    expect(payload.queryMetrics.totalSymbols).toBeGreaterThan(0);
    const metricFiles = await readdir(path.join(cwd, ".context", "generated", "source-index", "metrics"));
    expect(metricFiles.some((file) => file.includes("symbol-find"))).toBe(true);
  });

  test("explains unique symbols with callers, callees, imports, freshness, and confidence", async () => {
    const cwd = await createSymbolProject("symbol-explain");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);

    const stdout = await captureStdout(() => runSymbolExplain(cwd, "src/a.ts#target", { json: true }));

    const payload = JSON.parse(stdout) as {
      status: string;
      symbol: { name: string; qualifiedName: string; filePath: string };
      callers: Array<{ sourceSymbol?: { name: string }; filePath: string; confidenceTier: string }>;
      callees: Array<{ targetSymbol?: { name: string }; confidenceTier: string }>;
      imports: Array<{ kind: string; filePath: string }>;
      freshness: { status: string };
      confidence: string;
      queryMetrics: { candidates: number };
    };

    expect(payload.status).toBe("ok");
    expect(payload.symbol).toMatchObject({ name: "target", qualifiedName: "src/a.ts#target", filePath: "src/a.ts" });
    expect(payload.callers.some((caller) => caller.sourceSymbol?.name === "caller")).toBe(true);
    expect(payload.callees.some((callee) => callee.targetSymbol?.name === "helper")).toBe(true);
    expect(payload.imports.some((edge) => edge.kind === "IMPORTS_FROM" && edge.filePath === "src/a.ts")).toBe(true);
    expect(payload.freshness.status).toBe("fresh");
    expect(payload.confidence).toBe("high");
    expect(payload).toMatchObject({ truncated: false, omitted: { callers: 0, callees: 0, imports: 0 } });
    expect(payload.queryMetrics.candidates).toBe(1);
  });

  test("bounds symbol explain edge output and reports omitted counts", async () => {
    const cwd = await createSymbolProject("symbol-explain-limit");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);

    const stdout = await captureStdout(() => runSymbolExplain(cwd, "src/a.ts#target", { json: true, limit: "1" }));
    const payload = JSON.parse(stdout) as {
      status: string;
      callers: unknown[];
      omitted: { callers: number; callees: number; imports: number };
      truncated: boolean;
    };

    expect(payload.status).toBe("ok");
    expect(payload.callers).toHaveLength(1);
    expect(payload.omitted.callers).toBeGreaterThanOrEqual(1);
    expect(payload.truncated).toBe(true);
  });

  test("returns ambiguity candidates instead of silently choosing a duplicate symbol", async () => {
    const cwd = await createSymbolProject("symbol-ambiguity");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);

    const jsonStdout = await captureStdout(() => runSymbolExplain(cwd, "duplicate", { json: true }));
    const payload = JSON.parse(jsonStdout) as {
      status: string;
      ambiguityCandidates: Array<{ qualifiedName: string; filePath: string }>;
      freshness: { status: string };
      queryMetrics: { candidates: number };
    };

    expect(payload.status).toBe("ambiguous");
    expect(payload.ambiguityCandidates.map((candidate) => candidate.qualifiedName).sort()).toEqual([
      "src/a.ts#duplicate",
      "src/c.ts#duplicate"
    ]);
    expect(payload.freshness.status).toBe("fresh");
    expect(payload.queryMetrics.candidates).toBe(2);

    const markdown = await captureStdout(() => runSymbolExplain(cwd, "duplicate"));
    expect(markdown).toContain("Generated source evidence. Non-canonical");
    expect(markdown).toContain("Status: ambiguous");
    expect(markdown).toContain("Ambiguity candidates");
  });

  test("reports callers and callees with limits and generated freshness labels", async () => {
    const cwd = await createSymbolProject("symbol-call-graph");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);

    const callersStdout = await captureStdout(() => runSymbolCallers(cwd, "target", { json: true, limit: "1" }));
    const callersPayload = JSON.parse(callersStdout) as {
      status: string;
      callers: Array<{ sourceSymbol?: { name: string } }>;
      omitted: { callers: number };
      truncated: boolean;
      freshness: { generated: true; canonical: false; status: string };
    };

    expect(callersPayload.status).toBe("ok");
    expect(callersPayload.callers).toHaveLength(1);
    expect(callersPayload.omitted.callers).toBeGreaterThanOrEqual(1);
    expect(callersPayload.truncated).toBe(true);
    expect(callersPayload.freshness).toMatchObject({ generated: true, canonical: false, status: "fresh" });
    const callersMarkdown = await captureStdout(() => runSymbolCallers(cwd, "target", { limit: "1" }));
    expect(callersMarkdown).toContain("Truncated: yes");

    const calleesStdout = await captureStdout(() => runSymbolCallees(cwd, "target", { json: true, limit: "5" }));
    const calleesPayload = JSON.parse(calleesStdout) as {
      status: string;
      callees: Array<{ targetSymbol?: { name: string } }>;
      truncated: boolean;
    };

    expect(calleesPayload.status).toBe("ok");
    expect(calleesPayload.callees.some((callee) => callee.targetSymbol?.name === "helper")).toBe(true);
    expect(calleesPayload.truncated).toBe(false);
  });

  test("marks symbol reports stale when files changed after source index", async () => {
    const cwd = await createSymbolProject("symbol-stale");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);
    await writeFile(path.join(cwd, "src", "a.ts"), "export function target() { return helper() + 42; }\nfunction helper() { return 1; }\n");

    const stdout = await captureStdout(() => runSymbolFind(cwd, "target", { json: true }));
    const payload = JSON.parse(stdout) as {
      freshness: { status: string; staleFiles: string[] };
      confidence: string;
    };

    expect(payload.freshness.status).toBe("stale");
    expect(payload.freshness.staleFiles).toContain("src/a.ts");
    expect(payload.confidence).not.toBe("high");
  });

  test("exposes symbol commands through CLI", async () => {
    const cwd = await createSymbolProject("symbol-cli-boundary");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);

    const result = await runCmap(["symbol", "find", "target", "--json"], cwd);
    const payload = JSON.parse(result.stdout) as { matches: Array<{ name: string }> };

    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(payload.matches.map((match) => match.name)).toContain("target");
  });
});

async function createSymbolProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await mkdir(path.join(cwd, "tests"), { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }));
  await writeFile(path.join(cwd, "src", "a.ts"), [
    "import { importedHelper } from './helper';",
    "export function target() {",
    "  return helper() + importedHelper();",
    "}",
    "function helper() {",
    "  return 1;",
    "}",
    "export function duplicate() {",
    "  return target();",
    "}",
    ""
  ].join("\n"));
  await writeFile(path.join(cwd, "src", "b.ts"), [
    "import { target } from './a';",
    "export function caller() {",
    "  return target();",
    "}",
    "export function secondCaller() {",
    "  return target();",
    "}",
    ""
  ].join("\n"));
  await writeFile(path.join(cwd, "src", "c.ts"), [
    "export function duplicate() {",
    "  return 2;",
    "}",
    ""
  ].join("\n"));
  await writeFile(path.join(cwd, "src", "helper.ts"), "export function importedHelper() { return 1; }\n");
  await writeFile(path.join(cwd, "tests", "a.test.ts"), [
    "import { target } from '../src/a';",
    "test('target', () => {",
    "  target();",
    "});",
    ""
  ].join("\n"));
  return cwd;
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
