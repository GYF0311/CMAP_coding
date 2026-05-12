---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T18:50:00+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land the v0.2 context size controls slice so route and brief context packs can stay compact.

## Done Recently
Collected the ChatGPT Pro cmap product-completion research report locally. Added evidence/stale/inbox maintenance, observe/assist hooks, route context packing, and now `--max-context` controls for route and brief.

## Left Off
M11 focused tests pass. `--max-context` limits selected context modules, read-first module docs, and derived verification commands without changing direct module scoring.

## Next Steps
Commit and push this slice. Next implementation slice should add richer route benchmark fixtures.

## Changed Files
- README.md
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/brief.md
- .context/modules/cli.md
- .context/modules/route.md
- .context/modules/tests.md
- docs/superpowers/plans/2026-05-12-cmap-v0-2-context-size-controls.md
- src/cli.ts
- src/commands/brief.ts
- src/commands/route.ts
- tests/integration/m11-context-size-controls.test.ts

## Risks
Too-small context limits can hide useful related modules. Keep default at 6 and use smaller values only when context budget matters.

## Last Verified
2026-05-12: focused M10/M11 tests, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, and `git diff --check` passed. `verify --stale` reports one non-blocking pre-existing adoption-doc stale warning.
