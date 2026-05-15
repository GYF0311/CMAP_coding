---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-16T01:57:07+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Keep cmap on Trust Boundary + Human Review Layer while making real-project onboarding safe and the review layer useful for AI coding handoff: safe entrypoints, English skill/bootstrap discovery, freshness discipline, relation explanations, low-confidence alias candidates, Review HTML module understanding, and unified candidate inbox producers.

## Done Recently
`cmap install` now defaults to marker merge with `<!-- cmap:start -->` / `<!-- cmap:end -->`, preserving existing `AGENTS.md` / `CLAUDE.md` content outside the cmap block. `--mode print` previews without writing, `--force` is the explicit full-overwrite escape hatch, and `--backup` stores previous entrypoints under `.context/backups/install-*`.

`cmap skill export` writes an English project-local instruction pack under `.cmap/skills/cmap/` and supports `--check` for stale detection. `cmap bootstrap` still refuses to invent `.context` by default, but now recommends `cmap bootstrap --init --host both --skill` for new projects; explicit `--init` creates the skeleton before delegating to non-destructive install, optional skill export, and `.context/out/start-here.md` generation.

Package version was bumped to `0.2.2` for the Closeout Orchestration Patch release line.

`AGENTS.md` and `CLAUDE.md` were dogfooded through non-destructive install, so the original project rules are preserved and the new cmap marker block includes Git Safety Rules.

The project commit policy now allows proactive commits after coherent, verified work slices. Agents must still inspect `git status --short`, stage only task-related files, avoid unrelated user changes, and report the commit hash.

Entrypoint docs were deduplicated after marker merge: root-level project direction remains outside the cmap block, while Start Here, Git Safety Rules, Tools, and command policy live inside the generated block.

Legacy warning directories were retired safely: empty `.context/pending` and superseded `.context/stats` no longer make `verify` warn; old route stats were preserved under generated stats legacy storage instead of being deleted.

Freshness/stale review was manually converged for current active modules and then marked with `cmap freshness mark-reviewed`; `verify --stale` and `verify --freshness` are clean.

Core module `relation_explanations` now explain why relations exist, what they produce, and what changes may impact across route, view, evidence, update-agent, and hooks-doctor.

Low-confidence `cmap route` output now suggests source inspection and can write a candidate-only `module.alias.request` via `--write-alias-candidate` without inventing a module.

Review HTML module details now include responsibilities, incoming relations, relation explanations, module-owned verification commands, and related candidates from existing `.context` data only.

Unified candidate-store producers now cover MapPatch/update, low-confidence route alias requests, reconcile, and Obsidian pull under `.context/inbox/candidates/*.json|md`; relation candidates remain under `.context/inbox/relations/*.json|md`; legacy top-level inbox reports remain readable.

`cmap finish` now reminds users to refresh generated graph, Review HTML, and Obsidian layers when canonical `.context` files changed. Source-only changes do not show this reminder.

`cmap freshness mark-reviewed` now prints that it only updates `.context/generated/freshness.json`, not canonical module docs. Freshness snapshot and mark-reviewed writes now use `.context/generated/freshness.json.lock` plus atomic temp-file rename to avoid concurrent last-write-wins and partial JSON corruption.

## Left Off
v0.2.2 closeout orchestration patches are implemented and verified locally: explicit bootstrap onboarding is retained, finish reports generated-view refresh reminders for canonical context changes, freshness review metadata writes are locked and atomic, and the CLI reports version `0.2.2`. Commit and push are pending.

## Next Steps
1. Commit and push the v0.2.2 closeout slice.
2. Stop active tool polishing and move into real-project use unless new dogfood evidence appears.

## Changed Files
- Entrypoint/onboarding: `AGENTS.md`, `CLAUDE.md`, `README.md`, `src/commands/install.ts`, `src/commands/skill.ts`, `src/commands/bootstrap.ts`, `src/host/*`, `src/skill/*`, install/skill tests.
- Bootstrap/version slice: `package.json`, `src/cli.ts`, `src/commands/bootstrap.ts`, `tests/integration/m1.test.ts`, `tests/integration/m28-skill-bootstrap.test.ts`, `README.md`, `.context/MAP.md`, `.context/VERIFY.md`, and related module docs.
- Cleanup/review docs: `.context/CHECKPOINT.md`, `.context/STATUS.md`, `.context/modules/*.md`, `.context/graph/*.json`.
- Route/candidate store: `src/commands/route.ts`, `src/core/candidate-store.ts`, `src/commands/inbox.ts`, route/candidate tests.
- Review HTML: `src/view/*`, `tests/integration/m19-view-export.test.ts`, `tests/integration/m25-view-structured-candidates.test.ts`.
- Unified producers: `src/commands/reconcile.ts`, `src/commands/obsidian.ts`, `tests/integration/m6-brief-obsidian.test.ts`.
- v0.2.2 closeout: `src/commands/finish.ts`, `src/commands/freshness.ts`, `src/core/freshness.ts`, `tests/integration/m29-finish-view-reminder.test.ts`, `tests/integration/m30-freshness-lock.test.ts`, version metadata, and context docs.

## Risks
`_cmap-view`, `_cmap`, `.context/generated/*`, `.context/out/*`, and `.cmap/skills/*` remain generated/ignored local artifacts. Candidate requests are intentionally non-canonical until reviewed. `module.alias.request` has `target: unresolved` by design and must be converted manually after source inspection. Freshness locking is intentionally a simple file lock; stale lock files fail with a clear timeout instead of being auto-deleted.

## Last Verified
2026-05-16: `pnpm test` passed 31 files / 164 tests; `pnpm typecheck` passed; `pnpm build` passed; `pnpm smoke` passed; `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm dev verify --freshness`, `pnpm dev verify --policy`, and `pnpm dev verify --ci --format markdown` passed with 0 warnings/errors. `pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0` passed at 100% Top-1/Top-3/context with 0 bad hits. `pnpm dev graph build`, `pnpm dev view export --out _cmap-view`, `pnpm dev view export --check --out _cmap-view`, `pnpm dev obsidian export`, and `pnpm dev obsidian export --check` passed. `pnpm dev version` printed `0.2.2`; `git diff --check` passed.
