---
cmap_version: 0.1
context_type: verify
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T17:42:00+08:00
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
| cmap stale verify | `pnpm dev verify --stale` | exit 0 or warnings understood | after generated evidence, inbox, or module-path changes |
| smoke | `pnpm smoke` | exit 0 | before release or handoff |

## Module-specific Checks
| Module | Command | Manual Check |
|---|---|---|
| cli | `pnpm test tests/integration/m1.test.ts` | Commands return expected stdout and exit codes. |
| context | `pnpm dev init --auto` in a temp project | Generated files stay skeletal and do not invent module semantics. |
| verify | `pnpm dev verify` | Errors are real structural problems; warnings are actionable. |
| verify coverage | `pnpm dev verify --coverage --changed-files src/commands/verify.ts` | Reports changed-file module coverage and relation validity. |
| host | `pnpm dev install --host both` in a temp project | `AGENTS.md` and `CLAUDE.md` stay short and identical. |
| route | `pnpm dev route "checkpoint 更新当前主线"` | Should recommend handoff, not verify through `check` substring. |
| brief | `pnpm dev brief "路由结果没有推荐模块" --out .context/out/brief.md` | Writes a task-local AI brief with route result, checkpoint/status, module docs, verify reminder, and finish requirement. |
| handoff | `pnpm dev checkpoint read` | Prints current `CHECKPOINT.md`, falling back to `STATUS.md`; checkpoint writes only explicit fields. |
| cp | `pnpm test tests/integration/m3.test.ts` | Copy/move/delete/restore preserve expected line content and reject path escape. |
| finish | `pnpm dev finish --changed src/commands/cp.ts` | Prints a report with context update and checkpoint close/write reminders; does not modify trusted memory. |
| update-agent | `pnpm test tests/integration/m7-update-agent.test.ts` | MapPatch dry-run is read-only; `--apply-routine` writes only routine checkpoint state, backup, audit, and inbox candidates. |
| evidence | `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts` | Generated evidence writes are bounded; inbox status counts backlog; stale verify warns without canonical promotion. |
| obsidian-adapter | `pnpm dev obsidian export --out _cmap/CMAP_coding` | Writes Obsidian-friendly notes with Properties and relation wikilinks; generated files remain view-layer artifacts. |
| obsidian pull | `pnpm dev obsidian pull --from _cmap/CMAP_coding` | Reports candidate note edits only; no canonical `.context` writes unless `--write-inbox`. |
| memory-lite | `pnpm test tests/integration/m3.test.ts` | `log add` and `idea add` append only to logs/ideas. |
| benchmark | `pnpm dev benchmark route --file bench/tasks.jsonl` | Reports route top-1/top-3 and bad-module hit rates for explicit fixtures. |
| reconcile-adapter | `pnpm dev reconcile --adapter gsd-v1 --from .planning` when fixture/source exists | Produces dry-run candidate reports only; canonical `.context` files are not changed. |
| adoption | `pnpm test tests/integration/m4m5.test.ts` | Adopt writes ADOPTION candidate signals without promoting them into MAP. |
| module-docs | `pnpm test tests/integration/m4m5.test.ts` | add-module writes candidate docs and leaves MAP unchanged. |
| hooks-doctor | `pnpm test tests/integration/m4m5.test.ts` | install writes hook templates; hooks print reminders; doctor sees state. |
| release smoke | `pnpm smoke` | Builds `dist/cli.js` and runs real commands in a temp project. |
| verify L0 drift | `pnpm test tests/integration/verify-l0.test.ts` | MAP module docs, entrypoint drift, and module TODO residue are detected. |
| verify commands and pending | `pnpm test tests/integration/verify-l0.test.ts` | Missing package verification scripts and pending overload warnings are detected. |
| brief and Obsidian export | `pnpm test tests/integration/m6-brief-obsidian.test.ts` | Brief output, Obsidian module notes, relation wikilinks, and URI printing are covered. |
| agent MapPatch gate | `pnpm test tests/integration/m7-update-agent.test.ts` | Dry-run, routine apply, high-risk inbox routing, rollback, and `finish --agent` request generation are covered. |
| generated evidence / stale verify | `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts` | `evidence append`, `inbox status`, and `verify --stale` are covered. |

## Optional Commands
- `node dist/cli.js version` after `pnpm build`.

## Manual Verification
- Inspect generated `.context/MAP.md` from `init` and confirm it contains placeholders, not guessed modules.
- Inspect generated `AGENTS.md`/`CLAUDE.md` and confirm they are short entrypoints, not full PRD copies.
- For any command that rewrites files, inspect whether it creates a backup or only appends to non-canonical logs/ideas.
- Inspect `.context/hooks/*.json` and confirm templates call reminder commands only.
- For `cmap update --agent --apply-routine`, inspect `.context/audit/`, `.context/backups/`, and `.context/inbox/` and confirm semantic operations were not written into canonical files.
- For `cmap evidence append`, inspect the target module doc and confirm the write stayed inside the `cmap:generated:evidence` block.

## Known Flaky Checks
None known yet.

## Environment Assumptions
- Node.js 20 or newer; current local Node is v22.22.2.
- pnpm is available through Corepack/local install; current local pnpm is 10.32.1.
- This directory is now a git repository; `cmap verify --changed` currently runs and returns 0 warnings.
