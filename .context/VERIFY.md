---
cmap_version: 0.1
context_type: verify
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T09:44:43.433Z
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
| smoke | `pnpm smoke` | exit 0 | before release or handoff |

## Module-specific Checks
| Module | Command | Manual Check |
|---|---|---|
| cli | `pnpm test tests/integration/m1.test.ts` | Commands return expected stdout and exit codes. |
| context | `pnpm dev init --auto` in a temp project | Generated files stay skeletal and do not invent module semantics. |
| verify | `pnpm dev verify` | Errors are real structural problems; warnings are actionable. |
| host | `pnpm dev install --host both` in a temp project | `AGENTS.md` and `CLAUDE.md` stay short and identical. |
| route | `pnpm dev route "checkpoint 更新当前主线"` | Should recommend handoff, not verify through `check` substring. |
| handoff | `pnpm dev status` | Prints current `STATUS.md`; checkpoint writes only explicit fields. |
| cp | `pnpm test tests/integration/m3.test.ts` | Copy/move/delete/restore preserve expected line content and reject path escape. |
| finish | `pnpm dev finish --changed src/commands/cp.ts` | Prints a report and does not modify trusted memory. |
| memory-lite | `pnpm test tests/integration/m3.test.ts` | `log add` and `idea add` append only to logs/ideas. |
| adoption | `pnpm test tests/integration/m4m5.test.ts` | Adopt writes ADOPTION candidate signals without promoting them into MAP. |
| module-docs | `pnpm test tests/integration/m4m5.test.ts` | add-module writes candidate docs and leaves MAP unchanged. |
| hooks-doctor | `pnpm test tests/integration/m4m5.test.ts` | install writes hook templates; hooks print reminders; doctor sees state. |
| release smoke | `pnpm smoke` | Builds `dist/cli.js` and runs real commands in a temp project. |
| verify L0 drift | `pnpm test tests/integration/verify-l0.test.ts` | MAP module docs, entrypoint drift, and module TODO residue are detected. |
| verify commands and pending | `pnpm test tests/integration/verify-l0.test.ts` | Missing package verification scripts and pending overload warnings are detected. |

## Optional Commands
- `node dist/cli.js version` after `pnpm build`.

## Manual Verification
- Inspect generated `.context/MAP.md` from `init` and confirm it contains placeholders, not guessed modules.
- Inspect generated `AGENTS.md`/`CLAUDE.md` and confirm they are short entrypoints, not full PRD copies.
- For any command that rewrites files, inspect whether it creates a backup or only appends to non-canonical logs/ideas.
- Inspect `.context/hooks/*.json` and confirm templates call reminder commands only.

## Known Flaky Checks
None known yet.

## Environment Assumptions
- Node.js 20 or newer; current local Node is v22.22.2.
- pnpm is available through Corepack/local install; current local pnpm is 10.32.1.
- This directory is now a git repository; `cmap verify --changed` currently runs and returns 0 warnings.
