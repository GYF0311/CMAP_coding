---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-06-04T16:49:00+08:00
confidence: ai-drafted
module: benchmark
paths:
  - src/commands/benchmark.ts
  - bench
aliases:
  - benchmark
  - route benchmark
  - source intelligence benchmark
  - bench
  - 评测
  - 命中率
  - top-k
relations:
  depends_on:
    - route
    - tests
    - source-intelligence
---
# Module: benchmark

## Purpose
Measure whether deterministic cmap routing and generated source-intelligence queries match explicit JSONL fixtures without treating benchmark evidence as canonical project truth.

## Code Paths
- `src/commands/benchmark.ts`
- `bench/tasks.jsonl`
- `bench/source-intelligence.jsonl`

## Responsibilities
- Read route benchmark cases from JSONL.
- Run `routeTask()` for each case.
- Report top-1, top-3, and bad-module hit rates.
- Report context-pack hit rates when cases include `expected_context_modules`.
- Enforce optional `--min-top1`, `--min-top3`, `--min-context`, and `--max-bad` thresholds for CI.
- Return non-zero when a bad module appears in top-3.
- Return non-zero when any requested threshold fails.
- Read source-intelligence benchmark cases from JSONL with `task`, `query`, `expected_files`, and/or `expected_symbols`.
- Score generated source evidence with precision, recall, and F1.
- Report token and tool-call proxy fields for source-evidence savings.
- Assert/report `falseCanonicalWrites=0` by comparing canonical `.context` files before and after the benchmark.
- Keep source-intelligence benchmark output labelled generated/non-canonical.

## Depends On
- `route`
- `tests`
- `source-intelligence`

## Used By
- `cmap benchmark route --file bench/tasks.jsonl`
- `cmap benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0`
- `cmap benchmark source-intelligence --file bench/source-intelligence.jsonl`
- Dogfood evaluation before changing route scoring or aliases.

## Data Flow
Route benchmark: JSONL task cases -> route engine -> direct hit/miss and context-pack hit/miss report.

Source-intelligence benchmark: JSONL task/query cases -> generated source index -> symbol/file evidence scoring -> precision/recall/F1, token/tool-call proxy, freshness, and false-canonical-write report.

## State / Storage
Read-only for canonical project memory. Benchmark fixtures live under `bench/`; source-intelligence benchmarks read `.context/generated/source-index/**` as generated support evidence.

## Constraints
- Benchmark cases are evidence, not product truth.
- Keep fixtures small and explicit; do not hide expected modules behind natural-language labels.
- `expected_context_modules` checks selected context pack modules, not direct route rank.
- Thresholds are integer percentages from 0 to 100.
- Source-intelligence benchmark cases measure generated evidence only; they must not imply a canonical source graph.
- `expected_files` and `expected_symbols` are fixture assertions, not reviewed module responsibilities.
- Source benchmark false-canonical-write checks are a proxy; they do not promote source evidence.

## Traps
- A passing benchmark can still miss real tasks if aliases are too narrow.
- `bad_modules` only checks route harm, not implementation quality.
- Context hit rate can pass even when a related module should not be edited; context modules are read-first hints.
- High source benchmark precision can still be stale if the generated source index is stale.
- Token/tool-call savings are approximate proxies, not measured model usage.

## Tests / Verification
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm test tests/integration/m12-route-benchmark-context.test.ts`
- `pnpm test tests/integration/m15-ci-benchmark.test.ts`
- `pnpm test tests/integration/source-intelligence-benchmark.test.ts`
- `pnpm dev benchmark route --file bench/tasks.jsonl`
- `pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0`
- `pnpm dev benchmark source-intelligence --file bench/source-intelligence.jsonl`

## When to Update This Doc
When benchmark file format, metrics, exit-code behavior, route evaluation policy, or generated source-evidence scoring changes.
