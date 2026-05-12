---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T22:14:18+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land all ChatGPT Pro deep-research recommendations as safe, testable cmap product slices.

## Done Recently
Collected the ChatGPT Pro cmap product-completion research report locally. Added evidence/stale/inbox maintenance, observe/assist hooks, route context packing, `--max-context`, context-aware route benchmark metrics, inbox governance, policy-backed generated stats foundations, Claude hook lifecycle render/test, graph v0 projections, CI Markdown verify output, benchmark threshold flags, a GitHub Actions cmap workflow, `cmap pack`, assist prompt session briefs, and route usage stats.

## Left Off
Hook assist/session stats slice is implemented and verified locally. Assist `UserPromptSubmit` writes `.context/out/session-brief.md`, and both route commands plus assist prompt hooks update generated `.context/stats/route-usage.json` when policy allows.

## Next Steps
Commit and push the hook assist/session stats slice. Next slice should add view-layer drift checks.

## Changed Files
- README.md
- .github/workflows/cmap.yml
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/benchmark.md
- .context/modules/cli.md
- .context/modules/evidence.md
- .context/modules/hooks-doctor.md
- .context/modules/pack.md
- .context/modules/route.md
- .context/modules/tests.md
- .context/modules/verify.md
- docs/superpowers/plans/2026-05-12-cmap-pro-deep-research-completion.md
- src/cli.ts
- src/commands/hooks.ts
- src/commands/pack.ts
- src/commands/route.ts
- src/core/generated-stats.ts
- tests/integration/m9-hooks-assist.test.ts
- tests/integration/m13-policy-stats.test.ts
- tests/integration/m16-context-pack.test.ts

## Risks
Route usage stats are generated counters, not semantic ownership. Assist session briefs are generated task output, not canonical memory.

## Last Verified
2026-05-12: `pnpm test tests/integration/m9-hooks-assist.test.ts tests/integration/m13-policy-stats.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --ci --format markdown`, `pnpm dev verify --stale`, `pnpm smoke`, `pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0`, and `git diff --check` passed.
