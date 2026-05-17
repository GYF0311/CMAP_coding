---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-17T22:06:00+08:00
confidence: ai-drafted
module: cli
paths:
  - src/cli.ts
  - src/commands
aliases:
  - cli
  - command
  - 命令
  - version
  - init
  - install
  - bootstrap
  - skill
relations:
  dispatches_to:
    - route
    - graph
    - brief
    - pack
    - benchmark
    - obsidian-adapter
    - reconcile-adapter
    - finish
    - update-agent
    - evidence
    - view
    - relation-candidates
    - hooks-doctor
    - verify
    - skill
---
# Module: cli

## Purpose
Own the public `cmap` command surface: command registration, option parsing, command handler dispatch, stdout/stderr behavior, and process exit codes.

## Code Paths
- `src/cli.ts`
- `src/commands/*.ts`

## Responsibilities
- Register user-facing commands with commander.
- Keep command handlers small and delegate domain work to modules.
- Register `brief` and `obsidian` command groups without embedding domain logic in `cli.ts`.
- Register `pack` without embedding context selection or budget logic in `cli.ts`.
- Register `obsidian export --check` while keeping view drift comparison in `obsidian-adapter`.
- Register route/brief `--max-context` options while keeping context-pack policy in `route`.
- Register `route --graph` and `graph build/explain` while keeping graph projection logic outside `cli.ts`.
- Register `route --write-alias-candidate` while keeping candidate-only request writing in `route`.
- Register `verify --ci --format markdown` while keeping report formatting in `verify`.
- Register `checkpoint` actions while keeping the legacy option-only STATUS update path compatible.
- Register `benchmark route` as a public evaluation command.
- Register `benchmark route` quality threshold flags while keeping metric evaluation in `benchmark`.
- Register `reconcile` as a dry-run external artifact adapter command.
- Register `update --agent` and `update rollback` while keeping MapPatch v2 policy out of `cli.ts`.
- Register `policy show/validate` while keeping deterministic policy loading and validation in command modules.
- Register `evidence append/list/migrate` and `freshness snapshot/diff/mark-reviewed/review` while keeping generated-store and freshness policy in command modules.
- Register `inbox status/triage/promote/reject/archive` while keeping candidate governance, explicit rejection, and low-risk apply policy in command modules.
- Register `view export/open` while keeping HTML collection/render/check behavior in `view`.
- Register `view export --ui-lang en|zh-CN` and `--include-support` while keeping localization presentation-only.
- Register `relate request/ingest/promote` while keeping RelationPatch validation and candidate-only behavior in `relation-candidates`.
- Register `codex start/finish/guard/handoff` as explicit Codex workflow commands without relying on strict hook parity.
- Register `skill export` and `bootstrap --init` as host-neutral IDE onboarding commands without embedding skill template rendering in `cli.ts`.
- Register `verify --policy` and `doctor --release` without embedding policy or package checks in `cli.ts`.
- Register hook observe/assist/strict profile options plus `hooks render`, `hooks ingest`, and `hooks test` while keeping hook behavior in `hooks-doctor`.
- Register `verify --stale` and `verify --freshness` as deterministic warning modes.
- Convert expected CLI errors into exit code 2.
- Preserve command-specific exit codes such as `verify` returning 1 on structural errors.

## Depends On
- `context` for init templates and deterministic scanning.
- `verify` for structure checks.
- `host` for entrypoint generation.
- `brief` for AI coding startup packages.
- `pack` for budgeted task context packages.
- `handoff` for status and checkpoint command behavior.
- `benchmark` for route fixture evaluation.
- `obsidian-adapter` for Obsidian view commands.
- `reconcile-adapter` for external workflow candidate reports.
- `update-agent` for MapPatch intake and routine context maintenance.
- `evidence` for generated evidence and inbox visibility commands.
- `view` for the HTML project-map review dashboard.
- `relation-candidates` for AI relation candidate workflow commands.
- `hooks-doctor` for hook lifecycle command behavior.
- `skill` for portable skill pack export and bootstrap onboarding.

## Used By
- Package bin `cmap`.
- Integration tests spawning the CLI in temporary projects.

## Data Flow
Args enter through commander, handler receives cwd/options, command writes files or reports, `cli.ts` sets exit code.

## State / Storage
No persistent state except files written by command modules.

## Constraints
- Do not put project semantics in command parsing.
- Keep stdout stable enough for integration tests.

## Traps
- Tests run CLI from temp cwd; loader paths must come from this repo, but cwd behavior must stay temp-project local.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`
- `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts`
- `pnpm test tests/integration/m9-hooks-assist.test.ts`
- `pnpm test tests/integration/m17-hooks-ingest-codex.test.ts`
- `pnpm test tests/integration/m18-freshness-inbox-promote.test.ts`
- `pnpm test tests/integration/m19-view-export.test.ts`
- `pnpm test tests/integration/m20-relation-candidates.test.ts`
- `pnpm test tests/integration/m21-candidate-store.test.ts`
- `pnpm test tests/integration/m27-install-merge.test.ts`
- `pnpm test tests/integration/m28-skill-bootstrap.test.ts`
- `pnpm test tests/integration/m22-freshness-policy.test.ts`
- `pnpm test tests/integration/m23-release-hygiene.test.ts`
- `pnpm test tests/integration/m11-context-size-controls.test.ts`
- `pnpm test tests/integration/m15-ci-benchmark.test.ts`
- `pnpm test tests/integration/m16-context-pack.test.ts`
- `pnpm dev version`

## When to Update This Doc
When adding/removing public commands, changing exit code behavior, or changing command output contracts.
