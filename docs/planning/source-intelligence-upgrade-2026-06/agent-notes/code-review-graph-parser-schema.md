# Code Review Graph Parser Schema Agent Note

## Research Scope

This note studies the local Code Review Graph snapshot at `research/coding-knowledge-graphs-2026-06/repos/code-review-graph` for parser, schema, storage, reference-resolution, and graph-query mechanisms relevant to the CMAP Source Intelligence Upgrade.

Local snapshot: Code Review Graph commit `0c9a5ff`, listed as MIT in the planning license snapshot. This note summarizes mechanisms only; it does not copy source.

Planning context read:

- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`
- `docs/planning/source-intelligence-upgrade-2026-06/license-and-snapshot.md`

## Source Files Inspected

Primary Code Review Graph files:

- `code_review_graph/parser.py`
- `code_review_graph/graph.py`
- `code_review_graph/search.py`
- `code_review_graph/postprocessing.py`
- `code_review_graph/enrich.py`
- `code_review_graph/tsconfig_resolver.py`
- `code_review_graph/jedi_resolver.py`
- `code_review_graph/tools/query.py`
- `docs/schema.md`

Supporting files inspected to confirm build wiring and tests:

- `code_review_graph/incremental.py`
- `code_review_graph/tools/build.py`
- `tests/test_parser.py`
- `tests/test_graph.py`
- `tests/test_search.py`
- `tests/test_tools.py`
- `tests/test_postprocessing.py`
- `tests/test_tsconfig_resolver.py`

CMAP context files read:

- `.context/MAP.md`
- `.context/CHECKPOINT.md`
- `.context/STATUS.md`
- `.context/modules/graph.md`
- `.context/modules/route.md`
- `.context/modules/context.md`
- `.context/modules/brief.md`
- `.context/modules/view.md`
- `.context/modules/evidence.md`

## Core Mechanisms

Code Review Graph represents source code as generic `NodeInfo` and `EdgeInfo` records in `parser.py`, then persists them as `GraphNode` and `GraphEdge` rows through `GraphStore` in `graph.py`.

Core node kinds from `docs/schema.md` and `parser.py::NodeInfo`:

- `File`
- `Class`
- `Function`
- `Test`
- `Type`

Core edge kinds from `docs/schema.md` and `parser.py::EdgeInfo`:

- `CALLS`
- `IMPORTS_FROM`
- `INHERITS`
- `IMPLEMENTS`
- `CONTAINS`
- `TESTED_BY`
- `DEPENDS_ON`
- `REFERENCES`
- plus specialized enrichment edges such as `INJECTS`, `CONSUMES`, `PRODUCES`, and `TEMPORAL_STUB`

Extraction starts in `CodeParser.parse_file` / `CodeParser.parse_bytes`. The parser detects language from extension or shebang, handles special containers such as Vue/Svelte script blocks and notebooks, then uses Tree-sitter grammar mappings to walk the AST with `CodeParser._extract_from_tree`.

The parser first creates a `File` node, then pre-scans file scope through `CodeParser._collect_file_scope`. That pre-scan builds:

- `import_map`: imported local names to module/import specifiers.
- `defined_names`: top-level function/class names.

Symbol extraction is split by construct:

- `CodeParser._extract_classes` emits `Class` nodes, `CONTAINS` edges from file to class, and `INHERITS` edges for base classes.
- `CodeParser._extract_functions` emits `Function` or `Test` nodes, captures params/return type where available, and emits `CONTAINS` from file/class to function.
- `CodeParser._extract_js_var_functions` handles JS/TS function-valued variables such as arrow functions assigned to `const`.
- `CodeParser._extract_js_field_function` handles JS/TS class-field arrow functions.
- `CodeParser._extract_jsx_component_call` turns JSX component usage into synthetic `CALLS` edges.
- `CodeParser._extract_value_references` emits `REFERENCES` for function-as-value patterns such as callback maps, arrays, and identifier callback arguments, but only when the identifier is a known local definition or import.

Call extraction uses `CodeParser._extract_calls` plus `CodeParser._get_call_name`. Call sources are qualified to the enclosing function when available; module-scope calls use the file node as source. Targets are resolved through `CodeParser._resolve_call_target`, which prefers same-file definitions and then imported symbols. External or unresolved calls remain as bare target names.

Import extraction uses `CodeParser._extract_imports` and `CodeParser._extract_import`. It emits `IMPORTS_FROM` from file path to either a resolved file path or the raw import target. `CodeParser._resolve_module_to_file` handles relative imports, Python dotted modules, Java-ish paths, Dart package paths, and JS/TS/Vue file probing.

TypeScript alias resolution is delegated to `TsconfigResolver` in `tsconfig_resolver.py`. It walks upward for `tsconfig.json` / `tsconfig.app.json`, parses JSONC, resolves local `extends`, reads `compilerOptions.baseUrl` and `paths`, ranks alias patterns by prefix specificity, and probes `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, and index files.

