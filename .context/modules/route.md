---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T18:28:00+08:00
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
Recommend which `.context` files an AI should read first for a natural-language task, including direct module matches, graph-related context, and module-owned verification commands.

## Code Paths
- `src/commands/route.ts`
- `src/core/module-index.ts`

## Responsibilities
- Read `.context/modules/*.md` frontmatter.
- Use the shared module index so route, finish, brief, and Obsidian export agree on module ids/paths.
- Score alias, module-name, and path-keyword matches.
- Keep direct high-confidence matches separate from graph-related context modules.
- Expand a bounded context pack from typed module relations such as `depends_on` and `used_by`.
- Extract suggested verification commands from each selected module's `## Tests / Verification` section.
- Output a route card with likely modules, related context, read-first files, suggested verify commands, and low-confidence notes.
- Avoid inventing modules when no high-confidence match exists.

## Depends On
- `gray-matter`
- `core/module-index.ts`

## Used By
- `cmap route "<task>"`
- `cmap brief "<task>"`
- Future `finish` and hooks as a hint source.

## Data Flow
Task text -> shared module index -> deterministic direct scoring -> relation expansion -> verification command extraction -> text/JSON route report.

## State / Storage
Read-only.

## Constraints
- No embeddings, no model calls, no semantic guessing.
- ASCII aliases require word-like boundaries so `check` does not match `checkpoint`.
- Non-ASCII aliases can use substring matching for Chinese task phrases.
- Related context is a reading suggestion only; it must not be treated as a direct route match or edit target.

## Traps
- Short English aliases can create false positives inside longer words.
- Route output is a reading suggestion, not a code modification plan.
- Verification commands are parsed from module docs and can become stale; keep `.context/modules/*` updated when tests move.

## Tests / Verification
- `pnpm test tests/integration/m2.test.ts`
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm test tests/integration/m10-route-context-pack.test.ts`
- `pnpm dev route "checkpoint 更新当前主线"`

## When to Update This Doc
When scoring, output format, confidence rules, or alias parsing change.

<!-- cmap:generated:evidence:start -->
## Generated Evidence

This section is generated support evidence. It is not a semantic source of truth.

- 2026-05-12T10:28:41.925Z: Implemented route context pack with graph-related modules and module-owned verification commands. Evidence: `src/commands/route.ts`; command: `pnpm test tests/integration/m10-route-context-pack.test.ts`
<!-- cmap:generated:evidence:end -->
