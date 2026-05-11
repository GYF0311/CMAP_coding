---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T01:35:00+08:00
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
relations:
  dispatches_to:
    - route
    - brief
    - benchmark
    - obsidian-adapter
    - reconcile-adapter
    - finish
    - verify
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
- Register `checkpoint` actions while keeping the legacy option-only STATUS update path compatible.
- Register `benchmark route` as a public evaluation command.
- Register `reconcile` as a dry-run external artifact adapter command.
- Convert expected CLI errors into exit code 2.
- Preserve command-specific exit codes such as `verify` returning 1 on structural errors.

## Depends On
- `context` for init templates and deterministic scanning.
- `verify` for structure checks.
- `host` for entrypoint generation.
- `brief` for AI coding startup packages.
- `handoff` for status and checkpoint command behavior.
- `benchmark` for route fixture evaluation.
- `obsidian-adapter` for Obsidian view commands.
- `reconcile-adapter` for external workflow candidate reports.

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
- `pnpm dev version`

## When to Update This Doc
When adding/removing public commands, changing exit code behavior, or changing command output contracts.
