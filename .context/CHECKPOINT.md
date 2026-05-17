---
context_type: checkpoint
status: active
updated_at: '2026-05-17T22:11:00.000Z'
source: manual
---
# Current Checkpoint

## Current Task
Review HTML localized UI and human-readable `.context` rendering

## Current Hypothesis
The dogfood issue is not missing `.context` data, but poor presentation: module docs with Chinese headings were not parsed into human-readable cards/details, the details dialog dumped JSON, and the UI shell was fixed to English. Keep canonical headings as English anchors going forward, parse legacy Chinese headings for compatibility, and localize only Review HTML labels via `--ui-lang zh-CN`.

## Changed Files
- `src/view/*`, `src/commands/view.ts`, `src/cli.ts`
- `src/context/templates.ts`, `src/commands/add-module.ts`, `src/commands/bootstrap.ts`, `src/host/entrypoint-template.ts`, `src/skill/templates.ts`
- `tests/integration/m19-view-export.test.ts`, `tests/integration/m27-install-merge.test.ts`, `tests/integration/m28-skill-bootstrap.test.ts`, `tests/integration/m4m5.test.ts`, `tests/unit/redact.test.ts`
- `README.md`, `docs/CMAP项目更新流程.md`, and relevant `.context` module docs

## Verified
pnpm test; pnpm typecheck; pnpm test tests/integration/m19-view-export.test.ts; pnpm test tests/integration/m27-install-merge.test.ts tests/integration/m28-skill-bootstrap.test.ts tests/integration/m4m5.test.ts tests/unit/redact.test.ts; pnpm dev view export --out _cmap-view; pnpm dev view export --check --out _cmap-view; pnpm dev view export --ui-lang zh-CN --out .context/out/zh-view.html; pnpm dev view export --ui-lang zh-CN --check --out .context/out/zh-view.html; pnpm dev obsidian export --out _cmap/CMAP_coding; pnpm dev obsidian export --check --out _cmap/CMAP_coding; pnpm dev verify --changed; git diff --check

## Failed / Pending
`pnpm dev verify --changed` exits 0 with 13 warnings because changed docs/context files are not mapped to modules in the current coverage table.

## Next Step
Review diff; optionally regenerate a Chinese Review HTML in the target dogfood repo (`cmap view export --ui-lang zh-CN --out _cmap-view`) after this code lands.

## Do Not Redo
None recorded.
