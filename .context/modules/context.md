---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-17T22:06:00+08:00
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
- Keep generated canonical `.context` templates on stable English section headings while allowing body text to use the project's human language.
- Include `CHECKPOINT.md` as the explicit current handoff template.
- Create default directory names.
- Include non-canonical `.context/inbox/` and `.context/out/` directories for candidate facts and generated task outputs.
- Include generated `.context/index/`, `.context/graph/`, and `.context/generated/` directories for deterministic machine-readable data.
- Create and load `.context/policy.yml` with safe policy v2 auto-apply, candidate-only, blocked, threshold, and drift defaults.
- Validate drift policy scalar keys (`enabled`, `threshold`, `write_signals`, `test_weight`, `exclude_globs`) without expanding the lightweight parser to YAML lists.
- Infer deterministic verification commands from package scripts.
- Offer filesystem existence helpers shared by commands.

## Depends On
- Node filesystem/path APIs.

## Used By
- `init`
- `verify`
- `evidence`

## Data Flow
`init` builds `TemplateInput`, templates return relative file paths and content, command writes them under `.context`. Commands that need policy call `loadContextPolicy()`, which merges `.context/policy.yml` with safe policy v2 defaults and surfaces unknown keys as validation warnings. Drift excludes use scalar `exclude_globs` and are split by the drift module instead of changing the policy parser.

## State / Storage
Writes `.context/**` through `init`; reads `.context/policy.yml` through `loadContextPolicy()` and `policy validate`.

## Constraints
- Templates may contain placeholders but must not assert guessed project facts.
- Canonical section headings are parser anchors and should stay English; Chinese or other local-language prose belongs in the body.
- Scanner may use package scripts as deterministic signals only.
- Policy defaults may enable routine/generated writes, but semantic and decision updates must remain disabled by default.

## Traps
- A generated candidate is not a canonical fact. Keep adopt candidates out of formal `MAP.md` until AI/user confirmation.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`
- `pnpm test tests/integration/m13-policy-stats.test.ts`
- `pnpm test tests/integration/m26-drift.test.ts`
- `pnpm dev policy show`
- `pnpm dev policy validate`

## When to Update This Doc
When adding `.context` files/directories, changing template headings, or changing deterministic scan behavior.
