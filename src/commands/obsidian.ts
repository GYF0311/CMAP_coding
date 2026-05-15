import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";
import { writeCandidateDrafts, type CandidateDraft } from "../core/candidate-store.js";
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
  check?: boolean;
};

type ObsidianOpenOptions = {
  vaultName?: string;
};

type ObsidianPullOptions = {
  from?: string;
  dryRun?: boolean;
  writeInbox?: boolean;
};

type ObsidianCandidate = {
  notePath: string;
  sourcePath: string;
  reason: string;
};

type ExportEntry = {
  target: string;
  content: string;
};

export async function runObsidianExport(cwd: string, options: ObsidianExportOptions): Promise<number> {
  const [project, modules] = await Promise.all([loadProjectInfo(cwd), loadModuleIndex(cwd)]);
  const exportRoot = await resolveInsideRoot(cwd, options.out || path.join("_cmap", project.projectId));
  const entries = await buildExportEntries(cwd, project.projectId, exportRoot, modules);
  if (options.check) {
    return checkObsidianExport(cwd, exportRoot, entries);
  }

  const writes: string[] = [];
  for (const entry of entries) {
    await mkdir(path.dirname(entry.target), { recursive: true });
    await writeFile(entry.target, entry.content, "utf8");
    writes.push(projectRelative(cwd, entry.target));
  }

  process.stdout.write(`Exported Obsidian view to ${projectRelative(cwd, exportRoot)} (${writes.length} files)\n`);
  return 0;
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

export async function runObsidianPull(cwd: string, options: ObsidianPullOptions): Promise<void> {
  const project = await loadProjectInfo(cwd);
  const exportRoot = await resolveInsideRoot(cwd, options.from || path.join("_cmap", project.projectId));
  const modulesRoot = path.join(exportRoot, "modules");
  if (!(await fileExists(modulesRoot))) {
    process.stdout.write(`No Obsidian module export found at ${projectRelative(cwd, modulesRoot)}\n`);
    return;
  }

  const candidates = await detectObsidianCandidates(cwd, modulesRoot);
  const report = renderPullReport(candidates);
  if (options.writeInbox && candidates.length > 0) {
    const structured = await writeCandidateDrafts(cwd, candidates.map(obsidianCandidateDraft));
    const inboxRoot = path.join(cwd, ".context", "inbox");
    await mkdir(inboxRoot, { recursive: true });
    const target = path.join(inboxRoot, `obsidian-${dateStamp()}.md`);
    await writeFile(target, report, "utf8");
    process.stdout.write(`Structured candidates written: ${structured.written.length}\n`);
    process.stdout.write(`Structured duplicate candidates skipped: ${structured.duplicates.length}\n`);
    process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
    return;
  }

  process.stdout.write(report);
}

async function buildExportEntries(
  cwd: string,
  projectId: string,
  exportRoot: string,
  modules: ContextModule[]
): Promise<ExportEntry[]> {
  const modulesRoot = path.join(exportRoot, "modules");
  const lookup = moduleById(modules);
  const entries: ExportEntry[] = [];
  for (const module of modules) {
    entries.push({
      target: path.join(modulesRoot, `${moduleNoteTitle(module)}.md`),
      content: renderModuleNote(projectId, module, lookup)
    });
  }

  entries.push({
    target: path.join(exportRoot, "00_INDEX.md"),
    content: renderIndex(projectId, modules)
  });

  for (const source of ["MAP.md", "STATUS.md", "DECISIONS.md", "VERIFY.md"]) {
    const sourcePath = path.join(cwd, ".context", source);
    if (!(await fileExists(sourcePath))) {
      continue;
    }
    entries.push({
      target: path.join(exportRoot, source),
      content: renderContextMirror(source, await readFile(sourcePath, "utf8"))
    });
  }

  return entries;
}

async function checkObsidianExport(cwd: string, exportRoot: string, entries: ExportEntry[]): Promise<number> {
  const expected = new Map(entries.map((entry) => [entry.target, entry.content]));
  const issues: string[] = [];
  for (const entry of entries) {
    if (!(await fileExists(entry.target))) {
      issues.push(`would create ${projectRelative(cwd, entry.target)}`);
      continue;
    }
    const current = await readFile(entry.target, "utf8");
    if (current !== entry.content) {
      issues.push(`would update ${projectRelative(cwd, entry.target)}`);
    }
  }

  const modulesRoot = path.join(exportRoot, "modules");
  if (await fileExists(modulesRoot)) {
    const existingModuleNotes = await readdir(modulesRoot);
    for (const note of existingModuleNotes.filter((entry) => entry.endsWith(".md")).sort()) {
      const target = path.join(modulesRoot, note);
      if (!expected.has(target)) {
        issues.push(`would remove stale view ${projectRelative(cwd, target)}`);
      }
    }
  }

  if (issues.length === 0) {
    process.stdout.write(`Obsidian export is up to date: ${projectRelative(cwd, exportRoot)}\n`);
    return 0;
  }

  process.stdout.write(["# Obsidian Export Check", "", `Out of date: ${issues.length}`, "", ...issues.map((issue) => `- ${issue}`), ""].join("\n"));
  return 1;
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
    `source_hash: ${yamlString(`sha256:${moduleBodyHash(module.body)}`)}`,
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

function moduleBodyHash(value: string): string {
  return sha256(value.trim());
}

async function detectObsidianCandidates(cwd: string, modulesRoot: string): Promise<ObsidianCandidate[]> {
  const entries = await readdir(modulesRoot);
  const candidates: ObsidianCandidate[] = [];

  for (const entry of entries.filter((file) => file.endsWith(".md")).sort()) {
    const absoluteNotePath = path.join(modulesRoot, entry);
    const raw = await readFile(absoluteNotePath, "utf8");
    const parsed = matter(raw);
    const sourcePath = typeof parsed.data.source_path === "string" ? parsed.data.source_path : "";
    if (!sourcePath.startsWith(".context/modules/")) {
      continue;
    }

    const sourceAbsolute = path.join(cwd, sourcePath);
    if (!(await fileExists(sourceAbsolute))) {
      candidates.push({
        notePath: projectRelative(cwd, absoluteNotePath),
        sourcePath,
        reason: "source module doc is missing"
      });
      continue;
    }

    const exportedBody = extractSourceModuleDoc(raw);
    if (!exportedBody) {
      continue;
    }
    const currentBody = matter(await readFile(sourceAbsolute, "utf8")).content;
    if (moduleBodyHash(exportedBody) !== moduleBodyHash(currentBody)) {
      candidates.push({
        notePath: projectRelative(cwd, absoluteNotePath),
        sourcePath,
        reason: "exported Source Module Doc differs from canonical module doc"
      });
    }
  }

  return candidates;
}

function extractSourceModuleDoc(raw: string): string {
  const marker = "\n## Source Module Doc\n";
  const markerIndex = raw.indexOf(marker);
  if (markerIndex === -1) {
    return "";
  }
  return raw.slice(markerIndex + marker.length).trim();
}

function renderPullReport(candidates: ObsidianCandidate[]): string {
  const lines = [
    "# Obsidian Pull Dry Run",
    "",
    "This report is candidate input only. It does not modify canonical `.context` facts.",
    "",
    "## Detected Edits",
    ""
  ];

  if (candidates.length === 0) {
    lines.push("- None");
  } else {
    for (const candidate of candidates) {
      lines.push(`- ${candidate.notePath}`);
      lines.push(`  - source: \`${candidate.sourcePath}\``);
      lines.push(`  - reason: ${candidate.reason}`);
    }
  }

  lines.push(
    "",
    "## Suggested Action",
    "",
    "- Review each candidate manually.",
    "- Promote durable facts into `.context/modules/*.md`, `.context/DECISIONS.md`, or `.context/VERIFY.md` yourself.",
    "- Keep raw Obsidian thinking in `_cmap` or `.context/inbox`; do not auto-write canonical facts.",
    ""
  );

  return lines.join("\n");
}

function obsidianCandidateDraft(candidate: ObsidianCandidate): CandidateDraft {
  return {
    source: "obsidian-pull",
    type: "module.semantic.update",
    target: candidate.sourcePath || "unresolved",
    risk: "high",
    confidence: 0.6,
    summary: `${candidate.reason}: ${candidate.sourcePath}`,
    evidence: [candidate.notePath],
    fields: {
      modulePath: candidate.sourcePath,
      notePath: candidate.notePath,
      reason: candidate.reason
    }
  };
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
