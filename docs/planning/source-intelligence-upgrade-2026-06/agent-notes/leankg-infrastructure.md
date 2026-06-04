# LeanKG Infrastructure Agent Note
## Research Scope

Local snapshot only:

- LeanKG: `research/coding-knowledge-graphs-2026-06/repos/leankg`
- Planning context: `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- Planning context: `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`
- Planning context: `docs/planning/source-intelligence-upgrade-2026-06/license-and-snapshot.md`

This note focuses on LeanKG infrastructure mechanisms: graph storage, query/index/update behavior, MCP/API/Web surfaces, metrics/cache design, plugin/skill packaging, hooks, benchmark design, and Obsidian-style integration. It summarizes implementation patterns and CMAP fit only. It does not copy LeanKG source and does not propose copying source into CMAP.

CMAP planning boundary: source intelligence should remain generated evidence or candidate input until human review promotes it. It must not become canonical `.context` truth by itself.

## Source Files Inspected

Planning files:

- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`
- `docs/planning/source-intelligence-upgrade-2026-06/license-and-snapshot.md`

LeanKG license and product docs:

- `Cargo.toml`
- `LICENSE`
- `README.md`
- `docs/architecture.md`
- `docs/design/hld-leankg.md`
- `docs/design/disk-cache-persistence.md`
- `docs/cli-reference.md`
- `docs/mcp-tools.md`
- `docs/metrics.md`
- `docs/benchmark.md`
- `benchmark/README.md`
- `benchmark/prompts/navigation.yaml`
- `benchmark/prompts/impact.yaml`
- `benchmark/results/impact-db-change-comparison.md`

LeanKG implementation files:

- `src/db/models.rs`: `RelationshipType`, `CodeElement`, `Relationship`, `ContextMetric`, `MetricsSummary`.
- `src/db/schema.rs`: `init_db`, `resolve_storage_config`, `central_project_storage_path`, `init_schema`.
- `src/db/mod.rs`: `create_business_logic`, `record_metric`, `get_metrics_summary`, metric cleanup/reset helpers.
- `src/db/keys.rs`: `ApiKeyStore` and API-key database.
- `src/graph/query.rs`: `GraphEngine`, `find_element`, `get_dependencies`, `get_dependents`, `search_by_name`, `insert_elements`, `insert_relationships`, `remove_elements_by_file`, `get_callers`, `get_call_graph_bounded`.
- `src/graph/traversal.rs`: `ImpactAnalyzer`, `calculate_impact_radius_with_confidence`.
- `src/graph/cache.rs`: `TimedCache`, `QueryCache`.
- `src/graph/persistent_cache.rs`: `PersistentCache`.
- `src/indexer/mod.rs`: `find_files_sync`, `index_files_parallel`, `reindex_file_sync`, `incremental_index_sync`, `resolve_call_edges_inline`.
- `src/indexer/parser.rs`: `ParserManager`.
- `src/indexer/extractor.rs`: `EntityExtractor`, `is_test_file`, `is_noise_call`, `get_tested_file_path`.
- `src/indexer/call_graph.rs`: `CallGraphBuilder`, `CallInfo`.
- `src/mcp/tools.rs`: `ToolRegistry`.
- `src/mcp/handler.rs`: `ToolHandler`, `execute_tool`, `ctx_read`, `orchestrate_tool`.
- `src/mcp/server.rs`: `MCPServer`, stdio/http serving, project routing, auto-init, auto-index, write locking.
- `src/mcp/token_budget.rs`: `TokenBudget`.
- `src/mcp/tracker.rs`: `WriteTracker`.
- `src/api/mod.rs`, `src/api/handlers.rs`: Axum REST API.
- `src/web/mod.rs`, `src/web/handlers.rs`: embedded Web UI and Web API routes.
- `src/orchestrator/mod.rs`, `src/orchestrator/intent.rs`, `src/orchestrator/cache.rs`: natural-language query routing and cache.
- `src/compress/reader.rs`: `FileReader` and compressed read modes.
- `src/config/project.rs`, `leankg.yaml`: project config and MCP auto-index settings.
- `src/mcp/watcher.rs`, `src/watcher/mod.rs`: file watcher and incremental reindex triggers.
- `src/obsidian/mod.rs`, `src/obsidian/note_generator.rs`, `src/obsidian/sync.rs`.
- `docs/plans/leankg-obsidian-integration_2026-04-10.plan.md`.
- `.claude-plugin/plugin.json`, `.claude-plugin/INSTALL.md`, `.claude-plugin/hooks/hooks.json`, `.claude-plugin/hooks/leankg-pretooluse.mjs`, `.claude-plugin/hooks/leankg-posttooluse.mjs`.
- `.cursor-plugin/plugin.json`, `.cursor-plugin/rules/leankg-rule.mdc`.
- `.opencode/plugins/leankg.js`.
- `.codex/INSTALL.md`.
- `leankg-bootstrap.md`, `instructions/leankg-tools.md`.
- `tests/mcp_tools_full_tests.rs`, `tests/graph_query_tests.rs`, `tests/graph_cache_tests.rs`, `benches/orchestrator_bench.rs`.

