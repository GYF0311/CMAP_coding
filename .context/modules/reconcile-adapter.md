---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-15T22:44:41+08:00
confidence: ai-drafted
module: reconcile-adapter
paths:
  - src/commands/reconcile.ts
aliases:
  - reconcile
  - adapter
  - GSD adapter
  - gsd-v1
  - gsd-v2
  - dry-run
  - 候选事实
  - 外部产物
relations:
  depends_on:
    - module-docs
    - verify
---
# Module: reconcile-adapter

## Purpose
Read external workflow artifacts and produce dry-run candidate reports without changing canonical `.context` facts.

## Code Paths
- `src/commands/reconcile.ts`

## Responsibilities
- Support `--adapter gsd-v1` and `--adapter gsd-v2`.
- Default to `.planning` for GSD v1 and `.gsd` for GSD v2.
- Recursively scan Markdown workflow artifacts.
- Classify candidate lines as module facts, decisions, verification evidence, phase notes, or conflicts.
- Optionally write structured `cmap.candidate.v1` JSON+Markdown under `.context/inbox/candidates/` while preserving a legacy `.context/inbox/<adapter>-*.md` report.

## Depends On
- `module-docs`
- `verify`

## Used By
- `cmap reconcile --adapter gsd-v1 --from .planning`
- `cmap reconcile --adapter gsd-v2 --from .gsd`

## Data Flow
External workflow Markdown -> lightweight classifier -> dry-run report -> stdout, or structured candidates plus a legacy inbox report when `--write-inbox` is set.

## State / Storage
Read-only by default. With `--write-inbox`, writes structured candidates under `.context/inbox/candidates/` and a compatibility report under `.context/inbox/`.

## Constraints
- Never writes directly to `.context/modules`, `DECISIONS.md`, or `VERIFY.md`.
- Treats all findings as candidates requiring human/AI review.
- Does not parse `gsd.db`; GSD v2 support is projection-first in this version.

## Traps
- Keyword classification is intentionally conservative and can produce false positives.
- Phase progress is not a long-term project fact unless promoted manually.

## Tests / Verification
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm dev reconcile --adapter gsd-v1 --from .planning`

## When to Update This Doc
When adapter formats, candidate classification, inbox behavior, or GSD source handling changes.
