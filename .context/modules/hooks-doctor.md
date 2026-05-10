---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T18:15:00+08:00
confidence: ai-drafted
module: hooks-doctor
paths:
  - src/commands/hooks.ts
  - src/hooks
  - src/commands/doctor.ts
  - src/commands/install.ts
aliases:
  - hooks
  - doctor
  - reminder
  - maintain
  - 诊断
---
# Module: hooks-doctor

## Purpose
Provide optional hook templates and diagnostics without writing trusted project memory.

## Code Paths
- `src/hooks/templates.ts`
- `src/commands/hooks.ts`
- `src/commands/doctor.ts`
- `src/commands/install.ts`

## Responsibilities
- `install --hooks reminder|maintain` writes project-local hook templates.
- `hooks session-start` prints start reminders.
- `hooks stop` prints reminder or maintain closeout prompts.
- `doctor` checks `.context`, entrypoint parity, and hook template presence.

## Depends On
- Host entrypoint install flow.
- `.context/hooks/` storage.

## Used By
- `cmap install --host both --hooks reminder`
- `cmap hooks session-start`
- `cmap hooks stop`
- `cmap doctor`

## Data Flow
Install options -> hook JSON templates. Hook invocation -> stdout reminder only.

## State / Storage
Writes `.context/hooks/*.json` only when install is called with hooks.

## Constraints
- Hooks do not modify MAP, STATUS, DECISIONS, modules, logs, or ideas.
- No automatic host-global config edits in v0.1.

## Traps
- Hook templates are not active until a user/host installs or references them.

## Tests / Verification
- `pnpm test tests/integration/m4m5.test.ts`

## When to Update This Doc
When hook profile behavior, template destinations, or doctor checks change.
