---
context_type: checkpoint
status: active
updated_at: '2026-05-15T17:37:53.000Z'
source: manual
---
# Current Checkpoint

## Current Task
CMAP v0.2.1 bootstrap --init onboarding and version metadata closeout

## Current Hypothesis
Default `bootstrap` should remain conservative when `.context` is missing, while the recommended new-project entrypoint should be explicit: `cmap bootstrap --init --host both --skill`.

## Changed Files
- package/version metadata
- bootstrap command surface
- bootstrap integration tests
- README onboarding docs
- context module docs

## Verified
pnpm test tests/integration/m28-skill-bootstrap.test.ts tests/integration/m1.test.ts; pnpm test; pnpm typecheck; pnpm build; pnpm smoke; pnpm dev version; pnpm dev bootstrap --help; pnpm dev route "bootstrap --init onboarding version bump" --max-context 4; pnpm dev graph build; pnpm dev verify; pnpm dev verify --stale; pnpm dev verify --freshness; pnpm dev verify --policy; pnpm dev view export --out _cmap-view; pnpm dev view export --check --out _cmap-view; pnpm dev obsidian export; pnpm dev obsidian export --check; git diff --check

## Failed / Pending
Dogfood note: concurrent `cmap freshness mark-reviewed` runs can corrupt `.context/generated/freshness.json`; run them sequentially until atomic write or locking is added.

## Next Step
Commit and push this slice.

## Do Not Redo
None recorded.
