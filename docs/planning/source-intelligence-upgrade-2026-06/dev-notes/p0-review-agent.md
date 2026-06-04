# P0 Review Agent Notes

Reviewed: 2026-06-04T07:49:40Z

## Scope

只审查 CMAP Source Intelligence Upgrade 的 P0 已实现内容。审查重点是 trust boundary、generated/non-canonical 标注、source index / impact 逻辑、路径与写入边界、P0 测试覆盖、竞品源码/文本复制、依赖面、以及是否过早 daemon/MCP 化。

本次不修改源码、不 revert/reset/restore/delete。唯一写入是本审查记录。

## Files Reviewed

- `AGENTS.md`
- `.context/MAP.md`
- `.context/CHECKPOINT.md`
- `.context/STATUS.md`
- `docs/planning/source-intelligence-upgrade-2026-06/execution-plan.json`
- `src/source-intelligence/discovery.ts`
- `src/source-intelligence/evidence.ts`
- `src/source-intelligence/format.ts`
- `src/source-intelligence/freshness.ts`
- `src/source-intelligence/guards.ts`
- `src/source-intelligence/impact.ts`
- `src/source-intelligence/indexer.ts`
- `src/source-intelligence/metrics.ts`
- `src/source-intelligence/queries.ts`
- `src/source-intelligence/resolver.ts`
- `src/source-intelligence/schema.ts`
- `src/source-intelligence/store.ts`
- `src/commands/source.ts`
- `src/commands/impact.ts`
- `src/cli.ts`
- `tests/integration/source-intelligence.test.ts`
- `package.json`
- `.gitignore`

## Commands Run

- `pnpm test tests/integration/source-intelligence.test.ts`
  - Exit 0. `1 passed`, `3 passed`.
- `pnpm typecheck`
  - Exit 0.
- `git diff --check`
  - Exit 0.
- `cmap verify --changed`
  - Exit 0. Warnings: 5 unmapped changed files: `.context/CHECKPOINT.md`, `.context/MAP.md`, `.context/modules/showcase.md`, `.gitignore`, `package.json`.

## Findings

### P0

#### P0-01: Packaged CLI will fail because runtime imports `typescript` but package does not depend on it

Files:
- `src/source-intelligence/indexer.ts:6`
- `src/cli.ts:29`
- `src/commands/source.ts:2`
- `src/source-intelligence/store.ts:4`
- `package.json:23`
- `package.json:30-40`

Issue: P0 adds a static runtime import of `typescript` through the CLI import chain. `src/cli.ts` statically imports `runSourceIndex`, `src/commands/source.ts` statically imports `buildAndWriteSourceIndex`, `src/source-intelligence/store.ts` statically imports `buildSourceIndex`, and `src/source-intelligence/indexer.ts` imports `typescript`. At the same time, `package.json` externalizes `typescript` from the built bundle and leaves it in `devDependencies`, not `dependencies`.

That means an installed package with production dependencies only will not have `typescript`, so the built CLI can fail at startup before even reaching a specific command. Local tests and typecheck pass because the repo checkout has devDependencies installed.

Fix: keep `typescript` externalized if needed, but move it to runtime `dependencies`, or lazy-load the indexer path and emit a clear install-time/runtime error while declaring the dependency contract. Add a packaged smoke test that installs the packed artifact in a temp project without devDependencies and runs at least `cmap version` plus `cmap source index`.

#### P0-02: `impact file` reports stale generated indexes as fresh because it never samples current file state

Files:
- `src/commands/impact.ts:18-22`
- `src/source-intelligence/impact.ts:223`
- `src/source-intelligence/impact.ts:414-416`

Issue: `runImpactFile` reads the persisted source index and calls `impactFileWithProjectModules` with only traversal options. It never hashes or stats current files. `summarizeSourceFreshness` therefore falls back to index metadata and explicitly emits "No current file-state snapshot was supplied", so a source file modified after `cmap source index` can still produce an impact report with `freshness.status: "fresh"` and higher confidence.

