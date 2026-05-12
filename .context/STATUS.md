---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T19:15:38+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land the v0.2 route benchmark context metrics and richer fixture slice.

## Done Recently
Collected the ChatGPT Pro cmap product-completion research report locally. Added evidence/stale/inbox maintenance, observe/assist hooks, route context packing, `--max-context`, and context-aware route benchmark metrics.

## Left Off
M12 focused tests pass. `benchmark route` now supports optional `expected_context_modules`; local `bench/tasks.jsonl` has 8 project-realistic cases with 8/8 direct and 8/8 context hits.

## Next Steps
Next implementation slice should improve adoption stale docs or add route quality thresholds.

## Changed Files
- README.md
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/benchmark.md
- .context/modules/tests.md
- bench/tasks.jsonl
- docs/superpowers/plans/2026-05-12-cmap-v0-2-route-benchmark-fixtures.md
- src/commands/benchmark.ts
- tests/integration/m12-route-benchmark-context.test.ts

## Risks
Benchmark fixtures can overfit aliases if they are too few or too project-specific. Keep them explicit and extend them when route behavior changes.

## Last Verified
2026-05-12: `pnpm test tests/integration/m12-route-benchmark-context.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, `git diff --check`, and `pnpm dev benchmark route --file bench/tasks.jsonl` passed. `verify --stale` still reports the pre-existing adoption doc warning.
