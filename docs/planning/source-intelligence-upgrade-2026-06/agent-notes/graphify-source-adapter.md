# Graphify Source Adapter Agent Note

## Research Scope

This note inspects the local Graphify snapshot only:

- `research/coding-knowledge-graphs-2026-06/repos/graphify`
- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`

The goal is not to copy Graphify source. The goal is to identify mechanisms that can be translated into a CMAP-native TypeScript source-intelligence layer while preserving CMAP's current Trust Boundary + Human Review Layer direction.

## Source Files Inspected

Planning context:

- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`
- `.context/MAP.md`
- `.context/STATUS.md`
- `.context/VERIFY.md`
- `.context/modules/reconcile-adapter.md`
- `.context/modules/module-docs.md`
- `.context/modules/verify.md`

Graphify implementation and docs:

- `ARCHITECTURE.md`
- `docs/how-it-works.md`
- `README.md`
- `pyproject.toml`
- `graphify/__main__.py`
- `graphify/detect.py`
- `graphify/manifest.py`
- `graphify/cache.py`
- `graphify/extract.py`
- `graphify/symbol_resolution.py`
- `graphify/build.py`
- `graphify/validate.py`
- `graphify/affected.py`
- `graphify/analyze.py`
- `graphify/global_graph.py`
- `graphify/watch.py`
- `graphify/serve.py`
- `graphify/mcp_ingest.py`
- `graphify/scip_ingest.py`
- `graphify/ingest.py`
- `graphify/google_workspace.py`
- `graphify/transcribe.py`
- `graphify/llm.py`
- `graphify/skill.md`
- `graphify/skill-codex.md`

Tests checked for behavior contracts:

- `tests/test_pipeline.py`
- `tests/test_extract.py`
- `tests/test_symbol_resolution.py`
- `tests/test_confidence.py`
- `tests/test_affected_cli.py`
- `tests/test_analyze.py`
- `tests/test_global_graph.py`
- `tests/test_mcp_ingest.py`

## Core Mechanisms

Graphify's documented pipeline is `detect() -> extract() -> build_graph() -> cluster() -> analyze() -> report() -> export()`, with each stage passing plain extraction dicts or NetworkX graphs. The CLI's headless path in `graphify/__main__.py` command `extract` follows the same shape: detect files, run AST extraction for code via `graphify.extract.extract`, run semantic extraction for docs/papers/images via `graphify.llm.extract_corpus_parallel`, merge AST and semantic fragments, build the graph, cluster/analyze, and write `graphify-out/graph.json` plus analysis metadata.

File discovery and freshness are separate from graph building. `graphify.detect.detect` classifies code, docs, papers, images, and video, applies ignore/noise/sensitive-file filters, converts Office and Google Workspace shortcut files into Markdown sidecars when enabled, and returns a typed file list. `graphify.detect.save_manifest`, `load_manifest`, and `detect_incremental` track `ast_hash` and `semantic_hash` separately so an AST-only update does not accidentally mark semantic extraction fresh. `graphify.cache.file_hash`, `load_cached`, and `save_cached` add content-addressed caches under separate AST and semantic cache namespaces.

The source extractor is a broad tree-sitter layer. `graphify.extract.LanguageConfig` parameterizes class, function, import, call, body, and accessor node types. `_extract_generic` uses that config to emit file nodes, class/function nodes, structural edges, call edges, import edges, type references, and source locations. Language-specific extractors such as `extract_python`, `extract_js`, `extract_go`, `extract_rust`, `extract_sql`, and many others either reuse `_extract_generic` or provide custom logic.

The cross-file resolution pattern is the most useful part for CMAP. `graphify.extract._augment_symbol_resolution_edges` collects `_SymbolDeclarationFact`, `_SymbolImportFact`, `_SymbolAliasFact`, `_SymbolExportFact`, `_StarExportFact`, and `_SymbolUseFact`, then `_apply_symbol_resolution_facts` resolves imports, aliases, re-exports, heritage, type references, and top-level calls after all files have been parsed. The JavaScript/TypeScript pass handles named imports, re-export clauses, star exports, lexical aliases, top-level function bodies, and class heritage via `_collect_js_symbol_resolution_facts`. The Python pass handles `from ... import ...`, relative module paths, `__init__.py` re-exports, and top-level function calls via `_collect_python_symbol_resolution_facts`.

