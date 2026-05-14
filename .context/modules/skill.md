---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-14T23:20:00+08:00
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
  - 技能包
  - 接入
relations:
  depends_on:
    - host
    - context
---
# Module: skill

## Purpose
Export portable cmap skill/reference instructions and bootstrap a new project so IDE agents can discover and use the project map without depending on one host-specific runtime.

## Code Paths
- `src/commands/skill.ts`
- `src/commands/bootstrap.ts`
- `src/skill/templates.ts`

## Responsibilities
- Render `.cmap/skills/cmap/` as a reusable instructions pack with `SKILL.md`, `commands.md`, `boundaries.md`, `examples.md`, and `install.md`.
- Support English and `zh-CN` skill exports without changing canonical `.context` facts.
- Check whether an exported skill pack is stale without writing files.
- Bootstrap project onboarding by ensuring `.context/`, non-destructive host entrypoints, skill export, and `.context/out/start-here.md`.
- Keep skill content as guidance only; it must point back to `.context` as the trusted project memory.

## Depends On
- `host` for non-destructive `AGENTS.md` / `CLAUDE.md` install.
- `context` for `init --auto` when bootstrap starts in a project without `.context`.
- Node filesystem/path APIs.

## Used By
- `cmap skill export`
- `cmap skill export --check`
- `cmap bootstrap --host claude|codex|both --lang en|zh-CN`

## Data Flow
Skill export renders deterministic Markdown files under `.cmap/skills/cmap/` or `.cmap/skills/cmap/<locale>/`. Bootstrap optionally initializes `.context`, delegates host entrypoint merge to `install`, delegates skill file rendering to `skill export`, and writes a generated start-here guide under `.context/out/`.

## State / Storage
- Skill pack: `.cmap/skills/cmap/**`
- Bootstrap guide: `.context/out/start-here.md`
- Host entrypoints and backups are owned by the `host` module.

## Constraints
- Skill export is a discoverability/reference layer, not a canonical fact layer.
- Bootstrap must not overwrite existing host rules; it relies on marker merge.
- Host-specific hints can differ, but core cmap boundaries must stay consistent.

## Traps
- Do not auto-install into every IDE's global skill directory; export a project-local pack and explain host-specific usage.
- Do not let skill content become another source of module responsibilities or decisions.

## Tests / Verification
- `pnpm test tests/integration/m28-skill-bootstrap.test.ts`
- `pnpm dev skill export --check`
- `pnpm dev bootstrap --host both --lang zh-CN` in a temp project

## When to Update This Doc
When skill pack structure, host hints, bootstrap behavior, or start-here output changes.
