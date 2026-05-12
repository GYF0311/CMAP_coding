---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T13:32:28+08:00
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
Keep the current project thread resumable through durable `STATUS.md` and task-local `CHECKPOINT.md`.

## Code Paths
- `src/commands/status.ts`
- `src/commands/checkpoint.ts`

## Responsibilities
- `status` prints `.context/STATUS.md`.
- Legacy `checkpoint --goal ...` updates `STATUS.md` from explicit fields.
- `checkpoint --from-stdin` can replace `STATUS.md` with caller-provided markdown.
- `checkpoint write` updates `.context/CHECKPOINT.md` from explicit task, next-step, verification, and do-not-redo fields.
- `checkpoint read` prints `CHECKPOINT.md`, falling back to `STATUS.md` if no checkpoint exists.
- `checkpoint close` marks the current checkpoint closed; `checkpoint clear` resets it to an empty cleared checkpoint.

## Depends On
- `gray-matter`
- Node filesystem/path APIs

## Used By
- Long sessions before compaction.
- `brief`, which prefers `CHECKPOINT.md` over `STATUS.md` for session startup context.
- Future `finish` flow.
- `update-agent`, which may write routine checkpoint state from an accepted MapPatch.

## Data Flow
Explicit CLI fields -> `CHECKPOINT.md` or `STATUS.md` sections. `update-agent` may also write `CHECKPOINT.md` from explicit MapPatch fields. No transcript auto-summary.

## State / Storage
Writes `.context/CHECKPOINT.md` for active handoff state and `.context/STATUS.md` for durable project status.

## Constraints
- Missing key checkpoint fields are command errors.
- The CLI must not summarize conversation history by itself.

## Traps
- `CHECKPOINT.md` is resumable working state, not a replacement for long-lived status or module facts.
- `--from-stdin` trusts the caller's markdown; it should be used by AI/user-generated checkpoint text, not raw transcript.

## Tests / Verification
- `pnpm test tests/integration/m2.test.ts`
- `pnpm dev checkpoint read`
- `pnpm dev status`

## When to Update This Doc
When STATUS schema, CHECKPOINT schema, checkpoint options, or compaction workflow changes.
