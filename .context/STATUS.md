---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-11T17:33:56.490Z'
confidence: ai-drafted
---
# Status

## Active Goal
Complete cmap core + Obsidian view + AI brief + explicit CHECKPOINT workflow

## Done Recently
Added CHECKPOINT.md template and verify requirement; added checkpoint read/write/close/clear actions while keeping legacy STATUS.md updates; changed brief to prefer CHECKPOINT.md; updated host/hook guidance, README, smoke, tests, and .context docs.

## Left Off
Full verification passed. Generated .context/out/* and _cmap/* remain ignored outputs. research/ remains pre-existing untracked content and was not committed.

## Next Steps
Commit this checkpoint workflow update and push origin/main. Next product dogfood should inspect Obsidian export in the vault and try checkpoint/brief on a fresh real coding task.

## Changed Files
- src/commands/checkpoint.ts
- src/commands/brief.ts
- src/context/templates.ts
- src/commands/verify.ts
- src/cli.ts
- src/host/entrypoint-template.ts
- src/commands/hooks.ts
- tests/integration/m1.test.ts
- tests/integration/m2.test.ts
- tests/integration/m6-brief-obsidian.test.ts
- scripts/smoke-test.mjs
- README.md
- AGENTS.md
- CLAUDE.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/MAP.md
- .context/BRIEF.md
- .context/VERIFY.md
- .context/modules/handoff.md
- .context/modules/brief.md
- .context/modules/context.md
- .context/modules/verify.md
- .context/modules/host.md
- .context/modules/hooks-doctor.md
- .context/modules/cli.md
- .context/modules/tests.md

## Risks
CHECKPOINT.md is working handoff state, not a replacement for durable STATUS.md or module facts. Unknown checkpoint actions now fail fast. GSD v2 database parsing remains out of scope.

## Last Verified
2026-05-12: pnpm test, pnpm typecheck, pnpm dev verify, pnpm dev verify --coverage --changed-files src/commands/checkpoint.ts,src/commands/brief.ts,src/context/templates.ts,src/commands/verify.ts,src/cli.ts,src/host/entrypoint-template.ts,src/commands/hooks.ts, pnpm build, and pnpm smoke passed.
