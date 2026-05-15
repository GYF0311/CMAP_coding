---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-15T13:04:36+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Keep cmap on Trust Boundary + Human Review Layer while removing the i18n / locale branch and keeping Review HTML as an English project-map review page.

## Done Recently
The i18n / zh-CN / locale branch has been soft-reverted from the command surface and implementation. `cmap i18n export/check`, `cmap config get/set locale`, `init --lang`, `view --lang`, `.context/i18n/<locale>/` mirror reading, `locale` in the view data contract, and zh-CN UI messages are removed. Review HTML remains as the read-only human review layer for canonical project maps, generated evidence, freshness, inbox candidates, and relation explanations.

## Left Off
Canonical graph is still derived only from reviewed module docs. Route may warn about pending relation candidates but does not score or include them in `route.modules`, `route.contextModules`, or route benchmark data. Review HTML renders canonical `.context` module docs in English UI and ignores legacy locale config or translation mirrors.

## Next Steps
1. Review the i18n cleanup diff and commit it as one coherent cleanup slice if desired.
2. Continue improving Review HTML as an English project understanding page.
3. Decide a separate cleanup/migration task for legacy `.context/pending` and `.context/stats`; do not delete them in this cleanup.
4. Use `freshness mark-reviewed` only after a human/AI semantic review of updated module docs.

## Changed Files
- `.context/CHECKPOINT.md`, `.context/STATUS.md`, `.context/MAP.md`, `.context/modules/cli.md`, `.context/modules/view.md`, deleted `.context/modules/i18n.md`.
- `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/CMAP项目更新流程.md`, deleted superseded localized-review plan.
- `src/cli.ts`, `src/commands/init.ts`, `src/commands/view.ts`, deleted `src/commands/i18n.ts`, deleted `src/commands/config.ts`, deleted `src/i18n/*`.
- `src/view/collect.ts`, `src/view/messages.ts`, `src/view/render.ts`, `src/view/schema.ts`.
- `tests/integration/m19-view-export.test.ts`, deleted `tests/integration/m26-i18n-config.test.ts`, `tests/unit/redact.test.ts`.

## Risks
Legacy `.context/pending` and `.context/stats` still exist and intentionally produce warnings. `verify --changed` also reports the deleted i18n files/docs as unmapped because the i18n module was removed. `verify --stale` and `verify --freshness` report older semantic review metadata; resolve by review, not generated evidence writes.

## Last Verified
2026-05-15: `pnpm test` passed 27 files / 150 tests, `pnpm typecheck` passed, `pnpm smoke` passed, `pnpm dev verify` passed with 0 errors and 2 expected legacy warnings, `pnpm dev verify --stale` and `pnpm dev verify --freshness` passed with warning-only stale/freshness findings, `pnpm dev verify --policy` passed, `pnpm dev verify --ci --format markdown` passed, `pnpm dev view export --out _cmap-view` passed, `pnpm dev view export --check --out _cmap-view` passed, `pnpm dev obsidian export --out _cmap/CMAP_coding` refreshed the ignored view layer, `pnpm dev obsidian export --check` passed, route benchmark passed 100% Top-1/Top-3/context with 0 bad hits, and `git diff --check` passed.
