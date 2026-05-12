---
context_type: checkpoint
status: active
updated_at: '2026-05-12T18:50:00+08:00'
source: manual
---
# Current Checkpoint

## Current Task
Land the v0.2 context size controls slice on top of route context packing.

## Current Hypothesis
Context pack size should be user-controlled: direct route scoring stays stable, while related context modules and derived verify commands are bounded by `--max-context`.

## Changed Files
- .context/CHECKPOINT.md
- .context/MAP.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/brief.md
- .context/modules/cli.md
- .context/modules/route.md
- .context/modules/tests.md
- README.md
- docs/superpowers/plans/2026-05-12-cmap-v0-2-context-size-controls.md
- src/cli.ts
- src/commands/brief.ts
- src/commands/route.ts
- tests/integration/m11-context-size-controls.test.ts

## Verified
Focused M10/M11 tests; `pnpm test`; `pnpm typecheck`; `pnpm build`; `pnpm dev verify`; `pnpm dev verify --stale`; `pnpm smoke`; `git diff --check`.

## Failed / Pending
`pnpm dev verify --stale` previously returned exit 0 with a pre-existing warning: `.context/modules/adoption.md` is older than `src/commands/adopt.ts`. A temporary host warning was resolved by updating `.context/modules/host.md`.

## Next Step
Commit and push this slice. Next implementation slice should add richer route benchmark fixtures.

## Do Not Redo
Do not let `--max-context` change direct module scoring; it only limits selected context modules.
