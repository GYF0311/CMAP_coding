import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runBenchmarkSourceIntelligence } from "../../src/commands/benchmark.js";
import { createTempProject, runCmap } from "../helpers.js";

describe("source intelligence benchmark", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("reports precision, recall, F1, token/tool-call proxies, and canonical-write boundary", async () => {
    const cwd = await createBenchmarkSourceProject("source-benchmark");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["source", "index"], cwd);
    await mkdir(path.join(cwd, "bench"), { recursive: true });
    await writeFile(
      path.join(cwd, "bench", "source-intelligence.jsonl"),
      [
        JSON.stringify({
          task: "Find the target symbol for a source-level task",
          query: "src/a.ts#target",
          expected_symbols: ["src/a.ts#target"]
        }),
        JSON.stringify({
          task: "Find files impacted when target implementation changes",
          query: "src/a.ts",
          expected_files: ["src/a.ts", "src/b.ts", "tests/a.test.ts"]
        })
      ].join("\n"),
      "utf8"
    );
    const canonicalBefore = await readCanonicalContext(cwd);

    const stdout = await captureStdout(async () => {
      const code = await runBenchmarkSourceIntelligence(cwd, { file: "bench/source-intelligence.jsonl" });
      expect(code).toBe(0);
    });

    expect(stdout).toContain("# Source Intelligence Benchmark");
    expect(stdout).toContain("Generated source evidence. Non-canonical");
    expect(stdout).toContain("Cases: 2");
    expect(stdout).toContain("Precision: 100%");
    expect(stdout).toContain("Recall: 100%");
    expect(stdout).toContain("F1: 100%");
    expect(stdout).toContain("baselineTokens=");
    expect(stdout).toContain("sourceToolCalls=");
    expect(stdout).toContain("falseCanonicalWrites=0");
    expect(await readCanonicalContext(cwd)).toEqual(canonicalBefore);
  });
});

async function createBenchmarkSourceProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await mkdir(path.join(cwd, "tests"), { recursive: true });
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }));
  await writeFile(path.join(cwd, "src", "a.ts"), [
    "export function target() {",
    "  return helper();",
    "}",
    "function helper() {",
    "  return 1;",
    "}",
    ""
  ].join("\n"));
  await writeFile(path.join(cwd, "src", "b.ts"), [
    "import { target } from './a';",
    "export function caller() {",
    "  return target();",
    "}",
    ""
  ].join("\n"));
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

async function readCanonicalContext(cwd: string): Promise<Record<string, string>> {
  const files = ["MAP.md", "CHECKPOINT.md", "STATUS.md", "DECISIONS.md", "VERIFY.md"];
  const moduleFiles = await collectRelativeFiles(path.join(cwd, ".context", "modules"), ".context/modules");
  const entries: Record<string, string> = {};
  for (const file of [...files.map((item) => `.context/${item}`), ...moduleFiles].sort()) {
    entries[file] = await readFile(path.join(cwd, file), "utf8");
  }
  return entries;
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
