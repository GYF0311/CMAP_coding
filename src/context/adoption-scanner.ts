import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./scanner.js";

export type AdoptionSignals = {
  stack: string[];
  files: string[];
  scripts: string[];
  candidateDirectories: string[];
  entrypoints: string[];
};

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export async function scanAdoptionSignals(cwd: string): Promise<AdoptionSignals> {
  const stack = new Set<string>();
  const files: string[] = [];
  const scripts: string[] = [];
  const entrypoints: string[] = [];

  const packagePath = path.join(cwd, "package.json");
  if (await fileExists(packagePath)) {
    files.push("package.json");
    stack.add("Node.js");
    const parsed = JSON.parse(await readFile(packagePath, "utf8")) as PackageJson;
    const deps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
    if (deps.typescript) stack.add("TypeScript");
    if (deps.react) stack.add("React");
    if (deps.vite || Object.values(parsed.scripts ?? {}).some((script) => script.includes("vite"))) stack.add("Vite");
    for (const script of Object.keys(parsed.scripts ?? {})) {
      scripts.push(`npm run ${script}`);
    }
  }

  for (const [file, label] of [
    ["pyproject.toml", "Python"],
    ["go.mod", "Go"],
    ["Cargo.toml", "Rust"],
    ["README.md", "README"]
  ] as const) {
    if (await fileExists(path.join(cwd, file))) {
      files.push(file);
      if (label !== "README") {
        stack.add(label);
      }
      if (label === "README") {
        entrypoints.push(file);
      }
    }
  }

  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    if (await fileExists(path.join(cwd, file))) {
      entrypoints.push(file);
    }
  }

  return {
    stack: [...stack],
    files,
    scripts,
    candidateDirectories: await candidateModuleDirectories(cwd),
    entrypoints
  };
}

async function candidateModuleDirectories(cwd: string): Promise<string[]> {
  const roots = ["src/features", "src/modules", "app", "pages"];
  const candidates: string[] = [];
  for (const root of roots) {
    const absolute = path.join(cwd, root);
    if (!(await fileExists(absolute))) {
      continue;
    }
    try {
      const entries = await readdir(absolute, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          candidates.push(`${root}/${entry.name}`);
        }
      }
    } catch {
      // Ignore unreadable candidate roots; adopt should remain best-effort.
    }
  }
  return candidates.sort();
}
