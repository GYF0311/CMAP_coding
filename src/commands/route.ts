import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { writeCandidateDrafts, type CmapCandidate } from "../core/candidate-store.js";
import { computeDriftReport, renderDriftBlock, type DriftReport } from "../core/drift.js";
import type { ContextModule } from "../core/module-index.js";
import { loadModuleIndex } from "../core/module-index.js";
import { recordRouteUsage } from "../core/generated-stats.js";
import { CmapCommandError } from "../errors.js";

type RouteOptions = {
  format?: string;
  maxContext?: string | number;
  graph?: boolean;
  writeAliasCandidate?: boolean;
  recordUsage?: boolean;
};

const DEFAULT_MAX_CONTEXT_MODULES = 6;
const MAX_CONTEXT_MODULES_LIMIT = 20;

export type ModuleCandidate = {
  id: string;
  name: string;
  docPath: string;
  aliases: string[];
  paths: string[];
  relations: Record<string, string[]>;
  verifyCommands: string[];
  score: number;
  matchedAliases: string[];
  matchedModuleName: boolean;
  matchedPathKeywords: string[];
};

export type ContextModuleCandidate = ModuleCandidate & {
  source: "direct" | "related";
  relation?: {
    type: string;
    from: string;
  };
};

export type RouteReport = {
  task: string;
  modules: ModuleCandidate[];
  contextModules: ContextModuleCandidate[];
  ranked: ModuleCandidate[];
  lowConfidence: boolean;
  readFirst: string[];
  verifyCommands: string[];
  graphMode: boolean;
  warnings: string[];
  drift?: DriftReport;
  aliasCandidate?: AliasCandidateSuggestion;
  aliasCandidateWrite?: AliasCandidateWriteSummary;
};

type AliasCandidateSuggestion = {
  command: string;
  summary: string;
};

type AliasCandidateWriteSummary = {
  written: string[];
  duplicates: string[];
};

