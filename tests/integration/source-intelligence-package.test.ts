import { execFile } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { createTempProject, repoRoot } from "../helpers.js";

const execFileAsync = promisify(execFile);

describe("source intelligence packaged CLI", () => {
  test("runs source index with production dependencies only", async () => {
    const packDir = await createTempProject("source-intelligence-pack");
    const installRoot = await createTempProject("source-intelligence-prod-install");
    await writeFile(path.join(installRoot, "package.json"), JSON.stringify({ private: true, type: "module" }));

    await execFileAsync("pnpm", ["build"], { cwd: repoRoot, encoding: "utf8", timeout: 120_000 });
    await execFileAsync("npm", ["pack", "--ignore-scripts", "--pack-destination", packDir], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120_000
    });
    const tarball = (await readdir(packDir)).find((entry) => entry.endsWith(".tgz"));
    expect(tarball).toBeTruthy();

    await execFileAsync("pnpm", ["add", "--prod", path.join(packDir, tarball ?? "")], {
      cwd: installRoot,
      encoding: "utf8",
      timeout: 120_000
    });

    const cmapBin = path.join(installRoot, "node_modules", ".bin", "cmap");
    const version = await execFileAsync(cmapBin, ["version"], { cwd: installRoot, encoding: "utf8", timeout: 30_000 });
    expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);

    await mkdir(path.join(installRoot, "src"), { recursive: true });
    await writeFile(path.join(installRoot, "src", "a.ts"), "export function packagedTarget() { return 1; }\n");
    await execFileAsync(cmapBin, ["init", "--auto"], { cwd: installRoot, encoding: "utf8", timeout: 30_000 });
    const indexed = await execFileAsync(cmapBin, ["source", "index", "--json"], { cwd: installRoot, encoding: "utf8", timeout: 30_000 });
    const payload = JSON.parse(indexed.stdout) as { generated: boolean; canonical: boolean; status: string; meta: { fileCount: number } };

    expect(payload).toMatchObject({ generated: true, canonical: false, status: "indexed" });
    expect(payload.meta.fileCount).toBe(1);
  }, 180_000);
});