## License Boundary

LeanKG has conflicting local license signals. `Cargo.toml` declares `license = "Apache-2.0"` and `LICENSE` contains Apache License 2.0. `README.md` advertises MIT in the badge and license section, and some plugin manifests also carry MIT metadata. This note follows the planning rule and treats LeanKG as Apache-2.0/design reference only.

CMAP should not copy LeanKG source, schema strings, hook scripts, plugin text, or UI code. Useful mechanisms should be independently rewritten in TypeScript with CMAP naming, CMAP storage boundaries, and CMAP tests.

## Core Mechanisms

1. Graph storage is Cozo-backed, not a plain file index.

   `src/db/schema.rs::init_db` creates a Cozo database. Default storage is SQLite under `.leankg/leankg.db`; `LEANKG_DB_ENGINE=rocksdb` switches to a RocksDB backend, with `central_project_storage_path` hashing the project path under `~/.leankg-rocksdb/projects`. `Cargo.toml` patches Cozo locally and enables `storage-rocksdb`.

2. The canonical graph schema is element/relationship centered.

   `CodeElement` stores qualified name, element type, name, file path, line range, language, optional parent, cluster metadata, JSON metadata, and env. `Relationship` stores source, target, relationship type, confidence, metadata, and env. `RelationshipType` includes generic code edges (`imports`, `calls`, `tested_by`, `contains`, `defines`) plus Android, service, incident, and environment edges.

3. The database also stores support layers beside the graph.

   `init_schema` creates `business_logic`, `context_metrics`, `query_cache`, `service_metadata`, `teams`, `team_invites`, `knowledge_entries`, `incidents`, and migrations. This is a full product database, not just source intelligence. CMAP should not merge this breadth into `.context`.

4. Indexing is polyglot and extractor-heavy.

   `src/indexer/parser.rs::ParserManager` initializes tree-sitter parsers for Go, TypeScript/JavaScript, Python, Rust, Java, Kotlin, Bash, Ruby, PHP, Perl, R, and Elixir. `src/indexer/mod.rs::find_files_sync` scans source/config/XML/CICD files with default ignored dirs. `extract_elements_for_file` delegates to Terraform, CI/CD, config, Gradle/Maven, XML/Android, and tree-sitter extractors.

5. Batch indexing is parallel parse plus batched DB writes.

   `index_files_parallel` parses files with Rayon, generates physical folder/file structure, detects execution flows, detects frameworks, resolves call edges, extracts microservice relationships, then inserts elements and relationships in chunks. `GraphEngine::insert_elements` and `insert_relationships` batch data through Cozo `:put` operations and invalidate affected query caches.

6. Incremental indexing is git-change based plus dependent reindexing.

   `incremental_index_sync` uses `GitAnalyzer` to collect modified/added/deleted/untracked files, removes deleted-file rows, finds dependents from existing relationships, and reindexes changed plus dependent files. `reindex_file_sync` removes elements and source relationships for one file before parsing it again.

7. Query behavior is graph-engine first.

   `GraphEngine` exposes search and traversal-style primitives: exact and name-based element lookup, file dependencies, dependents, paginated graph loading, folder children, annotations, traceability, oversized functions, typed search, callers, bounded call graph, service graph, incidents, and environment conflict queries. `get_callers` finds incoming `calls`; `get_call_graph_bounded` walks outgoing `calls` with max depth and max results.

8. Impact analysis is bounded BFS over dependencies and dependents.

   `src/graph/traversal.rs::ImpactAnalyzer.calculate_impact_radius_with_confidence` walks both outgoing relationships and reverse dependents up to depth, filters by confidence, deduplicates targets, and assigns severity from relationship confidence and depth. This is directly relevant to CMAP's planned `impact file` / `impact symbol` capability, but should be rewritten with a narrower TS source-edge model.

