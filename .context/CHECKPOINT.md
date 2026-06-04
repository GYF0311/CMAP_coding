---
context_type: checkpoint
status: active
updated_at: '2026-06-04T09:56:02Z'
source: manual
---
# Current Checkpoint

## Current Task
CMAP Source Intelligence Upgrade implementation closeout

## Current Hypothesis
Source intelligence is now implemented as a generated evidence layer below CMAP's Trust Boundary. CLI source graph results remain candidate/generated evidence; reviewed `.context` memory is still the canonical layer.

## Changed Files
- Source intelligence core under `src/source-intelligence/**`
- CLI commands in `src/commands/source.ts`, `src/commands/symbol.ts`, `src/commands/impact.ts`, and `src/commands/benchmark.ts`
- Brief/View integration in `src/commands/brief.ts` and `src/view/**`
- Tests under `tests/integration/source-intelligence*.test.ts`
- Planning, research, review, and execution ledger under `docs/planning/source-intelligence-upgrade-2026-06/**`
- Source intelligence context module and related MAP/module updates

## Verified
- `git diff --check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm dev verify --changed`
- `pnpm dev source index --json >/tmp/cmap-source-index.json && pnpm dev benchmark source-intelligence --file bench/source-intelligence.jsonl --min-f1 80`
- `cmap finish`

## Failed / Pending
- `pnpm dev verify --changed` exits 0 with warnings for generated/planning/support files that are not mapped as canonical modules.
- `.context/generated/source-index/` is local generated evidence and intentionally ignored; regenerate with `pnpm dev source index`.

## Next Step
Commit and push the Source Intelligence Upgrade implementation. After that, dogfood the CLI on a second repository before considering MCP wrapper work.

## Do Not Redo
The competitor source research is already consolidated under `docs/planning/source-intelligence-upgrade-2026-06/research/`, with raw subagent notes under `agent-notes/`. Review Agent findings and fixes are recorded in `dev-notes/p2-final-review-agent.md`; do not restart from scratch if follow-up issues appear.