JS/TS barrel and re-export resolution is handled in `CodeParser._resolve_imported_symbol` and `CodeParser._resolve_exported_symbol`. It recursively inspects `export { Foo as Bar } from './x'` and `export * from './x'` patterns with a seen-set and cache to avoid cycles.

Same-file call resolution happens before storage through `CodeParser._resolve_call_targets`, which rewrites bare `CALLS` and `REFERENCES` targets to qualified names when a parsed same-file symbol matches. `GraphStore.resolve_bare_call_targets` also has a database-level unambiguous bare-name resolver using imports as a disambiguation hint, but the inspected build path did not show it wired into `full_build` / `build_or_update_graph`.

Python method-call enrichment exists separately in `jedi_resolver.py::enrich_jedi_calls`. It re-walks Python ASTs for dropped `receiver.method()` calls, asks Jedi to resolve definitions, and inserts additional `CALLS` edges. This is a useful pattern but appears to be a standalone optional post-build enrichment rather than the main parser path in the inspected wiring.

Storage is SQLite-backed through `GraphStore`:

- `nodes`: symbol/file rows keyed by unique `qualified_name`.
- `edges`: directed typed relationships with source, target, line, `extra`, `confidence`, and `confidence_tier`.
- `metadata`: build timestamps and schema state.
- migrations add support tables such as `nodes_fts`, `flows`, `communities`, summaries, risk index, and embeddings.

Qualified names are path-based:

- File: absolute or stored file path.
- Top-level symbol: `file_path::symbol`.
- Method: `file_path::Class.method`.

`GraphStore.store_file_nodes_edges` atomically replaces all rows for one file. `incremental.py::full_build` and `incremental.py::incremental_update` parse files, compute file hashes, remove stale rows, and call `store_file_nodes_edges`; full builds can parse in parallel while keeping SQLite writes serial.

Post-processing is a separate stage in `postprocessing.py::run_post_processing` and `tools/build.py::_run_postprocess`:

- compute compact signatures for nodes;
- rebuild the FTS5 index through `search.py::rebuild_fts_index`;
- trace flows;
- detect communities;
- optionally compute summary/risk tables in `tools/build.py::_compute_summaries`.

Hook enrichment in `enrich.py` shows the product surface: intercept search/read-like tool activity, query graph context, and add a small structural context block listing callers, callees, flows, communities, and tests.

## Query And Schema Lessons

`tools/query.py::query_graph` exposes a small fixed query vocabulary:

- `callers_of`
- `callees_of`
- `imports_of`
- `importers_of`
- `children_of`
- `tests_for`
- `inheritors_of`
- `file_summary`

Target resolution tries exact qualified name, absolute path, then name search. Ambiguous name search returns candidates and asks for a qualified name instead of guessing.

Caller/callee queries are edge-table lookups, not bespoke indexes:

- `callers_of` reads incoming `CALLS` via `GraphStore.get_edges_by_target`, then falls back to `GraphStore.search_edges_by_target_name` for bare call targets.
- `callees_of` reads outgoing `CALLS` via `GraphStore.get_edges_by_source`; unresolved bare callees are still returned as function-like result stubs.

Import queries are similarly edge-based:

- `imports_of` reads outgoing `IMPORTS_FROM`.
- `importers_of` resolves the target file path and reads incoming `IMPORTS_FROM`.

`GraphStore.get_impact_radius_sql` implements blast-radius traversal with a SQLite recursive CTE. It seeds from nodes in changed files, traverses both outgoing and incoming edges up to `max_depth`, caps output by `max_nodes`, and returns changed nodes, impacted nodes, impacted files, relevant edges, and truncation metadata. The older `GraphStore._get_impact_radius_networkx` remains as an opt-in fallback.

