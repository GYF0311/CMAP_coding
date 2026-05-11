---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T01:18:00+08:00
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
Measure whether deterministic cmap routing matches expected modules on a small JSONL task set.

## Code Paths
- `src/commands/benchmark.ts`
- `bench/tasks.jsonl`

## Responsibilities
- Read route benchmark cases from JSONL.
- Run `routeTask()` for each case.
- Report top-1, top-3, and bad-module hit rates.
- Return non-zero when a bad module appears in top-3.

## Depends On
- `route`
- `tests`

## Used By
- `cmap benchmark route --file bench/tasks.jsonl`
- Dogfood evaluation before changing route scoring or aliases.

## Data Flow
JSONL task cases -> route engine -> hit/miss report.

## State / Storage
Read-only. Benchmark fixtures live under `bench/`.

## Constraints
- Benchmark cases are evidence, not product truth.
- Keep fixtures small and explicit; do not hide expected modules behind natural-language labels.

## Traps
- A passing benchmark can still miss real tasks if aliases are too narrow.
- `bad_modules` only checks route harm, not implementation quality.

## Tests / Verification
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm dev benchmark route --file bench/tasks.jsonl`

## When to Update This Doc
When benchmark file format, metrics, exit-code behavior, or route evaluation policy changes.
