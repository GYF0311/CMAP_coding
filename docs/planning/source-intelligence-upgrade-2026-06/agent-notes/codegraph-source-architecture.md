# CodeGraph Source Architecture Agent Note
## Research Scope

Local snapshot inspected only: `/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/codegraph`.

The read was scoped to CodeGraph source architecture for indexing, extraction, storage, graph traversal, and freshness behavior. I focused on `src/extraction`, `src/db`, `src/graph`, `src/sync`, and `src/types.ts`. I did not copy source code into CMAP, and this note treats CodeGraph as an implementation reference only.

CMAP boundary from the planning docs: source analysis must remain generated evidence or candidate input. It must not become canonical `.context` truth without human review.

## Source Files Inspected

- `src/types.ts`: `Node`, `Edge`, `FileRecord`, `ExtractionResult`, `UnresolvedReference`, `Subgraph`, `TraversalOptions`, `SearchOptions`, `Context`, `GraphStats`, task context types.
- `src/extraction/index.ts`: `ExtractionOrchestrator`, `hashContent`, `buildDefaultIgnore`, `scanDirectory`, `scanDirectoryAsync`, `indexAll`, `indexFile`, `indexFileWithContent`, `sync`, `getChangedFiles`.
- `src/extraction/tree-sitter.ts`: `TreeSitterExtractor`, `extractFromSource`, `extractImport`, `extractCall`, `extractInstantiation`, `extractInheritance`, `visitFunctionBody`, `createNode`.
- `src/extraction/tree-sitter-types.ts`: `LanguageExtractor`, `ExtractorContext`, `ImportInfo`, `VariableInfo`.
- `src/extraction/grammars.ts`: `EXTENSION_MAP`, `isSourceFile`, `detectLanguage`, `initGrammars`, `loadGrammarsForLanguages`, `isFileLevelOnlyLanguage`, `resetParser`.
- `src/extraction/parse-worker.ts`: worker protocol for grammar loading and parse requests.
- `src/extraction/tree-sitter-helpers.ts`: `generateNodeId`, `getNodeText`, `getChildByField`, `getPrecedingDocstring`.
- `src/extraction/generated-detection.ts`: `isGeneratedFile`.
- `src/extraction/languages/index.ts`, `src/extraction/languages/typescript.ts`, `src/extraction/languages/javascript.ts`: TS/JS language extractor configs.
- `src/extraction/svelte-extractor.ts`, `src/extraction/vue-extractor.ts`: single-file component extraction by delegating script blocks to TS/JS extraction.
- `src/db/schema.sql`: core tables, indexes, FTS5 table, triggers, metadata.
- `src/db/index.ts`: `DatabaseConnection`, `getDatabasePath`, connection pragmas, schema init, maintenance.
- `src/db/migrations.ts`: `CURRENT_SCHEMA_VERSION`, migration list and migration runner.
- `src/db/sqlite-adapter.ts`: `SqliteDatabase`, `SqliteStatement`, `NodeSqliteAdapter`, `createDatabase`.
- `src/db/queries.ts`: `QueryBuilder`, CRUD, search, edge/file/unresolved reference operations, stats and metadata.
- `src/graph/traversal.ts`: `GraphTraverser`, `traverseBFS`, `traverseDFS`, `getCallers`, `getCallees`, `getCallGraph`, `getTypeHierarchy`, `findUsages`, `getImpactRadius`, `findPath`, `getAncestors`, `getChildren`.
- `src/graph/queries.ts`: `GraphQueryManager`, `getContext`, `getFileDependencies`, `getFileDependents`, `getExportedSymbols`, `findByQualifiedName`, `getModuleStructure`, `findCircularDependencies`, `getNodeMetrics`, `findDeadCode`, `getFilteredSubgraph`.
- `src/graph/index.ts`: graph exports.
- `src/sync/index.ts`: sync module exports.
- `src/sync/watcher.ts`: `FileWatcher`, `PendingFile`, `LockUnavailableError`.
- `src/sync/watch-policy.ts`: `watchDisabledReason`, `detectWsl`.
- `src/sync/git-hooks.ts`: `installGitSyncHook`, `removeGitSyncHook`, `isSyncHookInstalled`, hook marker model.
- `src/sync/worktree.ts`: `detectWorktreeIndexMismatch`, `worktreeMismatchWarning`, `worktreeMismatchNotice`.

## Core Mechanisms

