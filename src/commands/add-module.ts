import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CmapCommandError } from "../errors.js";
import { fileExists } from "../context/scanner.js";

type AddModuleOptions = {
  path?: string[];
  alias?: string[];
};

export async function runAddModule(cwd: string, name: string, options: AddModuleOptions): Promise<void> {
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(name)) {
    throw new CmapCommandError(`Invalid module name: ${name}`);
  }

  const modulesRoot = path.join(cwd, ".context", "modules");
  await mkdir(modulesRoot, { recursive: true });
  const target = path.join(modulesRoot, `${name}.md`);
  if (await fileExists(target)) {
    throw new CmapCommandError(`Module already exists: ${name}`);
  }

  const paths = options.path?.length ? options.path : [`TODO(ai-fill-${name}-path)`];
  const aliases = options.alias?.length ? options.alias : [name];
  const content = `---
cmap_version: 0.1
context_type: module
module: ${name}
paths:
${paths.map((item) => `  - ${item}`).join("\n")}
aliases:
${aliases.map((item) => `  - ${item}`).join("\n")}
confidence: candidate
---
# Module: ${name}

## Purpose
TODO(ai-fill)

## Code Paths
${paths.map((item) => `- ${item}`).join("\n")}

## Responsibilities
TODO(ai-fill)

## Depends On
TODO(ai-fill)

## Used By
TODO(ai-fill)

## Data Flow
TODO(ai-fill)

## State / Storage
TODO(ai-fill)

## Constraints
TODO(ai-fill)

## Traps
TODO(ai-fill)

## Tests / Verification
TODO(ai-fill)

## When to Update This Doc
When this module's responsibilities, dependencies, data flow, traps, or verification steps change.
`;

  await writeFile(target, content, "utf8");
  process.stdout.write(`Created .context/modules/${name}.md\n`);
}
