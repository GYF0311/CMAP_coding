---
context_type: checkpoint
status: active
updated_at: '2026-05-13T15:00:44.443Z'
source: manual
---
# Current Checkpoint

## Current Task
P0 v0.2 hardening

## Current Hypothesis
None recorded.

## Changed Files
- .context/VERIFY.md
- .context/modules/evidence.md
- .context/modules/relation-candidates.md
- .context/modules/route.md
- .context/modules/update-agent.md
- .context/modules/verify.md
- .context/modules/view.md
- .github/workflows/cmap.yml
- src/commands/route.ts
- src/commands/view.ts
- src/core/freshness.ts
- src/core/map-patch.ts
- src/core/relation-patch.ts
- src/view/check.ts
- src/view/collect.ts
- src/view/render.ts
- src/view/schema.ts
- tests/integration/m18-freshness-inbox-promote.test.ts
- tests/integration/m19-view-export.test.ts
- tests/integration/m20-relation-candidates.test.ts
- tests/integration/m7-update-agent.test.ts

## Verified
pnpm test tests/integration/m19-view-export.test.ts tests/integration/m20-relation-candidates.test.ts tests/integration/m7-update-agent.test.ts tests/integration/m18-freshness-inbox-promote.test.ts; pnpm typecheck; pnpm dev verify --freshness

## Failed / Pending
Freshness verify has expected legacy/stale review warnings, no errors.

## Next Step
Start P1 unified candidate store and review workflow enhancements

## Do Not Redo
None recorded.
