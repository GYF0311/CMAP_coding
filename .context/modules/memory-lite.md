---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T18:08:00+08:00
confidence: ai-drafted
module: memory-lite
paths:
  - src/commands/log.ts
  - src/commands/idea.ts
aliases:
  - log
  - idea
  - 工作日志
  - 灵感
  - inbox
---
# Module: memory-lite

## Purpose
Append explicit work logs and non-canonical ideas without polluting trusted project memory.

## Code Paths
- `src/commands/log.ts`
- `src/commands/idea.ts`

## Responsibilities
- `log add` appends to `.context/logs/current.md`.
- `idea add` appends to `.context/ideas/_inbox.md`.
- Keep ideas out of `MAP.md`.

## Depends On
- Node filesystem/path APIs.

## Used By
- `cmap log add`
- `cmap idea add`

## Data Flow
Explicit text -> date-stamped markdown entry -> append-only target file.

## State / Storage
- `.context/logs/current.md`
- `.context/ideas/_inbox.md`

## Constraints
- No transcript auto-summary.
- Logs and ideas are not canonical facts.

## Traps
- If an idea becomes part of the main plan, AI/user must explicitly promote it into BRIEF/MAP/DECISIONS later.

## Tests / Verification
- `pnpm test tests/integration/m3.test.ts`

## When to Update This Doc
When log/idea schema or append target changes.
