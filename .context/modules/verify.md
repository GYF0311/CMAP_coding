---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T17:55:00+08:00
confidence: ai-drafted
module: verify
paths:
  - src/commands/verify.ts
aliases:
  - verify
  - check
  - drift
  - 校验
  - 检查
  - placeholder
---
# Module: verify

## Purpose
Run deterministic checks over `.context` and report errors/warnings without modifying files.

## Code Paths
- `src/commands/verify.ts`

## Responsibilities
- Check required files exist.
- Parse frontmatter and warn on missing `context_type`.
- Check required headings in canonical files.
- Warn on generated placeholder residue.
- Check module frontmatter paths stay inside the project and exist.
- Check MAP module table docs exist.
- Warn when AGENTS.md and CLAUDE.md drift apart.
- Warn about AI-fill placeholders inside module docs.
- Return exit code 1 only for errors.

## Depends On
- `gray-matter`
- `context/scanner.ts` for file existence.

## Used By
- `cmap verify`
- Future `finish` and hook reminders.

## Data Flow
Read `.context` files -> collect ok lines and issues -> print text or JSON -> return exit code.

## State / Storage
Read-only.

## Constraints
- `verify` must not fix files automatically.
- Warnings should be actionable and not expose secrets.

## Traps
- TODO placeholders are warnings, not errors, because freshly initialized projects are expected to contain them.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`
- `pnpm dev verify`

## When to Update This Doc
When adding new L0/L1 checks or changing error/warning semantics.
