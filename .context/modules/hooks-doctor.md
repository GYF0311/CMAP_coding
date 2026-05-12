---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T21:27:45+08:00
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
  - observe
  - assist
  - strict
  - lifecycle
  - 诊断
relations:
  depends_on:
    - evidence
---
# Module: hooks-doctor

## Purpose
Provide optional hook templates, lifecycle render/test utilities, reminders, observe logs, assist-mode generated evidence, strict guard simulation, and diagnostics without writing trusted project semantics.

## Code Paths
- `src/hooks/templates.ts`
- `src/commands/hooks.ts`
- `src/commands/doctor.ts`
- `src/commands/install.ts`

## Responsibilities
- `install --hooks reminder|maintain|observe|assist|strict` writes project-local hook templates.
- `hooks render --host claude --mode observe|assist|strict` writes Claude lifecycle settings to a project-local file.
- `hooks test --event ... --mode ...` simulates hook events without needing a live host.
- `hooks session-start` prints start reminders.
- `hooks stop` prints reminder or maintain closeout prompts, including explicit `checkpoint write` guidance.
- `hooks stop --profile observe` writes a non-canonical `.context/logs/hooks.jsonl` event.
- `hooks stop --profile assist` maps changed files to modules and appends bounded generated evidence for mapped files.
- `hooks test --event PostToolUse` writes `.context/logs/session-events.jsonl`.
- `hooks test --event PreToolUse --mode strict` blocks direct writes to semantic canonical context files.
- `doctor` checks `.context`, entrypoint parity, and hook template presence.

## Depends On
- Host entrypoint install flow.
- `.context/hooks/` storage.
- `evidence` for generated support evidence.
- `core/module-index.ts` for changed-file to module mapping.

## Used By
- `cmap install --host both --hooks reminder`
- `cmap install --host both --hooks assist`
- `cmap hooks render --host claude --mode assist`
- `cmap hooks test --event PostToolUse --mode observe`
- `cmap hooks session-start`
- `cmap hooks stop`
- `cmap hooks stop --profile assist --changed src/commands/route.ts`
- `cmap doctor`

## Data Flow
Install options -> hook JSON templates. Render options -> project-local lifecycle settings. Hook invocation or test event -> stdout reminder, non-canonical hook/session log, strict guard decision, or generated evidence append depending on mode/profile.

## State / Storage
- Writes `.context/hooks/*.json` only when install is called with hooks.
- Writes rendered Claude lifecycle settings to the requested project-local output path.
- Writes `.context/logs/hooks.jsonl` for observe/assist stop events.
- Writes `.context/logs/session-events.jsonl` for simulated lifecycle events.
- Assist mode may write generated evidence blocks inside `.context/modules/*.md`.

## Constraints
- Hooks do not modify `MAP.md`, `CHECKPOINT.md`, `STATUS.md`, `DECISIONS.md`, module responsibilities, module relationships, or code files.
- Assist mode only writes marked generated evidence blocks.
- No automatic host-global config edits.
- Strict guard currently protects direct semantic canonical writes; it should not block generated evidence or inbox review paths.

## Traps
- Hook templates are not active until a user/host installs or references them.
- Rendered lifecycle settings are project-local artifacts until a host references them.
- Generated evidence is not canonical semantics.
- Assist mode can add local file diffs; run `cmap verify --stale` before claiming done.
- Strict mode should be rolled out after observe/assist data proves the workflow is low-noise.

## Tests / Verification
- `pnpm test tests/integration/m4m5.test.ts`
- `pnpm test tests/integration/m9-hooks-assist.test.ts`

## When to Update This Doc
When hook profile behavior, template destinations, or doctor checks change.

<!-- cmap:generated:evidence:start -->
## Generated Evidence

This section is generated support evidence. It is not a semantic source of truth.

- 2026-05-12T10:04:21.164Z: Implemented observe and assist hook profiles for generated evidence collection. Evidence: `src/commands/hooks.ts`; command: `pnpm test tests/integration/m9-hooks-assist.test.ts`
<!-- cmap:generated:evidence:end -->
