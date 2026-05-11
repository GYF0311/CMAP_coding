---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T18:08:00+08:00
confidence: ai-drafted
module: finish
paths:
  - src/commands/finish.ts
  - src/core/module-index.ts
aliases:
  - finish
  - closeout
  - report
  - 收尾
  - 上下文收尾
relations:
  depends_on:
    - module-docs
    - verify
    - handoff
---
# Module: finish

## Purpose
Produce a QA-lite closeout report focused on project memory and verification reminders.

## Code Paths
- `src/commands/finish.ts`
- `src/core/module-index.ts`

## Responsibilities
- Collect changed files from `--changed` or `git status --short`.
- Match changed files to module docs through the shared module index.
- Remind whether STATUS/modules/DECISIONS/traps/logs may need updates.
- Suggest `cmap verify --changed`.
- Report unmapped changed files so map coverage gaps are visible.

## Depends On
- `gray-matter`
- module docs in `.context/modules/*.md`
- `core/module-index.ts`
- git when no `--changed` list is provided

## Used By
- `cmap finish`

## Data Flow
Changed files -> shared module path matching -> Markdown report.

## State / Storage
Read-only in v0.1.

## Constraints
- Does not do code review, security review, release, or CI.
- Does not write trusted memory automatically.

## Traps
- Matching by path is deterministic but not semantic truth.

## Tests / Verification
- `pnpm test tests/integration/m3.test.ts`
- `pnpm dev finish --changed src/commands/finish.ts`

## When to Update This Doc
When finish starts generating pending updates or running deeper checks.
