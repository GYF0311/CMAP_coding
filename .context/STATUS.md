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
Complete cmap core + Obsidian view + AI brief workflow plan

## Done Recently
Added shared module index, `cmap brief`, Obsidian export/open/pull dry-run, verify relation checks, verify changed-file coverage, route benchmark, and conservative GSD v1/v2 reconcile dry-run. Added integration and smoke coverage for the workflow.

## Left Off
Full verification passed. Local generated `.context/out/brief.md` and `_cmap/CMAP_coding/*` exist for inspection but are ignored because they are task/view outputs, not canonical facts. `research/` remains pre-existing untracked content and should not be committed unless explicitly requested.

## Next Steps
Commit the code and `.context` updates. Next product work should be real-world dogfooding: inspect `_cmap/CMAP_coding` in Obsidian, run `benchmark route` on more historical tasks, and test `reconcile` against real `.planning` / `.gsd` outputs.

## Changed Files
- src/core/module-index.ts
- src/commands/brief.ts
- src/commands/obsidian.ts
- src/commands/benchmark.ts
- src/commands/reconcile.ts
- src/commands/verify.ts
- src/commands/route.ts
- src/commands/finish.ts
- src/cli.ts
- src/context/templates.ts
- tests/integration/m6-brief-obsidian.test.ts
- scripts/smoke-test.mjs
- README.md
- .gitignore
- bench/tasks.jsonl
- .context/STATUS.md
- .context/MAP.md
- .context/VERIFY.md
- .context/modules/benchmark.md
- .context/modules/brief.md
- .context/modules/obsidian-adapter.md
- .context/modules/reconcile-adapter.md

## Risks
`brief` still uses `.context/STATUS.md` as the checkpoint source; a future `CHECKPOINT.md` schema should be added compatibly. `reconcile` is keyword-based and intentionally conservative; real GSD v2 `gsd.db` parsing remains out of scope for this version.

## Last Verified
2026-05-12: `pnpm test`, `pnpm typecheck`, `pnpm dev verify`, `pnpm dev verify --coverage --changed-files src/commands/verify.ts,src/commands/obsidian.ts,src/commands/benchmark.ts,src/commands/reconcile.ts,bench/tasks.jsonl`, `pnpm build`, and `pnpm smoke` passed. Dogfood commands `pnpm dev benchmark route --file bench/tasks.jsonl`, `pnpm dev obsidian export --out _cmap/CMAP_coding`, and `pnpm dev obsidian pull --from _cmap/CMAP_coding` also ran successfully.