export async function runRoute(cwd: string, task: string, options: RouteOptions): Promise<void> {
  const report = await routeTask(cwd, task, options);
  if (options.recordUsage) {
    await recordRouteUsage(cwd, {
      source: "route",
      task,
      modules: report.modules.map((module) => module.id),
      contextModules: report.contextModules.map((module) => module.id)
    });
  }

  if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(toJsonReport(report), null, 2)}\n`);
    return;
  }

  process.stdout.write(formatRouteReport(report));
}

export async function routeTask(cwd: string, task: string, options: RouteOptions = {}): Promise<RouteReport> {
  const maxContext = parseMaxContext(options.maxContext);
  const candidates = (await loadModuleIndex(cwd)).map(toRouteCandidate);
  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, task))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  const strong = ranked.filter((candidate) => candidate.score > 0 && hasHighConfidenceSignal(candidate));
  const contextModules = buildContextModules(strong, candidates, maxContext);
  const verifyCommands = unique(contextModules.flatMap((module) => module.verifyCommands));
  const lowConfidence = strong.length === 0;
  const aliasCandidate = lowConfidence ? buildAliasCandidateSuggestion(task) : undefined;
  const aliasCandidateWrite = lowConfidence && options.writeAliasCandidate
    ? await writeAliasCandidateRequest(cwd, task, ranked)
    : undefined;
  const drift = strong.length > 0
    ? await computeDriftReport(cwd, { moduleId: strong[0].id })
    : undefined;
  return {
    task,
    modules: strong,
    contextModules,
    ranked,
    lowConfidence,
    readFirst: buildReadFirst(contextModules),
    verifyCommands,
    graphMode: Boolean(options.graph),
    warnings: await relationCandidateWarnings(cwd),
    drift,
    aliasCandidate,
    aliasCandidateWrite
  };
}

function toRouteCandidate(module: ContextModule): ModuleCandidate {
  return {
    id: module.id,
    name: module.id,
    docPath: module.docPath,
    aliases: module.aliases,
    paths: module.pathsInclude,
    relations: module.relations,
    verifyCommands: extractVerificationCommands(module.body),
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

function buildReadFirst(modules: Array<{ docPath: string }>): string[] {
  return unique([
    ".context/MAP.md",
    ".context/CHECKPOINT.md",
    ".context/STATUS.md",
    ...modules.slice(0, 6).map((module) => module.docPath),
    ".context/VERIFY.md"
  ]);
}

function formatRouteReport(report: RouteReport): string {
  const lines = ["## Route Result", "", `Task: ${report.task}`, "", "Likely modules:"];
  if (report.graphMode) {
    lines.splice(3, 0, "Graph mode: enabled", "");
  }

  if (report.modules.length === 0) {
    lines.push("No high-confidence module match.");
  } else {
    report.modules.slice(0, 3).forEach((module, index) => {
      lines.push(`${index + 1}. ${module.name} — ${formatMatchReason(module)}`);
    });
  }

  const related = report.contextModules.filter((module) => module.source === "related");
  if (related.length > 0) {
    lines.push("", "Related context:");
    for (const module of related.slice(0, 5)) {
      const relation = module.relation
        ? `related via ${module.relation.type} from ${module.relation.from}`
        : "related context";
      lines.push(`- ${module.name} — ${relation} (${module.docPath})`);
    }
  }

  lines.push("", "Read first:");
  for (const file of report.readFirst) {
    lines.push(`- ${file}`);
  }

  const driftBlock = report.drift ? renderDriftBlock(report.drift) : "";
  if (driftBlock) {
    lines.push("", driftBlock);
  }

  if (report.aliasCandidate) {
    lines.push("", "Suggested:");
    lines.push("- Inspect source code before editing.");
    lines.push("- Consider alias candidate:");
    lines.push(`  ${report.aliasCandidate.command}`);
  }

  if (report.aliasCandidateWrite) {
    if (report.aliasCandidateWrite.written.length > 0) {
      lines.push("", "Alias candidate request written:");
      for (const file of report.aliasCandidateWrite.written) {
        lines.push(`- ${file}`);
      }
    } else if (report.aliasCandidateWrite.duplicates.length > 0) {
      lines.push("", "Alias candidate request already exists:");
      for (const file of report.aliasCandidateWrite.duplicates) {
        lines.push(`- ${file}`);
      }
    }
  }

  if (report.verifyCommands.length > 0) {
    lines.push("", "Suggested verify:");
    for (const command of report.verifyCommands.slice(0, 8)) {
      lines.push(`- ${command}`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  const contextIds = new Set(report.contextModules.map((module) => module.id));
  const doNotTouch = report.ranked
    .filter((module) => module.score === 0 && !contextIds.has(module.id))
    .map((module) => module.name);
  if (doNotTouch.length > 0) {
    lines.push("", "Do not touch first:");
    for (const module of doNotTouch.slice(0, 5)) {
      lines.push(`- ${module}`);
    }
  }

  lines.push("", "Notes:");
  if (report.modules.length === 0) {
    lines.push("- No alias or module name matched; inspect source code and update MAP.md aliases after confirmation.");
  } else {
    lines.push("- Read the suggested context first, then decide the real impact range.");
    lines.push("- Related context comes from typed module relations; it is not a direct route match.");
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

function buildContextModules(
  strong: ModuleCandidate[],
  candidates: ModuleCandidate[],
  maxContext: number
): ContextModuleCandidate[] {
  const lookup = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const result: ContextModuleCandidate[] = [];
  const seen = new Set<string>();

  for (const module of strong.slice(0, 3)) {
    if (result.length >= maxContext) {
      break;
    }
    result.push({ ...module, source: "direct" });
    seen.add(module.id);
  }

  for (const module of strong.slice(0, 3)) {
    for (const [relationType, targets] of Object.entries(module.relations)) {
      for (const target of targets) {
        if (seen.has(target) || result.length >= maxContext) {
          continue;
        }
        const candidate = lookup.get(target);
        if (!candidate) {
          continue;
        }
        result.push({
          ...candidate,
          source: "related",
          relation: {
            type: relationType,
            from: module.id
          }
        });
        seen.add(candidate.id);
      }
    }
  }

  return result;
}

function parseMaxContext(value: string | number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MAX_CONTEXT_MODULES;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_CONTEXT_MODULES_LIMIT) {
    throw new CmapCommandError(
      `Invalid --max-context "${value}". Expected an integer from 1 to ${MAX_CONTEXT_MODULES_LIMIT}.`,
      2
    );
  }
  return parsed;
}

function extractVerificationCommands(body: string): string[] {
  const commands: string[] = [];
  let inTestsSection = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^##\s+Tests\s*\/\s*Verification\s*$/i.test(line.trim())) {
      inTestsSection = true;
      continue;
    }
    if (inTestsSection && /^##\s+/.test(line.trim())) {
      break;
    }
    if (!inTestsSection) {
      continue;
    }
    const match = line.match(/^-\s+`([^`]+)`/);
    if (match) {
      commands.push(match[1]);
    }
  }
  return unique(commands);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
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
    contextModules: report.contextModules.map((module) => ({
      id: module.id,
      name: module.name,
      docPath: module.docPath,
      source: module.source,
      relation: module.relation,
      verifyCommands: module.verifyCommands,
      evidence: evidence(module)
    })),
    lowConfidence: report.lowConfidence,
    readFirst: report.readFirst,
    verifyCommands: report.verifyCommands,
    graphMode: report.graphMode,
    warnings: report.warnings,
    drift: report.drift,
    aliasCandidate: report.aliasCandidate,
    aliasCandidateWrite: report.aliasCandidateWrite
  };
}

