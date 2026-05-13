---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T21:48:27+08:00
confidence: ai-drafted
module: benchmark
paths:
  - src/commands/benchmark.ts
  - bench
aliases:
  - benchmark
  - route benchmark
  - bench
  - 评测
  - 命中率
  - top-k
relations:
  depends_on:
    - route
    - tests
---
# Module: benchmark

## Purpose
Measure whether deterministic cmap routing matches expected direct modules and graph-expanded context modules on a small JSONL task set.

## Code Paths
- `src/commands/benchmark.ts`
- `bench/tasks.jsonl`

## Responsibilities
- Read route benchmark cases from JSONL.
- Run `routeTask()` for each case.
- Report top-1, top-3, and bad-module hit rates.
- Report context-pack hit rates when cases include `expected_context_modules`.
- Enforce optional `--min-top1`, `--min-top3`, `--min-context`, and `--max-bad` thresholds for CI.
- Return non-zero when a bad module appears in top-3.
- Return non-zero when any requested threshold fails.

## Depends On
- `route`
- `tests`

## Used By
- `cmap benchmark route --file bench/tasks.jsonl`
- `cmap benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0`
- Dogfood evaluation before changing route scoring or aliases.

## Data Flow
JSONL task cases -> route engine -> direct hit/miss and context-pack hit/miss report.

## State / Storage
Read-only. Benchmark fixtures live under `bench/`.

## Constraints
- Benchmark cases are evidence, not product truth.
- Keep fixtures small and explicit; do not hide expected modules behind natural-language labels.
- `expected_context_modules` checks selected context pack modules, not direct route rank.
- Thresholds are integer percentages from 0 to 100.

## Traps
- A passing benchmark can still miss real tasks if aliases are too narrow.
- `bad_modules` only checks route harm, not implementation quality.
- Context hit rate can pass even when a related module should not be edited; context modules are read-first hints.

## Tests / Verification
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm test tests/integration/m12-route-benchmark-context.test.ts`
- `pnpm test tests/integration/m15-ci-benchmark.test.ts`
- `pnpm dev benchmark route --file bench/tasks.jsonl`
- `pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0`

## When to Update This Doc
When benchmark file format, metrics, exit-code behavior, or route evaluation policy changes.
