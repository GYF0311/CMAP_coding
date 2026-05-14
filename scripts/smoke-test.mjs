import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");
const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

async function run(args, cwd, expectedCode = 0) {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd,
      encoding: "utf8"
    });
    if (expectedCode !== 0) {
      throw new Error(`Expected exit ${expectedCode} for ${args.join(" ")}, got 0`);
    }
    return { stdout: result.stdout, stderr: result.stderr, code: 0 };
  } catch (error) {
    const code = typeof error.code === "number" ? error.code : 1;
    if (code !== expectedCode) {
      throw new Error(
        `Expected exit ${expectedCode} for ${args.join(" ")}, got ${code}\nstdout:\n${error.stdout ?? ""}\nstderr:\n${error.stderr ?? error.message}`
      );
    }
    return { stdout: error.stdout ?? "", stderr: error.stderr ?? "", code };
  }
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label} did not include "${expected}"\nActual:\n${value}`);
  }
}

const project = await mkdtemp(path.join(tmpdir(), "cmap-smoke-"));
await writeFile(path.join(project, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
await mkdir(path.join(project, "src", "features", "chat"), { recursive: true });
await writeFile(path.join(project, "src", "features", "chat", "send.ts"), "export const send = true;\n", "utf8");

const version = await run(["version"], project);
assertIncludes(version.stdout, packageJson.version, "version output");

await run(["init", "--auto"], project);
await run(["install", "--host", "both", "--hooks", "reminder"], project);
await run(["add-module", "chat", "--path", "src/features/chat", "--alias", "chat"], project);

const route = await run(["route", "chat message failing"], project);
assertIncludes(route.stdout, ".context/modules/chat.md", "route output");

await run(
  [
    "checkpoint",
    "write",
    "--task",
    "Smoke test",
    "--hypothesis",
    "Brief should include checkpoint context",
    "--files",
    "src/features/chat/send.ts",
    "--next",
    "Generate brief",
    "--verified",
    "Built CLI smoke"
  ],
  project
);
const checkpointRead = await run(["checkpoint", "read"], project);
assertIncludes(checkpointRead.stdout, "# Current Checkpoint", "checkpoint read output");

const brief = await run(["brief", "chat message failing", "--out", ".context/out/brief.md"], project);
assertIncludes(brief.stdout, "Wrote .context/out/brief.md", "brief output");
const briefFile = await readFile(path.join(project, ".context", "out", "brief.md"), "utf8");
assertIncludes(briefFile, "# AI Coding Brief", "brief file");
assertIncludes(briefFile, "Smoke test", "brief checkpoint context");

const obsidian = await run(["obsidian", "export", "--out", "_cmap/Smoke"], project);
assertIncludes(obsidian.stdout, "Exported Obsidian view to _cmap/Smoke", "obsidian export output");
const obsidianNote = await readFile(path.join(project, "_cmap", "Smoke", "modules", "Chat.md"), "utf8");
assertIncludes(obsidianNote, 'type: "cmap-module"', "obsidian note");

await run(
  [
    "checkpoint",
    "--goal",
    "Smoke test",
    "--done",
    "Created context",
    "--left-off",
    "Before verify",
    "--next",
    "Run verify",
    "--verified",
    "Built CLI smoke"
  ],
  project
);

const verify = await run(["verify"], project);
assertIncludes(verify.stdout, "Errors: 0", "verify output");

const coverage = await run(["verify", "--coverage", "--changed-files", "src/features/chat/send.ts"], project);
assertIncludes(coverage.stdout, "Changed file coverage: 1/1 files mapped", "coverage output");

const pull = await run(["obsidian", "pull", "--from", "_cmap/Smoke"], project);
assertIncludes(pull.stdout, "# Obsidian Pull Dry Run", "obsidian pull output");

await mkdir(path.join(project, "bench"), { recursive: true });
await writeFile(
  path.join(project, "bench", "tasks.jsonl"),
  `${JSON.stringify({ task: "chat message failing", expected_modules: ["chat"] })}\n`,
  "utf8"
);
const benchmark = await run(["benchmark", "route", "--file", "bench/tasks.jsonl"], project);
assertIncludes(benchmark.stdout, "Top-1: 1/1", "benchmark output");

await mkdir(path.join(project, ".planning"), { recursive: true });
await writeFile(path.join(project, ".planning", "STATE.md"), "- Decision: keep cmap canonical facts in `.context`.\n", "utf8");
const reconcile = await run(["reconcile", "--adapter", "gsd-v1", "--from", ".planning"], project);
assertIncludes(reconcile.stdout, "# gsd-v1 Reconcile Dry Run", "reconcile output");

const unknown = await run(["not-a-command"], project, 2);
const unknownCount = (unknown.stderr.match(/unknown command/g) ?? []).length;
if (unknownCount !== 1) {
  throw new Error(`Expected one unknown command message, got ${unknownCount}\n${unknown.stderr}`);
}

const status = await readFile(path.join(project, ".context", "STATUS.md"), "utf8");
assertIncludes(status, "Smoke test", "STATUS.md");
const checkpoint = await readFile(path.join(project, ".context", "CHECKPOINT.md"), "utf8");
assertIncludes(checkpoint, "Smoke test", "CHECKPOINT.md");

process.stdout.write(`Smoke test passed in ${project}\n`);
