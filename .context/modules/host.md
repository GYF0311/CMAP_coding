---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T17:55:00+08:00
confidence: ai-drafted
module: host
paths:
  - src/host
  - src/commands/install.ts
aliases:
  - install
  - AGENTS
  - CLAUDE
  - host
  - 入口
---
# Module: host

## Purpose
Generate short host entrypoints for AI coding agents.

## Code Paths
- `src/host/entrypoint-template.ts`
- `src/commands/install.ts`

## Responsibilities
- Generate same-source `AGENTS.md` and/or `CLAUDE.md`.
- Keep entrypoints short and route-oriented.
- Validate host and hook profile options.

## Depends On
- Node filesystem/path APIs.

## Used By
- `cmap install --host claude|codex|both`
- Future hook installer.

## Data Flow
Options choose target files, template receives project name, command writes entrypoints at project root.

## State / Storage
Writes `AGENTS.md` and/or `CLAUDE.md`.

## Constraints
- Entrypoints should point to `.context`, not duplicate the full PRD.
- Hooks are reserved for later milestones and must not write canonical memory.

## Traps
- Keep `AGENTS.md` and `CLAUDE.md` identical unless a future host-specific reason is explicit.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`

## When to Update This Doc
When entrypoint content, host selection, or hook install semantics change.
