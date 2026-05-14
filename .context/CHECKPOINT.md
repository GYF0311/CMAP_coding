---
context_type: checkpoint
status: active
updated_at: '2026-05-14T15:24:18.474Z'
source: manual
---
# Current Checkpoint

## Current Task
P0 onboarding: non-destructive install, skill export, and bootstrap

## Current Hypothesis
cmap should use AGENTS/CLAUDE as non-destructive lowest-compatible entrypoints, skill export as a project-local IDE reference pack, and bootstrap as the one-command onboarding flow.

## Changed Files
- src/commands/install.ts
- src/host/entrypoint-template.ts
- src/host/merge-entrypoint.ts
- src/commands/skill.ts
- src/skill/templates.ts
- src/commands/bootstrap.ts
- src/cli.ts
- tests/integration/m27-install-merge.test.ts
- tests/integration/m28-skill-bootstrap.test.ts
- README.md
- .context/MAP.md
- .context/VERIFY.md
- .context/modules/host.md
- .context/modules/cli.md
- .context/modules/skill.md
- .context/modules/tests.md

## Verified
pnpm test; pnpm typecheck; pnpm build; pnpm smoke; pnpm dev verify; pnpm dev verify --ci --format markdown; pnpm dev verify --changed; git diff --check

## Failed / Pending
verify --changed has warning-only legacy .context/pending/.context/stats messages and unmapped documentation-file warnings; errors 0.

## Next Step
Review diff, then commit and push this onboarding slice if accepted.

## Do Not Redo
Do not return to overwrite-style install. Keep Skill as a reference/discovery layer, not a replacement for .context or AGENTS/CLAUDE.
