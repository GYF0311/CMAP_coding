---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T17:55:00+08:00
confidence: ai-drafted
module: tests
paths:
  - tests
aliases:
  - test
  - vitest
  - 集成测试
  - 行为测试
  - red green
---
# Module: tests

## Purpose
Prove public CLI behavior with reproducible integration tests.

## Code Paths
- `tests/integration/m1.test.ts`

## Responsibilities
- Spawn the CLI in temporary project directories.
- Assert stdout/stderr-sensitive behavior and exit codes.
- Assert generated files contain expected content and do not invent project semantics.

## Depends On
- Vitest
- Node child_process, fs, os, path APIs
- Repo-local `node_modules/.bin/tsx`

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

## When to Update This Doc
When changing test harness strategy, adding fixtures, or changing public behavior contracts.
