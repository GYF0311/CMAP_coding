---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T18:08:00+08:00
confidence: ai-drafted
module: cp
paths:
  - src/commands/cp.ts
  - src/fs
aliases:
  - cp
  - copy
  - move
  - delete
  - restore
  - line block
  - 行块
  - 搬运
  - 备份
---
# Module: cp

## Purpose
Move, copy, delete, and restore existing line blocks without using irreversible file deletion.

## Code Paths
- `src/commands/cp.ts`
- `src/fs/safe-path.ts`
- `src/fs/line-block.ts`
- `src/fs/backup.ts`

## Responsibilities
- Parse `file:start-end` and `file:position` references.
- Ensure paths stay inside the project root.
- Preserve target newline style while rewriting text.
- Create backups before move/delete.
- Restore backups by id.

## Depends On
- Node filesystem/path APIs.
- `.context/backups/` for backup records.

## Used By
- `cmap cp copy`
- `cmap cp move`
- `cmap cp delete`
- `cmap cp restore`

## Data Flow
Line reference -> safe path resolution -> read source/target -> select/remove/insert lines -> write updated files -> optional backup id.

## State / Storage
- Writes modified target/source files.
- Writes `.context/backups/<id>.json` for move/delete.

## Constraints
- No `rm`.
- Reject `..` paths outside cwd.
- Backup before destructive line edits.

## Traps
- `delete` deletes line ranges, not whole files.
- Restore overwrites backed-up files with their saved content.

## Tests / Verification
- `pnpm test tests/integration/m3.test.ts`

## When to Update This Doc
When line range syntax, backup format, restore behavior, or path safety rules change.
