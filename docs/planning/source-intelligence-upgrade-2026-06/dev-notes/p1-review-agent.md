# P1 Review Agent Note

Date: 2026-06-04

## Scope

Reviewed P1 implementation only. No source code was modified.

Focus areas:

- generated/non-canonical trust boundary and generated source-index write paths
- `symbol find/explain/callers/callees` parsing, ambiguity, freshness, and limit behavior
- source-aware brief evidence placement, budget, redaction, freshness, and truncated labels
- Review HTML source support panel read boundary
- CLI option registration and canonical-fact wording
- P1 targeted tests plus m6/m19 regressions

## Files Reviewed

- `AGENTS.md`
- `docs/planning/source-intelligence-upgrade-2026-06/execution-plan.json`
- `docs/planning/source-intelligence-upgrade-2026-06/dev-notes/p1-symbol-query-agent.md`
- `docs/planning/source-intelligence-upgrade-2026-06/dev-notes/p1-brief-view-agent.md`
- `src/commands/symbol.ts`
- `src/commands/brief.ts`
- `src/cli.ts`
- `src/source-intelligence/queries.ts`
- `src/source-intelligence/brief.ts`
- `src/source-intelligence/metrics.ts`
- `src/view/collect.ts`
- `src/view/schema.ts`
- `src/view/render.ts`
- `tests/integration/source-intelligence-symbol.test.ts`
- `tests/integration/source-intelligence-brief-view.test.ts`
- `tests/integration/m6-brief-obsidian.test.ts`
- `tests/integration/m19-view-export.test.ts`

## Commands Run

- `pnpm typecheck` - passed.
- `pnpm test tests/integration/source-intelligence-symbol.test.ts tests/integration/source-intelligence-brief-view.test.ts` - passed: 2 files, 8 tests.
- `pnpm test tests/integration/m6-brief-obsidian.test.ts tests/integration/m19-view-export.test.ts` - passed: 2 files, 23 tests.
- `git diff --check` - passed.
- `node dist/cli.js verify --changed` - passed with 0 errors and 6 warnings. Existing dist was not rebuilt in this review turn. Warnings were unmapped changed files: `.context/CHECKPOINT.md`, `.context/MAP.md`, `.context/modules/showcase.md`, `.gitignore`, `package.json`, `pnpm-lock.yaml`.

## Findings

### WR-01: `symbol explain` can emit unbounded call/import evidence

**Classification:** WARNING

**File:** `src/commands/symbol.ts:100`

**Issue:** `runSymbolExplain` decorates and returns all callers, callees, and imports without a limit or omitted/truncated marker:

- `callers: decorateEdges(index, callersOf(index, symbol.id))`
- `callees: decorateEdges(index, calleesOf(index, symbol.id))`
- `imports: importsOfFile(index, symbol.filePath)`

The CLI registration for `symbol explain` also has no `--limit` option (`src/cli.ts:156`). This makes `explain` inconsistent with `symbol callers/callees`, which do cap output and report omitted counts. On a large generated index, one symbol can dump a very large edge set without telling the user evidence was bounded or unbounded.

**Fix:** Add an explain limit, default it to the same value as callers/callees, slice callers/callees/imports, and include `omitted` plus `truncated` in JSON and Markdown.

### WR-02: source brief budget is not enforced as displayed

**Classification:** WARNING

**File:** `src/source-intelligence/brief.ts:222`

**Issue:** `buildSnippets` uses `Math.max(120, budgetTokens * 4)`, so a user-provided tiny budget still allows at least 120 snippet characters. The brief then prints the original budget as if it were the effective cap (`src/source-intelligence/brief.ts:82-83`). The rendered section also adds snippet headings, fences, freshness labels, and other source evidence outside the tracked snippet body budget (`src/source-intelligence/brief.ts:296-304`).

This makes `--source-budget` misleading and weakens the P1 "bounded generated source evidence" contract.

**Fix:** Either enforce the requested budget strictly, or validate a documented minimum and print `effectiveBudgetTokens`. Also account for rendered snippet overhead or explicitly label the budget as snippet-body-only.

## Verdict

Fail. No BLOCKER was found in this review pass, but the two WARNING findings above should be fixed before marking P1 passed.
