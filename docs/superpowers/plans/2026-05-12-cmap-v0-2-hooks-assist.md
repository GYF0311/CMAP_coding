# cmap v0.2 Hooks Assist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect hook lifecycle commands to the new generated evidence layer without letting hooks write trusted semantic facts.

**Architecture:** Extend hook profiles from reminder/maintain to observe/assist. `observe` records deterministic hook events in non-canonical logs; `assist` can append bounded generated evidence for explicitly changed files that map to known modules. Hook templates remain project-local examples and do not edit host-global settings.

**Tech Stack:** TypeScript CLI, Commander, Vitest integration tests, existing module index and evidence command.

---

## Task 1: Failing Tests

**Files:**
- Create `tests/integration/m9-hooks-assist.test.ts`

- [x] Write tests for `install --hooks assist`, `doctor`, `hooks stop --profile observe`, and `hooks stop --profile assist --changed ...`.
- [x] Run `pnpm test tests/integration/m9-hooks-assist.test.ts` and confirm failure before production code.

## Task 2: Hook Profiles

**Files:**
- Modify `src/hooks/templates.ts`
- Modify `src/commands/install.ts`
- Modify `src/commands/doctor.ts`
- Modify `src/cli.ts`

- [x] Add `observe` and `assist` to hook profile validation and templates.
- [x] Update doctor to detect reminder, maintain, observe, or assist templates.

## Task 3: Hook Stop Behavior

**Files:**
- Modify `src/commands/hooks.ts`

- [x] Add `--changed <csv>` and `--summary <text>` support to `hooks stop`.
- [x] In `observe`, append a JSONL event to `.context/logs/hooks.jsonl`.
- [x] In `assist`, map changed files to modules and call generated evidence append for mapped files only.
- [x] Preserve reminder/maintain output behavior.

## Task 4: Docs And Context

**Files:**
- Modify `README.md`
- Modify `.context/MAP.md`
- Modify `.context/STATUS.md`
- Modify `.context/VERIFY.md`
- Modify `.context/modules/hooks-doctor.md`
- Modify `.context/modules/evidence.md`
- Modify `.context/modules/tests.md`

- [x] Document observe/assist as optional local hook profiles.
- [x] Re-state that generated evidence is not canonical project semantics.

## Task 5: Verification And Save

- [x] Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, `git diff --check`.
- [x] Commit and push.