`search.py::hybrid_search` combines FTS5 BM25 and optional embeddings using Reciprocal Rank Fusion. If both are unavailable or empty, it falls back to keyword `LIKE`. It then applies lightweight boosts for PascalCase, snake_case, dotted qualified queries, identifier-shaped tokens, and optional context files.

Practical schema lessons for CMAP:

- Keep source nodes and edges generic. New query behavior can be added mostly by filtering edge kind and direction.
- Store call-site line numbers and preserve multiple call sites; Code Review Graph upserts edges with line as part of identity.
- Use confidence metadata on edges. Bare target fallback, same-file resolution, alias resolution, and compiler-semantic resolution should not have the same trust level.
- Keep file hashes and build metadata in the generated source index so stale answers are visible.
- Separate raw parse, post-processing, and query surfaces. Search/signatures/impact can be refreshed without pretending source graph output is reviewed memory.
- Return ambiguity explicitly. Do not silently pick a symbol when multiple matches exist.
- Treat file nodes as first-class containers and module-scope callers; this makes top-level script glue queryable.

## Capabilities CMAP Should Absorb

CMAP should absorb these ideas as CMAP-native TypeScript, generated support data:

- A generated source index with `SourceNode` and `SourceEdge` concepts similar to `NodeInfo` / `EdgeInfo`.
- TS/JS-first symbol extraction for files, functions, classes, methods, exported arrow functions, imported symbols, JSX component calls, and callback/reference patterns.
- Import and importer queries from a file-level dependency graph.
- `symbol callers` and `symbol callees` from directed `CALLS` edges.
- File impact traversal from changed files through `IMPORTS_FROM`, `CALLS`, `REFERENCES`, and maybe test edges, with max-depth and max-result caps.
- Symbol search with exact/qualified-name matching first, then ranked fuzzy/keyword fallback.
- Explicit ambiguous-result handling.
- Test relationship heuristics for `*.test.ts`, `*.spec.ts`, Vitest/Jest `test` / `it` calls, and test-to-production `CALLS`.
- Source-index status and freshness metadata based on file hashes and git state.
- Source evidence packs for `cmap brief "<task>" --with-source-evidence`, scoped to a target symbol or changed file.
- Optional Review HTML panels that show source evidence as Generated / Non-canonical.

The most valuable immediate lesson is not the polyglot breadth. It is the simple query contract over typed directed edges:

```text
- callers = incoming CALLS
- callees = outgoing CALLS
- importers = incoming IMPORTS_FROM
- imports = outgoing IMPORTS_FROM
- impact = bounded bidirectional traversal from changed file nodes
```

## Parts CMAP Should Not Absorb

CMAP should not absorb these parts in the initial source-intelligence upgrade:

- Full polyglot Tree-sitter coverage. CMAP's own proving ground is TypeScript; multi-language support should follow after the TS schema and trust boundary are stable.
- Python/Jedi semantic resolution as a CMAP dependency. It is useful for Python projects but does not belong in a TS-first MVP.
- Spring, Temporal, Kafka, ReScript, SQL, Nix, notebook, and language-specific enrichment layers.
- Always-on hook injection that automatically adds context to every grep/read. CMAP can later add optional lifecycle integration, but the first product surface should be explicit CLI output.
- Embedding search as P0. FTS/qualified-name search and deterministic AST extraction are enough to prove value and easier to verify.
- Flow/community/risk-index tables as P0. They are interesting but widen the blast radius beyond parser/schema/query.
- Treating source graph facts as canonical module relations. CMAP's reviewed module graph must stay separate from generated source evidence.
- Copying the SQLite schema wholesale. CMAP needs the same ideas, not the same schema or Python implementation.

## TypeScript Rewrite Direction For CMAP

Recommended CMAP MVP shape:

- Add one new module first: `source-intelligence`.
- Put implementation under `src/source-intelligence/**`.
- Add CLI families gradually:
  - `cmap source index`
  - `cmap source status`
  - `cmap symbol find <query>`
  - `cmap symbol callers <symbol>`
  - `cmap symbol callees <symbol>`
  - `cmap impact file <path>`

Use the TypeScript compiler API for the first implementation because `typescript` is already in the repo. A TS-first parser can use `ts.createSourceFile` and, when a project config is available, `ts.createProgram` / type checker for better symbol resolution. This avoids a new Tree-sitter dependency for the MVP.

Candidate generated schema:

