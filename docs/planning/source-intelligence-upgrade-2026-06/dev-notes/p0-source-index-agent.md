# P0 Source Index Agent Dev Note

Date: 2026-06-04
Workspace: `/Users/gaoyifan/Desktop/CMAP_coding`

## Scope

Implemented the P0 source-index core layer for CMAP Source Intelligence Upgrade.

This slice is generated evidence only. It writes under `.context/generated/source-index/**` through helper APIs and does not write canonical `.context` facts.

## Files Read

- `AGENTS.md`
- `.context/MAP.md`
- `.context/CHECKPOINT.md`
- `.context/STATUS.md`
- `.context/VERIFY.md`
- `.context/modules/cli.md`
- `.context/modules/evidence.md`
- `.context/modules/tests.md`
- `.context/modules/showcase.md`
- `docs/planning/source-intelligence-upgrade-2026-06/execution-plan.json`
- `docs/planning/source-intelligence-upgrade-2026-06/implementation-roadmap.md`
- `docs/planning/source-intelligence-upgrade-2026-06/module-notes/source-index.md`
- Existing helpers in `src/core/*`, `src/context/scanner.ts`, and `src/fs/safe-path.ts`

## Files Changed

Main source-index core files:

- `src/source-intelligence/schema.ts`
- `src/source-intelligence/guards.ts`
- `src/source-intelligence/discovery.ts`
- `src/source-intelligence/store.ts`
- `src/source-intelligence/indexer.ts`
- `src/source-intelligence/resolver.ts`
- `src/source-intelligence/queries.ts`
- `src/source-intelligence/freshness.ts`
- `src/source-intelligence/metrics.ts`

Compatibility repair in the same source-intelligence worktree:

- `src/source-intelligence/impact.ts` - narrowed `positiveInteger` so the parallel impact helper typechecks.

Dev note:

- `docs/planning/source-intelligence-upgrade-2026-06/dev-notes/p0-source-index-agent.md`

Build boundary repair:

- `package.json` - externalized `typescript` in the tsup build script so CLI ESM output does not bundle the TypeScript compiler API and fail on dynamic `fs` require.

Parallel work was present in this directory and outside this slice, including `src/source-intelligence/evidence.ts`, `src/source-intelligence/format.ts`, `src/commands/source.ts`, `src/commands/impact.ts`, `src/cli.ts`, and `tests/integration/source-intelligence.test.ts`. I did not reset, restore, or delete those changes.

## Implementation

- Added source-index schema for files, symbols, edges, unresolved refs, and meta with `canonical: false`.
- Added generated-path guards so store writes stay under `.context/generated/source-index`.
- Added TS/JS discovery for `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`.
- Ignored dependency/generated directories including `node_modules`, `dist`, `.git`, `.context/generated`, `.context/out`, `.context/backups`, `.context/audit`, `_cmap`, `_cmap-view`, `.cmap`, and `coverage`.
- Added basic `.gitignore` directory/exact-path support without new dependencies.
- Implemented TypeScript compiler API parsing for imports, exports, re-exports, functions, classes, methods, exported variables, exported types, test blocks, and basic call expressions.
- Added resolver for relative imports/re-exports, named exports, same-file calls, named imports, default imports, and namespace calls.
- Added unresolved-ref records for external modules, missing local files, missing symbols, ambiguous symbols, and unsupported call targets.
- Added store helpers to build, write, and read:
  - `.context/generated/source-index/source-index.meta.json`
  - `.context/generated/source-index/files.json`
  - `.context/generated/source-index/symbols.json`
  - `.context/generated/source-index/edges.json`
  - `.context/generated/source-index/unresolved-refs.json`
- Added query helpers for symbol search, callers/callees, file imports/dependents, and file impact traversal.
- Added freshness/status helper comparing stored hashes to current discovered source files.
- Added metrics helper for counts by symbol kind, edge kind, and confidence tier.

## Self-Test

Passed:

- `pnpm typecheck`
- `pnpm build`
- `pnpm exec tsup src/source-intelligence/store.ts --format cjs --out-dir /tmp/cmap-source-index-store-build-cjs --no-dts`
- Pure Node smoke against a temp project using the temporary CJS bundle:
  - files: 2
  - symbols: 5
  - edges: 9
  - unresolvedRefs: 1
  - relative import resolved: true
  - imported call resolved: true
  - store write/read succeeded
- Built CLI smoke against a temp project:
  - command: `node dist/cli.js source index --json`
  - files: 2
  - symbols: 4
  - edges: 7
  - unresolvedRefs: 1
  - status: indexed
- `node dist/cli.js finish`
- `node dist/cli.js verify --changed` exited 0 with 5 unmapped changed-file warnings for existing/current unmapped files.
- `git diff --check`

Verification wrinkle:

- `pnpm exec tsx --eval "..."` and direct `./node_modules/.bin/tsx --eval "..."` both hung locally, including a minimal `console.log` case. I killed only those smoke processes and switched to the temporary CJS bundle path.
- After source CLI parallel wiring, the old build script bundled `typescript` into `dist/cli.js` and made built `cmap` fail with `Dynamic require of "fs" is not supported`. Externalizing `typescript` in `package.json` fixed the built CLI startup path.

## Known Risks

- No TypeScript typechecker/program-level resolution yet; call resolution is AST/name based and intentionally confidence-labeled.
- External package calls and global/runtime calls remain unresolved evidence.
- `.gitignore` handling is intentionally simple and does not implement full gitignore glob semantics.
- No CLI command was wired by this agent; command/test files were being edited in parallel.
- Source evidence may contradict reviewed `.context`; it must stay generated/candidate-only until human review promotes facts.

## Next Steps

- Wire thin CLI commands on top of these helpers in the P0 CLI slice.
- Add integration tests for path safety, generated-only writes, hash freshness, import resolution, and file impact.
- Update `.context/MAP.md` and module docs only after implementation and tests are reviewed.
- Consider TypeScript Program/typechecker resolution in a later P1/P2 slice.
