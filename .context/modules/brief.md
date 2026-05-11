---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T01:10:00+08:00
confidence: ai-drafted
module: brief
paths:
  - src/commands/brief.ts
aliases:
  - brief
  - AI brief
  - coding brief
  - 开工包
  - AI 开工包
relations:
  depends_on:
    - route
    - handoff
    - module-docs
    - verify
---
# Module: brief

## Purpose
Render an AI coding brief from route results, current status, selected module docs, and verification reminders.

## Code Paths
- `src/commands/brief.ts`
- `src/commands/route.ts`
- `src/core/module-index.ts`

## Responsibilities
- Run the same deterministic routing used by `cmap route`.
- Read `.context/STATUS.md` as the current handoff/checkpoint source.
- Include the top routed module docs in a single AI-readable brief.
- Optionally include `obsidian://` links for routed modules.
- Write to `.context/out/brief.md` or another explicit project-relative output path.

## Depends On
- `route`
- `handoff`
- `module-docs`
- `verify`

## Used By
- `cmap brief "<task>"`
- AI coding session startup prompts.

## Data Flow
Task text -> route result -> status excerpt -> module docs -> Markdown brief -> stdout or `.context/out/*`.

## State / Storage
Writes only explicit output files, usually under `.context/out/`. It does not modify canonical facts.

## Constraints
- A brief is a task-local artifact, not a project fact source.
- Route output is a reading plan, not an implementation plan.
- Do not let `brief` summarize hidden transcript state or invent module responsibilities.

## Traps
- If module aliases are weak, `brief` will package the wrong docs; fix aliases or module docs instead of adding semantic guessing.
- Obsidian links are only useful after `cmap obsidian export` has generated matching note paths.

## Tests / Verification
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm dev brief "路由结果没有推荐模块" --out .context/out/brief.md`

## When to Update This Doc
When brief inputs, output sections, Obsidian link behavior, or status/checkpoint source changes.
