---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-07-19T17:35:00+08:00
confidence: ai-drafted
module: finish
paths:
  - src/commands/finish.ts
  - src/core/module-index.ts
aliases:
  - finish
  - closeout
  - report
  - 收尾
  - 上下文收尾
  - 任务结束
  - 任务结束前
  - 更新 context
  - context 文件
relations:
  depends_on:
    - module-docs
    - verify
    - handoff
    - update-agent
---
# Module: finish

## Purpose
Produce a QA-lite closeout report focused on project memory and verification reminders.

## Code Paths
- `src/commands/finish.ts`
- `src/core/module-index.ts`

## Responsibilities
- Collect changed files from `--changed` or `git status --short`.
- Match changed files to module docs through the shared module index.
- Keep the full human-readable report available by default, while `--compact` bounds module/path lists and truncates long items for AI-facing stdout.
- Remind whether STATUS/CHECKPOINT/modules/DECISIONS/traps/logs may need updates.
- Suggest `checkpoint write` when work continues and `checkpoint close` when the task is complete.
- With `--agent`, write a MapPatch request artifact under `.context/out/` for an AI to fill and pass to `cmap update --agent`.
- Suggest `cmap verify --changed`.
- When canonical `.context` files changed, remind the user to refresh generated graph, Review HTML, and Obsidian views.
- Report unmapped changed files so map coverage gaps are visible.

## Depends On
- `gray-matter`
- module docs in `.context/modules/*.md`
- `core/module-index.ts`
- git when no `--changed` list is provided

## Used By
- `cmap finish`
- `cmap finish --compact --max-files 8`

## Data Flow
Changed files -> shared module path matching -> full Markdown report or bounded compact summary. With `--agent`, the complete evidence remains in a local MapPatch request artifact even when stdout is compact.
Canonical context file paths additionally trigger a generated-view refresh reminder; `finish` only prints commands and does not execute them.

## State / Storage
- Default mode is read-only.
- `--agent` writes `.context/out/update-request-*.md`; it does not apply canonical updates.

## Constraints
- Does not do code review, security review, release, or CI.
- Does not write trusted memory automatically; write policy belongs to `update-agent`.

## Traps
- Matching by path is deterministic but not semantic truth.
- `finish` should remind about checkpoint lifecycle without closing or clearing it automatically.
- `finish --agent` should not become an implicit memory writer; it only prepares input for the MapPatch gate.
- Compact output must remain bounded independently of repository dirty-file count; explicit full output remains available through `cmap finish`.
- Generated graph/view/Obsidian refresh remains a reminder, not an automatic side effect.

## Tests / Verification
- `pnpm test tests/integration/m3.test.ts`
- `pnpm test tests/integration/m17-hooks-ingest-codex.test.ts`
- `pnpm test tests/integration/m29-finish-view-reminder.test.ts`
- `pnpm test tests/integration/m7-update-agent.test.ts`
- `pnpm dev finish --changed src/commands/finish.ts`
- `pnpm dev finish --changed .context/modules/route.md`

## When to Update This Doc
When finish changes the MapPatch request format, starts generating other artifacts, or changes closeout checks.