Graphify keeps a conservative fallback for unresolved calls. After all nodes exist, `extract.extract` builds a normalized label index, skips builtins, skips member calls, skips ambiguous duplicate labels, and emits a cross-file `calls` edge only when the callee label has exactly one candidate. If the caller's file has explicit symbol or module import evidence, the edge is promoted to `EXTRACTED`; otherwise it stays `INFERRED` with a lower score. `graphify.symbol_resolution.resolve_cross_file_raw_calls` and `resolve_python_import_guided_calls` expose the same policy in smaller testable helpers.

Graph construction is schema-first. `graphify.validate.validate_extraction` enforces required node fields, edge fields, file types, and confidence labels. `graphify.build.build_from_json` normalizes legacy shapes, relativizes source paths, remaps normalized IDs, preserves direction metadata for undirected graph rendering, drops cross-language inferred calls, and stores hyperedges on `G.graph["hyperedges"]`. `build`, `build_merge`, `prefix_graph_for_global`, and `prune_repo_from_graph` add deduplication, incremental merge, deletion pruning, and cross-repo ID prefixing.

Impact logic is intentionally simple. `graphify.affected.DEFAULT_AFFECTED_RELATIONS` includes `calls`, `references`, `imports`, `imports_from`, `re_exports`, `inherits`, `extends`, `implements`, `uses`, `mixes_in`, and `embeds`. `resolve_seed` finds a unique node by id, label, source file, or contained label. `affected_nodes` reverse-traverses incoming edges up to a bounded depth. `format_affected` turns that into a line-oriented impact report with relation and source location.

Query surfaces are graph-first. `graphify.__main__.py` exposes CLI commands `query`, `affected`, `path`, and `explain`. `graphify.serve.serve` exposes MCP tools including `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`, and PR impact helpers. `graphify.serve._query_graph_text` scores query terms, picks seed nodes, traverses BFS or DFS, applies context filters, and emits a bounded text pack.

Architecture scanning is a second layer over the graph. `graphify.analyze.god_nodes` filters synthetic file/method/json-key/concept nodes and returns high-degree real entities. `surprising_connections` ranks cross-file or cross-community edges, with `_surprise_score` combining confidence, cross-file-type, cross-directory, cross-community, and hub/leaf signals. `graph_diff` compares two graph snapshots, and `find_import_cycles` collapses to a file-level import graph to detect bounded cycles.

Graphify also indexes non-source technical surfaces. `graphify.mcp_ingest.extract_mcp_config` parses `.mcp.json`, `mcp.json`, `mcp_servers.json`, and `claude_desktop_config.json` into config, server, command, package, and env-var nodes. It never stores env var values. `graphify.scip_ingest.ingest_scip_json` converts simplified SCIP-style JSON into Graphify nodes and edges with a two-pass symbol index and external stubs for unresolved relationships.

Multimodal/document ingestion is real but mostly outside CMAP's source MVP. `graphify.ingest.ingest` fetches URLs into graph-ready files, including webpages, tweets, arXiv pages, PDFs, images, and YouTube audio. `graphify.google_workspace.convert_google_workspace_file` exports `.gdoc`, `.gsheet`, and `.gslides` shortcuts into Markdown sidecars. `graphify.transcribe.transcribe_all` creates text transcripts using faster-whisper. `graphify.llm.extract_corpus_parallel` handles semantic docs/papers/images extraction with token-budget chunking, limited concurrency, adaptive split on truncated outputs, and optional deep mode.

The skill surface is broad. `graphify/skill-codex.md` teaches agents to query `graphify-out/graph.json` before broad grep/read loops and describes a staged pipeline. `graphify/__main__.py` contains many platform installers and hook integrations. For CMAP, the lesson is the query-first guidance, not the multi-platform installer sprawl.

## Graph And Confidence Lessons

Graphify's graph schema is simple and useful: nodes carry `id`, `label`, `file_type`, `source_file`, and usually `source_location`; edges carry `source`, `target`, `relation`, `confidence`, `confidence_score`, `source_file`, `source_location`, and sometimes `context` or metadata. CMAP should keep a similarly explicit source-evidence schema rather than hiding edge provenance in prose.

