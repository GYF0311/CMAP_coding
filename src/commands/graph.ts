import { CmapCommandError } from "../errors.js";
import { explainGraphModule, writeContextGraph } from "../core/context-graph.js";

export async function runGraphBuild(cwd: string): Promise<void> {
  const written = await writeContextGraph(cwd);
  for (const file of written) {
    process.stdout.write(`Wrote ${file}\n`);
  }
}

export async function runGraphExplain(cwd: string, moduleId: string): Promise<void> {
  const id = moduleId.trim();
  if (!id) {
    throw new CmapCommandError("graph explain requires a module id");
  }
  process.stdout.write(await explainGraphModule(cwd, id));
}