function evidence(module: ModuleCandidate | ContextModuleCandidate): string[] {
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
  if ("relation" in module && module.relation) {
    values.push(`related via ${module.relation.type} from ${module.relation.from}`);
  }
  return values;
}

function buildAliasCandidateSuggestion(task: string): AliasCandidateSuggestion {
  return {
    command: `cmap route ${JSON.stringify(task)} --write-alias-candidate`,
    summary: "No alias or module name matched. Inspect source before adding a reviewed module alias."
  };
}

async function writeAliasCandidateRequest(
  cwd: string,
  task: string,
  ranked: ModuleCandidate[]
): Promise<AliasCandidateWriteSummary> {
  const result = await writeCandidateDrafts(cwd, [
    {
      source: "route",
      type: "module.alias.request",
      target: "unresolved",
      risk: "medium",
      confidence: 0.2,
      summary: `Low-confidence route for "${task}" needs source inspection before a reviewed module alias can be added.`,
      evidence: [".context/MAP.md"],
      fields: {
        task,
        requestedAlias: task,
        instruction: "Inspect source and choose the correct existing module before converting this request into module.alias.add.",
        topRankedModules: ranked.slice(0, 5).map((module) => ({
          module: module.id,
          score: module.score,
          matchedAliases: module.matchedAliases,
          matchedModuleName: module.matchedModuleName,
          matchedPathKeywords: module.matchedPathKeywords
        }))
      }
    }
  ]);
  return {
    written: result.written.flatMap(candidateInboxPaths),
    duplicates: result.duplicates.flatMap(candidateInboxPaths)
  };
}

function candidateInboxPaths(candidate: CmapCandidate): string[] {
  return [
    `.context/inbox/candidates/${candidate.id}.json`,
    `.context/inbox/candidates/${candidate.id}.md`
  ];
}

async function relationCandidateWarnings(cwd: string): Promise<string[]> {
  const root = path.join(cwd, ".context", "inbox", "relations");
  if (!(await fileExists(root))) {
    return [];
  }
  const entries = (await readdir(root))
    .filter((entry) => /^relation-.+\.(json|md)$/.test(entry))
    .sort();
  if (entries.length === 0) {
    return [];
  }
  const ids = [...new Set(entries.map((entry) => entry.replace(/\.(json|md)$/, "")))].sort();
  const files = ids
    .slice(0, 5)
    .map((id) => `.context/inbox/relations/${entries.includes(`${id}.json`) ? `${id}.json` : `${id}.md`}`)
    .join(", ");
  const suffix = ids.length > 5 ? `, +${ids.length - 5} more` : "";
  return [`Pending relation candidates exist (${ids.length}): ${files}${suffix}. Route does not consume unpromoted candidates.`];
}