The confidence model is worth absorbing, with CMAP-specific names if needed:

- `EXTRACTED`: direct source evidence, such as an import, call, inheritance clause, config reference, or SCIP relationship. Score should be `1.0`.
- `INFERRED`: conservative deduction, such as unique-label call resolution without direct import proof. Must include a score and resolver reason.
- `AMBIGUOUS`: uncertain relationship that should be visible for review but not used as a deterministic route fact.

Tests in `tests/test_confidence.py` show useful invariants: extracted edges score `1.0`, inferred scores stay in `[0, 1]`, ambiguous scores stay low, confidence scores survive graph export, and reports show confidence breakdowns. CMAP should copy these invariants as behavior, not source.

Graphify's false-positive controls are important: skip ambiguous duplicate symbol labels, skip member-call resolution without receiver evidence, skip builtins, suppress cross-language inferred call pollution, exclude rationale/concept/doc nodes from callable resolution, and keep source-file/source-location on every edge. CMAP's TS MVP should be at least this conservative.

Graphify's build path also shows what not to normalize away. Direction matters for `calls`, `imports`, `re_exports`, and impact traversal. If CMAP stores source edges, it should use a directed edge schema directly instead of needing Graphify's NetworkX `_src`/`_tgt` workaround for undirected graphs.

## Capabilities CMAP Should Absorb

CMAP should absorb the source-intelligence layer as generated evidence below the reviewed `.context` layer:

```text
source files
  -> source index / symbol graph / impact traversal
  -> generated source evidence
  -> CMAP inbox / Review HTML support panels
  -> reviewed .context memory only after promotion
```

High-fit capabilities:

- A source index manifest with separate source hash/freshness metadata, inspired by `detect.save_manifest` and `detect_incremental`.
- TS/JS import/export/re-export/alias extraction, inspired by `_collect_js_symbol_resolution_facts`, but rewritten using the TypeScript compiler API.
- `symbol callers` and `symbol callees` queries over directed `calls`, `imports`, `inherits`, `implements`, and `references` edges.
- `impact file <path>` and `impact symbol <id>` using reverse traversal like `affected_nodes`.
- A bounded source evidence pack for `brief --with-source-evidence`, inspired by `serve._query_graph_text`, but formatted as CMAP generated evidence with exact source anchors.
- A confidence and resolver-reason field on every generated edge.
- Source freshness checks in `verify --freshness` or a new `source status`.
- Optional Review HTML panels for source evidence, impact reports, and ambiguous candidates.
- A benchmark that measures file reads, tool calls, source-evidence tokens, and task answer quality against current route/brief behavior.
- A later MCP surface after CLI output schemas stabilize.

## Parts CMAP Should Not Absorb

CMAP should not absorb Graphify as a full product shape.

Avoid:

- Copying the Python/NetworkX/tree-sitter implementation into CMAP.
- Turning CMAP into a full multi-language corpus graph engine in the MVP.
- Treating generated source graph output as canonical `.context` truth.
- Recreating Graphify's multi-platform installer and global hook behavior.
- Adding multimodal ingestion, video/audio transcription, Google Workspace export, or URL fetching to the source-intelligence MVP.
- Reusing Graphify's undirected graph compatibility tricks. CMAP can design a directed source-edge store from the start.
- Using LLM semantic extraction as a default source-index path. CMAP's P0 should be deterministic TS/JS source analysis.
- Making cross-repo global graphs part of canonical project memory. Cross-repo can remain a future advisory product, never an implicit fact store.
- Letting source-derived relation candidates feed `route` or benchmarks before review.

## TypeScript Rewrite Direction For CMAP

Start with a narrow TypeScript/JavaScript indexer for CMAP's own stack.

Recommended P0 shape:

