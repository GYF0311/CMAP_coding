---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-15T21:50:00+08:00
confidence: ai-drafted
module: skill
paths:
  - src/commands/skill.ts
  - src/commands/bootstrap.ts
  - src/skill
aliases:
  - skill
  - bootstrap
  - IDE
  - AGENTS
  - CLAUDE
  - start-here
  - 接入
relations:
  depends_on:
    - host
    - context
---
# Module: skill

## Purpose
Export portable cmap skill/reference instructions and bootstrap initialized projects so IDE agents can discover and use the project map without depending on one host-specific runtime.

## Code Paths
- `src/commands/skill.ts`
- `src/commands/bootstrap.ts`
- `src/skill/templates.ts`

## Responsibilities
- Render `.cmap/skills/cmap/` as a reusable English instructions pack with `SKILL.md`, `commands.md`, `boundaries.md`, and `examples.md`.
- Check whether an exported skill pack is stale without writing files.
- Bootstrap onboarding for an initialized project by running non-destructive host entrypoint install, optional skill export, and `.context/out/start-here.md` generation.
- Refuse bootstrap before `.context` exists and tell the user to run `cmap init --auto`.
- Keep skill content as guidance only; it must point back to `.context` as the trusted project memory.

## Depends On
- `host` for non-destructive `AGENTS.md` / `CLAUDE.md` install.
- `context` as the required initialized project memory skeleton.
- Node filesystem/path APIs.

## Used By
- `cmap skill export`
- `cmap skill export --check`
- `cmap bootstrap --host claude|codex|both --skill`

## Data Flow
Skill export renders deterministic Markdown files under `.cmap/skills/cmap/`. Bootstrap validates that `.context` exists, delegates host entrypoint merge to `install`, optionally delegates skill file rendering to `skill export`, and writes a generated start-here guide under `.context/out/`.

## State / Storage
- Skill pack: `.cmap/skills/cmap/**`
- Bootstrap guide: `.context/out/start-here.md`
- Host entrypoints and backups are owned by the `host` module.

## Constraints
- Skill export is a discoverability/reference layer, not a canonical fact layer.
- Bootstrap must not overwrite existing host rules; it relies on marker merge.
- Do not revive `--lang`, locale config, translation mirrors, or `.context/i18n` through skill/bootstrap.
- Host-specific hints can differ, but core cmap boundaries must stay consistent.

## Traps
- Do not auto-install into every IDE's global skill directory; export a project-local pack and explain host-specific usage.
- Do not let skill content become another source of module responsibilities or decisions.
- Do not auto-create `.context` during bootstrap; force the user or agent to run `cmap init --auto` explicitly first.

## Tests / Verification
- `pnpm test tests/integration/m28-skill-bootstrap.test.ts`
- `pnpm dev skill export --check`
- `pnpm dev bootstrap --host both --skill` in a temp initialized project

## When to Update This Doc
When skill pack structure, host hints, bootstrap behavior, or start-here output changes.
