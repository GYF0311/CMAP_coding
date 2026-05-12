---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T21:30:00+08:00
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
Generate short host entrypoints and optional project-local hook templates for AI coding agents.

## Code Paths
- `src/host/entrypoint-template.ts`
- `src/commands/install.ts`

## Responsibilities
- Generate same-source `AGENTS.md` and/or `CLAUDE.md`.
- Keep entrypoints short and route-oriented.
- Point agents to `CHECKPOINT.md` for current handoff and `STATUS.md` for durable status.
- Validate host and hook profile options, including `reminder`, `maintain`, `observe`, `assist`, and `strict`.

## Depends On
- Node filesystem/path APIs.

## Used By
- `cmap install --host claude|codex|both`
- `cmap install --host both --hooks reminder|maintain|observe|assist|strict`

## Data Flow
Options choose target files and hook profile, template receives project name, command writes entrypoints at project root and optional hook templates under `.context/hooks/`.

## State / Storage
Writes `AGENTS.md` and/or `CLAUDE.md`; writes `.context/hooks/*.json` only when hooks are requested.

## Constraints
- Entrypoints should point to `.context`, not duplicate the full PRD.
- Hook install only writes project-local templates; hook runtime behavior must not write canonical project semantics.

## Traps
- Keep `AGENTS.md` and `CLAUDE.md` identical unless a future host-specific reason is explicit.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`
- `pnpm test tests/integration/m9-hooks-assist.test.ts`

## When to Update This Doc
When entrypoint content, host selection, or hook install semantics change.
