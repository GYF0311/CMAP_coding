import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { listModuleEvidence } from "../core/generated-store.js";
import { moduleById, loadModuleIndex } from "../core/module-index.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";
import { routeTask } from "./route.js";

type PackOptions = {
  budget?: string;
  format?: string;
  out?: string;
  maxContext?: string;
};

const DEFAULT_TOKEN_BUDGET = 4000;
const CHARS_PER_TOKEN = 4;

export async function runPack(cwd: string, task: string, options: PackOptions): Promise<void> {
  const format = options.format ?? "markdown";
  if (format !== "markdown") {
    throw new CmapCommandError(`Unsupported pack format "${format}". Expected markdown.`);
  }

  const tokenBudget = parseTokenBudget(options.budget);
  const maxChars = tokenBudget * CHARS_PER_TOKEN;
  const [route, modules, checkpoint, status, decisions, verify, inbox] = await Promise.all([
    routeTask(cwd, task, { maxContext: options.maxContext ?? "8", graph: true }),
    loadModuleIndex(cwd),
    readOptionalContextFile(cwd, "CHECKPOINT.md"),
    readOptionalContextFile(cwd, "STATUS.md"),
    readOptionalContextFile(cwd, "DECISIONS.md"),
    readOptionalContextFile(cwd, "VERIFY.md"),
    inboxSummary(cwd)
  ]);
  const lookup = moduleById(modules);
  const selectedModules = route.contextModules
    .map((candidate) => lookup.get(candidate.id))
    .filter((module): module is NonNullable<typeof module> => Boolean(module));
  const generatedEvidence = await generatedEvidenceSummary(cwd, selectedModules.map((module) => module.id));
  const rendered = redactSensitiveValues(renderPack({
    task,
    tokenBudget,
    maxChars,
    route,
    selectedModules,
    checkpoint,
    status,
    decisions,
    verify,
    inbox,
    generatedEvidence
  }));
  const packed = enforceCharBudget(rendered, maxChars);

  if (options.out) {
    const target = await resolveInsideRoot(cwd, options.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, ensureTrailingNewline(packed), "utf8");
    process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
    return;
  }

  process.stdout.write(ensureTrailingNewline(packed));
}

function renderPack(input: {
  task: string;
  tokenBudget: number;
  maxChars: number;
  route: Awaited<ReturnType<typeof routeTask>>;
  selectedModules: Awaited<ReturnType<typeof loadModuleIndex>>;
  checkpoint: string;
  status: string;
  decisions: string;
  verify: string;
  inbox: string;
  generatedEvidence: string;
}): string {
  const lines = [
    "# cmap Context Pack",
    "",
    `Task: ${input.task}`,
    `Approx token budget: ${input.tokenBudget}`,
    `Approx character budget: ${input.maxChars}`,
    "",
    "## Route",
    ""
  ];

  if (input.route.modules.length === 0) {
    lines.push("- No direct module match. Inspect `.context/MAP.md` before editing.");
  } else {
    for (const module of input.route.modules.slice(0, 3)) {
      lines.push(`- ${module.id}: score ${module.score}; doc ${module.docPath}`);
    }
  }

  const related = input.route.contextModules.filter((module) => module.source === "related");
  if (related.length > 0) {
    lines.push("", "## Graph Neighborhood", "");
    for (const module of related) {
      const relation = module.relation ? `${module.relation.type} from ${module.relation.from}` : "related";
      lines.push(`- ${module.id}: ${relation}`);
    }
  }

  lines.push("", "## Current Checkpoint", "");
  lines.push(excerptMarkdown(input.checkpoint) || "_No checkpoint found._");

  lines.push("", "## Current Status", "");
  lines.push(excerptMarkdown(input.status) || "_No status found._");

  lines.push("", "## Module Docs", "");
  for (const module of input.selectedModules) {
    lines.push(`### ${module.id}`, "");
    lines.push(`Source: \`${module.docPath}\``);
    lines.push("");
    lines.push(module.body.trim() || "_No module body._");
    lines.push("");
  }

  lines.push("", "## Decisions", "");
  lines.push(excerptMarkdown(input.decisions) || "_No decisions found._");

  lines.push("", "## Generated Evidence (Non-canonical)", "");
  lines.push(input.generatedEvidence);

  lines.push("", "## Verify Commands", "");
  if (input.route.verifyCommands.length > 0) {
    for (const command of input.route.verifyCommands) {
      lines.push(`- ${command}`);
    }
  } else {
    lines.push("- Read `.context/VERIFY.md`.");
  }

  lines.push("", "## Verification Source", "");
  lines.push(excerptMarkdown(input.verify) || "_No verification source found._");

  lines.push("", "## Inbox Warnings", "");
  lines.push(input.inbox);

  lines.push(
    "",
    "## Pack Boundaries",
    "",
    "- This pack contains routed graph-neighborhood context only, not the whole repository.",
    "- Treat generated evidence and inbox candidates as support signals, not canonical facts.",
    "- If the task escapes this neighborhood, rerun `cmap route` or `cmap pack` with a better task description."
  );

  return lines.join("\n");
}

async function generatedEvidenceSummary(cwd: string, moduleIds: string[]): Promise<string> {
  const lines: string[] = [];
  for (const moduleId of moduleIds) {
    const entries = (await listModuleEvidence(cwd, moduleId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 3);
    for (const entry of entries) {
      lines.push(`- ${moduleId}: ${entry.summary} (${entry.files.slice(0, 3).join(", ") || "no files"})`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "- No generated evidence for routed modules.";
}

function parseTokenBudget(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_TOKEN_BUDGET;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 50 || parsed > 200000) {
    throw new CmapCommandError(`Invalid --budget "${value}". Expected an integer from 50 to 200000.`);
  }
  return parsed;
}

async function readOptionalContextFile(cwd: string, relative: string): Promise<string> {
  const target = path.join(cwd, ".context", relative);
  if (!(await fileExists(target))) {
    return "";
  }
  return readFile(target, "utf8");
}

async function inboxSummary(cwd: string): Promise<string> {
  const inboxRoot = path.join(cwd, ".context", "inbox");
  if (!(await fileExists(inboxRoot))) {
    return "- Inbox directory not found.";
  }
  const entries = (await readdir(inboxRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  if (entries.length === 0) {
    return "- No pending inbox candidates.";
  }
  return [`- Pending inbox candidates: ${entries.length}`, ...entries.slice(0, 8).map((entry) => `- ${entry}`)].join("\n");
}

function excerptMarkdown(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const lines = trimmed.split(/\r?\n/);
  if (lines[0] !== "---") {
    return trimmed;
  }
  const end = lines.indexOf("---", 1);
  return (end >= 0 ? lines.slice(end + 1) : lines).join("\n").trim();
}

function redactSensitiveValues(value: string): string {
  return value
    .replace(/\b(api[_-]?key|token|secret|password)(\s*[:=]\s*)(["']?)[^\s"'`]+/gi, "$1$2[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g, "Bearer [REDACTED]");
}

function enforceCharBudget(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  const marker = "\n\n[Truncated to fit budget]\n";
  if (maxChars <= marker.length) {
    return marker.slice(0, maxChars);
  }
  return `${value.slice(0, maxChars - marker.length).trimEnd()}${marker}`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
