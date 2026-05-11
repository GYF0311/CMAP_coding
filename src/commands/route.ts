import type { ContextModule } from "../core/module-index.js";
import { loadModuleIndex } from "../core/module-index.js";

type RouteOptions = {
  format?: string;
};

export type ModuleCandidate = {
  id: string;
  name: string;
  docPath: string;
  aliases: string[];
  paths: string[];
  score: number;
  matchedAliases: string[];
  matchedModuleName: boolean;
  matchedPathKeywords: string[];
};

export type RouteReport = {
  task: string;
  modules: ModuleCandidate[];
  ranked: ModuleCandidate[];
  lowConfidence: boolean;
  readFirst: string[];
};

export async function runRoute(cwd: string, task: string, options: RouteOptions): Promise<void> {
  const report = await routeTask(cwd, task);

  if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(toJsonReport(report), null, 2)}\n`);
    return;
  }

  process.stdout.write(formatRouteReport(task, report.modules, report.ranked));
}

export async function routeTask(cwd: string, task: string): Promise<RouteReport> {
  const candidates = (await loadModuleIndex(cwd)).map(toRouteCandidate);
  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, task))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  const strong = ranked.filter((candidate) => candidate.score > 0 && hasHighConfidenceSignal(candidate));
  return {
    task,
    modules: strong,
    ranked,
    lowConfidence: strong.length === 0,
    readFirst: buildReadFirst(strong)
  };
}

function toRouteCandidate(module: ContextModule): ModuleCandidate {
  return {
    id: module.id,
    name: module.id,
    docPath: module.docPath,
    aliases: module.aliases,
    paths: module.pathsInclude,
    score: 0,
    matchedAliases: [],
    matchedModuleName: false,
    matchedPathKeywords: []
  };
}

function scoreCandidate(candidate: ModuleCandidate, task: string): ModuleCandidate {
  const normalizedTask = task.toLocaleLowerCase();
  const matchedAliases = candidate.aliases.filter((alias) => matchesTerm(normalizedTask, alias));
  const matchedModuleName = matchesTerm(normalizedTask, candidate.id) || matchesTerm(normalizedTask, candidate.name);
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
  return [
    ".context/MAP.md",
    ".context/STATUS.md",
    ...modules.slice(0, 3).map((module) => module.docPath),
    ".context/VERIFY.md"
  ];
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

function toJsonReport(report: RouteReport): object {
  return {
    task: report.task,
    modules: report.modules.map((module) => ({
      id: module.id,
      name: module.name,
      docPath: module.docPath,
      score: module.score,
      evidence: evidence(module)
    })),
    lowConfidence: report.lowConfidence,
    readFirst: report.readFirst
  };
}

function evidence(module: ModuleCandidate): string[] {
  const values: string[] = [];
  for (const alias of module.matchedAliases) {
    values.push(`alias matched: ${alias}`);
  }
  if (module.matchedModuleName) {
    values.push(`module matched: ${module.id}`);
  }
  for (const keyword of module.matchedPathKeywords) {
    values.push(`path keyword matched: ${keyword}`);
  }
  return values;
}
