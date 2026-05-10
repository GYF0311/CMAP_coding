---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T18:02:00+08:00
confidence: ai-drafted
module: handoff
paths:
  - src/commands/status.ts
  - src/commands/checkpoint.ts
aliases:
  - status
  - checkpoint
  - handoff
  - 续接
  - 主线
  - 上下文
---
# Module: handoff

## Purpose
Keep the current project thread resumable through `STATUS.md`.

## Code Paths
- `src/commands/status.ts`
- `src/commands/checkpoint.ts`

## Responsibilities
- `status` prints `.context/STATUS.md`.
- `checkpoint` updates `STATUS.md` from explicit fields.
- `checkpoint --from-stdin` can replace `STATUS.md` with caller-provided markdown.

## Depends On
- `gray-matter`
- Node filesystem/path APIs

## Used By
- Long sessions before compaction.
- Future `finish` flow.

## Data Flow
Explicit CLI fields -> `STATUS.md` sections. No transcript auto-summary.

## State / Storage
Writes `.context/STATUS.md`.

## Constraints
- Missing key checkpoint fields are command errors.
- The CLI must not summarize conversation history by itself.

## Traps
- `--from-stdin` trusts the caller's markdown; it should be used by AI/user-generated checkpoint text, not raw transcript.

## Tests / Verification
- `pnpm test tests/integration/m2.test.ts`
- `pnpm dev status`

## When to Update This Doc
When STATUS schema, checkpoint options, or compaction workflow changes.
