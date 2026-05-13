---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-13T02:35:30+08:00
confidence: ai-drafted
module: verify
paths:
  - src/commands/verify.ts
aliases:
  - verify
  - check
  - drift
  - stale
  - 校验
  - 检查
  - placeholder
relations:
  observes:
    - evidence
    - update-agent
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
- Require `CHECKPOINT.md` with the current checkpoint headings.
- Warn on generated placeholder residue.
- Check module frontmatter paths stay inside the project and exist.
- Check typed module relations point to existing modules.
- Check changed-file coverage when `--coverage` or `--changed` is requested.
- Check MAP module table docs exist.
- Warn when AGENTS.md and CLAUDE.md drift apart.
- Warn about AI-fill placeholders inside module docs.
- Warn when `.context/VERIFY.md` omits common package verification scripts.
- Warn when pending updates exceed the v0.1 review threshold.
- Warn when `.context/inbox/` contains candidate updates under `--stale`.
- Respect `.context/policy.yml` inbox thresholds under `--stale`.
- Warn when a module doc appears older than one of its owned source paths under `--stale`.
- Warn under `--freshness` when owned source files or generated evidence are newer than the last semantic review.
- Warn under `--freshness` when a module has pending inbox candidates that need review.
- Warn under `--freshness` when no generated freshness snapshot exists, so users know to run `cmap freshness snapshot`.
- Classify pending freshness candidates as relation, high-risk, or routine when possible.
- Validate `.context/policy.yml` under `--policy`, surfacing unknown keys and unsupported versions as warnings and invalid value types as errors.
- Render stable CI-friendly Markdown output with `--ci --format markdown`.
- Return exit code 1 only for errors.

## Depends On
- `gray-matter`
- `context/scanner.ts` for file existence.
- `context/policy.ts` for inbox thresholds.
- `core/freshness.ts` for generated freshness snapshots and review markers.
- `core/module-index.ts` for module relation and changed-file coverage.
- `evidence` module conventions for generated evidence and inbox visibility.

## Used By
- `cmap verify`
- `cmap verify --stale`
- `cmap verify --freshness`
- `cmap verify --policy`
- Future `finish` and hook reminders.

## Data Flow
Read `.context` files -> collect ok lines and issues -> print text, JSON, or CI Markdown -> return exit code.

## State / Storage
Read-only.

## Constraints
- `verify` must not fix files automatically.
- Warnings should be actionable and not expose secrets.

## Traps
- TODO placeholders are warnings, not errors, because freshly initialized projects are expected to contain them.

## Tests / Verification
- `pnpm test tests/integration/m1.test.ts`
- `pnpm test tests/integration/verify-l0.test.ts`
- `pnpm dev verify`
- `pnpm dev verify --stale`
- `pnpm dev verify --freshness`
- `pnpm dev verify --policy`
- `pnpm dev verify --coverage --changed-files src/commands/verify.ts`
- `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts`
- `pnpm test tests/integration/m13-policy-stats.test.ts`
- `pnpm test tests/integration/m18-freshness-inbox-promote.test.ts`
- `pnpm test tests/integration/m22-freshness-policy.test.ts`
- `pnpm test tests/integration/m15-ci-benchmark.test.ts`

## When to Update This Doc
When adding new L0/L1 checks, stale/freshness checks, inbox checks, or changing error/warning semantics.
