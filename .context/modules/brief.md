---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T18:48:00+08:00
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
Render an AI coding brief from route results, route context pack, current checkpoint/status, selected module docs, and verification reminders.

## Code Paths
- `src/commands/brief.ts`
- `src/commands/route.ts`
- `src/core/module-index.ts`

## Responsibilities
- Run the same deterministic routing used by `cmap route`.
- Read `.context/CHECKPOINT.md` as the preferred current handoff source, falling back to `.context/STATUS.md`.
- Include direct routed module docs and graph-related context module docs in a single AI-readable brief.
- Include suggested verification commands extracted from selected module docs.
- Respect `--max-context` by using the already-bounded route context pack.
- Optionally include `obsidian://` links for selected context modules.
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
Task text -> route result and context pack -> checkpoint/status excerpt -> selected module docs -> Markdown brief -> stdout or `.context/out/*`.

## State / Storage
Writes only explicit output files, usually under `.context/out/`. It does not modify canonical facts.

## Constraints
- A brief is a task-local artifact, not a project fact source.
- Route output is a reading plan, not an implementation plan.
- Do not let `brief` summarize hidden transcript state or invent module responsibilities.
- Related context modules in a brief are for inspection; they are not automatically edit targets.
- Smaller `--max-context` values intentionally omit related module docs and their derived verification commands.
- Source-level facts may be consulted externally through CodeGraph during a task, but `brief` itself should remain a reviewed context package, not a generated source report.

## Traps
- If module aliases are weak, `brief` will package the wrong docs; fix aliases or module docs instead of adding semantic guessing.
- Obsidian links are only useful after `cmap obsidian export` has generated matching note paths.

## Tests / Verification
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm test tests/integration/m10-route-context-pack.test.ts`
- `pnpm test tests/integration/m11-context-size-controls.test.ts`
- `pnpm dev brief "路由结果没有推荐模块" --out .context/out/brief.md`

## When to Update This Doc
When brief inputs, output sections, Obsidian link behavior, or status/checkpoint source changes.
