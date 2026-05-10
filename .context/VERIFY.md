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

## Module-specific Checks
| Module | Command | Manual Check |
|---|---|---|
| cli | `pnpm test tests/integration/m1.test.ts` | Commands return expected stdout and exit codes. |
| context | `pnpm dev init --auto` in a temp project | Generated files stay skeletal and do not invent module semantics. |
| verify | `pnpm dev verify` | Errors are real structural problems; warnings are actionable. |
| host | `pnpm dev install --host both` in a temp project | `AGENTS.md` and `CLAUDE.md` stay short and identical. |
| route | `pnpm dev route "checkpoint 更新当前主线"` | Should recommend handoff, not verify through `check` substring. |
| handoff | `pnpm dev status` | Prints current `STATUS.md`; checkpoint writes only explicit fields. |

## Optional Commands
- `node dist/cli.js version` after `pnpm build`.

## Manual Verification
- Inspect generated `.context/MAP.md` from `init` and confirm it contains placeholders, not guessed modules.
- Inspect generated `AGENTS.md`/`CLAUDE.md` and confirm they are short entrypoints, not full PRD copies.

## Known Flaky Checks
None known yet.

## Environment Assumptions
- Node.js 20 or newer; current local Node is v22.22.2.
- pnpm is available through Corepack/local install; current local pnpm is 10.32.1.
- This directory is not yet a git repository, so source commit and changed-file checks may be unavailable.
