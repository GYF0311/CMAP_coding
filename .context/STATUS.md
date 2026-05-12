---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T21:22:18+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land all ChatGPT Pro deep-research recommendations as safe, testable cmap product slices.

## Done Recently
Collected the ChatGPT Pro cmap product-completion research report locally. Added evidence/stale/inbox maintenance, observe/assist hooks, route context packing, `--max-context`, context-aware route benchmark metrics, inbox governance, and policy-backed generated stats foundations.

## Left Off
Policy/stats slice is implemented and verified. `init` now creates `.context/policy.yml`; `evidence append` records `.context/stats/module-activity.json`; `verify --stale` respects policy inbox thresholds.

## Next Steps
Commit and push the policy/stats slice. Next slice should add hook lifecycle render/test.

## Changed Files
- README.md
- .context/policy.yml
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/context.md
- .context/modules/evidence.md
- .context/modules/tests.md
- .context/modules/verify.md
- src/commands/evidence.ts
- src/commands/verify.ts
- src/context/policy.ts
- src/context/templates.ts
- src/core/generated-stats.ts
- tests/integration/m13-policy-stats.test.ts

## Risks
Policy must not be mistaken for semantic permission. It can enable routine/generated maintenance, but semantic and decision auto-writes remain disabled.

## Last Verified
2026-05-12: `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts`, `pnpm test tests/integration/m13-policy-stats.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, `pnpm dev benchmark route --file bench/tasks.jsonl`, and `git diff --check` passed. `verify --stale` reports 0 warnings.
