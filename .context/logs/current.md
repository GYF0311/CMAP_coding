---
cmap_version: 0.1
context_type: log
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T09:44:43.433Z
confidence: medium
---
# Current Work Log

## 2026-05-10 — M1 CLI skeleton

**Goal:** Start building cmap from zero according to `cmap_v0.1_PRD_and_execution_manual.md`.
**Changed:** Added TypeScript CLI scaffolding, M1 commands, integration tests, generated `.context`, and host entrypoints.
**Tried:** Wrote failing M1 integration tests first; initial run failed because CLI did not exist. After implementation, tests failed once due to `tsx` resolution from temp cwd; fixed the test harness to call the repo-local `node_modules/.bin/tsx`.
**Result:** M1 behavior is implemented: `version`, `init --auto`, `verify`, `install --host both`.
**Verification:** `pnpm test`, `pnpm typecheck`, and `pnpm build` passed before this log entry was written.
**Memory Impact:** Added this `.context` map so future work can route by module.
**Next:** Implement M2: `route`, `status`, and `checkpoint`.

## 2026-05-10 — M2 route and checkpoint

**Goal:** Add deterministic routing and explicit status handoff.
**Changed:** Added `src/commands/route.ts`, `src/commands/status.ts`, `src/commands/checkpoint.ts`, M2 integration tests, and route alias boundary handling.
**Tried:** Dogfooded `cmap route "继续实现 checkpoint 和 route"` and found `checkpoint` incorrectly matched verify alias `check`.
**Result:** Added a regression test and changed ASCII aliases to require word boundaries; Chinese aliases still use substring matching.
**Verification:** `pnpm test tests/integration/m2.test.ts` passed after the fix.
**Memory Impact:** Added route and handoff modules to `MAP.md`.
**Next:** Run full verification and move to M3.

## 2026-05-10 — M3 cp, finish, log, idea

**Goal:** Add deterministic file-block and closeout commands.
**Changed:** Added `src/commands/cp.ts`, `src/commands/finish.ts`, `src/commands/log.ts`, `src/commands/idea.ts`, and shared fs helpers for safe paths, line-block manipulation, and backups.
**Tried:** Wrote M3 integration tests first; initial run failed because commands were unregistered.
**Result:** Implemented `cp copy/move/delete/restore`, `finish --changed`, `log add`, and `idea add`.
**Verification:** `pnpm test`, `pnpm typecheck`, and `pnpm build` passed after implementation.
**Memory Impact:** Added cp, finish, and memory-lite modules to the project map.
**Next:** Implement M4/M5: `adopt`, `add-module`, `doctor`, and optional hook generation.

## 2026-05-10 — M4/M5 adopt, module docs, hooks, doctor

**Goal:** Complete the remaining v0.1 CLI command surface.
**Changed:** Added `adopt`, `add-module`, `doctor`, hook reminder commands, hook template generation in `install --hooks`, and adoption scanning.
**Tried:** Wrote M4/M5 integration tests first; initial run failed because commands and hook template generation were missing.
**Result:** Existing-project adoption now writes `ADOPTION.md` candidate signals, add-module creates candidate module docs, hooks only print reminders, and doctor diagnoses context/entrypoint/hook state.
**Verification:** `pnpm test`, `pnpm typecheck`, and `pnpm build` passed after implementation.
**Memory Impact:** Added adoption, module-docs, and hooks-doctor modules to MAP.
**Next:** Polish README and release-facing docs, then run final v0.1 verification.

## 2026-05-10 — v0.1 README polish

**Goal:** Add release-facing README and close the v0.1 implementation loop.
**Changed:** Added README with product positioning, quick start, command table, boundary rules, and verification commands.
**Tried:** Kept README concise and aligned with the PRD's "project map, not AI coding full stack" boundary.
**Result:** README now gives a usable first screen and command overview.
**Verification:** Pending final full verification after this doc update.
**Memory Impact:** Added README to MAP entrypoints.
**Next:** Run final test/typecheck/build/self-verify and built CLI smoke test.

## 2026-05-10 — Built CLI smoke and usage-error hardening

**Goal:** Add a post-build self-test and fix CLI usage-error behavior.
**Changed:** Added `tests/integration/cli-errors.test.ts`, changed unknown command handling to exit 2 without duplicate messages, added `pnpm smoke`, and added `scripts/smoke-test.mjs`.
**Tried:** First smoke run failed because the temp project added a module path without creating the matching source directory.
**Result:** Smoke script now creates the source path, then runs built CLI commands through version/init/install/add-module/route/checkpoint/verify/unknown-command checks.
**Verification:** `pnpm test tests/integration/cli-errors.test.ts` and `pnpm smoke` passed after fixes.
**Memory Impact:** Added smoke script to MAP/VERIFY/tests module.
**Next:** Run full verification and commit.
