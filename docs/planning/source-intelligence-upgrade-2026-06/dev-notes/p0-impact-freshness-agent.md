# P0 Impact/Freshness Agent Dev Note

Date: 2026-06-04
Workspace: `/Users/gaoyifan/Desktop/CMAP_coding`

## Responsible Scope

- Implement the P0 impact/freshness query helper layer for CMAP Source Intelligence.
- Keep source analysis output as generated, non-canonical evidence.
- Do not modify CLI registration, command handlers, tests, or canonical `.context` facts in this slice.
- Coordinate with the source-index core by accepting an index-like object rather than owning index build/store logic.

## Files Read

- `AGENTS.md`
- `.context/MAP.md`
- `.context/CHECKPOINT.md`
- `.context/STATUS.md`
- `.context/modules/cli.md`
- `.context/modules/evidence.md`
- `.context/modules/tests.md`
- `.context/modules/showcase.md`
- `docs/planning/source-intelligence-upgrade-2026-06/execution-plan.json`
- `docs/planning/source-intelligence-upgrade-2026-06/implementation-roadmap.md`
- `docs/planning/source-intelligence-upgrade-2026-06/module-notes/source-index.md`
- `docs/planning/source-intelligence-upgrade-2026-06/module-notes/impact-analysis.md`
- `docs/planning/source-intelligence-upgrade-2026-06/module-notes/mcp-cli-surface.md`
- `src/core/module-index.ts`
- `src/core/freshness.ts`
- `src/core/generated-store.ts`
- `src/source-intelligence/schema.ts`
- `src/source-intelligence/queries.ts`

## Files Modified

- `src/source-intelligence/impact.ts`
- `src/source-intelligence/format.ts`
- `src/source-intelligence/evidence.ts`
- `docs/planning/source-intelligence-upgrade-2026-06/dev-notes/p0-impact-freshness-agent.md`

## Implementation

- Added `impactFile(index, path, options)` with:
  - changed file and changed symbol separation.
  - conservative bounded traversal over reverse `IMPORTS_FROM`, incoming `CALLS`, and `TESTED_BY` edges.
  - support for core file node ids shaped as `file:<path>`.
  - impacted symbols, impacted files, likely tests, related CMAP modules, risk factors, omitted counts, confidence, and `truncated`.
  - generated/non-canonical report labels.
- Added `impactFileWithProjectModules(cwd, index, path, options)` to load module mapping through existing `core/module-index.ts`.
- Added `summarizeSourceFreshness(index, options)` with fresh/stale/missing/error counts, stale files, missing files, error files, index timestamp, git head, and explanations.
- Added Markdown formatter helpers for impact reports and freshness summaries.
- Added source evidence record builder for impact reports. It builds generated JSONL-ready objects only; it does not write canonical or generated files by itself.

## Interface Assumptions

- The P0 source index provides arrays or object maps for `files`, `symbols`, and `edges`.
- Core `SourceIndex` arrays from `src/source-intelligence/schema.ts` are structurally compatible with `SourceIndexLike`.
- File-level graph nodes may appear either as raw project-relative paths or `file:<path>` ids.
- Call edges are only treated as high-signal incoming impact when `targetId` resolves to the changed/impacted symbol frontier.
- Freshness can be enriched by passing current file state into `currentFiles`; without that, status falls back to index metadata.

## Self-Test Commands

- `pnpm exec tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types node src/source-intelligence/impact.ts src/source-intelligence/format.ts src/source-intelligence/evidence.ts`
- `pnpm typecheck`
- `git diff --check`
- `cmap finish`
- `cmap verify --changed`

## Results

- Local strict compile for this Agent's files passed.
- Full `pnpm typecheck` passed after the concurrently landed source-index core files became type-clean.
- `git diff --check` exited 0.
- `cmap finish` exited 0 and reported unrelated/concurrent changed files, including CLI/source command/core files outside this Agent's scope.
- `cmap verify --changed` exited 0 with 4 warnings for existing unmapped `.context/*` and `.gitignore` changed files.

## Known Risks

- No CLI command or integration tests were added in this slice, per write-scope constraints.
- The algorithm is conservative static analysis and can miss dynamic calls, framework wiring, alias resolution gaps, or unresolved imports.
- Related module mapping is advisory generated evidence and must not affect `cmap route` scoring.
- Wide graphs are bounded by `maxDepth`, `maxEdges`, and `maxResults`; reports mark truncation and omitted counts.

## Next Suggestions

- Wire `impactFile` into the future `cmap impact file <path>` command after command-surface owner lands CLI registration.
- Add integration fixtures for reverse imports, incoming calls, likely tests, stale index, missing target, truncation, and no canonical writes.
- Feed impact evidence into Review HTML or brief only as support-layer generated evidence.
