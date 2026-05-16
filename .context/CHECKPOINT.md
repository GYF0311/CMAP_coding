---
context_type: checkpoint
status: active
updated_at: '2026-05-16T04:13:42.000Z'
source: manual
---
# Current Checkpoint

## Current Task
CMAP global skill discovery fix

## Current Hypothesis
Global cmap skill files existed, but the generated `SKILL.md` lacked frontmatter, so Codex UI could not index it. Add `name`/`description` frontmatter to the template and installed global copies.

## Changed Files
- `src/skill/templates.ts`
- `tests/integration/m28-skill-bootstrap.test.ts`
- `.gitignore`
- `.context/modules/skill.md`
- global installed skill files under `~/.codex/skills/cmap` and `~/.agents/skills/cmap`

## Verified
pnpm test tests/integration/m28-skill-bootstrap.test.ts; pnpm typecheck; pnpm dev skill export --check --out .cmap/skills/cmap; cmp project-local skill files with ~/.codex/skills/cmap and ~/.agents/skills/cmap; pnpm dev verify; pnpm dev verify --freshness; pnpm dev graph build; pnpm dev view export --out _cmap-view; pnpm dev view export --check --out _cmap-view; pnpm dev obsidian export; pnpm dev obsidian export --check; git diff --check

## Failed / Pending
UI may need a new chat or app refresh before the newly indexed skill appears in the picker.

## Next Step
Commit and push the skill discovery fix.

## Do Not Redo
None recorded.
