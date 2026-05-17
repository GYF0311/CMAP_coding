---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-17T22:06:00+08:00
confidence: ai-drafted
module: module-docs
paths:
  - src/commands/add-module.ts
aliases:
  - add-module
  - module doc
  - module template
  - 模块文档
---
# Module: module-docs

## Purpose
Create a candidate module documentation file for AI/user completion.

## Code Paths
- `src/commands/add-module.ts`

## Responsibilities
- Validate module names.
- Create `.context/modules/<name>.md`.
- Include provided paths and aliases.
- Include a heading contract in new candidate docs: section headings stay English; body text can be project-language prose.
- Include `Key Contracts` and `Read Next` sections so Review HTML can show human-readable module cards.
- Mark new docs as `confidence: candidate`.
- Avoid editing `MAP.md`.

## Depends On
- `context/scanner`

## Used By
- `cmap add-module`

## Data Flow
Module name/options -> candidate module markdown template.

## State / Storage
Writes `.context/modules/<name>.md`.

## Constraints
- Does not promote module into MAP.
- Does not inspect source code semantically.

## Traps
- A candidate module doc still needs AI/user review before being treated as trusted.

## Tests / Verification
- `pnpm test tests/integration/m4m5.test.ts`

## When to Update This Doc
When module template fields or add-module options change.