- `SourceNode`
  - `id`
  - `kind`: `File | Class | Function | Method | Component | Test | Type`
  - `name`
  - `qualifiedName`
  - `filePath`
  - `lineStart`
  - `lineEnd`
  - `exported`
  - `isTest`
  - `signature`
  - `fileHash`
  - `extra`
- `SourceEdge`
  - `kind`: `CONTAINS | IMPORTS_FROM | CALLS | REFERENCES | TESTED_BY | EXPORTS`
  - `source`
  - `target`
  - `filePath`
  - `line`
  - `confidence`
  - `confidenceTier`: `parsed | resolved-local | resolved-import | typechecker | heuristic | unresolved`
  - `extra`
- `SourceIndexMeta`
  - `schemaVersion`
  - `generatedAt`
  - `repoRoot`
  - `gitHead`
  - `indexedFiles`
  - `sourceHashes`
  - `warnings`

Storage should live under a generated support path such as `.context/generated/source-index/`. Start with a storage adapter boundary so CMAP can use JSON/JSONL for small repos and later add SQLite only if benchmarks show it is needed. The public query API should not depend on the physical storage choice.

Resolution strategy:

1. Same-file symbols: qualify from local declarations.
2. Relative imports: resolve through TS module resolution.
3. `tsconfig` paths/baseUrl: use TypeScript's own module resolution rather than reimplementing JSONC/path matching by hand.
4. Barrel exports: resolve common `export { X } from` and `export * from` through the compiler graph where possible.
5. Dynamic/member calls: emit lower-confidence heuristic edges or leave as unresolved call names.
6. Ambiguous query targets: return candidate symbols; do not choose silently.

The CMAP query surface should return compact Markdown by default and structured JSON with `--json`. Every output should label source index data as generated evidence and include freshness status.

## CMAP Modules Affected

Primary new module:

- `source-intelligence`: owns source indexing, source schema, symbol queries, and impact traversal.

Existing modules affected:

- `context`: add generated source-index directory and policy language without making source evidence canonical.
- `evidence`: store source evidence/status/freshness under generated support layers and optionally route durable findings into inbox candidates.
- `brief`: add optional source evidence packs for tasks that need code coupling answers.
- `view`: optionally render source-index status, symbol evidence, impact evidence, and candidate relation suggestions as Generated / Non-canonical.
- `benchmark`: add source-intelligence fixtures for callers, callees, importers, impacted files, tests, files read, and token/tool-call reduction.
- `graph`: keep current reviewed module graph separate from source graph. It may display links to source evidence but must not become an import/call graph.
- `route`: may suggest source queries for low-confidence or source-coupling tasks, but must not use unreviewed source graph facts as direct module routing truth.
- `skill`: teach agents to run source queries before broad grep/read loops for source-level questions.
- `verify`: add source-index freshness/staleness checks once generated source metadata exists.
- `tests`: add focused parser/query/storage/impact integration coverage.

## Risks And Verification

Risks:

- Generated source edges can be wrong, stale, or incomplete.
- Bare call targets and member calls are ambiguous without compiler/type information.
- TS path aliases, project references, monorepos, generated files, and package exports can break naive import resolution.
- Absolute paths in generated indexes can leak local details into exported artifacts.
- Large repositories can make full indexing slow unless updates are incremental and capped.
- Source graph excitement can accidentally revive the paused import-graph roadmap or blur the canonical `.context` boundary.

Verification path for a future CMAP implementation:

- Unit fixtures for TS functions, classes, class methods, arrow-function exports, JSX component usage, callback references, relative imports, tsconfig aliases, barrel exports, and unresolved dynamic calls.
- Query tests for `symbol callers`, `symbol callees`, `imports`, `importers`, `file_summary`, and ambiguous symbol names.
- Impact tests for bounded traversal, max-depth, max-results, truncation, and changed-file path normalization.
- Freshness tests for file hash changes, deleted files, stale index detection, and regenerated metadata.
- Trust-boundary tests proving source index writes only under `.context/generated/source-index/**` and never edits `MAP.md`, module docs, or reviewed relations.
- Review HTML tests showing source evidence is hidden by default or clearly marked as generated support.
- Benchmark fixtures comparing source-aware brief/query flows against broad `rg` / file-read baselines.

For this research note only, verification should be limited to checking that the note exists, only the requested file changed, and Markdown has no trailing whitespace.
