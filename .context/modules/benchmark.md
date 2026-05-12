---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T19:08:00+08:00
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
- Return non-zero when a bad module appears in top-3.

## Depends On
- `route`
- `tests`

## Used By
- `cmap benchmark route --file bench/tasks.jsonl`
- Dogfood evaluation before changing route scoring or aliases.

## Data Flow
JSONL task cases -> route engine -> direct hit/miss and context-pack hit/miss report.

## State / Storage
Read-only. Benchmark fixtures live under `bench/`.

## Constraints
- Benchmark cases are evidence, not product truth.
- Keep fixtures small and explicit; do not hide expected modules behind natural-language labels.
- `expected_context_modules` checks selected context pack modules, not direct route rank.

## Traps
- A passing benchmark can still miss real tasks if aliases are too narrow.
- `bad_modules` only checks route harm, not implementation quality.
- Context hit rate can pass even when a related module should not be edited; context modules are read-first hints.

## Tests / Verification
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm test tests/integration/m12-route-benchmark-context.test.ts`
- `pnpm dev benchmark route --file bench/tasks.jsonl`

## When to Update This Doc
When benchmark file format, metrics, exit-code behavior, or route evaluation policy changes.

<!-- cmap:generated:evidence:start -->
## Generated Evidence

This section is generated support evidence. It is not a semantic source of truth.

- 2026-05-12T11:07:48.035Z: Added route benchmark context-pack metrics and richer project fixtures. Evidence: `src/commands/benchmark.ts`; command: `pnpm test tests/integration/m12-route-benchmark-context.test.ts`
<!-- cmap:generated:evidence:end -->
