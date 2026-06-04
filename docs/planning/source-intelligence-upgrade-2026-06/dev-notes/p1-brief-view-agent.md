# P1 Brief/View Integration Agent Dev Note

Date: 2026-06-04

## Scope

Implemented the MVP integration slice for P1 Brief/View:

- `runBrief` accepts `withSourceEvidence`, `sourceBudget`, and `sourceTarget` handler options.
- `src/source-intelligence/brief.ts` builds a bounded generated source evidence section.
- Review HTML renders an opt-in source evidence support panel from existing `.context/generated/source-index/**` files.
- Targeted integration coverage lives in `tests/integration/source-intelligence-brief-view.test.ts`.

## Trust Boundary

Source evidence remains generated and non-canonical. This slice does not write `MAP.md`, module docs, `DECISIONS.md`, or `VERIFY.md`.

Review HTML only reads generated source-index JSON/evidence files. It does not re-index, hash, or semantically analyze source files during view export.

## CLI Wiring

`src/cli.ts` was intentionally not modified by this agent. If the main agent has not already registered the flags, the command handler is ready for CLI option registration such as:

```bash
cmap brief "<task>" --with-source-evidence --source-budget 700 --source-target src/foo.ts
```

This slice's tests call `runBrief` directly so they do not depend on ownership or timing of `src/cli.ts` wiring.

## Verification Notes

Checks run:

- `pnpm test tests/integration/source-intelligence-brief-view.test.ts` passed.
- `pnpm test tests/integration/m6-brief-obsidian.test.ts` passed.
- `pnpm test tests/integration/m19-view-export.test.ts` passed.
- `pnpm typecheck` passed.
- `git diff --check` passed.
- `pnpm --silent dev finish` passed.
- `pnpm --silent dev verify --changed` passed with 0 errors and 6 existing unmapped changed-file warnings.

The brief source section is appended after reviewed route/module context. It includes generated/non-canonical labels, freshness status, source-index metrics, recent evidence records, context-savings estimate, omitted counts, and budgeted snippets with redaction.
