import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { contextDirectories, contextTemplates } from "../context/templates.js";
import { fileExists, inferVerifyCommands } from "../context/scanner.js";

type InitOptions = {
  auto?: boolean;
};

export async function runInit(cwd: string, options: InitOptions): Promise<void> {
  const contextRoot = path.join(cwd, ".context");
  const input = {
    projectName: path.basename(cwd),
    updatedAt: new Date().toISOString(),
    sourceCommit: "unknown",
    verifyCommands: await inferVerifyCommands(cwd)
  };

  await mkdir(contextRoot, { recursive: true });
  for (const directory of contextDirectories) {
    await mkdir(path.join(contextRoot, directory), { recursive: true });
  }

  let created = 0;
  let skipped = 0;
  for (const [relativePath, content] of contextTemplates(input)) {
    const target = path.join(contextRoot, relativePath);
    if (await fileExists(target)) {
      skipped += 1;
      continue;
    }
    await writeFile(target, content, "utf8");
    created += 1;
  }

  process.stdout.write(`Created .context skeleton (${created} files created, ${skipped} skipped)\n`);
}