9. Caching is layered.

   `src/graph/cache.rs::QueryCache` keeps TTL-bound in-memory caches for dependencies, dependents, and search. `src/graph/persistent_cache.rs::PersistentCache` persists JSON values in the `query_cache` Cozo table with TTL, max entry guard, and DB eviction. `QueryOrchestrator` adds a separate orchestration cache using `orch:` keys.

10. Query orchestration maps natural language to tools.

   `src/orchestrator/intent.rs::IntentParser` classifies simple intent keywords into `context`, `impact`, `dependencies`, `search`, `doc`, `test`, and `traceability`. `QueryOrchestrator.orchestrate` resolves target files, checks cache, executes the selected graph/file-read path, and returns token/savings metadata. This is useful as a later convenience layer, but CMAP should first stabilize explicit CLI query contracts.

11. MCP is the main AI-agent surface.

   `src/mcp/tools.rs::ToolRegistry` defines a large tool set: init/index/status/impact; file, dependency, caller/callee, call graph, context, compressed read, search, annotations, docs, clusters, raw query, navigation, service graph, knowledge, environment, incident, ontology, and wake-up tools. `ToolHandler.execute_tool` dispatches by tool name, applies `TokenBudget`, counts response elements, and records `ContextMetric`.

12. MCP server supports stdio, HTTP, auth, project routing, auto-init, and auto-index.

   `src/mcp/server.rs::MCPServer` serves stdio via `rmcp` and HTTP via Axum `/mcp` and `/mcp/stream`. It caches `GraphEngine` per project DB, routes HTTP requests by `?project=`, can auto-init missing `.leankg`, can auto-index stale projects by git commit time versus DB mtime, can trigger reindex after external writes, and serializes write/index operations through `write_lock`.

13. REST API and Web UI are separate surfaces.

   `src/api/mod.rs` exposes `/health`, `/api/v1/status`, `/api/v1/search`, and v2 service/incident/environment endpoints. `src/web/mod.rs` serves an embedded UI with `/api/elements`, `/api/relationships`, `/api/graph/data`, graph expansion, project switching, index status, export, team, service, and file endpoints. This is broader than CMAP's current Review HTML support-layer role.

14. Metrics are first-class but not fully reliable as proof.

   `ContextMetric` records tool name, timestamps, project path, input/output tokens, output elements, execution time, baseline tokens/lines, tokens saved, savings percent, correctness/F1, query pattern/file/depth, success, and deletion status. `docs/metrics.md` frames this as token-savings evidence. `docs/benchmark.md` and `benchmark/README.md` also preserve negative evidence: one A/B batch had +41,048 token overhead and LeanKG won F1 on only 2/7 tasks.

15. Benchmarking is agent-run A/B, not just unit tests.

   `src/benchmark/runner.rs::BenchmarkRunner` switches Kilo MCP config with and without LeanKG, runs prompts, parses token stats, extracts referenced file paths, and writes comparisons. `src/benchmark/context_parser.rs::QualityMetrics` computes precision, recall, F1, missing files, and incorrect files against `expected_files` in YAML prompts. This is a good evaluation shape for CMAP source intelligence.

16. Plugin packaging is aggressive and multi-host.

   LeanKG includes `.claude-plugin`, `.cursor-plugin`, `.opencode`, `.codex`, `.google-antigravity`, `.kilo`, and Gemini/OpenCode config files. The shared product message is "LeanKG first, grep fallback": host instructions and plugin hooks push agents to query MCP before raw grep/read. CMAP should absorb the query-before-broad-reading guidance, not the mandatory blocking tone or multi-platform sprawl.

17. Hooks enforce and measure tool usage.

   `.claude-plugin/hooks/leankg-pretooluse.mjs` denies Bash raw search commands when LeanKG appears ready and suggests MCP alternatives. `.claude-plugin/hooks/leankg-posttooluse.mjs` appends usage JSONL under `~/.cache/leankg-hooks`. Root `hooks/hooks.json` describes a fuller lifecycle: Setup, SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop. CMAP already has trust-boundary hook discipline; source intelligence should remain opt-in or advisory at first.

