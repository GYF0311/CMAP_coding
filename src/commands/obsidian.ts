import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import {
  type ContextModule,
  loadModuleIndex,
  loadProjectInfo,
  moduleById,
  moduleNoteTitle
} from "../core/module-index.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";

type ObsidianExportOptions = {
  out?: string;
};

type ObsidianOpenOptions = {
  vaultName?: string;
};

export async function runObsidianExport(cwd: string, options: ObsidianExportOptions): Promise<void> {
  const [project, modules] = await Promise.all([loadProjectInfo(cwd), loadModuleIndex(cwd)]);
  const exportRoot = await resolveInsideRoot(cwd, options.out || path.join("_cmap", project.projectId));
  const modulesRoot = path.join(exportRoot, "modules");
  await mkdir(modulesRoot, { recursive: true });

  const lookup = moduleById(modules);
  const writes: string[] = [];
  for (const module of modules) {
    const target = path.join(modulesRoot, `${moduleNoteTitle(module)}.md`);
    await writeFile(target, renderModuleNote(project.projectId, module, lookup), "utf8");
    writes.push(projectRelative(cwd, target));
  }

  await writeFile(path.join(exportRoot, "00_INDEX.md"), renderIndex(project.projectId, modules), "utf8");
  writes.push(projectRelative(cwd, path.join(exportRoot, "00_INDEX.md")));

  for (const source of ["MAP.md", "STATUS.md", "DECISIONS.md", "VERIFY.md"]) {
    const sourcePath = path.join(cwd, ".context", source);
    if (!(await fileExists(sourcePath))) {
      continue;
    }
    const target = path.join(exportRoot, source);
    await writeFile(target, renderContextMirror(source, await readFile(sourcePath, "utf8")), "utf8");
    writes.push(projectRelative(cwd, target));
  }

  process.stdout.write(`Exported Obsidian view to ${projectRelative(cwd, exportRoot)} (${writes.length} files)\n`);
}

export async function runObsidianOpen(cwd: string, moduleId: string, options: ObsidianOpenOptions): Promise<void> {
  const [project, modules] = await Promise.all([loadProjectInfo(cwd), loadModuleIndex(cwd)]);
  const module = modules.find((candidate) => candidate.id === moduleId || candidate.name === moduleId);
  if (!module) {
    process.stdout.write(`No module found for ${moduleId}\n`);
    return;
  }

  process.stdout.write(`${obsidianUri(options.vaultName || "corpus", project.projectId, moduleNoteTitle(module))}\n`);
}

function renderModuleNote(projectId: string, module: ContextModule, lookup: Map<string, ContextModule>): string {
  const title = moduleNoteTitle(module);
  const relationLines = renderRelationLinks(module, lookup);
  const lines = [
    "---",
    `type: ${yamlString("cmap-module")}`,
    `schema: ${yamlString("cmap.module.v1")}`,
    `project: ${yamlString(projectId)}`,
    `module_id: ${yamlString(module.id)}`,
    `status: ${yamlString(module.status || "active")}`,
    `layer: ${yamlString(module.layer || "unknown")}`,
    `risk: ${yamlString(module.risk || "unknown")}`,
    `source_path: ${yamlString(module.docPath)}`,
    `source_hash: ${yamlString(`sha256:${sha256(module.body)}`)}`,
    "tags:",
    `  - ${yamlString("cmap/module")}`,
    `  - ${yamlString(`cmap/project/${projectId}`)}`,
    ...(module.layer ? [`  - ${yamlString(`cmap/layer/${module.layer}`)}`] : []),
    ...(module.risk ? [`  - ${yamlString(`cmap/risk/${module.risk}`)}`] : []),
    "aliases:",
    ...yamlList(module.aliases),
    "paths:",
    ...yamlList(module.pathsInclude),
    "---",
    "",
    `# ${title}`,
    "",
    `> Source: \`${module.docPath}\``,
    "",
    "## Relations",
    "",
    relationLines.length > 0 ? relationLines.join("\n") : "- No typed relations recorded yet.",
    "",
    "## Source Module Doc",
    "",
    module.body.trim(),
    ""
  ];

  return lines.join("\n");
}

function renderRelationLinks(module: ContextModule, lookup: Map<string, ContextModule>): string[] {
  const lines: string[] = [];
  for (const [relation, targets] of Object.entries(module.relations)) {
    const links = targets
      .map((target) => lookup.get(target))
      .filter((target): target is ContextModule => Boolean(target))
      .map((target) => `- [[${moduleNoteTitle(target)}]]`);
    if (links.length === 0) {
      continue;
    }
    lines.push(`### ${relation}`);
    lines.push("");
    lines.push(...links);
    lines.push("");
  }
  return lines;
}

function renderIndex(projectId: string, modules: ContextModule[]): string {
  const lines = [
    "---",
    `type: ${yamlString("cmap-index")}`,
    `project: ${yamlString(projectId)}`,
    "tags:",
    `  - ${yamlString("cmap/index")}`,
    "---",
    "",
    `# ${projectId} cmap index`,
    "",
    "## Core Files",
    "",
    "- [[MAP]]",
    "- [[STATUS]]",
    "- [[DECISIONS]]",
    "- [[VERIFY]]",
    "",
    "## Modules",
    ""
  ];

  for (const module of modules) {
    lines.push(`- [[modules/${moduleNoteTitle(module)}|${module.id}]]`);
  }

  lines.push(
    "",
    "## Graph Filter",
    "",
    "```text",
    `path:_cmap/${projectId}`,
    "```",
    ""
  );

  return lines.join("\n");
}

function renderContextMirror(name: string, content: string): string {
  return [
    "---",
    `type: ${yamlString("cmap-context-mirror")}`,
    `source_path: ${yamlString(`.context/${name}`)}`,
    "---",
    "",
    content.trim(),
    ""
  ].join("\n");
}

function obsidianUri(vaultName: string, projectId: string, noteTitle: string): string {
  const file = `_cmap/${projectId}/modules/${noteTitle}.md`;
  const params = new URLSearchParams({ vault: vaultName, file });
  return `obsidian://open?${params.toString()}`;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function yamlList(values: string[]): string[] {
  if (values.length === 0) {
    return ["  - \"\""];
  }
  return values.map((value) => `  - ${yamlString(value)}`);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
