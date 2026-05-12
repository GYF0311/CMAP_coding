import { readFile } from "node:fs/promises";
import { CmapCommandError } from "../errors.js";
import { resolveInsideRoot } from "../fs/safe-path.js";
import { routeTask } from "./route.js";

type BenchmarkRouteOptions = {
  file?: string;
  minTop1?: string;
  minTop3?: string;
  minContext?: string;
  maxBad?: string;
};

type RouteBenchmarkCase = {
  task: string;
  expected_modules: string[];
  bad_modules?: string[];
  expected_context_modules?: string[];
};

export async function runBenchmarkRoute(cwd: string, options: BenchmarkRouteOptions): Promise<number> {
  const filePath = await resolveInsideRoot(cwd, options.file || "bench/tasks.jsonl");
  const cases = parseCases(await readFile(filePath, "utf8"));
  if (cases.length === 0) {
    throw new CmapCommandError("Benchmark file has no valid cases");
  }

  let top1Hits = 0;
  let top3Hits = 0;
  let badHits = 0;
  let contextHits = 0;
  let contextChecked = 0;
  const thresholds = parseThresholds(options);
  const lines = ["# Route Benchmark", "", `Cases: ${cases.length}`, ""];

  for (const [index, item] of cases.entries()) {
    const route = await routeTask(cwd, item.task);
    const top = route.modules.slice(0, 3).map((module) => module.id);
    const context = route.contextModules.map((module) => module.id);
    const top1 = top[0];
    const top1Hit = Boolean(top1 && item.expected_modules.includes(top1));
    const top3Hit = top.some((module) => item.expected_modules.includes(module));
    const badHit = (item.bad_modules ?? []).some((module) => top.includes(module));
    const expectedContext = item.expected_context_modules ?? [];
    const contextResult = expectedContext.length === 0
      ? "unchecked"
      : expectedContext.every((module) => context.includes(module))
        ? "hit"
        : "miss";
    top1Hits += top1Hit ? 1 : 0;
    top3Hits += top3Hit ? 1 : 0;
    badHits += badHit ? 1 : 0;
    if (expectedContext.length > 0) {
      contextChecked += 1;
      contextHits += contextResult === "hit" ? 1 : 0;
    }

    lines.push(`${index + 1}. ${item.task}`);
    lines.push(`   expected: ${item.expected_modules.join(", ")}`);
    lines.push(`   top3: ${top.length ? top.join(", ") : "(none)"}`);
    if (expectedContext.length > 0) {
      lines.push(`   expected context: ${expectedContext.join(", ")}`);
      lines.push(`   context: ${context.length ? context.join(", ") : "(none)"}`);
    }
    lines.push(`   result: top1=${top1Hit ? "hit" : "miss"}, top3=${top3Hit ? "hit" : "miss"}, bad=${badHit ? "yes" : "no"}, context=${contextResult}`);
  }

  const top1Percent = percentNumber(top1Hits, cases.length);
  const top3Percent = percentNumber(top3Hits, cases.length);
  const badPercent = percentNumber(badHits, cases.length);
  const contextPercent = contextChecked === 0 ? undefined : percentNumber(contextHits, contextChecked);
  const thresholdFailures = thresholdFailureLines({
    top1Percent,
    top3Percent,
    badPercent,
    contextPercent,
    contextChecked,
    thresholds
  });

  lines.push(
    "",
    "## Summary",
    "",
    `Top-1: ${top1Hits}/${cases.length} (${formatPercent(top1Percent)})`,
    `Top-3: ${top3Hits}/${cases.length} (${formatPercent(top3Percent)})`,
    `Bad-module hits: ${badHits}/${cases.length} (${formatPercent(badPercent)})`,
    `Context: ${contextHits}/${contextChecked} (${contextPercent === undefined ? "n/a" : formatPercent(contextPercent)})`,
    ""
  );
  if (thresholdFailures.length > 0) {
    lines.push("Threshold failures:");
    for (const failure of thresholdFailures) {
      lines.push(`- ${failure}`);
    }
    lines.push("");
  }

  process.stdout.write(lines.join("\n"));
  return badHits > 0 || thresholdFailures.length > 0 ? 1 : 0;
}

function parseCases(raw: string): RouteBenchmarkCase[] {
  const cases: RouteBenchmarkCase[] = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parsed = JSON.parse(trimmed) as Partial<RouteBenchmarkCase>;
    if (typeof parsed.task !== "string" || !Array.isArray(parsed.expected_modules)) {
      throw new CmapCommandError(`Invalid route benchmark case on line ${index + 1}`);
    }
    cases.push({
      task: parsed.task,
      expected_modules: parsed.expected_modules.filter((item): item is string => typeof item === "string"),
      bad_modules: Array.isArray(parsed.bad_modules)
        ? parsed.bad_modules.filter((item): item is string => typeof item === "string")
        : [],
      expected_context_modules: Array.isArray(parsed.expected_context_modules)
        ? parsed.expected_context_modules.filter((item): item is string => typeof item === "string")
        : []
    });
  }
  return cases;
}

function percentNumber(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function parseThresholds(options: BenchmarkRouteOptions): { minTop1?: number; minTop3?: number; minContext?: number; maxBad?: number } {
  return {
    minTop1: parseOptionalPercent(options.minTop1, "--min-top1"),
    minTop3: parseOptionalPercent(options.minTop3, "--min-top3"),
    minContext: parseOptionalPercent(options.minContext, "--min-context"),
    maxBad: parseOptionalPercent(options.maxBad, "--max-bad")
  };
}

function parseOptionalPercent(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new CmapCommandError(`Invalid ${flag} "${value}". Expected an integer from 0 to 100.`);
  }
  return parsed;
}

function thresholdFailureLines(input: {
  top1Percent: number;
  top3Percent: number;
  badPercent: number;
  contextPercent?: number;
  contextChecked: number;
  thresholds: { minTop1?: number; minTop3?: number; minContext?: number; maxBad?: number };
}): string[] {
  const failures: string[] = [];
  if (input.thresholds.minTop1 !== undefined && input.top1Percent < input.thresholds.minTop1) {
    failures.push(`Top-1 below ${input.thresholds.minTop1}% (${input.top1Percent}%)`);
  }
  if (input.thresholds.minTop3 !== undefined && input.top3Percent < input.thresholds.minTop3) {
    failures.push(`Top-3 below ${input.thresholds.minTop3}% (${input.top3Percent}%)`);
  }
  if (input.thresholds.maxBad !== undefined && input.badPercent > input.thresholds.maxBad) {
    failures.push(`Bad-module hits above ${input.thresholds.maxBad}% (${input.badPercent}%)`);
  }
  if (input.thresholds.minContext !== undefined) {
    if (input.contextChecked === 0 || input.contextPercent === undefined) {
      failures.push(`Context below ${input.thresholds.minContext}% (unchecked)`);
    } else if (input.contextPercent < input.thresholds.minContext) {
      failures.push(`Context below ${input.thresholds.minContext}% (${input.contextPercent}%)`);
    }
  }
  return failures;
}
