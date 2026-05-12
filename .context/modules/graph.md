---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T21:36:07+08:00
confidence: ai-drafted
module: graph
paths:
  - src/commands/graph.ts
  - src/core/context-graph.ts
aliases:
  - graph
  - context graph
  - graph build
  - graph explain
  - 关系图
  - 图谱
relations:
  depends_on:
    - route
    - context
---
# Module: graph

## Purpose
Build deterministic machine-readable graph projections from reviewed module docs and explain module files/typed relations without making Obsidian the typed graph source.

## Code Paths
- `src/commands/graph.ts`
- `src/core/context-graph.ts`

## Responsibilities
- Build `.context/graph/modules.json` from module frontmatter.
- Build `.context/graph/files.json` from module path ownership hints.
- Build `.context/graph/edges.json` from typed module relations.
- Build `.context/graph/graph.meta.json` with generation metadata.
- Explain one module's files, outgoing relations, and incoming relations.
- Keep graph data deterministic and derived from `.context/modules/*.md`.

## Depends On
- `core/module-index.ts` for reviewed module docs and relations.
- `fs/safe-path.ts` for project-relative output paths.

## Used By
- `cmap graph build`
- `cmap graph explain <module>`
- Future graph-aware route and context pack work.

## Data Flow
Module docs -> module index -> graph projection -> `.context/graph/*.json` and graph explain text.

## State / Storage
Writes deterministic generated JSON under `.context/graph/`.

## Constraints
- Graph files are generated data, not canonical semantic facts.
- Does not infer imports, symbols, or ownership beyond reviewed module docs in v0.
- Does not write module docs or MAP semantics.

## Traps
- A graph edge proves a documented relation exists; it does not prove runtime coupling.
- Obsidian `_cmap` remains a view layer; typed graph analysis belongs to cmap graph.

## Tests / Verification
- `pnpm test tests/integration/m14-graph-route.test.ts`
- `pnpm dev graph build`
- `pnpm dev graph explain route`

## When to Update This Doc
When graph file schema, graph explanation output, or graph-aware route behavior changes.
