---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-13T21:47:48+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Complete v0.2 Trust Boundary + Human Review Layer implementation and verification.

## Done Recently
The roadmap has been reset away from CLI-owned import graph / route v2 / pack v2 and toward trust-boundary clarity, HTML human review, generated/canonical hygiene, freshness, and AI relation candidates. Implementation now includes the read-only HTML view, generated evidence store/migration, explicit Codex workflow, hook ingest, Freshness v2 baseline/review metadata, and candidate-only RelationPatch ingest.

## Left Off
All five v0.2 slices are implemented in the local worktree. Canonical graph is still derived only from reviewed module docs. Route may warn about pending relation candidates but does not score or include them in `route.modules`, `route.contextModules`, or route benchmark data.

## Next Steps
1. Finish final verification after the checkpoint/status update.
2. Review whether to keep `.context/graph/*.json` as committed generated projections or regenerate them only in CI/review flows.
3. Decide a separate cleanup/migration task for legacy `.context/pending` and `.context/stats`; do not delete them in this implementation PR.
4. Use `freshness mark-reviewed` only after a human/AI semantic review of updated module docs.

## Changed Files
- `.context/CHECKPOINT.md`, `.context/STATUS.md`, `.context/MAP.md`, `.context/VERIFY.md`, module docs, README, PRD, research superseded notices.
- `src/cli.ts`, command handlers for codex/evidence/freshness/hooks/inbox/pack/relate/route/verify/view.
- `src/core/freshness.ts`, `src/core/generated-store.ts`, `src/core/relation-patch.ts`, `src/context/relation-schema.ts`, `src/hooks/events.ts`, `src/view/*`.
- Integration tests for evidence/stale/inbox, hooks ingest, freshness, view export, relation candidates, and legacy pending verification.

## Risks
Legacy `.context/pending` and `.context/stats` still exist and intentionally produce warnings. `verify --stale` reports updated modules that need semantic review; freshness metadata separates baseline from reviewed state so this should be resolved by review, not by generated evidence writes. Codex hook parity remains experimental; the supported Codex path is explicit `cmap codex start/finish/guard`.

## Last Verified
2026-05-13: `pnpm test` passed 21 files / 111 tests, `pnpm typecheck` passed, `pnpm smoke` passed, `pnpm dev verify` passed with 0 errors and 2 expected legacy warnings, `pnpm dev verify --freshness` passed with the same legacy warnings, `pnpm dev view export --check --out _cmap-view` passed, `pnpm dev obsidian export --check` passed after refreshing `_cmap/`, benchmark route passed 100% Top-1/Top-3/context with 0 bad hits, and `git diff --check` passed.