1. Source file scope is git-aware but not git-only.

   `src/extraction/index.ts` uses `getGitVisibleFiles` and `collectGitFiles` to enumerate tracked plus untracked git-visible files, including submodules and embedded repos. It applies `buildDefaultIgnore` even to tracked files, so dependency and build directories do not become project code merely because they are committed. Non-git projects fall back to `scanDirectoryWalk`, which applies built-in ignore rules plus nested `.gitignore` files.

2. Language support is extension-driven, with special no-symbol file classes.

   `src/extraction/grammars.ts` defines `EXTENSION_MAP`, `isSourceFile`, and `detectLanguage`. TS/JS, Python, Go, Rust and other languages use WASM tree-sitter grammars. `yaml`, `twig`, and `properties` are tracked at file-record level only via `isFileLevelOnlyLanguage`; they can still participate in framework-level evidence but do not emit normal symbol nodes in the core extractor.

3. Indexing is a staged pipeline.

   `ExtractionOrchestrator.indexAll` performs scan, framework detection, grammar loading, worker-backed parsing, and DB storage. Files are read in small I/O batches. Parsing can run in `src/extraction/parse-worker.ts`, with timeouts, worker recycling, and retry paths for WASM memory failures. `MAX_FILE_SIZE` prevents multi-MB generated or vendored files from consuming parser memory.

4. Extraction separates symbol creation from reference resolution.

   `TreeSitterExtractor.extract` creates a file node, pushes it on `nodeStack`, then visits the AST. `createNode` emits typed nodes and `contains` edges. Calls, imports, inheritance, instantiation, decorators, and type annotations generally become `UnresolvedReference` entries first. The inspected files show extraction producing unresolved references and DB storage for them; final resolution into inter-symbol edges appears outside this scoped read.

5. The core extractor is generic; language files are thin adapters.

   `LanguageExtractor` names AST node types and hooks for signatures, visibility, export flags, imports, body resolution, package names, and custom visitors. `src/extraction/languages/typescript.ts` and `javascript.ts` are compact examples: they declare function/class/method/import/call/variable node types, handle class-field arrow functions through `resolveBody`, and extract import module names from import statements.

6. Custom component extractors delegate back to the core.

   `SvelteExtractor` and `VueExtractor` create a component node, extract script blocks, parse those blocks through `TreeSitterExtractor`, offset line numbers back to the component file, and add containment from the component to extracted nodes. Svelte additionally scans template calls and component usages. This is useful as a design pattern but is beyond CMAP's first TS source-index MVP.

7. DB schema is small but purpose-separated.

   `src/db/schema.sql` has four essential data groups: `nodes`, `edges`, `files`, and `unresolved_refs`, plus `schema_versions` and `project_metadata`. `files` stores `content_hash`, `size`, `modified_at`, `indexed_at`, `node_count`, and extraction errors. `nodes_fts` is an FTS5 virtual table synced by triggers from `nodes`.

8. SQLite setup is tuned for local concurrent use.

   `DatabaseConnection` sets `busy_timeout`, foreign keys, WAL journal mode, `synchronous = NORMAL`, cache size, temp store, and mmap. `runMaintenance` performs best-effort `PRAGMA optimize` and passive WAL checkpoint after bulk writes. `sqlite-adapter.ts` wraps Node's built-in `node:sqlite`, avoiding a native build dependency.

9. QueryBuilder combines CRUD, search, cache, and graph primitives.

   `QueryBuilder` lazily prepares statements, keeps an LRU node cache, batch-fetches nodes by ID through `getNodesByIds`, and chunks large IN-list queries. Search uses FTS prefix matching, LIKE fallback, fuzzy fallback, exact-name supplementation, field filters, and scoring helpers. Edge access is through `getOutgoingEdges`, `getIncomingEdges`, and `findEdgesBetweenNodes`. File freshness and unresolved reference operations are first-class methods.

10. Graph traversal is explicit and bounded.

   `GraphTraverser` implements BFS and DFS with `TraversalOptions` for max depth, direction, edge kinds, node kinds, limit, and include-start behavior. It batch-fetches neighbor nodes to avoid N+1 query patterns. Dedicated methods cover callers, callees, call graph, type hierarchy, usages, impact radius, shortest path, ancestors, and children.

11. Higher-level graph queries are file and context oriented.

   `GraphQueryManager.getContext` assembles focal node, ancestors, children, incoming and outgoing references, type edges, and imports. It also exposes file dependencies, file dependents, exported symbols, module structure, circular dependency detection, node metrics, dead-code candidates, and filtered subgraphs.

