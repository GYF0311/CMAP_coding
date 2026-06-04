# CodeGraphContext Infrastructure Agent Note

## Research Scope

This note inspected the local CodeGraphContext snapshot only:

`research/coding-knowledge-graphs-2026-06/repos/codegraphcontext`

The focus was infrastructure that may inform the CMAP Source Intelligence Upgrade:

- MCP server and tool definition surface.
- Indexing pipeline and graph persistence model.
- Graph backend abstraction.
- Allowed-root, read-only query, and MCP guardrails.
- Watch mode, bundle import/export, context switching, and CLI surface.
- TypeScript rewrite implications for CMAP without copying CodeGraphContext source.

Planning context was read from:

- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`

CMAP direction constraints used here: source intelligence is generated evidence, not canonical project memory; reviewed `.context` map files remain the durable fact store.

## Source Files Inspected

Primary CodeGraphContext files inspected:

- `src/codegraphcontext/server.py`: `MCPServer`, tool dispatch, context discovery/switching, disabled-tool loading, JSON-RPC loop, token truncation.
- `src/codegraphcontext/tool_definitions.py`: MCP tool manifest in `TOOLS`.
- `src/codegraphcontext/prompts.py`: agent-facing system prompt and MCP usage guidance.
- `src/codegraphcontext/api/mcp_sse.py`: MCP SDK/SSE adapter around `MCPServer`.
- `src/codegraphcontext/api/router.py`: FastAPI wrapper for MCP-style tools and index/query endpoints.
- `src/codegraphcontext/tools/handlers/indexing_handlers.py`: `add_code_to_graph`, `add_package_to_graph`, allowed-root checks.
- `src/codegraphcontext/tools/handlers/query_handlers.py`: `execute_cypher_query`, `visualize_graph_query`, read-only Cypher checks.
- `src/codegraphcontext/tools/handlers/analysis_handlers.py`: analysis wrapper functions over `CodeFinder`.
- `src/codegraphcontext/tools/handlers/watcher_handlers.py`: `watch_directory`, `unwatch_directory`, watched-path listing.
- `src/codegraphcontext/tools/graph_builder.py`: `GraphBuilder`, parser routing, schema creation, Tree-sitter/SCIP indexing entrypoints.
- `src/codegraphcontext/tools/code_finder.py`: `CodeFinder`, fuzzy find, callers/callees/importers/complexity/dead-code queries.
- `src/codegraphcontext/tools/indexing/discovery.py`: file discovery, `.cgcignore`, safe walk.
- `src/codegraphcontext/tools/indexing/pipeline.py`: Tree-sitter indexing orchestration.
- `src/codegraphcontext/tools/indexing/pre_scan.py`: import pre-scan dispatch.
- `src/codegraphcontext/tools/indexing/schema.py`: backend schema/index creation.
- `src/codegraphcontext/tools/indexing/schema_contract.py`: canonical node labels, relationships, merge keys.
- `src/codegraphcontext/tools/indexing/resolution/calls.py`: function-call resolution and confidence labels.
- `src/codegraphcontext/tools/indexing/persistence/writer.py`: `GraphWriter` persistence, update, relink, and delete operations.
- `src/codegraphcontext/core/__init__.py`: `get_database_manager` backend selection.
- `src/codegraphcontext/core/database.py`: Neo4j database manager.
- `src/codegraphcontext/core/database_kuzu.py`: KuzuDB compatibility wrapper.
- `src/codegraphcontext/core/database_ladybug.py`: LadybugDB compatibility wrapper.
- `src/codegraphcontext/core/database_falkordb.py`: FalkorDB Lite wrapper.
- `src/codegraphcontext/core/database_falkordb_remote.py`: remote FalkorDB wrapper.
- `src/codegraphcontext/core/database_nornic.py`: Nornic wrapper.
- `src/codegraphcontext/core/watcher.py`: `RepositoryEventHandler`, `CodeWatcher`, incremental reindex/relink.
- `src/codegraphcontext/core/cgc_bundle.py`: `.cgc` export/import.
- `src/codegraphcontext/core/bundle_registry.py`: remote bundle registry client.
- `src/codegraphcontext/cli/main.py`: Typer CLI command groups and aliases.
- `src/codegraphcontext/cli/cli_helpers.py`: CLI service initialization, index/watch/query helpers.
- `src/codegraphcontext/cli/config_manager.py`: config defaults, context resolution, workspace mapping.

Supporting docs and tests inspected:

- `ARCHITECTURE.md`
- `docs/MCP_TOOLS.md`
- `docs/CLI_COMPLETE_REFERENCE.md`
- `docs/BUNDLE_ARCHITECTURE.md`
- `docs/ON_DEMAND_BUNDLES.md`
- `tests/unit/tools/test_cwe22_path_traversal.py`
- `tests/unit/tools/test_cypher_query_readonly.py`
- `tests/unit/core/test_watcher_cgcignore.py`
- `tests/integration/mcp/test_mcp_server.py`
- `tests/integration/cli/test_cli_commands.py`
- `tests/e2e/test_verify_databases_parity.py`

## Core Mechanisms

### MCP server and tools

CodeGraphContext uses a static tool manifest in `src/codegraphcontext/tool_definitions.py` (`TOOLS`). The manifest groups tools into context discovery/switching, indexing, repository management, search, analysis, raw query/visualization, watching, job status, bundle loading, and Java/Spring/data-source analysis.

`src/codegraphcontext/server.py` centralizes runtime behavior in `MCPServer`:

- `MCPServer.__init__` resolves the active context, creates a database manager, job manager, `GraphBuilder`, `CodeFinder`, and `CodeWatcher`.
- `_init_tools` maps tool names to handler methods.
- `_load_disabled_tools` reads project `mcp.json` and supports `disabledTools`.
- `handle_tool_call` dispatches calls through a tool map and runs synchronous handlers through `asyncio.to_thread`.
- `run` implements a JSON-RPC stdin/stdout loop for `initialize`, `tools/list`, `tools/call`, and initialized notifications.
- `_apply_response_token_limit` truncates oversized tool responses according to `MAX_TOOL_RESPONSE_TOKENS`.
- `_strip_workspace_prefix` normalizes `/workspace/` prefixes in response paths.

The useful pattern for CMAP is not the large tool count. It is the separation between tool manifest, guarded handlers, and an entrypoint adapter that can expose the same capability through MCP, HTTP, or CLI.

### Context switching

CodeGraphContext has explicit project contexts. `src/codegraphcontext/cli/config_manager.py` defines `ResolvedContext`, `DEFAULT_CONFIG`, `resolve_context`, child context discovery, and workspace mappings. `MCPServer.switch_context_tool` switches to another `.codegraphcontext` or named/global context, reconnects the database manager, and rebuilds `GraphBuilder`, `CodeFinder`, and `CodeWatcher`.

This maps to CMAP only as an entrypoint lesson. CMAP should keep one project root and one `.context` authority per worktree. It may need source-index profiles later, but should avoid a second maintained fact store.

### Indexing pipeline

`src/codegraphcontext/tools/graph_builder.py` acts as the facade for indexing. `GraphBuilder` maps file extensions to language parsers, handles generic file nodes for non-code support files, creates schema, parses files, and chooses Tree-sitter or optional SCIP indexing.

The Tree-sitter path is orchestrated in `src/codegraphcontext/tools/indexing/pipeline.py`:

- Add a Repository node through `GraphWriter.add_repository_to_graph`.
- Discover files through `discover_files_to_index` in `tools/indexing/discovery.py`.
- Pre-scan imports through `pre_scan_imports` in `tools/indexing/pre_scan.py`.
- Parse files concurrently and persist each parsed file through `GraphWriter.add_file_to_graph`.
- Post-process inheritance, function-call groups, C++ class links, Spring injection/endpoints, build-system links, ORM/data-source edges, and optional vector/inheritance re-resolution.
- Complete or fail the job through the job manager.

`src/codegraphcontext/tools/indexing/resolution/calls.py` is especially relevant: resolved edges carry resolution confidence such as extracted/inferred/ambiguous. CMAP should preserve that idea for generated source evidence.

### Graph schema and persistence

`src/codegraphcontext/tools/indexing/schema_contract.py` defines the semantic contract: node labels such as Repository, Directory, File, Function, Class, Interface, Variable, Module, and build/data-source entities; relationship types such as CONTAINS, CALLS, IMPORTS, INHERITS, IMPLEMENTS, READS, WRITES, and MODULE_DEPENDS_ON.

`src/codegraphcontext/tools/indexing/schema.py` materializes schema/indexes per backend. `src/codegraphcontext/tools/indexing/persistence/writer.py` centralizes writes in `GraphWriter`, including repository metadata, file/directory/code nodes, import edges, call edges, inheritance edges, incremental file deletion, caller-neighbor lookup, and relinking support.

For CMAP, the important split is:

- A source index can be regenerated.
- A source evidence report can support review.
- Reviewed `.context` module docs remain the only canonical module/dependency map.

### Query engine

`src/codegraphcontext/tools/code_finder.py` implements the query side in `CodeFinder`. It supports fuzzy name lookup, related-code lookup, callers, callees, transitive callers/callees, importers, variable modifiers, class hierarchy, overrides, dead code, call chains, module dependencies, variable scope, and complexity queries.

Handler wrappers in `src/codegraphcontext/tools/handlers/analysis_handlers.py` enforce result limits and adapt MCP arguments to `CodeFinder`. This is the better pattern for CMAP than exposing raw graph queries: a small curated query API is easier to guard, test, and explain.

### Graph backends

Backend selection lives in `src/codegraphcontext/core/__init__.py` (`get_database_manager`). The implementation supports multiple backends: FalkorDB Lite, remote FalkorDB, KuzuDB, Neo4j, LadybugDB, and Nornic.

Each backend wrapper tries to provide a Neo4j-like session/driver shape. Examples:

- `src/codegraphcontext/core/database.py`: Neo4j manager.
- `src/codegraphcontext/core/database_kuzu.py`: KuzuDB wrapper that translates Cypher-like queries and tolerates Neo4j session kwargs such as `default_access_mode`.
- `src/codegraphcontext/core/database_falkordb.py`: FalkorDB Lite process/socket wrapper.
- `src/codegraphcontext/core/database_ladybug.py`: LadybugDB wrapper.

`tests/e2e/test_verify_databases_parity.py` compares indexing counts across backends. CMAP should not import this complexity. The relevant lesson is to define one storage contract and test query parity across CLI/MCP adapters, not across graph databases.

### Watch and incremental update

`src/codegraphcontext/core/watcher.py` provides `CodeWatcher` and `RepositoryEventHandler`.

The watcher:

- Loads `.cgcignore`.
- Debounces file events.
- Updates the import map for modified files.
- Finds affected caller and inheritance neighbors before deleting stale edges.
- Reindexes the changed file.
- Reparses affected files and relinks calls/inheritance.
- Handles create, modify, delete, and move events.

`src/codegraphcontext/tools/handlers/watcher_handlers.py` exposes watch/unwatch tools. The CMAP-relevant lesson is incremental invalidation by affected neighbors, not always full reindex. Watch mode should be opt-in for CMAP because background file watching can blur trust and freshness boundaries.

### Bundles

`src/codegraphcontext/core/cgc_bundle.py` exports/imports `.cgc` bundles containing metadata, schema, nodes, edges, stats, and a README. `import_from_bundle` validates bundle structure and guards against Zip Slip by resolving extracted paths under a temporary directory.

`src/codegraphcontext/core/bundle_registry.py` can fetch a remote manifest and download bundles. The docs in `docs/BUNDLE_ARCHITECTURE.md` and `docs/ON_DEMAND_BUNDLES.md` frame bundles as prebuilt graph snapshots.

CMAP may later borrow local snapshot/cache ideas, but should not absorb the public registry or on-demand remote bundle workflow into the current source-intelligence MVP.

### CLI surface

`src/codegraphcontext/cli/main.py` exposes a broad Typer CLI. `docs/CLI_COMPLETE_REFERENCE.md` lists command groups for MCP setup/start/tools, context management, config/db, bundle/registry, doctor, index, clean, stats, SCIP setup, delete, report, visualize, list, add-package, watch, find, analyze, and raw query.

CLI helpers in `src/codegraphcontext/cli/cli_helpers.py` initialize services and implement index/watch/query flows. For CMAP, the surface should be much smaller and should share implementation with MCP handlers from day one.

## MCP And Guardrail Lessons

Useful guardrails to absorb:

- Allowed-root checks. `indexing_handlers._get_allowed_roots` allows the current working directory and explicit `CGC_ALLOWED_ROOTS`; `_is_path_allowed` rejects resolved paths outside those roots. `tests/unit/tools/test_cwe22_path_traversal.py` covers absolute escape, relative traversal, home-directory secrets, symlink escape, and environment allowlists.
- Read-only raw query checks. `query_handlers.execute_cypher_query` strips string literals, blocks write keywords/patterns, uses `session(default_access_mode="READ")`, and limits result count. `tests/unit/tools/test_cypher_query_readonly.py` covers dangerous constructs and false positives.
- Tool disablement. `MCPServer._load_disabled_tools` lets a project `mcp.json` hide or block named MCP tools. Integration tests cover disabled tools in `tests/integration/mcp/test_mcp_server.py`.
- Response caps. `MCPServer._apply_response_token_limit` prevents oversized MCP tool responses from flooding the agent context.
- Async jobs. Indexing returns job IDs through `add_code_to_graph`, with `check_job_status` and `list_jobs` for long-running work.
- Ignore files. `.cgcignore` and safe directory walking in `tools/indexing/discovery.py` and `core/watcher.py` keep indexing scoped.

Guardrail gaps CMAP should avoid:

- Do not implement separate guard logic per adapter. In CodeGraphContext, MCP indexing/query handlers are more guarded than parts of the CLI helper path. CMAP should define shared `guards` and call them from CLI, MCP, and any future HTTP adapter.
- Do not expose raw graph query as the default power feature. Curated read-only tools are easier to test and safer for review workflows.
- Do not let external package indexing expand trust boundaries implicitly. Extra roots should be explicit and visible in output metadata.
- Do not let write-capable graph operations hide behind neutral wording. Repository deletion, bundle import with clearing, and background watchers should be classified as higher-risk operations.

## Capabilities CMAP Should Absorb

- A small generated source index for the current project, stored under a generated area such as `.context/generated/source-index/`.
- TS/JS source discovery with ignore handling, path normalization, and explicit project-root containment.
- Symbol and import extraction for the MVP: files, exported symbols, functions/classes/interfaces/types where practical, import edges, and simple caller/callee evidence.
- File impact traversal: "this file imports", "files importing this file", and bounded dependent walks.
- Query commands aligned with the gap list: `cmap source index`, `cmap source status`, `cmap symbol find`, `cmap symbol callers`, `cmap symbol callees`, and `cmap impact file`.
- Source evidence reports that include source index version, repo root, git commit, file hashes or mtimes, extraction confidence, and stale/fresh status.
- Source-aware task briefs as generated evidence, not canonical route facts.
- MCP exposure only after the CLI/query core is stable, using the same handlers and guards.
- Optional local snapshot/export later for reproducible reviews.
- Confidence labels for inferred edges, following the spirit of `resolution/calls.py`.

## Parts CMAP Should Not Absorb

- Multi-backend graph database abstraction. It is impressive but too heavy for CMAP's trust-boundary roadmap.
- Public bundle registry, HuggingFace-hosted manifests, and on-demand bundle CI.
- Broad multi-language parser coverage in the first pass.
- SCIP installation/setup as an MVP requirement.
- Java/Spring/MyBatis/data-source-specific analyzers.
- Raw Cypher or graph query as a primary user feature.
- Website, VS Code extension, and visualization product layers.
- A second context system parallel to `.context`.
- Automatic promotion from source graph to `.context/MAP.md` or `.context/modules/*.md`.
- Always-on watcher/daemon behavior by default.

## TypeScript Rewrite Direction For CMAP

Recommended TypeScript shape:

- `source/guards`: shared path, root, symlink, ignore, and query-safety guards used by every adapter.
- `source/discovery`: project-root bounded file discovery with `.gitignore` plus CMAP-specific ignore support.
- `source/indexer`: TypeScript/JavaScript extraction using the TypeScript compiler API or `ts-morph` if the dependency is accepted later.
- `source/schema`: small typed schema for SourceFile, SourceSymbol, ImportEdge, CallEvidence, and IndexMetadata.
- `source/store`: generated source-index persistence, preferably a simple local store first; avoid graph DB infrastructure.
- `source/queries`: curated read-only query functions for symbol find, importers, callers/callees, and file impact.
- `source/evidence`: Markdown/JSON evidence emitters for briefs, review HTML, and agent notes.
- `source/freshness`: git commit, index timestamp, dirty-worktree status, file hash/mtime checks.
- `source/mcp`: thin MCP adapter later, calling the same query handlers as CLI.

Command direction:

- Start with `cmap source index` and `cmap source status`.
- Add `cmap symbol find`, `cmap symbol callers`, `cmap symbol callees`.
- Add `cmap impact file` before broader architecture scans.
- Add `cmap brief --with-source-evidence` only after source evidence has freshness metadata and clear generated/non-canonical labeling.

Data boundary:

- Source index output is generated and disposable.
- Source evidence can enter inbox/review surfaces.
- Only human-reviewed updates can change canonical CMAP docs.

## CMAP Modules Affected

- `cli`: new source commands and shared adapter registration.
- `graph`: do not overload the existing reviewed project map graph; add a separate generated source-index concept or a new module if implementation begins.
- `route`: should not treat generated import/call edges as canonical route facts. It may optionally display source evidence as supporting context.
- `brief`: likely first consumer of bounded source evidence.
- `pack`: can include generated source evidence with strict labels and budgets.
- `evidence`: natural home for source evidence reports, freshness metadata, and promotion workflow.
- `view`: review HTML can show source evidence panels, but should not perform semantic analysis itself.
- `verify`: should check source-index freshness, changed-file coverage, and generated/canonical boundary violations.
- `hooks-doctor`: can surface missing source index, stale index, or unsupported dependency warnings.
- `skill`: update agent guidance only after commands and guardrails exist.

## Risks And Verification

Risks:

- Generated source graph becomes mistaken for canonical CMAP memory.
- Stale source index produces misleading impact evidence.
- Path traversal or symlink escape causes indexing outside the project.
- MCP and CLI drift because they call different guard/query implementations.
- Raw query escape creates write or data-exfiltration risk.
- TypeScript symbol resolution becomes overconfident around re-exports, barrel files, aliases, dynamic imports, and generated files.
- Large repos make source evidence too noisy or too slow.
- New dependencies make install and verification less predictable.

Verification needed for CMAP implementation:

- Unit tests for project-root containment, symlink escape, relative traversal, home-directory paths, explicit allowlists, and ignored paths.
- Fixture tests for TS/JS imports, re-exports, default/named imports, namespace imports, dynamic imports, path aliases, circular imports, and barrel files.
- Impact traversal tests with bounded depth and deterministic ordering.
- Freshness tests for changed files, deleted files, dirty worktree, and git commit mismatch.
- CLI/MCP parity tests proving both adapters call the same handlers.
- Output labeling tests proving generated source evidence cannot be mistaken for canonical `.context` facts.
- Review HTML tests proving it renders existing source evidence only and performs no new semantic analysis.
- Standard project verification after implementation: `git diff --check`, targeted source-intelligence tests, `cmap finish`, and `cmap verify --changed`.
