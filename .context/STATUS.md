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
Keep cmap on Trust Boundary + Human Review Layer while making real-project onboarding safe: non-destructive host entrypoints, English-only skill/bootstrap discovery, and Review HTML as the human review layer.

## Done Recently
`cmap install` now defaults to marker merge with `<!-- cmap:start -->` / `<!-- cmap:end -->`, preserving existing `AGENTS.md` / `CLAUDE.md` content outside the cmap block. `--mode print` previews without writing, `--force` is the explicit full-overwrite escape hatch, and `--backup` stores previous entrypoints under `.context/backups/install-*`.

`cmap skill export` writes an English project-local instruction pack under `.cmap/skills/cmap/` and supports `--check` for stale detection. `cmap bootstrap` now requires an existing `.context`, then delegates to non-destructive install, optional skill export, and `.context/out/start-here.md` generation.

`AGENTS.md` and `CLAUDE.md` were dogfooded through non-destructive install, so the original project rules are preserved and the new cmap marker block includes Git Safety Rules.

The project commit policy now allows proactive commits after coherent, verified work slices. Agents must still inspect `git status --short`, stage only task-related files, avoid unrelated user changes, and report the commit hash.

## Left Off
P0-PR2 i18n/locale removal remains intact: no `i18n`, `config`, or `--lang` command surface has been restored. Current implementation is ready for final verification and review as one onboarding hardening slice.

## Next Steps
1. Run final full verification after this status update.
2. Review and commit the P0 onboarding hardening slice if desired.
3. Continue P1 with relation explanation polish and Review HTML module understanding improvements.
4. Decide a separate cleanup/migration task for legacy `.context/pending` and `.context/stats`; do not delete them in this cleanup.

## Changed Files
- `.context/CHECKPOINT.md`, `.context/STATUS.md`, `.context/MAP.md`, `.context/VERIFY.md`, `.context/modules/cli.md`, `.context/modules/host.md`, `.context/modules/skill.md`.
- `AGENTS.md`, `CLAUDE.md`, `README.md`.
- `src/cli.ts`, `src/commands/install.ts`, `src/commands/skill.ts`, `src/commands/bootstrap.ts`, `src/host/entrypoint-template.ts`, `src/host/merge-entrypoint.ts`, `src/skill/templates.ts`.
- `tests/integration/m27-install-merge.test.ts`, `tests/integration/m28-skill-bootstrap.test.ts`.

## Risks
Legacy `.context/pending` and `.context/stats` still exist and intentionally produce warnings. `verify --stale` and `verify --freshness` may report older semantic review metadata; resolve by review, not generated evidence writes. `.cmap/skills/cmap/` is generated output for consuming projects and is not required to be committed in this repo.

## Last Verified
2026-05-15: targeted install/skill/bootstrap tests passed; `pnpm typecheck` passed; `pnpm dev --help` showed `skill` and `bootstrap`; command-surface negative check for `i18n|config|--lang` passed; `pnpm test` passed 29 files / 155 tests; `pnpm build` passed; `pnpm smoke` passed; `pnpm dev verify`, `pnpm dev verify --changed`, `pnpm dev verify --policy`, and `pnpm dev verify --ci --format markdown` passed with warning-only legacy/coverage findings; `pnpm dev verify --stale` and `pnpm dev verify --freshness` passed with warning-only stale/freshness findings; `pnpm dev skill export --out .context/out/skill-check` and `pnpm dev skill export --check --out .context/out/skill-check` passed; `pnpm dev view export --out _cmap-view` and `pnpm dev view export --check --out _cmap-view` passed; `pnpm dev obsidian export --out _cmap/CMAP_coding` refreshed the ignored view layer and `pnpm dev obsidian export --check` passed; route benchmark passed 100% Top-1/Top-3/context with 0 bad hits; `git diff --check` passed.
