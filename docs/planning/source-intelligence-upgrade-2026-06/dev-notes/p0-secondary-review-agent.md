# P0 Secondary Review Agent Notes

Reviewed: 2026-06-04T08:04:45Z

## Scope

Secondary review for CMAP Source Intelligence Upgrade P0 repair status. This review is read-only for source code; the only write is this review note.

Focus was limited to the prior P0 review findings:

- packaged CLI runtime `typescript` dependency and production install smoke
- `impact file` stale freshness/current file snapshot
- wildcard `.gitignore` rules
- canonical module docs no-write snapshot
- duplicate unused impact implementation

## Files Reviewed

- `AGENTS.md`
- `docs/planning/source-intelligence-upgrade-2026-06/execution-plan.json`
- `docs/planning/source-intelligence-upgrade-2026-06/dev-notes/p0-review-agent.md`
- `package.json`
- `pnpm-lock.yaml`
- `src/commands/impact.ts`
- `src/source-intelligence/freshness.ts`
- `src/source-intelligence/discovery.ts`
- `src/source-intelligence/queries.ts`
- `src/source-intelligence/impact.ts`
- `src/source-intelligence/indexer.ts`
- `src/source-intelligence/store.ts`
- `src/commands/source.ts`
- `src/cli.ts`
- `tests/integration/source-intelligence.test.ts`
- `tests/integration/source-intelligence-package.test.ts`

## Commands Run

- `pnpm typecheck`
  - Exit 0.
- `pnpm test tests/integration/source-intelligence.test.ts tests/integration/source-intelligence-package.test.ts`
  - Exit 0. `2 passed`, `6 passed`.
- `pnpm build`
  - Exit 0. `dist/cli.js` and `dist/cli.d.ts` built successfully.
- `git diff --check`
  - Exit 0.
- `node dist/cli.js verify --changed`
  - Exit 0. `Errors: 0, Warnings: 6`.
  - Warnings: changed files not mapped to a module: `.context/CHECKPOINT.md`, `.context/MAP.md`, `.context/modules/showcase.md`, `.gitignore`, `package.json`, `pnpm-lock.yaml`.
- Additional targeted ignore-semantics probe run before this note:
  - `discoverSourceFiles` with `.gitignore` rule `**/*.secret.ts` still indexed root-level `root.secret.ts`.
  - `git check-ignore root.secret.ts` with the same rule exited 0, confirming Git ignores that file.

## Findings

### Fixed: Packaged CLI runtime `typescript` dependency

`typescript` is now in runtime `dependencies` in `package.json`, and `pnpm-lock.yaml` importer state matches. `tests/integration/source-intelligence-package.test.ts` packs the project, installs it with `pnpm add --prod`, runs `cmap version`, then runs `cmap source index --json`.

Status: fixed.

### Fixed: `impact file` current file freshness

`src/commands/impact.ts` now calls `currentSourceFileStates(cwd, index)` and passes `currentFiles` to `impactFileWithProjectModules`. The integration test mutates `src/a.ts` after indexing and asserts stale freshness, `stale-index` risk, and non-high confidence.

Status: fixed.

### Not fully fixed: wildcard `.gitignore` semantics remain incomplete

Classification: **WARNING**

File: `src/source-intelligence/discovery.ts:161`

Issue: the repair covers simple wildcard cases such as `*.secret.ts` and `src/generated/*.ts`, but it still does not match Git semantics for common leading `**/` patterns. A `.gitignore` rule of `**/*.secret.ts` should ignore a root-level `root.secret.ts`; Git confirms this via `git check-ignore`, but `discoverSourceFiles` still indexes it. This leaves a residual risk that ignored/private source files can leak path, hash, symbol, or signature data into generated source-index evidence.

Fix: use `git ls-files --cached --others --exclude-standard` in Git worktrees, or replace the hand-rolled matcher with a real `.gitignore` parser. Add regression coverage for `**/*.secret.ts` matching both root-level and nested files.

### Fixed: canonical module docs no-write snapshot

`tests/integration/source-intelligence.test.ts` now snapshots `.context/modules` recursively in `readCanonicalContext`, and both source index and impact tests assert any new `.context` files remain under `.context/generated/source-index/`.

Status: fixed.

### Fixed: duplicate unused impact implementation

`src/source-intelligence/queries.ts` no longer contains the duplicate `impactFile` implementation. It now only exposes symbol and edge query helpers.

Status: fixed.

## Verdict

Fail.

Four of five prior findings are fixed and all requested verification commands pass. The remaining `.gitignore` matcher gap is a residual trust-boundary issue for generated source evidence because common Git wildcard syntax can still allow ignored source files to be indexed.
