---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T01:35:00+08:00
confidence: ai-drafted
module: tests
paths:
  - tests
  - scripts/smoke-test.mjs
aliases:
  - test
  - vitest
  - smoke
  - 自测
  - 集成测试
  - 行为测试
  - red green
---
# Module: tests

## Purpose
Prove public CLI behavior with reproducible integration tests and built-CLI smoke checks.

## Code Paths
- `tests/integration/m1.test.ts`
- `tests/integration/m2.test.ts`
- `tests/integration/m3.test.ts`
- `tests/integration/m4m5.test.ts`
- `tests/integration/m6-brief-obsidian.test.ts`
- `tests/integration/cli-errors.test.ts`
- `tests/integration/verify-l0.test.ts`
- `scripts/smoke-test.mjs`

## Responsibilities
- Spawn the CLI in temporary project directories.
- Assert stdout/stderr-sensitive behavior and exit codes.
- Assert generated files contain expected content and do not invent project semantics.
- Assert `CHECKPOINT.md` write/read/close behavior and legacy `STATUS.md` checkpoint compatibility.
- Assert brief/export commands write task-local or view-layer artifacts without changing canonical facts.
- Assert coverage, pull dry-run, and benchmark commands surface candidate issues without canonical writes.
- Run built `dist/cli.js` against a real temp project through `pnpm smoke`.

## Depends On
- Vitest
- Node child_process, fs, os, path APIs
- Repo-local `node_modules/.bin/tsx`
- Built `dist/cli.js` for smoke tests

## Used By
- Development workflow before claiming completion.
- Future regression coverage for milestones.

## Data Flow
Test creates temp cwd -> executes CLI source through tsx -> inspects process result and generated files.

## State / Storage
Temporary directories under the system temp path.

## Constraints
- Tests should exercise user-visible behavior before internals.
- Avoid brittle timestamp assertions.

## Traps
- `node --import tsx` resolves from cwd; use repo-local `tsx` binary when cwd is a temp project.

## Tests / Verification
- `pnpm test`
- `pnpm smoke`

## When to Update This Doc
When changing test harness strategy, adding fixtures, or changing public behavior contracts.
