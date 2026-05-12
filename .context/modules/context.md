---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T21:18:31+08:00
confidence: ai-drafted
module: context
paths:
  - src/context
aliases:
  - context
  - template
  - skeleton
  - .context
  - policy
  - 模板
  - 骨架
---
# Module: context

## Purpose
Create and describe `.context` files and deterministic maintenance policy without inventing trusted project meaning.

## Code Paths
- `src/context/templates.ts`
- `src/context/scanner.ts`
- `src/context/policy.ts`

## Responsibilities
- Provide Markdown templates with frontmatter.
- Include `CHECKPOINT.md` as the explicit current handoff template.
- Create default directory names.
- Include non-canonical `.context/inbox/` and `.context/out/` directories for candidate facts and generated task outputs.
- Include generated `.context/index/`, `.context/graph/`, and `.context/stats/` directories for deterministic machine-readable data.
- Create and load `.context/policy.yml` with safe auto-apply defaults.
- Infer deterministic verification commands from package scripts.
- Offer filesystem existence helpers shared by commands.

## Depends On
- Node filesystem/path APIs.

## Used By
- `init`
- `verify`
- `evidence`

## Data Flow
`init` builds `TemplateInput`, templates return relative file paths and content, command writes them under `.context`. Commands that need policy call `loadContextPolicy()`, which merges `.context/policy.yml` with safe defaults.

## State / Storage
Writes `.context/**` through `init`; reads `.context/policy.yml` through `loadContextPolicy()`.

## Constraints
- Templates may contain placeholders but must not assert guessed project facts.
- Scanner may use package scripts as deterministic signals only.
- Policy defaults may enable routine/generated writes, but semantic and decision updates must remain disabled by default.

## Traps
- A generated candidate is not a canonical fact. Keep adopt candidates out of formal `MAP.md` until AI/user confirmation.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`
- `pnpm test tests/integration/m13-policy-stats.test.ts`

## When to Update This Doc
When adding `.context` files/directories, changing template headings, or changing deterministic scan behavior.
