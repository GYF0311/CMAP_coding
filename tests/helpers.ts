import { execFile } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const repoRoot = path.resolve(import.meta.dirname, "..");
export const cliPath = path.join(repoRoot, "src/cli.ts");
export const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

export type CmapResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export async function runCmap(args: string[], cwd: string): Promise<CmapResult> {
  try {
    const result = await execFileAsync(tsxBin, [cliPath, ...args], {
      cwd,
      encoding: "utf8"
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as Error & {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message
    };
  }
}

export async function createTempProject(name: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), `cmap-${name}-`));
}

export async function expectFile(filePath: string): Promise<string> {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error(`Expected file at ${filePath}`);
  }
  return readFile(filePath, "utf8");
}
