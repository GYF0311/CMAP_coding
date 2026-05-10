import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import type { VerifyCommand } from "./templates.js";

type PackageJson = {
  scripts?: Record<string, string>;
};

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function inferVerifyCommands(cwd: string): Promise<VerifyCommand[]> {
  const packagePath = path.join(cwd, "package.json");
  if (!(await fileExists(packagePath))) {
    return [];
  }

  const parsed = JSON.parse(await readFile(packagePath, "utf8")) as PackageJson;
  const scripts = parsed.scripts ?? {};
  const commands: VerifyCommand[] = [];

  for (const script of ["test", "typecheck", "lint", "build"]) {
    if (scripts[script]) {
      commands.push({
        purpose: script,
        command: script === "test" ? "npm test" : `npm run ${script}`,
        expected: "exit 0",
        when: script === "test" ? "before claiming done" : "before release or handoff"
      });
    }
  }

  return commands;
}