18. Obsidian integration exists, but LeanKG treats CozoDB as source of truth.

   `src/obsidian/note_generator.rs::NoteGenerator` writes Markdown notes with `leankg_*` frontmatter and wikilinks. `src/obsidian/sync.rs::SyncEngine` pushes graph data to a managed vault, pulls only annotation edits back, and reports conflicts. The plan file states `.leankg/obsidian/vault/` is LeanKG-managed and CozoDB remains source of truth. CMAP's equivalent must keep `.context` canonical and any Obsidian/HTML/source panels as view/support layers only.

## Metrics And Tooling Lessons

- Keep metrics honest. LeanKG has token-savings fields, but its own benchmark docs record a token-overhead result. CMAP should report both wins and losses: files read, tool calls, source-evidence tokens, elapsed time, precision/recall/F1, and human correctness notes.
- Store query metrics as generated evidence, not canonical facts. LeanKG puts `context_metrics` in the same Cozo product DB; CMAP should keep source-intelligence metrics under `.context/generated/**` or another clearly generated store.
- Add a source benchmark before making product claims. LeanKG's `expected_files` + parsed file references + F1 is a practical baseline. CMAP can adapt this to `cmap benchmark source-intelligence`.
- Prefer bounded query outputs. LeanKG repeatedly caps depth and results (`get_impact_radius`, `get_call_graph`, `TokenBudget`). CMAP should make depth/result/token caps visible in CLI JSON and text.
- Track cache freshness with source provenance. LeanKG's query cache is TTL-based and invalidated by file reindex events. CMAP should also include content hashes/git HEAD/stale file counts so cache hits never look like reviewed truth.
- Make negative freshness visible. A source query that touches stale or missing index entries should return a warning and recommend direct source inspection.
- Separate convenience orchestration from core tools. Natural-language `orchestrate` is useful after primitives stabilize; CMAP's MVP should test explicit `source`, `symbol`, and `impact` commands first.

## Capabilities CMAP Should Absorb

- A generated source graph store below the `.context` trust boundary.
- A narrow TS/JS source index for CMAP's native stack before any polyglot ambition.
- Typed source nodes for files, functions, classes, methods, exported constants, tests, and import/package targets.
- Typed source edges for `contains`, `imports`, `calls`, `references`, `tested_by`, `exports`, `extends`, and `implements`.
- Confidence and provenance on every source edge, inspired by LeanKG's relationship confidence and metadata fields.
- Bounded `symbol callers`, `symbol callees`, `impact file`, and `impact symbol` queries.
- Explicit source freshness metadata: content hash, mtime, git HEAD, indexed time, stale reason, extraction errors.
- A source-aware brief option that inserts a small generated source evidence pack without changing route's reviewed-module behavior.
- A Review HTML support panel for source evidence, clearly labeled generated/non-canonical/stale-aware.
- Query metrics for source-intelligence use: files avoided or read, source tokens, output tokens, elapsed time, stale warnings, success, and later precision/recall/F1.
- Optional MCP surface only after CLI schemas are stable.
- Agent guidance that says "query source index before broad reads", while still saying reviewed `.context` facts outrank generated source evidence.

## Parts CMAP Should Not Absorb

- Cozo/RocksDB as a mandatory storage dependency for the MVP. CMAP can start with a small TS-native generated store, likely SQLite or JSONL-backed, and only grow if query performance proves it necessary.
- LeanKG's full schema breadth: teams, invites, incidents, service metadata, knowledge entries, env conflicts, API keys, and business annotations.
- Full polyglot tree-sitter extraction in the first upgrade. TS/JS is the right proving ground.
- Automatic source graph promotion into `.context/MAP.md` or module docs.
- Always-on hooks that deny grep/rg. CMAP can warn or suggest source queries, but blocking raw search would be too intrusive during early source-index accuracy work.
- LeanKG's broad MCP tool catalog. CMAP should expose a smaller command family first.
- Embedded Web UI as a product control plane. CMAP's current Review HTML should stay read-only and support-layer oriented.
- Obsidian as a write-back source graph IDE. CMAP's Obsidian adapter should remain a view/export path unless a separate reviewed workflow changes that.
- Natural-language intent routing as a P0 feature. It risks hiding ambiguity before the source graph is accurate.
- Token-saving claims without benchmark proof.

## TypeScript Rewrite Direction For CMAP

1. Add a narrow generated source-intelligence module.

   Candidate module name: `source-intelligence` or `source-index`. Implementation can live under `src/source-intelligence/**`. Generated state should live under `.context/generated/source-intelligence/**` or a similarly explicit generated path.

