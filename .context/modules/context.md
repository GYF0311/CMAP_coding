---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T17:55:00+08:00
confidence: ai-drafted
module: context
paths:
  - src/context
aliases:
  - context
  - template
  - skeleton
  - .context
  - 模板
  - 骨架
---
# Module: context

## Purpose
Create and describe `.context` files without inventing trusted project meaning.

## Code Paths
- `src/context/templates.ts`
- `src/context/scanner.ts`

## Responsibilities
- Provide Markdown templates with frontmatter.
- Create default directory names.
- Infer deterministic verification commands from package scripts.
- Offer filesystem existence helpers shared by commands.

## Depends On
- Node filesystem/path APIs.

## Used By
- `init`
- `verify`

## Data Flow
`init` builds `TemplateInput`, templates return relative file paths and content, command writes them under `.context`.

## State / Storage
Writes `.context/**` through `init`.

## Constraints
- Templates may contain placeholders but must not assert guessed project facts.
- Scanner may use package scripts as deterministic signals only.

## Traps
- A generated candidate is not a canonical fact. Keep adopt candidates out of formal `MAP.md` until AI/user confirmation.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`

## When to Update This Doc
When adding `.context` files, changing template headings, or changing deterministic scan behavior.
