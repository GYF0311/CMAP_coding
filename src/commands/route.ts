import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";

type RouteOptions = {
  format?: string;
};

type ModuleCandidate = {
  name: string;
  docPath: string;
  aliases: string[];
  paths: string[];
  score: number;
  matchedAliases: string[];
  matchedModuleName: boolean;
  matchedPathKeywords: string[];
};

export async function runRoute(cwd: string, task: string, options: RouteOptions): Promise<void> {
  const candidates = await readModuleCandidates(cwd);
  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, task))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  const strong = ranked.filter((candidate) => candidate.score > 0 && hasHighConfidenceSignal(candidate));
  const report = {
    task,
    modules: strong,
    lowConfidence: strong.length === 0,
    readFirst: buildReadFirst(strong)
  };

  if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(formatRouteReport(task, strong, ranked));
}

async function readModuleCandidates(cwd: string): Promise<ModuleCandidate[]> {
  const modulesRoot = path.join(cwd, ".context", "modules");
  if (!(await fileExists(modulesRoot))) {
    return [];
  }

  const entries = await readdir(modulesRoot);
  const candidates: ModuleCandidate[] = [];

  for (const entry of entries.filter((file) => file.endsWith(".md"))) {
    const absolutePath = path.join(modulesRoot, entry);
    const raw = await readFile(absolutePath, "utf8");
    const parsed = matter(raw);
    const fallbackName = path.basename(entry, ".md");
    const aliases = normalizeStringArray(parsed.data.aliases);
    const modulePaths = normalizeStringArray(parsed.data.paths);
    const moduleName = typeof parsed.data.module === "string" ? parsed.data.module : fallbackName;

    candidates.push({
      name: moduleName,
      docPath: `.context/modules/${entry}`,
      aliases,
      paths: modulePaths,
      score: 0,
      matchedAliases: [],
      matchedModuleName: false,
      matchedPathKeywords: []
    });
  }

  return candidates;
}

function scoreCandidate(candidate: ModuleCandidate, task: string): ModuleCandidate {
  const normalizedTask = task.toLocaleLowerCase();
  const matchedAliases = candidate.aliases.filter((alias) => matchesTerm(normalizedTask, alias));
  const matchedModuleName = matchesTerm(normalizedTask, candidate.name);
  const matchedPathKeywords = pathKeywords(candidate.paths).filter((keyword) =>
    matchesTerm(normalizedTask, keyword)
  );

  return {
    ...candidate,
    matchedAliases,
    matchedModuleName,
    matchedPathKeywords,
    score: matchedAliases.length * 5 + (matchedModuleName ? 4 : 0) + matchedPathKeywords.length * 3
  };
}

function matchesTerm(normalizedText: string, rawTerm: string): boolean {
  const term = rawTerm.trim().toLocaleLowerCase();
  if (!term) {
    return false;
  }
  if (isAsciiWord(term)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i").test(normalizedText);
  }
  return normalizedText.includes(term);
}

function isAsciiWord(value: string): boolean {
  return /^[a-z0-9_-]+$/i.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasHighConfidenceSignal(candidate: ModuleCandidate): boolean {
  return candidate.matchedAliases.length > 0 || candidate.matchedModuleName;
}

function buildReadFirst(modules: ModuleCandidate[]): string[] {
  return [".context/MAP.md", ".context/STATUS.md", ...modules.slice(0, 3).map((module) => module.docPath)];
}

function formatRouteReport(task: string, modules: ModuleCandidate[], ranked: ModuleCandidate[]): string {
  const lines = ["## Route Result", "", `Task: ${task}`, "", "Likely modules:"];

  if (modules.length === 0) {
    lines.push("No high-confidence module match.");
  } else {
    modules.slice(0, 3).forEach((module, index) => {
      lines.push(`${index + 1}. ${module.name} — ${formatMatchReason(module)}`);
    });
  }

  lines.push("", "Read first:");
  for (const file of buildReadFirst(modules)) {
    lines.push(`- ${file}`);
  }

  const doNotTouch = ranked.filter((module) => module.score === 0).map((module) => module.name);
  if (doNotTouch.length > 0) {
    lines.push("", "Do not touch first:");
    for (const module of doNotTouch.slice(0, 5)) {
      lines.push(`- ${module}`);
    }
  }

  lines.push("", "Notes:");
  if (modules.length === 0) {
    lines.push("- No alias or module name matched; inspect source code and update MAP.md aliases after confirmation.");
  } else {
    lines.push("- Read the suggested context first, then decide the real impact range.");
    lines.push("- If route confidence is low, inspect source code and update MAP.md aliases.");
  }

  return `${lines.join("\n")}\n`;
}

function formatMatchReason(module: ModuleCandidate): string {
  if (module.matchedAliases.length > 0) {
    return `matched aliases: ${module.matchedAliases.join(", ")}`;
  }
  if (module.matchedModuleName) {
    return `matched module name: ${module.name}`;
  }
  return `matched path keywords: ${module.matchedPathKeywords.join(", ")}`;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function pathKeywords(paths: string[]): string[] {
  const keywords = new Set<string>();
  for (const filePath of paths) {
    for (const segment of filePath.split(/[\\/._-]/g)) {
      if (segment.length >= 3) {
        keywords.add(segment);
      }
    }
  }
  return [...keywords];
}
