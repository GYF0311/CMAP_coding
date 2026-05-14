---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-13T02:38:30+08:00
confidence: ai-drafted
module: tests
paths:
  - tests
  - scripts/smoke-test.mjs
aliases:
  - test
  - vitest
  - smoke
  - 自测
  - 集成测试
  - 行为测试
  - red green
---
# Module: tests

## Purpose
Prove public CLI behavior with reproducible integration tests and built-CLI smoke checks.

## Code Paths
- `tests/integration/m1.test.ts`
- `tests/integration/m2.test.ts`
- `tests/integration/m3.test.ts`
- `tests/integration/m4m5.test.ts`
- `tests/integration/m6-brief-obsidian.test.ts`
- `tests/integration/m7-update-agent.test.ts`
- `tests/integration/m8-evidence-stale-inbox.test.ts`
- `tests/integration/m9-hooks-assist.test.ts`
- `tests/integration/m10-route-context-pack.test.ts`
- `tests/integration/m11-context-size-controls.test.ts`
- `tests/integration/m12-route-benchmark-context.test.ts`
- `tests/integration/m13-policy-stats.test.ts`
- `tests/integration/m14-graph-route.test.ts`
- `tests/integration/m15-ci-benchmark.test.ts`
- `tests/integration/m16-context-pack.test.ts`
- `tests/integration/m17-hooks-ingest-codex.test.ts`
- `tests/integration/m18-freshness-inbox-promote.test.ts`
- `tests/integration/m24-inbox-path-escape.test.ts`
- `tests/integration/m25-view-structured-candidates.test.ts`
- `tests/integration/m27-install-merge.test.ts`
- `tests/integration/m28-skill-bootstrap.test.ts`
- `tests/integration/cli-errors.test.ts`
- `tests/integration/verify-l0.test.ts`
- `tests/unit/redact.test.ts`
- `scripts/smoke-test.mjs`

## Responsibilities
- Spawn the CLI in temporary project directories.
- Assert stdout/stderr-sensitive behavior and exit codes.
- Assert generated files contain expected content and do not invent project semantics.
- Assert `CHECKPOINT.md` write/read/close behavior and legacy `STATUS.md` checkpoint compatibility.
- Assert brief/export commands write task-local or view-layer artifacts without changing canonical facts.
- Assert Obsidian export check detects stale view-layer mirrors without writing.
- Assert coverage, pull dry-run, and benchmark commands surface candidate issues without canonical writes.
- Assert MapPatch v1/v2 routine apply, generated evidence/verification evidence, policy blocking, inbox status/triage/promote/archive, and stale verify behavior.
- Assert observe/assist/strict hook profiles write only non-canonical hook logs/session events, bounded generated evidence, or guard decisions.
- Assert assist UserPromptSubmit writes a generated session brief and route usage stats.
- Assert Codex hook render/ingest reads stdin payloads, writes generated session briefs/logs, returns Codex-compatible JSON, and denies direct semantic canonical writes in strict PreToolUse.
- Assert route context pack behavior separates direct matches from related context and surfaces module-owned verification commands.
- Assert route/brief context size controls bound selected context modules and derived verification commands.
- Assert route benchmark fixtures can measure context-pack hits separately from direct module hits.
- Assert policy defaults, generated module activity stats, and policy-backed inbox thresholds.
- Assert route usage stats are written when policy allows stats updates.
- Assert freshness snapshot/review warnings, low-risk inbox promote apply backup/audit/archive behavior, and explicit inbox reject archive behavior.
- Assert inbox promotion rejects evidence paths that escape the project root.
- Assert graph projections, graph explanation, and graph-mode route output.
- Assert CI Markdown verify output and benchmark threshold failure behavior.
- Assert context pack budget enforcement, route-neighborhood selection, and secret-looking value redaction.
- Assert HTML view redaction covers auth headers, cloud SDK credential fields, and PEM private key blocks without over-redacting innocent identifiers.
- Assert `view export --include-inbox` surfaces structured `cmap.candidate.v1` files from `.context/inbox/candidates/*.json`.
- Assert install marker merge preserves existing entrypoints, skill export/check writes stable packs, and bootstrap wires `.context`, host entrypoints, skill output, and start-here guidance.
- Run built `dist/cli.js` against a real temp project through `pnpm smoke`.

## Depends On
- Vitest
- Node child_process, fs, os, path APIs
- Repo-local `node_modules/.bin/tsx`
- Built `dist/cli.js` for smoke tests

## Used By
- Development workflow before claiming completion.
- Future regression coverage for milestones.

## Data Flow
Test creates temp cwd -> executes CLI source through tsx -> inspects process result and generated files.

## State / Storage
Temporary directories under the system temp path.

## Constraints
- Tests should exercise user-visible behavior before internals.
- Avoid brittle timestamp assertions.

## Traps
- `node --import tsx` resolves from cwd; use repo-local `tsx` binary when cwd is a temp project.

## Tests / Verification
- `pnpm test`
- `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts`
- `pnpm test tests/integration/m9-hooks-assist.test.ts`
- `pnpm test tests/integration/m10-route-context-pack.test.ts`
- `pnpm test tests/integration/m11-context-size-controls.test.ts`
- `pnpm test tests/integration/m12-route-benchmark-context.test.ts`
- `pnpm test tests/integration/m13-policy-stats.test.ts`
- `pnpm test tests/integration/m14-graph-route.test.ts`
- `pnpm test tests/integration/m15-ci-benchmark.test.ts`
- `pnpm test tests/integration/m16-context-pack.test.ts`
- `pnpm test tests/integration/m17-hooks-ingest-codex.test.ts`
- `pnpm test tests/integration/m18-freshness-inbox-promote.test.ts`
- `pnpm test tests/integration/m24-inbox-path-escape.test.ts`
- `pnpm test tests/integration/m25-view-structured-candidates.test.ts`
- `pnpm test tests/integration/m27-install-merge.test.ts`
- `pnpm test tests/integration/m28-skill-bootstrap.test.ts`
- `pnpm test tests/unit/redact.test.ts`
- `pnpm smoke`

## When to Update This Doc
When changing test harness strategy, adding fixtures, or changing public behavior contracts.
