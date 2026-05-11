---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T01:10:00+08:00
confidence: ai-drafted
module: obsidian-adapter
paths:
  - src/commands/obsidian.ts
aliases:
  - obsidian
  - Obsidian
  - graph
  - 图谱
  - 关系图谱
  - 可视化
  - export
relations:
  depends_on:
    - module-docs
    - route
    - context
  used_by:
    - brief
---
# Module: obsidian-adapter

## Purpose
Export `.context` into Obsidian-friendly Markdown notes so humans can read module docs and inspect module links in Obsidian Graph.

## Code Paths
- `src/commands/obsidian.ts`
- `src/core/module-index.ts`

## Responsibilities
- Generate `_cmap/<project>/00_INDEX.md`.
- Generate `_cmap/<project>/modules/*.md` from `.context/modules/*.md`.
- Preserve `.context` as the canonical fact source.
- Render module frontmatter as Obsidian Properties.
- Render typed `relations` as body wikilinks so Obsidian Graph can draw edges.
- Print `obsidian://open` links for individual module notes.

## Depends On
- `module-docs`
- `route`
- `context`

## Used By
- `cmap obsidian export`
- `cmap obsidian open <module>`
- `cmap brief --obsidian`

## Data Flow
`.context/modules/*.md` -> module index -> Obsidian note renderer -> `_cmap/<project>/`.

## State / Storage
Writes view files under `_cmap/<project>/`. These files are generated reading/visualization artifacts, not canonical facts.

## Constraints
- Do not treat Obsidian `_cmap` notes as the source of truth.
- Do not auto-pull Obsidian edits into `.context`.
- Do not require an Obsidian plugin for Level 0 export.

## Traps
- YAML-only links may not create obvious graph relationships; body wikilinks are the stable Graph input.
- Generated `_cmap` files can be overwritten by export, so manual edits belong in `.context` or a future dry-run inbox.

## Tests / Verification
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm dev obsidian export --out _cmap/CMAP_coding`

## When to Update This Doc
When export structure, note naming, relation rendering, or open-link behavior changes.
