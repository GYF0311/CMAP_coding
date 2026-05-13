---
cmap_version: 0.1
context_type: verify
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-13T02:38:30+08:00
confidence: ai-drafted
---
# Verification

## Required Commands
| Purpose | Command | Expected | When |
|---|---|---|---|
| test | `pnpm test` | exit 0 | before claiming done |
| typecheck | `pnpm typecheck` | exit 0 | before claiming done |
| build | `pnpm build` | exit 0 | before release or handoff |
| cmap self-verify | `pnpm dev verify` | exit 0 or warnings understood | after `.context` edits |
| cmap CI report | `pnpm dev verify --ci --format markdown` | exit 0 and stable Markdown report | in CI or before push |
| cmap stale verify | `pnpm dev verify --stale` | exit 0 or warnings understood | after generated evidence, inbox, or module-path changes |
| cmap freshness verify | `pnpm dev verify --freshness` | exit 0 or warnings understood | after source/module/evidence review changes |
| HTML view export | `pnpm dev view export --out _cmap-view` | exit 0 and writes read-only dashboard | after view/data contract changes |
| HTML view check | `pnpm dev view export --check --out _cmap-view` | exit 0 when normalized HTML is up to date | after `.context`, view, or renderer edits |
| Obsidian view check | `pnpm dev obsidian export --check` | exit 0 when local `_cmap` view is up to date | after `.context` module or core context edits |
| route benchmark thresholds | `pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0` | exit 0 when quality gates pass | in CI or before route changes ship |
| smoke | `pnpm smoke` | exit 0 | before release or handoff |

## Module-specific Checks
| Module | Command | Manual Check |
|---|---|---|
| cli | `pnpm test tests/integration/m1.test.ts` | Commands return expected stdout and exit codes. |
| context | `pnpm dev init --auto` in a temp project | Generated files stay skeletal and do not invent module semantics. |
| verify | `pnpm dev verify` | Errors are real structural problems; warnings are actionable. |
| verify coverage | `pnpm dev verify --coverage --changed-files src/commands/verify.ts` | Reports changed-file module coverage and relation validity. |
| verify CI report | `pnpm test tests/integration/m15-ci-benchmark.test.ts` | `verify --ci --format markdown` emits a stable CI report. |
| host | `pnpm dev install --host both` in a temp project | `AGENTS.md` and `CLAUDE.md` stay short and identical. |
| route | `pnpm test tests/integration/m11-context-size-controls.test.ts` | Direct matches stay separate from graph-related context; `--max-context` bounds selected context and derived verify commands. |
| route usage stats | `pnpm test tests/integration/m13-policy-stats.test.ts` | Route commands write generated route usage stats when policy allows `stats.update`. |
| graph | `pnpm test tests/integration/m14-graph-route.test.ts` | `graph build`, `graph explain`, and `route --graph` are covered. |
| brief | `pnpm test tests/integration/m11-context-size-controls.test.ts` | Writes a task-local AI brief from the bounded route context pack. |
| pack | `pnpm test tests/integration/m16-context-pack.test.ts` | Writes a redacted, budgeted context pack from routed graph-neighborhood context only. |
| handoff | `pnpm dev checkpoint read` | Prints current `CHECKPOINT.md`, falling back to `STATUS.md`; checkpoint writes only explicit fields. |
| cp | `pnpm test tests/integration/m3.test.ts` | Copy/move/delete/restore preserve expected line content and reject path escape. |
| finish | `pnpm dev finish --changed src/commands/cp.ts` | Prints a report with context update and checkpoint close/write reminders; does not modify trusted memory. |
| update-agent | `pnpm test tests/integration/m7-update-agent.test.ts` | MapPatch v1/v2 dry-run is read-only; `--apply-routine` writes only policy-approved checkpoint/generated state, backup, audit, and inbox candidates. |
| evidence | `pnpm test tests/integration/m13-policy-stats.test.ts` | Generated evidence writes `.context/generated/evidence/**` and policy-backed module activity stats; inbox thresholds remain deterministic. |
| freshness | `pnpm test tests/integration/m18-freshness-inbox-promote.test.ts` | Freshness snapshots, semantic review markers, generated evidence drift, low-risk inbox promote apply, and explicit reject archive are covered. |
| HTML view | `pnpm test tests/integration/m19-view-export.test.ts` | View include flags, Overview/Verification parsing, normalized HTML check, escaping/redaction, and size caps are covered. |
| obsidian-adapter | `pnpm dev obsidian export --out _cmap/CMAP_coding` | Writes Obsidian-friendly notes with Properties and relation wikilinks; generated files remain view-layer artifacts. |
| obsidian export check | `pnpm test tests/integration/m6-brief-obsidian.test.ts` | `obsidian export --check` detects stale or missing view-layer files without writing. |
| obsidian pull | `pnpm dev obsidian pull --from _cmap/CMAP_coding` | Reports candidate note edits only; no canonical `.context` writes unless `--write-inbox`. |
| memory-lite | `pnpm test tests/integration/m3.test.ts` | `log add` and `idea add` append only to logs/ideas. |
| benchmark | `pnpm dev benchmark route --file bench/tasks.jsonl` | Reports route top-1/top-3, bad-module, and context-pack hit rates for explicit fixtures. |
| benchmark thresholds | `pnpm test tests/integration/m15-ci-benchmark.test.ts` | Route benchmark threshold flags fail when requested quality gates are missed. |
| reconcile-adapter | `pnpm dev reconcile --adapter gsd-v1 --from .planning` when fixture/source exists | Produces dry-run candidate reports only; canonical `.context` files are not changed. |
| adoption | `pnpm test tests/integration/m4m5.test.ts` | Adopt writes ADOPTION candidate signals without promoting them into MAP. |
| module-docs | `pnpm test tests/integration/m4m5.test.ts` | add-module writes candidate docs and leaves MAP unchanged. |
| hooks-doctor | `pnpm test tests/integration/m9-hooks-assist.test.ts` | observe writes hook logs/session events only; assist writes bounded generated evidence for mapped changed files; render/test covers Claude lifecycle settings and strict guard decisions. |
| hooks Codex ingest | `pnpm test tests/integration/m17-hooks-ingest-codex.test.ts` | Codex render writes `.codex/hooks.json`; ingest reads stdin payloads, writes generated briefs/logs, returns Codex JSON, and denies strict canonical semantic writes. |
| hooks assist session brief | `pnpm test tests/integration/m9-hooks-assist.test.ts` | Assist `UserPromptSubmit` writes `.context/out/session-brief.md` and generated route usage stats. |
| release smoke | `pnpm smoke` | Builds `dist/cli.js` and runs real commands in a temp project. |
| verify L0 drift | `pnpm test tests/integration/verify-l0.test.ts` | MAP module docs, entrypoint drift, and module TODO residue are detected. |
| verify commands and pending | `pnpm test tests/integration/verify-l0.test.ts` | Missing package verification scripts and pending overload warnings are detected. |
| brief and Obsidian export | `pnpm test tests/integration/m6-brief-obsidian.test.ts` | Brief output, Obsidian module notes, relation wikilinks, and URI printing are covered. |
| agent MapPatch gate | `pnpm test tests/integration/m7-update-agent.test.ts` | Dry-run, routine apply, high-risk inbox routing, rollback, and `finish --agent` request generation are covered. |
| generated evidence / stale verify | `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts` | `evidence append/list/migrate`, `inbox status`, `inbox triage`, `inbox promote --dry-run`, `inbox archive`, and `verify --stale` are covered. |
| hooks observe / assist / strict | `pnpm test tests/integration/m9-hooks-assist.test.ts` | `install --hooks observe|assist`, `doctor`, hook logs, generated evidence, lifecycle render/test, strict canonical write guard, and unmapped file reporting are covered. |
| hooks Codex-first ingest | `pnpm test tests/integration/m17-hooks-ingest-codex.test.ts` | Codex `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop` ingest paths are covered with real stdin payloads and missing optional fields. |
| relation candidates | `pnpm test tests/integration/m20-relation-candidates.test.ts` | RelationPatch schema, safe path validation, JSON+Markdown inbox, duplicate skip, promote dry-run, and route warning de-dupe are covered. |
| route context pack | `pnpm test tests/integration/m10-route-context-pack.test.ts` | Route JSON/text context pack and brief consumption are covered. |
| context size controls | `pnpm test tests/integration/m11-context-size-controls.test.ts` | `route --max-context`, `brief --max-context`, and invalid limit handling are covered. |
| route benchmark context | `pnpm test tests/integration/m12-route-benchmark-context.test.ts` | `expected_context_modules` metrics and legacy fixture compatibility are covered. |
| policy and stats | `pnpm test tests/integration/m13-policy-stats.test.ts` | policy v2 defaults/validation, generated module activity stats, and policy-backed inbox thresholds are covered. |
| freshness and inbox promote apply | `pnpm test tests/integration/m18-freshness-inbox-promote.test.ts` | `freshness snapshot`, `freshness mark-reviewed`, `verify --freshness`, and low-risk `inbox promote --apply` are covered. |
| graph build and route graph mode | `pnpm test tests/integration/m14-graph-route.test.ts` | Generated graph projections, graph explanation, and graph-mode route JSON are covered. |
| CI report and benchmark thresholds | `pnpm test tests/integration/m15-ci-benchmark.test.ts` | CI Markdown verify output and route threshold failures are covered. |
| context pack | `pnpm test tests/integration/m16-context-pack.test.ts` | Context pack budget/redaction and graph-neighborhood selection are covered. |

