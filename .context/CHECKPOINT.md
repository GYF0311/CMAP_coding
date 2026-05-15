---
context_type: checkpoint
status: active
updated_at: '2026-05-15T13:04:36+08:00'
source: manual
---
# Current Checkpoint

## Current Task
Implement CMAP v0.2.1 Entry Safety + Skill Bootstrap + Review HTML Focus P0 onboarding hardening.

## Current Hypothesis
Current mainline should stay on Trust Boundary + Human Review Layer while making onboarding safe for real projects. `cmap install` must preserve existing `AGENTS.md` / `CLAUDE.md` content by default, `skill export` and `bootstrap` should help IDE/AI tools discover cmap without becoming canonical fact stores, and Review HTML stays English-only. Do not revive i18n / zh-CN / locale / translation mirrors, import graph, route v2, or pack v2 as the current roadmap unless a future explicit plan supersedes this checkpoint.

## Changed Files
- .context/CHECKPOINT.md
- .context/MAP.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/cli.md
- .context/modules/host.md
- .context/modules/skill.md
- AGENTS.md
- CLAUDE.md
- README.md
- src/cli.ts
- src/commands/bootstrap.ts
- src/commands/install.ts
- src/commands/skill.ts
- src/host/entrypoint-template.ts
- src/host/merge-entrypoint.ts
- src/skill/templates.ts
- tests/integration/m27-install-merge.test.ts
- tests/integration/m28-skill-bootstrap.test.ts

## Verified
pnpm test tests/integration/m27-install-merge.test.ts tests/integration/m28-skill-bootstrap.test.ts; pnpm typecheck; pnpm dev --help; pnpm dev install --host both --mode print; pnpm dev --help | rg "i18n|config|--lang" && exit 1 || true; pnpm test; pnpm build; pnpm smoke; pnpm dev verify; pnpm dev verify --changed; pnpm dev verify --policy; pnpm dev verify --ci --format markdown; pnpm dev verify --stale; pnpm dev verify --freshness; pnpm dev skill export --out .context/out/skill-check; pnpm dev skill export --check --out .context/out/skill-check; pnpm dev view export --out _cmap-view; pnpm dev view export --check --out _cmap-view; pnpm dev obsidian export --out _cmap/CMAP_coding; pnpm dev obsidian export --check; pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0; git diff --check.

## Failed / Pending
Warning-only findings remain: legacy `.context/pending` and `.context/stats`; `verify --changed` warns that project entrypoint/docs are not mapped to module paths; `verify --stale` / `verify --freshness` report older semantic review metadata from prior work. These are not blockers for this P0 slice.

## Next Step
Commit the coherent P0 onboarding hardening slice. P1 can then continue with relation explanation polish and Review HTML module understanding improvements.

## Do Not Redo
Do not reintroduce `i18n export/check`, `config locale`, `init --lang`, `view --lang`, `.context/i18n/<locale>/`, zh-CN UI dictionaries, CLI import graph, route v2 scoring, or pack v2 priority work as the current roadmap unless a future research proposal explicitly supersedes this checkpoint. Do not make install overwrite `AGENTS.md` / `CLAUDE.md` by default. Do not re-add the old project rule that commits require an explicit user request; proactive commits are allowed after coherent, verified slices.