This breaks the P0 boundary promise that generated evidence carries accurate freshness/confidence labels. It can mislead a reviewer into trusting stale generated impact output.

Fix: before running impact, collect current state for indexed/discovered source files using the same discovery/hash path used by `source status`, pass it as `currentFiles`, and downgrade confidence/risk factors when the index is stale. Add an integration test: build index, modify `src/a.ts`, then run `cmap impact file src/a.ts --json` and assert `freshness.status === "stale"`, `riskFactors` includes `stale-index`, and confidence is not high.

### P1

#### P1-01: `.gitignore` wildcard rules are ignored, so source index can ingest ignored/private source files

Files:
- `src/source-intelligence/discovery.ts:43`
- `src/source-intelligence/discovery.ts:131-149`

Issue: discovery claims `.gitignore` support, but `matchesGitignore` returns false for any rule containing `*`. Patterns such as `*.secret.ts`, `src/generated/*.ts`, or `**/*.local.ts` will be indexed even though Git excludes them. The scanner also only reads the root `.gitignore`; it does not support nested `.gitignore` or `.codexignore`.

Because source index files are generated review artifacts, this can leak file names, hashes, symbol names, and signatures from intentionally ignored code into `.context/generated/source-index`.

Fix: prefer `git ls-files --cached --others --exclude-standard` when inside a Git worktree, or use a real ignore parser with full `.gitignore` semantics and add `.codexignore` support if CMAP expects agent-facing ignore boundaries. Add tests for wildcard ignore patterns and ignored nested directories.

### P2

#### P2-01: no-canonical-write test does not snapshot canonical module docs

Files:
- `tests/integration/source-intelligence.test.ts:66`
- `tests/integration/source-intelligence.test.ts:106`
- `tests/integration/source-intelligence.test.ts:143-148`

Issue: the P0 no-canonical-write tests snapshot only top-level canonical files: `MAP.md`, `CHECKPOINT.md`, `STATUS.md`, `DECISIONS.md`, and `VERIFY.md`. Project rules define `.context/modules/*.md` as canonical too, but module docs are not included in the snapshot. A future regression could edit a module doc and these tests would still pass.

Fix: snapshot all canonical files, including `.context/modules/*.md`, before and after `source index` / `impact file`. Also assert generated writes remain under `.context/generated/source-index/**`.

### P3

#### P3-01: duplicate unused impact implementation increases drift risk

Files:
- `src/source-intelligence/queries.ts:75-136`
- `src/source-intelligence/impact.ts:217-331`

Issue: P0 contains two exported `impactFile` implementations. The CLI uses `src/source-intelligence/impact.ts`; `src/source-intelligence/queries.ts` is not imported by the reviewed source or tests. This is not currently breaking behavior, but it creates an attractive wrong API surface for future work and can drift from the CLI behavior.

Fix: remove the unused helper, rename it to make its experimental status explicit, or add tests/imports that prove it is the intended shared query API.

## Pass/Fail Verdict

Fail for P0 shipping readiness.

The implementation keeps canonical writes out of `.context/MAP.md` and top-level canonical files in the covered tests, and CLI output consistently labels generated/non-canonical evidence. No copied competitor source/text, daemon, watcher, MCP server, model call, or broad new dependency was observed in P0 source files.

However, P0 cannot ship as-is because packaged CLI startup depends on a missing runtime dependency, and `impact file` can label stale generated evidence as fresh.

## Required Fixes

1. Fix the `typescript` runtime/package dependency boundary and add a packaged CLI smoke test.
2. Make `impact file` compute current file freshness before reporting confidence, and add stale-impact test coverage.
3. Fix ignored-file discovery semantics before broad use, at minimum for wildcard `.gitignore` patterns.
4. Extend no-canonical-write tests to include `.context/modules/*.md`.
5. Remove or clearly contain the unused duplicate impact query implementation.
