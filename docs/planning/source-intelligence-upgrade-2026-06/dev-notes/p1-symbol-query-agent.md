# P1 Symbol Query Agent Dev Note

Date: 2026-06-04

## Scope

Implemented the minimal symbol query helper surface without editing `src/cli.ts`.

Changed files:

- `src/commands/symbol.ts`
- `src/source-intelligence/queries.ts`
- `tests/integration/source-intelligence-symbol.test.ts`
- `docs/planning/source-intelligence-upgrade-2026-06/dev-notes/p1-symbol-query-agent.md`

## Behavior

- Added `runSymbolFind`, `runSymbolExplain`, `runSymbolCallers`, and `runSymbolCallees`.
- Symbol reports read the generated source index only.
- Reports do not write canonical `.context` files.
- JSON reports include `generated: true`, `canonical: false`, `label`, `freshness`, `confidence`, and `queryMetrics`.
- Markdown reports include generated/non-canonical and freshness labels.
- `find` supports fuzzy symbol search with `kind`, `exportedOnly`, and `limit`.
- `explain`, `callers`, and `callees` resolve exact id/name/qualifiedName first and return ambiguity candidates when a query is not unique.
- Call graph output uses directed `CALLS` edges from the generated index.
- `explain` also includes source-file `IMPORTS_FROM` edges.

## CLI Boundary

`src/cli.ts` was intentionally not modified. Main owns command registration.

The integration test records the current boundary:

```bash
cmap symbol find target --json
```

currently fails as an unknown command until main wires the helper into the CLI.

## Verification

- `pnpm test tests/integration/source-intelligence-symbol.test.ts` passed: 6 tests.
- `pnpm typecheck` passed.
- `git diff --check` passed.
- `pnpm dev finish` ran and reported changed modules `cli` and `tests`; it also listed broader parallel P0/planning changes outside this agent's write scope.
- `pnpm dev verify --changed` exited 0 with 6 unmapped changed-file warnings for existing parallel changes: `.context/CHECKPOINT.md`, `.context/MAP.md`, `.context/modules/showcase.md`, `.gitignore`, `package.json`, and `pnpm-lock.yaml`.
