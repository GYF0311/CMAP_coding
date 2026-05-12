import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { loadModuleIndex, loadProjectInfo, moduleById, moduleNoteTitle } from "../core/module-index.js";
import { resolveInsideRoot, projectRelative } from "../fs/safe-path.js";
import { routeTask } from "./route.js";

type BriefOptions = {
  out?: string;
  obsidian?: boolean;
  vaultName?: string;
  maxContext?: string;
};

export async function runBrief(cwd: string, task: string, options: BriefOptions): Promise<void> {
  const [route, modules, project] = await Promise.all([
    routeTask(cwd, task, { maxContext: options.maxContext }),
    loadModuleIndex(cwd),
    loadProjectInfo(cwd)
  ]);
  const moduleLookup = moduleById(modules);
  const selectedModules = route.contextModules
    .slice(0, 6)
    .map((candidate) => moduleLookup.get(candidate.id))
    .filter((module): module is NonNullable<typeof module> => Boolean(module));
  const checkpoint = await readCurrentCheckpoint(cwd);
  const brief = renderBrief({
    task,
    route,
    selectedModules,
    checkpoint,
    projectId: project.projectId,
    includeObsidian: Boolean(options.obsidian),
    vaultName: options.vaultName || "corpus"
  });

  if (options.out) {
    const target = await resolveInsideRoot(cwd, options.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, ensureTrailingNewline(brief), "utf8");
    process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
    return;
  }

  process.stdout.write(ensureTrailingNewline(brief));
}

function renderBrief(input: {
  task: string;
  route: Awaited<ReturnType<typeof routeTask>>;
  selectedModules: Awaited<ReturnType<typeof loadModuleIndex>>;
  checkpoint: { label: string; content: string };
  projectId: string;
  includeObsidian: boolean;
  vaultName: string;
}): string {
  const lines = [
    "# AI Coding Brief",
    "",
    "## Task",
    "",
    input.task,
    "",
    "## Route Result",
    ""
  ];

  if (input.route.modules.length === 0) {
    lines.push("- No high-confidence module match. Start with `.context/MAP.md` and inspect source before editing.");
  } else {
    for (const module of input.route.modules.slice(0, 3)) {
      lines.push(`- ${module.id} (score ${module.score})`);
      lines.push(`  - doc: \`${module.docPath}\``);
      const evidence = routeEvidence(module);
      if (evidence.length > 0) {
        lines.push(`  - evidence: ${evidence.join("; ")}`);
      }
    }
  }

  lines.push("", "## Read First", "");
  for (const file of input.route.readFirst) {
    lines.push(`- \`${file}\``);
  }

  if (input.includeObsidian) {
    lines.push("", "## Obsidian Links", "");
    for (const module of input.selectedModules) {
      lines.push(`- ${module.id}: ${obsidianUri(input.vaultName, input.projectId, moduleNoteTitle(module))}`);
    }
  }

  lines.push("", `## ${input.checkpoint.label}`, "");
  lines.push(input.checkpoint.content.trim() ? excerptMarkdown(input.checkpoint.content) : "No checkpoint or status found.");

  lines.push("", "## Module Context", "");
  for (const module of input.selectedModules) {
    lines.push(`### ${module.id}`);
    lines.push("");
    lines.push(`Source: \`${module.docPath}\``);
    lines.push("");
    lines.push(module.body.trim() || "_No module body._");
    lines.push("");
  }

  lines.push(
    "## Boundaries",
    "",
    "- Treat route output as a reading plan, not a final implementation plan.",
    "- Do not update canonical `.context` facts unless the change is a confirmed long-lived project fact.",
    "- If evidence points outside the routed modules, inspect first and explain why.",
    "",
    "## Verify",
    "",
    "- Read `.context/VERIFY.md` before claiming completion.",
    "- Run the relevant project commands listed there.",
    ...input.route.verifyCommands.map((command) => `- Suggested by routed modules: \`${command}\``),
    "",
    "## Finish Requirement",
    "",
    "Before claiming completion, run or simulate:",
    "",
    "```bash",
    "cmap finish --changed",
    "```"
  );

  return lines.join("\n");
}

function routeEvidence(module: {
  matchedAliases: string[];
  matchedModuleName: boolean;
  matchedPathKeywords: string[];
}): string[] {
  const evidence: string[] = [];
  for (const alias of module.matchedAliases) {
    evidence.push(`alias matched: ${alias}`);
  }
  if (module.matchedModuleName) {
    evidence.push("module name matched");
  }
  for (const keyword of module.matchedPathKeywords) {
    evidence.push(`path keyword matched: ${keyword}`);
  }
  return evidence;
}

function obsidianUri(vaultName: string, projectId: string, noteTitle: string): string {
  const file = `_cmap/${projectId}/modules/${noteTitle}.md`;
  const params = new URLSearchParams({ vault: vaultName, file });
  return `obsidian://open?${params.toString()}`;
}

async function readOptionalFile(filePath: string): Promise<string> {
  if (!(await fileExists(filePath))) {
    return "";
  }
  return readFile(filePath, "utf8");
}

async function readCurrentCheckpoint(cwd: string): Promise<{ label: string; content: string }> {
  const checkpoint = await readOptionalFile(path.join(cwd, ".context", "CHECKPOINT.md"));
  if (checkpoint.trim()) {
    return { label: "Current Checkpoint", content: checkpoint };
  }
  return { label: "Current Status", content: await readOptionalFile(path.join(cwd, ".context", "STATUS.md")) };
}

function excerptMarkdown(status: string): string {
  const lines = status.trim().split(/\r?\n/);
  const withoutFrontmatter = lines[0] === "---" ? lines.slice(lines.indexOf("---", 1) + 1) : lines;
  return withoutFrontmatter.join("\n").trim();
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