12. Incremental sync is filesystem-reconciled, not just git-status based.

   `ExtractionOrchestrator.sync` scans current source files, compares them to DB `files`, deletes removed files, skips unchanged files by size and mtime, reads and hashes changed candidates, and reindexes only changed files. This catches clean working-tree changes from checkout, merge, rebase, or pull because it compares filesystem state to the indexed state. `getChangedFiles` still provides a git-status fast path for status-like reporting.

13. Watch freshness is visible to callers.

   `FileWatcher` uses chokidar with the same ignore matcher as indexing. It debounces source file changes and tracks `pendingFiles` with first seen, last seen, and `indexing` status. On sync success it clears only events covered by that sync. On failure or `LockUnavailableError`, it preserves pending state and reschedules, preferring false stale warnings over false fresh results.

14. Watch policy and fallback are environment-aware.

   `watchDisabledReason` disables watching for explicit `CODEGRAPH_NO_WATCH=1` and for WSL `/mnt` paths unless forced. `git-hooks.ts` offers opt-in background `codegraph sync` snippets for post-commit, post-merge, and post-checkout, preserving user hook content with marker blocks. `worktree.ts` detects when a resolved index belongs to a different git worktree and formats warnings.

## Capabilities CMAP Should Absorb

- A generated source-index layer under the trust boundary: CMAP should add a source index that outputs generated evidence, never canonical `.context` facts by itself.
- A small source schema with separate `source_files`, `source_symbols`, `source_edges`, `source_unresolved_refs`, and `source_metadata` roles. CodeGraph's `files` table is the most important piece for freshness.
- Shared scan scope between index and watch/status. CodeGraph's `buildDefaultIgnore` reused by `FileWatcher` is the right design principle.
- TS/JS import and symbol extraction as P0. Start with functions, classes, methods, exported constants, import declarations, call expressions, and file nodes.
- Delayed reference resolution. Extract raw references first, resolve them in a later pass, and keep unresolved refs queryable for diagnostics rather than hiding uncertainty.
- File-level freshness metadata: content hash, size, mtime, indexed time, extraction errors, and stale reason.
- Bounded graph traversal APIs for callers, callees, file dependents, and impact radius. These map directly to planned command families like `cmap symbol callers`, `cmap symbol callees`, and `cmap impact file`.
- Query outputs that include freshness warnings. A result touching a pending or stale file should tell the agent to read that source file directly.
- SQLite with WAL and FTS if CMAP wants fast local symbol search without a server. CodeGraph's `nodes_fts` plus ordinary indexes are a practical model.
- Worktree mismatch detection. CMAP users often use worktrees; a stale or borrowed index can be worse than no index.
- Generated-file down-ranking. CodeGraph's `isGeneratedFile` is a useful relevance hint for source evidence packs.

## Parts CMAP Should Not Absorb

- Full multi-language support in the first upgrade. CodeGraph's language matrix is valuable but too broad for CMAP's current TS-first product surface.
- A long-lived watcher or git hook installer as default behavior. CMAP should first ship explicit `source index`, `source status`, and `source sync`; watch can be opt-in later.
- Framework route extraction as a core primitive. It risks reviving route-v2-like scope. If needed, keep it as generated source evidence, not a maintained map.
- Svelte/Vue template call extraction in P0. Script-block delegation can wait until plain TS/JS is stable.
- CodeGraph's full search scoring stack. CMAP can start with exact name, qualified name, file path, and simple FTS; fuzzy and co-location boosts can come after observed misses.
- Dead-code claims as product truth. `findDeadCode` style outputs should be advisory only because static call graphs are incomplete.
- Automatic promotion from source graph to `.context/modules/*.md`. The only safe bridge is candidate evidence to inbox to human review.
- Worker-thread WASM complexity unless CMAP chooses tree-sitter. If CMAP uses TypeScript compiler APIs for the TS MVP, it can avoid much of CodeGraph's WASM memory handling.
- Broad component, XML, YAML, framework, and route node kinds in the initial schema. They expand blast radius without helping CMAP's P0 gaps.

## TypeScript Rewrite Direction For CMAP

1. Introduce a new generated source-index module.

   Proposed working module name: `source-index`. Store the index as generated state, for example under `.context/generated/source-index/`, or another clearly generated local state path. Do not put source-derived semantics into `MAP.md` or module docs.