## Optional Commands
- `node dist/cli.js version` after `pnpm build`.

## Manual Verification
- Inspect generated `.context/MAP.md` from `init` and confirm it contains placeholders, not guessed modules.
- Inspect generated `AGENTS.md`/`CLAUDE.md` and confirm they are short entrypoints, not full PRD copies.
- For any command that rewrites files, inspect whether it creates a backup or only appends to non-canonical logs/ideas.
- Inspect `.context/hooks/*.json` and confirm templates call selected hook profiles without writing canonical semantics.
- For `cmap update --agent --apply-routine`, inspect `.context/audit/`, `.context/backups/`, and `.context/inbox/` and confirm semantic operations were not written into canonical files.
- For `cmap evidence append`, inspect `.context/generated/evidence/modules/<module>.jsonl` and confirm the target module doc was not modified.
- For `cmap hooks stop --profile assist`, inspect `.context/logs/hooks.jsonl` and `.context/generated/evidence/modules/*.jsonl`; confirm canonical module semantics did not change.
- For `cmap inbox promote <id> --apply`, inspect `.context/backups/`, `.context/audit/`, and `.context/inbox/archive/`; confirm only allowed low-risk metadata or generated evidence was applied.

## Known Flaky Checks
None known yet.

## Environment Assumptions
- Node.js 20 or newer; current local Node is v22.22.2.
- pnpm is available through Corepack/local install; current local pnpm is 10.32.1.
- This directory is a git repository; `cmap verify --changed` may report mapped/unmapped warnings during multi-PR dogfood work. Treat those warnings as review evidence, not as permission to skip final targeted verification.
