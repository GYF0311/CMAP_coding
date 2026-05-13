import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, runCmap } from "../helpers.js";

async function createReleaseProject(name: string, packageOverrides: Record<string, unknown> = {}): Promise<string> {
  const cwd = await createTempProject(name);
  await mkdir(path.join(cwd, "dist"), { recursive: true });
  await mkdir(path.join(cwd, ".github/workflows"), { recursive: true });
  await writeFile(path.join(cwd, "dist/cli.js"), "#!/usr/bin/env node\n", "utf8");
  await writeFile(path.join(cwd, "README.md"), "# cmap\n", "utf8");
  await writeFile(path.join(cwd, "LICENSE"), "MIT\n", "utf8");
  await writeFile(path.join(cwd, ".github/workflows/cmap.yml"), "name: cmap\n", "utf8");
  await writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({
      name: "cmap",
      version: "0.1.0",
      description: "Repo-local project memory map CLI for AI coding",
      license: "MIT",
      repository: {
        type: "git",
        url: "https://github.com/GYF0311/CMAP_coding.git"
      },
      engines: {
        node: ">=20"
      },
      files: ["dist", "README.md", "LICENSE"],
      scripts: {
        prepack: "pnpm build && pnpm test && pnpm typecheck && pnpm smoke"
      },
      dependencies: {
        commander: "14.0.3"
      },
      devDependencies: {
        vitest: "4.1.5"
      },
      ...packageOverrides
    }, null, 2),
    "utf8"
  );
  return cwd;
}

describe("M23 release hygiene", () => {
  test("doctor --release passes when package metadata and artifacts are present", async () => {
    const cwd = await createReleaseProject("m23-release-pass");

    const result = await runCmap(["doctor", "--release"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# Release Doctor");
    expect(result.stdout).toContain("Errors: 0");
    expect(result.stdout).toContain("package repository: present");
    expect(result.stdout).toContain("dist/cli.js: present");
  });

  test("doctor --release rejects latest dependencies and missing package metadata", async () => {
    const cwd = await createReleaseProject("m23-release-fail", {
      description: "",
      repository: undefined,
      dependencies: {
        commander: "latest"
      }
    });

    const result = await runCmap(["doctor", "--release"], cwd);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("package description is missing");
    expect(result.stdout).toContain("package repository is missing");
    expect(result.stdout).toContain("dependencies.commander uses latest");
  });
});
