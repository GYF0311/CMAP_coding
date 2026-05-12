---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T21:56:02+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land all ChatGPT Pro deep-research recommendations as safe, testable cmap product slices.

## Done Recently
Collected the ChatGPT Pro cmap product-completion research report locally. Added evidence/stale/inbox maintenance, observe/assist hooks, route context packing, `--max-context`, context-aware route benchmark metrics, inbox governance, policy-backed generated stats foundations, Claude hook lifecycle render/test, graph v0 projections, CI Markdown verify output, benchmark threshold flags, and a GitHub Actions cmap workflow.

## Left Off
CI/benchmark slice is implemented and verified locally. `verify --ci --format markdown` prints a stable CI report, benchmark route supports explicit top-1/top-3/context/bad-module thresholds, and `.github/workflows/cmap.yml` runs test/typecheck/build/verify/stale/benchmark gates.

## Next Steps
Commit and push the CI/benchmark slice. Next slice should add selected context pack, hook assist session brief, and view-layer drift checks.

## Changed Files
- README.md
- .github/workflows/cmap.yml
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/benchmark.md
- .context/modules/cli.md
- .context/modules/tests.md
- .context/modules/verify.md
- docs/superpowers/plans/2026-05-12-cmap-pro-deep-research-completion.md
- src/cli.ts
- src/commands/benchmark.ts
- src/commands/verify.ts
- tests/integration/m15-ci-benchmark.test.ts

## Risks
CI gates are local workflow definitions until GitHub runs them after push. Benchmark thresholds are only as meaningful as the small explicit fixture set.

## Last Verified
2026-05-12: `pnpm test tests/integration/m15-ci-benchmark.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --ci --format markdown`, `pnpm dev verify --stale`, `pnpm smoke`, `pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0`, and `git diff --check` passed.