2. Define a CMAP-native source schema.

   Minimum tables or JSONL equivalents:
   - `source_files(path, language, content_hash, size, modified_at, indexed_at, status, error_json)`
   - `source_symbols(id, kind, name, qualified_name, file_path, start_line, end_line, export_kind, signature, updated_at)`
   - `source_edges(source_id, target_id, kind, line, col, provenance, confidence)`
   - `source_unresolved_refs(from_id, ref_name, ref_kind, file_path, line, col, candidates_json)`
   - `source_metadata(key, value, updated_at)`

3. Build a TS/JS extractor first.

   Use a TS-native parser surface such as the TypeScript compiler API or a maintained ESTree parser. Implement the CodeGraph pattern, not its code: file node, declarations, imports, calls, contains edges, unresolved references, then a resolver pass. For CMAP itself, this covers `src/**/*.ts`, command handlers, tests, and module ownership queries.

4. Make indexing explicit and reproducible.

   Candidate commands:
   - `cmap source index`
   - `cmap source sync`
   - `cmap source status`
   - `cmap symbol find <query>`
   - `cmap symbol callers <symbol>`
   - `cmap symbol callees <symbol>`
   - `cmap impact file <path>`
   - `cmap impact symbol <symbol>`

5. Keep freshness visible in every query.

   Each source query should report index timestamp, stale file count, and whether returned files are stale. If stale, the command should say that source evidence is advisory and the agent should read the affected file directly.

6. Bridge to CMAP evidence and brief, not canonical facts.

   `brief` and `pack` can accept a `--with-source-evidence` option that embeds a minimal generated source evidence section. `inbox` can receive candidate relation or module-boundary notes derived from source evidence, but promotion stays human-reviewed.

7. Add impact traversal before broad semantic claims.

   Start with file import/dependent graph and symbol callers/callees. Avoid "dead code", "architecture truth", or "module ownership truth" until extraction accuracy is measured.

8. Verification-first implementation path.

   Use small fixture repos in tests: TS imports, re-exports, default exports, class methods, arrow functions, command-handler calls, deleted file sync, changed file sync, generated-file down-ranking, and stale status output. Only then connect source evidence to `brief` or Review HTML.

## CMAP Modules Affected

- New candidate module: `source-index`, owning source scan, generated source DB, freshness status, symbol query, and impact traversal.
- `cli`: add `source`, `symbol`, and `impact` command families after schema stabilizes.
- `evidence`: store source evidence and stale/source freshness reports as generated support artifacts.
- `brief`: optionally include source evidence packs for a task.
- `pack`: optionally include bounded source snippets or symbol summaries under a token budget.
- `view`: optional read-only source evidence panel, clearly labeled generated and stale-aware.
- `benchmark`: add source-intelligence A/B metrics for files read, tool calls, source context tokens, and answer quality.
- `skill`: update agent guidance to query source index before broad reading, while preserving `.context` priority.
- `verify`: later add source-index health checks, likely separate from canonical `.context` verification.
- `showcase`: planning and comparison artifacts should explain that source graph projects are advisory layers below CMAP's trust boundary.

## Risks And Verification

- Risk: static extraction can miss dynamic calls, aliasing, re-exports, runtime framework wiring, generated code, or test ownership. Mitigation: label outputs as generated evidence with confidence and unresolved refs.
- Risk: stale index causes false precision. Mitigation: source query outputs must include freshness status and stale file warnings.
- Risk: watcher complexity can introduce background behavior users do not understand. Mitigation: ship manual `source sync/status` first; make watch opt-in.
- Risk: worktree mismatch returns another branch's source facts. Mitigation: implement a worktree-root check before trusting an existing index.
- Risk: source graph facts leak into canonical `.context`. Mitigation: route source-derived changes through candidate inbox and human promotion only.
- Risk: SQLite lock contention during agent sessions. Mitigation: WAL, short busy timeout, bounded writes, and clear "index writer busy" status.
- Risk: scope creep into a full CodeGraph clone. Mitigation: TS/JS MVP, file impact, callers/callees, source evidence packs, then measure.

Suggested verification for CMAP implementation:

- Unit tests for TS/JS extraction of imports, exports, declarations, calls, contains edges, and unresolved refs.
- Integration tests for `source index`, `source sync`, add/modify/delete file behavior, and stale status.
- Query tests for symbol find, callers, callees, file dependents, and impact radius.
- Fixture tests for generated-file down-ranking and worktree mismatch warnings.
- Trust-boundary tests proving source commands write only generated state or inbox candidates, never `MAP.md` or module docs.
- CLI closeout with `cmap finish`, `cmap verify --changed`, and `git diff --check` after implementation changes.
