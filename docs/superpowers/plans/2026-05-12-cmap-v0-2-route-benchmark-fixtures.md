# cmap v0.2 Route Benchmark Fixtures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand route benchmark coverage so it can evaluate both direct module routing and graph-expanded context pack quality.

**Architecture:** Keep `expected_modules` as the direct route metric. Add optional `expected_context_modules` to JSONL cases and report a separate context hit metric based on `route.contextModules`. Existing benchmark files without context expectations remain valid.

**Tech Stack:** TypeScript CLI, JSONL fixtures, Vitest integration tests, existing `routeTask` benchmark flow.

---

## Task 1: Failing Tests

**Files:**
- Create `tests/integration/m12-route-benchmark-context.test.ts`

- [x] Write a benchmark test with `expected_context_modules` where a direct `chat` route must include related `auth` context.
- [x] Assert the output reports per-case context status and a context summary metric.
- [x] Assert old benchmark cases without `expected_context_modules` still work.
- [x] Run `pnpm test tests/integration/m12-route-benchmark-context.test.ts` and confirm it fails before production code.

## Task 2: Benchmark Context Metric

**Files:**
- Modify `src/commands/benchmark.ts`

- [x] Add optional `expected_context_modules` to `RouteBenchmarkCase`.
- [x] Compare expected context modules against `route.contextModules`.
- [x] Print per-case `context=hit|miss|unchecked`.
- [x] Print summary `Context: x/y`.
- [x] Preserve existing top-1/top-3/bad-module behavior and exit code.

## Task 3: Project Fixture Expansion

**Files:**
- Modify `bench/tasks.jsonl`

- [x] Add project-realistic cases for route context pack, brief context limits, hook assist evidence, and generated evidence stale checks.
- [x] Include `expected_context_modules` only where current module relations make it deterministic.
- [x] Run `pnpm dev benchmark route --file bench/tasks.jsonl`.

## Task 4: Docs And Context

**Files:**
- Modify `README.md`
- Modify `.context/MAP.md`
- Modify `.context/STATUS.md`
- Modify `.context/CHECKPOINT.md`
- Modify `.context/VERIFY.md`
- Modify `.context/modules/benchmark.md`
- Modify `.context/modules/tests.md`

- [x] Document `expected_context_modules`.
- [x] Update current status/checkpoint and verification map.

## Task 5: Verification And Save

- [x] Run focused M12 tests.
- [x] Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, `git diff --check`.
- [x] Commit and push.
