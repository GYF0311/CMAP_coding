---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T21:06:00+08:00
confidence: ai-drafted
module: adoption
paths:
  - src/commands/adopt.ts
  - src/context/adoption-scanner.ts
aliases:
  - adopt
  - adoption
  - existing project
  - 接管
  - 候选模块
---
# Module: adoption

## Purpose
Create an adoption workspace for existing projects without pretending candidate signals are trusted facts.

## Code Paths
- `src/commands/adopt.ts`
- `src/context/adoption-scanner.ts`

## Responsibilities
- Reuse `init` to create `.context` skeleton.
- Scan deterministic signals such as package files, scripts, README, and candidate module directories.
- Write `.context/ADOPTION.md` with `confidence: candidate`.
- Include existing entrypoints so the AI/user can review likely starting files before promoting facts.
- Leave `MAP.md` placeholders untouched until AI/user review.

## Depends On
- `context/templates`
- `context/scanner`
- Node filesystem/path APIs

## Used By
- `cmap adopt`

## Data Flow
Existing project files -> deterministic signal scan -> ADOPTION guide.

## State / Storage
Writes `.context/ADOPTION.md` and any missing `.context` skeleton files.

## Constraints
- No automatic trusted module facts.
- Candidate directories stay in ADOPTION until reviewed.
- Existing entrypoints are review hints, not confirmed ownership.

## Traps
- A detected directory is not a confirmed module boundary.
- An existing entrypoint is not proof of module responsibility.

## Tests / Verification
- `pnpm test tests/integration/m4m5.test.ts`

## When to Update This Doc
When adoption scan inputs, output format, or confidence rules change.
