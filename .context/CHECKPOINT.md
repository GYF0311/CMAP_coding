---
context_type: checkpoint
status: active
updated_at: '2026-05-15T13:04:36+08:00'
source: manual
---
# Current Checkpoint

## Current Task
Remove the i18n / zh-CN / locale branch while keeping Review HTML focused on English project-map rendering.

## Current Hypothesis
Current mainline should stay on Trust Boundary + Human Review Layer: AI proposes candidates, CLI validates/audits/routes them, and HTML/Obsidian views remain read-only review layers. Review HTML is the core human project-understanding page, with English UI and canonical `.context` facts as input. Do not revive i18n / zh-CN / locale / translation mirrors, import graph, route v2, or pack v2 as the current roadmap unless a future explicit plan supersedes this checkpoint.

## Changed Files
- .context/CHECKPOINT.md
- .context/MAP.md
- .context/modules/cli.md
- .context/modules/i18n.md
- .context/modules/view.md
- AGENTS.md
- CLAUDE.md
- README.md
- docs/CMAP项目更新流程.md
- docs/superpowers/plans/2026-05-14-cmap-localized-review-html.md
- src/cli.ts
- src/commands/config.ts
- src/commands/i18n.ts
- src/commands/init.ts
- src/commands/view.ts
- src/i18n/config.ts
- src/i18n/context-mirror.ts
- src/i18n/locale.ts
- src/view/collect.ts
- src/view/messages.ts
- src/view/render.ts
- src/view/schema.ts
- tests/integration/m19-view-export.test.ts
- tests/integration/m26-i18n-config.test.ts
- tests/unit/redact.test.ts

## Verified
pnpm test; pnpm typecheck; pnpm smoke; pnpm dev verify; pnpm dev verify --changed; pnpm dev verify --stale; pnpm dev verify --freshness; pnpm dev verify --policy; pnpm dev verify --ci --format markdown; pnpm dev view export --out _cmap-view; pnpm dev view export --check --out _cmap-view; pnpm dev obsidian export --out _cmap/CMAP_coding; pnpm dev obsidian export --check; pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0; pnpm dev finish --changed src/cli.ts,src/commands/init.ts,src/commands/view.ts,src/view/collect.ts,src/view/render.ts,src/view/messages.ts,src/view/schema.ts,tests/integration/m19-view-export.test.ts,tests/unit/redact.test.ts; git diff --check

## Failed / Pending
Expected warnings remain: legacy `.context/pending` exists, legacy `.context/stats` exists, `verify --changed` reports unmapped deleted i18n files/docs because the i18n module was intentionally removed, and freshness/stale checks report older module review metadata from prior implementation work. These are warning-only and are intentionally not cleaned or deleted in this task.

## Next Step
Review the cleanup diff, then commit as a single cleanup slice if desired. Future work should enhance Review HTML as an English project understanding page and keep translation/i18n as a separate future workflow candidate.

## Do Not Redo
Do not reintroduce `i18n export/check`, `config locale`, `init --lang`, `view --lang`, `.context/i18n/<locale>/`, zh-CN UI dictionaries, CLI import graph, route v2 scoring, or pack v2 priority work as the current roadmap unless a future research proposal explicitly supersedes this checkpoint.
