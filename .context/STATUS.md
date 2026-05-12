---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T18:18:00+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land the v0.2 hook assist slice so lifecycle hooks can record routine evidence without becoming a semantic-writing agent.

## Done Recently
Collected the ChatGPT Pro cmap product-completion research report locally. Added `cmap evidence append`, `cmap inbox status`, and `cmap verify --stale`; then connected optional hook profiles to that evidence layer with `observe` and `assist`.

## Left Off
M9 focused tests pass. `observe` writes `.context/logs/hooks.jsonl`; `assist` maps changed files to known modules and appends marked generated evidence only.

## Next Steps
Commit and push this slice. Next implementation slice should expand route scoring with graph/test ownership signals and selected context packing.

## Changed Files
- README.md
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/cli.md
- .context/modules/evidence.md
- .context/modules/hooks-doctor.md
- .context/modules/host.md
- .context/modules/tests.md
- src/cli.ts
- src/commands/doctor.ts
- src/commands/evidence.ts
- src/commands/hooks.ts
- src/commands/install.ts
- src/hooks/templates.ts
- docs/superpowers/plans/2026-05-12-cmap-v0-2-hooks-assist.md
- tests/integration/m9-hooks-assist.test.ts

## Risks
Assist hooks can become noisy if hosts call them too often or with broad changed-file lists. Keep generated evidence bounded, keep logs non-canonical, and do not promote evidence into module responsibilities without review.

## Last Verified
2026-05-12: focused M9 tests, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, and `git diff --check` passed. `verify --stale` reports one non-blocking pre-existing adoption-doc stale warning.