- New source index core, for example `src/source/indexer.ts`, `src/source/schema.ts`, `src/source/queries.ts`, and `src/source/impact.ts`.
- Store generated outputs under `.context/generated/source/`, not canonical `.context/modules`.
- Define `SourceNode` for files, exported symbols, local symbols, methods/functions, classes/interfaces/types, tests, and optional package/import targets.
- Define `SourceEdge` as directed, with `relation`, `confidence`, `confidence_score`, `resolver`, `source_file`, `source_location`, and optional `target_file`.
- Use TypeScript compiler API for `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`. If runtime package size is a concern, make the parser dependency explicit and keep the feature optional until accepted.
- First pass: parse files, create file and declaration nodes, collect imports, exports, re-exports, local aliases, class heritage, call expressions, and test-file markers.
- Second pass: resolve imports/exports/path aliases to files and symbols. Treat direct AST evidence as `EXTRACTED`; unresolved unique-name fallback, if enabled, must be opt-in or low-confidence.
- Third pass: produce query indexes: symbol lookup, file dependents, callers, callees, and reverse impact traversal.
- Write source status/freshness metadata with content hashes and current git HEAD when available.
- Emit task-local source evidence packs instead of auto-editing `.context`.
- Convert likely stable source relations into candidate inbox entries only when explicitly requested, similar to existing `reconcile-adapter` and `relation-candidates` behavior.

Proposed command family, aligned with the planning docs:

- `cmap source index`
- `cmap source status`
- `cmap source architecture`
- `cmap symbol find <query>`
- `cmap symbol callers <symbol>`
- `cmap symbol callees <symbol>`
- `cmap impact file <path>`
- `cmap impact symbol <symbol>`
- `cmap brief "<task>" --with-source-evidence`
- `cmap benchmark source-intelligence`

## CMAP Modules Affected

Likely new or changed modules:

- `cli`: register `source`, `symbol`, `impact`, and source-aware `brief` flags.
- `evidence`: store source index metadata, source evidence packs, and source freshness snapshots as generated support material.
- `verify`: warn on stale source indexes, unsafe source paths, malformed generated source evidence, and pending source-derived candidates.
- `brief`: include bounded source evidence when explicitly requested.
- `pack`: optionally include source evidence without changing route's reviewed-module behavior.
- `view`: render source evidence and impact panels as read-only support layers.
- `relation-candidates`: accept source-derived relation candidates, still candidate-only.
- `reconcile-adapter`: reuse candidate-store conventions for source-derived reports.
- `benchmark`: add source-token/tool-read A/B metrics.
- `skill`: teach agents to query source intelligence before broad file reads while keeping reviewed `.context` facts first.
- `hooks-doctor`: optional future source-index freshness reminder only; no canonical writes.
- `tests`: add focused fixtures for TS import/export/re-export/path-alias/call/impact behavior.

Do not touch the current English-only Review HTML/i18n boundary while adding source evidence. Source evidence panels should use the existing read-only support-layer framing.

## Risks And Verification

Main risks:

- False positives from unique-name call resolution, especially in monorepos or mixed-language repos.
- Incorrect import resolution for TS path aliases, package exports, barrel files, dynamic imports, and CJS interop.
- Source evidence accidentally being treated as reviewed module memory.
- Source index staleness after refactors, renames, deletes, or generated file changes.
- Large-repo performance and cache invalidation bugs.
- Secret leakage through source snippets, env config parsing, or generated evidence packs.
- Dependency footprint if `typescript` becomes a runtime dependency.
- Review HTML or brief growing too noisy and increasing token use instead of reducing it.

Verification path for a CMAP TS rewrite:

- Unit tests with fixtures for named imports, default imports, namespace imports, re-exports, star exports, TS path aliases, CJS `require`, dynamic imports, class inheritance, interface extension, function calls, duplicate symbol names, and ambiguous fallback skips.
- Unit tests for `SourceEdge` confidence invariants: extracted score `1.0`, inferred score in range, ambiguous visible but not routed.
- Impact tests mirroring `tests/test_affected_cli.py`: reverse traversal should find callers, importers, and re-export barrels; relation filters should narrow output.
- Freshness tests for source hash changes, deleted files, renamed files, and unchanged manifests.
- Integration tests for `cmap source index`, `cmap symbol callers`, `cmap symbol callees`, `cmap impact file`, `cmap brief --with-source-evidence`, `cmap view export --check`, and `cmap verify --freshness`.
- Safety tests that generated source evidence cannot auto-write `MAP.md`, module docs, `DECISIONS.md`, or `VERIFY.md`.
- Benchmark before/after on CMAP itself: compare file reads, tool calls, source tokens, elapsed time, and answer quality for representative coding tasks.
