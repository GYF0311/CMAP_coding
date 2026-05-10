import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");

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

const version = await run(["version"], project);
assertIncludes(version.stdout, "0.1.0", "version output");

await run(["init", "--auto"], project);
await run(["install", "--host", "both", "--hooks", "reminder"], project);
await run(["add-module", "chat", "--path", "src/features/chat", "--alias", "chat"], project);

const route = await run(["route", "chat message failing"], project);
assertIncludes(route.stdout, ".context/modules/chat.md", "route output");

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

const unknown = await run(["not-a-command"], project, 2);
const unknownCount = (unknown.stderr.match(/unknown command/g) ?? []).length;
if (unknownCount !== 1) {
  throw new Error(`Expected one unknown command message, got ${unknownCount}\n${unknown.stderr}`);
}

const status = await readFile(path.join(project, ".context", "STATUS.md"), "utf8");
assertIncludes(status, "Smoke test", "STATUS.md");

process.stdout.write(`Smoke test passed in ${project}\n`);