2. Define a CMAP-native source schema.

   Minimum entities:

   - `SourceFile`: path, language, hash, size, modifiedAt, indexedAt, gitHead, status, error.
   - `SourceSymbol`: id, kind, name, qualifiedName, filePath, startLine, endLine, exported, signature, isTest, metadata.
   - `SourceEdge`: sourceId, targetId or unresolvedTarget, kind, sourceFile, line, column, confidence, provenance, resolver.
   - `SourceIndexMeta`: projectRoot, indexVersion, createdAt, updatedAt, staleFiles, extractionErrors.
   - `SourceQueryMetric`: command, query, input/output/source tokens, elapsedMs, resultCount, staleWarning, success.

3. Use TypeScript-native parsing first.

   Use the TypeScript compiler API for `.ts`, `.tsx`, `.js`, and `.jsx`. First pass creates file/symbol/import/call facts. Second pass resolves imports, re-exports, path aliases, local calls, and test relationships. Unresolved references should remain visible instead of being silently dropped.

4. Keep command scope small.

   Candidate P0/P1 commands:

   - `cmap source index`
   - `cmap source status`
   - `cmap symbol find <query>`
   - `cmap symbol callers <symbol>`
   - `cmap symbol callees <symbol>`
   - `cmap impact file <path>`
   - `cmap impact symbol <symbol>`
   - `cmap brief "<task>" --with-source-evidence`
   - `cmap benchmark source-intelligence`

5. Make every source answer stale-aware.

   Each query should include index version, indexed time, stale count, and whether any returned path is stale. Stale answers should be useful but visibly advisory.

6. Bridge into CMAP through evidence and inbox.

   Source intelligence may write generated evidence packs and candidate relation/module-boundary notes. It must not directly write `MAP.md`, `DECISIONS.md`, `VERIFY.md`, or `.context/modules/*.md`.

7. Defer MCP and hooks.

   After CLI output schemas and tests are stable, add an MCP surface mirroring the same commands. Hook guidance can later suggest source queries before broad reads, but should not block `rg` during MVP.

## CMAP Modules Affected

- New module: `source-intelligence` or `source-index`, owning extraction, generated source state, source freshness, symbol query, and impact traversal.
- `cli`: add `source`, `symbol`, and `impact` command families.
- `evidence`: store generated source evidence, source query metrics, and source freshness reports.
- `brief`: optionally include bounded source evidence for a task.
- `pack`: optionally include source snippets/symbol summaries under a token budget.
- `view`: render source evidence panels as read-only support layers.
- `relation-candidates`: accept source-derived relation candidates without feeding them into route until reviewed.
- `verify`: later warn on malformed source generated state, stale source index, or generated evidence path issues.
- `benchmark`: add source-intelligence A/B fixtures and metrics.
- `skill`: teach source-query-before-broad-read behavior while preserving `.context` priority.
- `hooks-doctor`: optional future reminders only; no source-derived canonical writes.
- `showcase`: explain source intelligence as a generated support layer below CMAP governance.

## Risks And Verification

Risks:

- Static source graphs miss dynamic calls, runtime framework wiring, re-export edge cases, and alias-heavy code.
- Unique-name fallback can create false callers/callees in medium-size repos.
- Stale indexes can look authoritative if freshness is not printed beside every answer.
- Background auto-index/watch behavior can surprise users and obscure what changed.
- Source snippets can leak secrets into generated evidence packs if redaction is weak.
- Token-saving claims can be false; LeanKG's own benchmark docs show an overhead case.
- Hook enforcement can make agents brittle if the source index is incomplete.
- Generated source facts may drift into canonical `.context` if the bridge is not guarded.

Verification path:

- Unit tests for TS/JS import, export, re-export, namespace import, dynamic import, class method, function call, arrow function, duplicate symbol, and path alias fixtures.
- Query tests for `symbol find`, `callers`, `callees`, `impact file`, `impact symbol`, stale warnings, and ambiguity handling.
- Freshness tests for changed files, deleted files, renamed files, git HEAD changes, and extraction errors.
- Trust-boundary tests proving source commands write only generated state or inbox candidates, never canonical `.context` files.
- Redaction tests for generated evidence and Review HTML source panels.
- Benchmark fixtures with expected files and measured file reads/tool calls/source tokens/F1 before claiming improvement.
- Final implementation closeout should run targeted source tests, `cmap finish`, `cmap verify --changed`, and `git diff --check`.
