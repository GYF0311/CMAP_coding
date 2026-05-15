---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-15T22:28:19+08:00
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
- `src/host/merge-entrypoint.ts`
- `src/commands/install.ts`

## Responsibilities
- Generate same-source `AGENTS.md` and/or `CLAUDE.md`.
- Merge the cmap marker block into existing host entrypoints without overwriting project-owned rules by default.
- Support print-only previews, explicit `--force` overwrites, and optional backups before entrypoint writes.
- Keep entrypoints short and route-oriented.
- Include Git Safety Rules inside the cmap marker block so AI agents know not to reset, restore, clean, delete, or overwrite user work.
- Allow proactive commits after coherent, verified work slices while still staging only task-related files and never committing unrelated user changes.
- Point agents to `CHECKPOINT.md` for current handoff and `STATUS.md` for durable status.
- Validate host and hook profile options, including `reminder`, `maintain`, `observe`, `assist`, and `strict`.

## Depends On
- Node filesystem/path APIs.

## Used By
- `cmap install --host claude|codex|both`
- `cmap install --host both --mode merge|print`
- `cmap install --host both --backup`
- `cmap install --host both --force`
- `cmap install --host both --hooks reminder|maintain|observe|assist|strict`
- `cmap bootstrap --host claude|codex|both`

## Data Flow
Options choose target files, merge mode, backup behavior, and hook profile. Template receives project name, install writes or previews marker blocks at the project root and optional hook templates under `.context/hooks/`.

## State / Storage
Writes `AGENTS.md` and/or `CLAUDE.md`; optional pre-write backups go under `.context/backups/install-*`; writes `.context/hooks/*.json` only when hooks are requested.

## Constraints
- Entrypoints should point to `.context`, not duplicate the full PRD.
- Default install must preserve content outside `<!-- cmap:start -->` / `<!-- cmap:end -->`.
- Full overwrite is allowed only through explicit `--force`.
- Hook install only writes project-local templates; hook runtime behavior must not write canonical project semantics.

## Traps
- Existing `AGENTS.md` and `CLAUDE.md` may intentionally differ outside the cmap marker block; do not normalize away host-owned content.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`
- `pnpm test tests/integration/m9-hooks-assist.test.ts`
- `pnpm test tests/integration/m27-install-merge.test.ts`

## When to Update This Doc
When entrypoint content, host selection, or hook install semantics change.
