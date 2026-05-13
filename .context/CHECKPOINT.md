---
context_type: checkpoint
status: active
updated_at: '2026-05-13T21:47:48+08:00'
source: manual
---
# Current Checkpoint

## Current Task
Implement v0.2 Trust Boundary + Human Review Layer plan.

## Current Hypothesis
The next phase is now anchored on trust boundaries and human review: AI reads code and proposes candidates; CLI validates, audits, routes to inbox, and keeps generated data separate; HTML/Obsidian views let humans review the map. Canonical graph remains a projection of reviewed module docs, not an import graph.

## Completed PR Slices
- PR-A Roadmap Reset: `.context`, README, PRD, and research docs now mark old import graph / route v2 / pack v2 as paused/superseded/historical.
- PR-B View Export MVP: added `cmap view export/open`, `cmap.view_data.v1`, safe single-file HTML rendering, normalized `--check`, caps, redaction, and `_cmap-view/` ignore.
- PR-C Hygiene + Lifecycle + Codex Workflow: generated evidence/store migration, legacy pending/stats/evidence warnings, Claude/Codex hook ingest, and explicit `cmap codex start/finish/guard`.
- PR-C2 Freshness v2: baseline vs reviewed state, review evidence, generated freshness metadata, and `verify --freshness`.
- PR-D Relation Candidates: `relate request/ingest/promote --dry-run`, relation schema, JSON+Markdown inbox output, duplicate skip, audit, and route candidate warnings without scoring consumption.

## Changed Files
- Roadmap/docs/context: `.context/MAP.md`, `.context/STATUS.md`, `.context/VERIFY.md`, `.context/modules/*.md`, README, PRD, research superseded notices.
- Generated/review artifacts: `.context/generated/evidence/modules/*.jsonl`, `.context/graph/*.json`.
- Core commands: `src/cli.ts`, `src/commands/{codex,evidence,freshness,hooks,inbox,pack,relate,route,verify,view}.ts`.
- Core helpers: `src/core/{freshness,generated-store,relation-patch}.ts`, `src/context/relation-schema.ts`, `src/hooks/events.ts`, `src/view/*`.
- Tests: `tests/integration/m8`, `m9`, `m17`, `m18`, `m19`, `m20`, and `verify-l0`.

## Verified
- `pnpm test`: 21 files, 111 tests passed.
- `pnpm typecheck`: passed.
- `pnpm dev verify`: 0 errors, 2 expected legacy warnings for `.context/pending` and `.context/stats`.
- `pnpm dev verify --stale`: 0 errors, stale warnings for updated modules that need semantic review.
- `pnpm dev verify --freshness`: 0 errors, 2 expected legacy warnings.
- `pnpm dev verify --ci --format markdown`: 0 errors, 2 expected legacy warnings.
- `pnpm smoke`: passed.
- `pnpm dev view export --out _cmap-view` and `pnpm dev view export --check --out _cmap-view`: passed.
- `pnpm dev obsidian export` and `pnpm dev obsidian export --check`: passed.
- `pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0`: 100% Top-1/Top-3/context, 0% bad.
- `git diff --check`: passed.

## Failed / Pending
- `.context/pending` and `.context/stats` still exist as legacy paths by design; do not delete or migrate destructively without explicit follow-up.
- `verify --stale` reports module docs older than touched source files; this is review signal after the multi-slice implementation, not a structural error.
- No failed verification remains; warnings are the expected legacy/stale review signals listed above.

## Next Step
Run final verification commands, then review whether to create a follow-up cleanup PR for legacy `.context/pending` / `.context/stats` migration and semantic freshness `mark-reviewed` updates.

## Do Not Redo
Do not revive old PR-6 import graph/test ownership, route v2, or pack v2 as the current roadmap. Those are paused historical ideas; the current v0.2 relation-candidate slice is PR-D AI Relation Candidate Workflow after the HTML review layer exists.
