---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T18:02:00+08:00
confidence: ai-drafted
module: route
paths:
  - src/commands/route.ts
  - src/core/module-index.ts
aliases:
  - route
  - aliases
  - routing
  - 路由
  - 模块定位
relations:
  depends_on:
    - module-docs
  used_by:
    - brief
    - obsidian-adapter
---
# Module: route

## Purpose
Recommend which `.context` files an AI should read first for a natural-language task.

## Code Paths
- `src/commands/route.ts`
- `src/core/module-index.ts`

## Responsibilities
- Read `.context/modules/*.md` frontmatter.
- Use the shared module index so route, finish, brief, and Obsidian export agree on module ids/paths.
- Score alias, module-name, and path-keyword matches.
- Output a route card with likely modules, read-first files, and low-confidence notes.
- Avoid inventing modules when no high-confidence match exists.

## Depends On
- `gray-matter`
- `core/module-index.ts`

## Used By
- `cmap route "<task>"`
- `cmap brief "<task>"`
- Future `finish` and hooks as a hint source.

## Data Flow
Task text -> shared module index -> deterministic scoring -> text/JSON route report.

## State / Storage
Read-only.

## Constraints
- No embeddings, no model calls, no semantic guessing.
- ASCII aliases require word-like boundaries so `check` does not match `checkpoint`.
- Non-ASCII aliases can use substring matching for Chinese task phrases.

## Traps
- Short English aliases can create false positives inside longer words.
- Route output is a reading suggestion, not a code modification plan.

## Tests / Verification
- `pnpm test tests/integration/m2.test.ts`
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm dev route "checkpoint 更新当前主线"`

## When to Update This Doc
When scoring, output format, confidence rules, or alias parsing change.
