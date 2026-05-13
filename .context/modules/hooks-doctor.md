---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-13T02:37:30+08:00
confidence: ai-drafted
module: hooks-doctor
paths:
  - src/commands/hooks.ts
  - src/commands/codex.ts
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
Provide optional hook templates, Codex-first lifecycle render/ingest utilities, lifecycle tests, reminders, observe logs, assist-mode session briefs/generated evidence, strict guard decisions, and diagnostics without writing trusted project semantics.

## Code Paths
- `src/hooks/templates.ts`
- `src/hooks/events.ts`
- `src/commands/hooks.ts`
- `src/commands/doctor.ts`
- `src/commands/install.ts`

## Responsibilities
- `install --hooks reminder|maintain|observe|assist|strict` writes project-local hook templates.
- `hooks render --host codex --mode observe|assist|strict` writes Codex lifecycle settings to `.codex/hooks.json` by default.
- `hooks render --host claude --mode observe|assist|strict` writes Claude lifecycle settings to a project-local file.
- `hooks ingest --host codex|claude|generic --event ... --mode ...` reads a real host hook JSON payload from stdin and normalizes it.
- `hooks test --event ... --mode ...` simulates hook events without needing a live host.
- `hooks session-start` prints start reminders.
- `hooks stop` prints reminder or maintain closeout prompts, including explicit `checkpoint write` guidance.
- `hooks stop --profile observe` writes a non-canonical `.context/logs/hooks.jsonl` event.
- `hooks stop --profile assist` maps changed files to modules and appends bounded generated evidence for mapped files.
- `hooks test --event PostToolUse` writes `.context/logs/session-events.jsonl`.
- `hooks test --event UserPromptSubmit --mode assist --prompt ...` writes `.context/out/session-brief.md` and generated route usage stats.
- `hooks ingest --host codex --event UserPromptSubmit --mode assist` writes `.context/out/session-brief.md`, updates generated route usage stats, and returns Codex `additionalContext`.
- `hooks ingest --host codex --event PreToolUse --mode strict` blocks direct semantic canonical context writes with Codex `permissionDecision: "deny"`.
- `hooks ingest --host codex --event PostToolUse|Stop` records real tool/session events without mutating canonical context.
- `codex start|finish|guard` provides the supported explicit Codex workflow while Codex hooks remain experimental/generic.
- `hooks test --event PreToolUse --mode strict` blocks direct writes to semantic canonical context files.
- `doctor` checks `.context`, entrypoint parity, and hook template presence.

## Depends On
- Host entrypoint install flow.
- `.context/hooks/` storage.
- `evidence` for generated support evidence.
- `route` for prompt-to-module startup briefs.
- `core/module-index.ts` for changed-file to module mapping.

## Used By
- `cmap install --host both --hooks reminder`
- `cmap install --host both --hooks assist`
- `cmap hooks render --host codex --mode assist`
- `cmap hooks ingest --host codex --event UserPromptSubmit --mode assist`
- `cmap hooks ingest --host codex --event PreToolUse --mode strict`
- `cmap codex start "<task>"`
- `cmap codex finish --task "..."`
- `cmap codex guard --changed`
- `cmap hooks render --host claude --mode assist`
- `cmap hooks test --event PostToolUse --mode observe`
- `cmap hooks test --event UserPromptSubmit --mode assist --prompt "..."`
- `cmap hooks session-start`
- `cmap hooks stop`
- `cmap hooks stop --profile assist --changed src/commands/route.ts`
- `cmap doctor`

## Data Flow
Install options -> hook JSON templates. Render options -> project-local lifecycle settings. Real host stdin JSON or simulated hook event -> normalized event -> stdout reminder/Codex JSON, non-canonical hook/session log, generated session brief, strict guard decision, or generated evidence append depending on mode/profile.

## State / Storage
- Writes `.context/hooks/*.json` only when install is called with hooks.
- Writes `.codex/hooks.json` by default when rendering Codex lifecycle settings.
- Writes rendered Claude lifecycle settings to the requested project-local output path.
- Writes `.context/logs/hooks.jsonl` for observe/assist stop events.
- Writes `.context/logs/session-events.jsonl` for simulated and real ingested lifecycle events.
- Writes `.context/out/session-brief.md` for assist prompt events.
- Writes `.context/generated/stats/route-usage.json` for assist prompt events when policy allows stats updates.
- Assist mode may append generated evidence under `.context/generated/evidence/modules/*.jsonl`.

## Constraints
- Hooks do not modify `MAP.md`, `CHECKPOINT.md`, `STATUS.md`, `DECISIONS.md`, module responsibilities, module relationships, or code files.
- Assist mode only writes generated evidence into the generated store.
- Assist startup briefs are generated task outputs, not canonical memory.
- No automatic host-global config edits.
- Strict guard currently protects direct semantic canonical writes; it should not block generated evidence or inbox review paths.

## Traps
- Hook templates are not active until a user/host installs or references them.
- Rendered lifecycle settings are project-local artifacts until a host references them and Codex hooks are enabled/trusted for the repo.
- Generated evidence is not canonical semantics.
- Assist mode can add local file diffs; run `cmap verify --stale` before claiming done.
- Strict mode should be rolled out after observe/assist data proves the workflow is low-noise.

## Tests / Verification
- `pnpm test tests/integration/m4m5.test.ts`
- `pnpm test tests/integration/m9-hooks-assist.test.ts`
- `pnpm test tests/integration/m17-hooks-ingest-codex.test.ts`

## When to Update This Doc
When hook profile behavior, template destinations, or doctor checks change.
