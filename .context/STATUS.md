---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T21:40:22+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land all ChatGPT Pro deep-research recommendations as safe, testable cmap product slices.

## Done Recently
Collected the ChatGPT Pro cmap product-completion research report locally. Added evidence/stale/inbox maintenance, observe/assist hooks, route context packing, `--max-context`, context-aware route benchmark metrics, inbox governance, policy-backed generated stats foundations, Claude hook lifecycle render/test, and graph v0 projections.

## Left Off
Graph v0 slice is implemented and verified. `cmap graph build` writes `.context/graph/modules.json`, `files.json`, `edges.json`, and `graph.meta.json`; `cmap graph explain <module>` explains module files and typed relations; `route --graph` exposes graph mode in route output.

## Next Steps
Commit and push the graph v0 slice. Next slice should add CI/benchmark thresholds or selected context pack.

## Changed Files
- README.md
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/cli.md
- .context/modules/graph.md
- .context/modules/route.md
- .context/modules/tests.md
- docs/superpowers/plans/2026-05-12-cmap-pro-deep-research-completion.md
- src/cli.ts
- src/commands/graph.ts
- src/commands/route.ts
- src/core/context-graph.ts
- tests/integration/m14-graph-route.test.ts

## Risks
Graph v0 is based on reviewed module docs only. It does not yet infer imports, tests, symbols, or runtime coupling.

## Last Verified
2026-05-12: `pnpm test tests/integration/m14-graph-route.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, `pnpm dev benchmark route --file bench/tasks.jsonl`, and `git diff --check` passed. `verify --stale` reports 0 warnings.
