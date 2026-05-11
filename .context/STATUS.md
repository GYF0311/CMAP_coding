---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T01:12:00.000+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land cmap core + AI brief + Obsidian view-layer workflow on the existing v0.1 CLI

## Done Recently
Added a shared module index, wired route/finish to it, implemented `cmap brief`, implemented `cmap obsidian export/open`, added integration coverage for brief + Obsidian export, and dogfooded the workflow on this repo.

## Left Off
Full verification passed. Local generated `.context/out/brief.md` and `_cmap/CMAP_coding/*` exist for inspection but are ignored because they are task/view outputs, not canonical facts.

## Next Steps
Commit the code and `.context` updates, leaving pre-existing untracked `research/` untouched.

## Changed Files
- src/core/module-index.ts
- src/commands/brief.ts
- src/commands/obsidian.ts
- src/commands/route.ts
- src/commands/finish.ts
- src/cli.ts
- src/context/templates.ts
- tests/integration/m6-brief-obsidian.test.ts
- scripts/smoke-test.mjs
- README.md
- .gitignore
- .context/STATUS.md
- .context/MAP.md
- .context/VERIFY.md
- .context/modules/brief.md
- .context/modules/obsidian-adapter.md

## Risks
`brief` currently uses `.context/STATUS.md` as the checkpoint source; a future `CHECKPOINT.md` schema should be added compatibly rather than breaking existing `checkpoint` behavior.

## Last Verified
2026-05-12: `pnpm test`, `pnpm typecheck`, `pnpm dev verify`, `pnpm build`, `pnpm smoke`, and `pnpm dev verify --changed` passed. Dogfood commands `pnpm dev brief ... --out .context/out/brief.md`, `pnpm dev obsidian export --out _cmap/CMAP_coding`, and `pnpm dev obsidian open obsidian-adapter --vault-name corpus` also ran successfully.
