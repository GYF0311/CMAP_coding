# Code Review Graph Impact Token Agent Note

## Research Scope

- Local-only inspection of `research/coding-knowledge-graphs-2026-06/repos/code-review-graph`.
- Planning context read from `docs/planning/source-intelligence-upgrade-2026-06/README.md` and `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`.
- Focus: impact / blast radius, minimal review context, context-savings benchmark, and changed-file incremental update.
- This note summarizes mechanisms and CMAP rewrite lessons only. It does not copy third-party source into CMAP.

## Source Files Inspected

- `code_review_graph/graph.py`: `GraphNode`, `GraphEdge`, `GraphStats`, `GraphStore`, `GraphStore.get_impact_radius()`, `GraphStore.get_impact_radius_sql()`, `GraphStore.store_file_nodes_edges()`, `GraphStore.get_subgraph()`, `GraphStore.search_nodes()`, `GraphStore.get_transitive_tests()`.
- `code_review_graph/changes.py`: `parse_git_diff_ranges()`, `parse_svn_diff_ranges()`, `parse_diff_ranges()`, `_parse_unified_diff()`, `map_changes_to_nodes()`, `compute_risk_score()`, `analyze_changes()`.
- `code_review_graph/incremental.py`: `get_changed_files()`, `get_staged_and_unstaged()`, `collect_all_files()`, `find_dependents()`, `DependentList`, `_single_hop_dependents()`, `full_build()`, `incremental_update()`, `_parse_single_file()`, `watch()`.
- `code_review_graph/context_savings.py`: `estimate_tokens()`, `estimate_file_tokens()`, `estimate_context_savings()`, `attach_context_savings()`, `verify_with_tiktoken()`, `format_context_savings_panel()`.
- `code_review_graph/tools/review.py`: `get_review_context()`, `_extract_relevant_lines()`, `_generate_review_guidance()`, `get_affected_flows_func()`, `detect_changes_func()`.
- `code_review_graph/tools/context.py`: `get_minimal_context()`.
- `code_review_graph/tools/query.py`: `get_impact_radius()`, `query_graph()`. This was inspected because `main.py` exposes its impact wrapper.
- `code_review_graph/tools/_common.py`: `_get_store()`, `_resolve_graph_file_paths()`, `compact_response()`.
- `code_review_graph/main.py`: `get_minimal_context_tool()`, `get_impact_radius_tool()`, `get_review_context_tool()`, `detect_changes_tool()`, review-related prompt wrappers.
- `code_review_graph/token_benchmark.py` and `code_review_graph/eval/token_benchmark.py`: whole-corpus query benchmark and workflow-token benchmark.
- `docs/schema.md`, `docs/COMMANDS.md`, `docs/USAGE.md`, `docs/FEATURES.md`, `README.md`: schema, command behavior, benchmark caveats, and token-savings UX.
- Supporting tests: `tests/test_context_savings.py`, `tests/test_changes.py`, `tests/test_incremental.py`, `tests/test_tools.py`, `tests/test_cli.py`, `tests/test_main.py`.

## Core Mechanisms

1. Source graph storage

   `code_review_graph/graph.py` uses `GraphStore` as a SQLite-backed local index. The main tables model source nodes, source edges, and metadata. Nodes represent files, functions, classes, tests, and types. Edges represent relationships such as calls, imports, inheritance, containment, test coverage, references, injection, and flow-like consume/produce links. The graph is a generated structural index, not a reviewed project-memory layer.

2. Impact radius

   `code_review_graph/tools/query.py#get_impact_radius()` accepts changed files, resolves repo-relative paths to the graph's stored paths via `tools/_common.py#_resolve_graph_file_paths()`, estimates the raw changed-file token baseline, then calls `GraphStore.get_impact_radius()`.

   `GraphStore.get_impact_radius_sql()` seeds traversal from nodes in changed files and uses a SQLite recursive CTE to walk both outgoing and incoming edges up to a depth and node cap. The response separates directly changed nodes, impacted nodes, impacted files, connecting edges, truncation state, and total impacted count. A legacy NetworkX traversal exists behind `GraphStore._get_impact_radius_networkx()`, but the SQL path is the default performance lesson.

3. Diff-to-function mapping

   `code_review_graph/changes.py#parse_diff_ranges()` chooses Git or SVN, parses unified diff hunk ranges, and maps changed line ranges to graph nodes with `map_changes_to_nodes()`. If line ranges are unavailable, `analyze_changes()` falls back to all nodes in changed files.

   `analyze_changes()` narrows changed nodes to functions, classes, and tests, caps large PR analysis with `CRG_MAX_CHANGED_FUNCS`, scores each node with `compute_risk_score()`, finds affected flows, detects test gaps from missing `TESTED_BY` edges, and returns priority-ordered review items.

4. Risk scoring

   `compute_risk_score()` is a simple additive model. It considers flow participation, cross-community callers, test coverage, security-sensitive names, and caller count. The exact weights should not be copied, but the product pattern is useful: expose why something is risky instead of returning an opaque "AI risk" label.

5. Minimal review context

   `code_review_graph/tools/context.py#get_minimal_context()` is designed as the first call. It returns graph stats, a coarse change risk when diffs exist, top entities, top communities/flows, and suggested next tools through `compact_response()`.

   `code_review_graph/tools/review.py#get_review_context()` has a `detail_level="minimal"` mode that returns counts, risk, key entities, test-gap count, and next-tool suggestions. Standard mode returns a graph context plus optional source snippets. When source files are long, `_extract_relevant_lines()` slices only around changed nodes instead of embedding the whole file.

   `detect_changes_func()` follows the same pattern: minimal mode keeps only summary, risk score, changed-file count, test-gap count, and top three review priority names.

6. Context savings metadata

   `code_review_graph/context_savings.py` keeps the runtime metadata intentionally tiny: `estimated`, `saved_tokens`, and `saved_percent`. The baseline for review-style tools is usually changed-file size from `estimate_file_tokens()`, while the returned side is the structured graph response. `format_context_savings_panel()` renders a human-facing panel; `verify_with_tiktoken()` can calibrate estimates with a real tokenizer when available.

   `tests/test_context_savings.py`, `tests/test_cli.py`, and `tests/test_tools.py` verify that savings metadata stays compact and appears on relevant review/impact outputs.

7. Token benchmarks

   `code_review_graph/token_benchmark.py#run_token_benchmark()` measures whole-corpus token count versus graph search results plus nearby edges for sample natural-language questions.

   `code_review_graph/eval/token_benchmark.py` measures complete agent workflows such as review, architecture, debug, onboard, and pre-merge by summing tokens across minimal tool calls.

   The project docs explicitly warn that these are different benchmarks. Whole-corpus question answering can show large reductions, while changed-file review can look worse for tiny diffs because graph metadata and snippets have overhead.

8. Incremental update

   `code_review_graph/incremental.py#full_build()` collects parseable tracked files, skips ignored/binary/unparseable paths, parses files in serial or parallel, writes file hashes, removes stale file data, and stores VCS metadata.

   `incremental_update()` detects changed files or accepts an explicit list, finds dependent files through `find_dependents()`, combines changed plus dependent files, removes deleted files from the graph, skips ignored/unparseable paths, skips unchanged files by SHA-256 file hash, reparses only the remaining files, commits metadata, and reruns specialized resolvers only when relevant language files changed.

   `find_dependents()` expands reverse dependency edges for a bounded number of hops and returns a `DependentList` with a `truncated` flag when a cap is hit. This is a useful UX pattern for CMAP: do not hide incomplete impact analysis.

## Impact And Minimal Context Lessons

- Treat impact as a layered report: changed files -> changed symbols -> impacted nodes/files -> risk factors -> suggested verification. Avoid a single flat "affected files" list.
- Keep direct changed symbols separate from graph-expanded impacted symbols. This matches CMAP's current direct route vs related context boundary.
- Path resolution is not a detail. `tools/_common.py#_resolve_graph_file_paths()` exists because graphs may store absolute, repo-relative, or cwd-relative paths. CMAP needs the same kind of path-normalization seam before source evidence can be trusted.
- Minimal mode should be a first-class output contract, not a truncation afterthought. The useful minimal payload is counts, risk, key entities, test gaps, and next actions.
- Source snippets should be opt-in and range-bounded. The Code Review Graph pattern of slicing around changed symbols is better than dumping entire changed files into a brief.
- Token savings should be labeled as estimated unless measured with a tokenizer. The estimate should be small enough to include in every relevant output without becoming its own token tax.
- Benchmark scenarios must stay separate: whole-corpus Q&A reduction, changed-file review reduction, and full workflow token consumption answer different product questions.
- Incremental update must be paired with freshness/status semantics. The docs distinguish read-only `detect-changes --brief` from `update --brief`, which refreshes the graph first. CMAP should offer the same "read existing index" vs "refresh then analyze" distinction.

## Capabilities CMAP Should Absorb

- A CMAP-native generated source index for TypeScript/JavaScript first: files, symbols, imports, exports, simple calls, tests, line ranges, and file hashes.
- A changed-file impact command that starts from Git diff or explicit file paths and emits a candidate impact report, not canonical `.context` edits.
- A minimal source-evidence pack for `brief` / `pack`: changed symbols, likely impacted files, caller/importer edges, test hints, and bounded source snippets.
- Source index freshness metadata under generated state: source commit/hash, indexed file hashes, last build type, stale/missing/deleted file status.
- Context-savings metadata with two baselines: changed-file baseline for review tasks and corpus baseline for source lookup / Q&A tasks.
- A source-intelligence benchmark command that records files read, tool calls, source context tokens, relevant context ratio, and answer quality gates.
- A Review HTML support panel that displays generated source evidence and freshness state clearly below reviewed project-map facts.
- A truncation/cap signal for wide blast radius results. CMAP should never imply complete impact if traversal was capped.
- A path resolver that maps user-facing paths to stored source-index paths and then to reviewed CMAP modules through `src/core/module-index.ts`.

## Parts CMAP Should Not Absorb

- Do not turn CMAP into a full multi-language code graph engine in this planning slice. P0 should prove the loop on CMAP's own TypeScript stack.
- Do not copy Code Review Graph's parser implementation, risk weights, schema text, or CLI copy.
- Do not make generated source graph edges canonical module relations. They can propose candidates, but reviewed `.context/modules/*.md` remains the source for canonical module relationships.
- Do not expose a large default MCP/tool surface. Code Review Graph has many specialized tools; CMAP should keep a smaller CLI-first surface until usage proves the need.
- Do not make daemon/watch/hooks mandatory. Incremental refresh is useful, but CMAP's trust boundary means background updates should write generated evidence only.
- Do not require embeddings for P0. Embeddings may improve search later, but import/symbol impact and minimal review context should work deterministically first.
- Do not import community detection, flow tracing, and broad architecture mining as MVP requirements. They are attractive but can consume the roadmap before changed-file impact works.
- Do not make OpenAI-specific tokenizer verification a required runtime dependency. It can be an optional benchmark calibration path.

## TypeScript Rewrite Direction For CMAP

- Add a separate source-intelligence layer, likely under `src/source/`, with explicit generated-output boundaries.
- Keep the current reviewed graph in `src/core/context-graph.ts` separate from any source graph. A source graph can inform route/brief, but it must not replace reviewed module docs.
- Start with a small TS/JS extractor:
  - `SourceFile`: path, language, hash, line count, indexed_at.
  - `SourceSymbol`: id, kind, name, qualified_name, file_path, line_start, line_end, parent, exported, is_test.
  - `SourceEdge`: kind, source, target, file_path, line, confidence_tier.
  - `SourceImpactReport`: changed_files, changed_symbols, impacted_symbols, impacted_files, likely_tests, risk_factors, truncated.
  - `SourceEvidencePack`: task, route_modules, source_facts, snippets, context_savings, freshness.
- Use a local generated store. SQLite is attractive for recursive impact traversal, but dependency choice should be reviewed. A JSON index can work for an MVP if the graph remains small; the API should hide storage behind an adapter.
- Implement command candidates in a conservative order:
  - `cmap source index`
  - `cmap source status`
  - `cmap impact file <path> --base <ref>`
  - `cmap brief "<task>" --with-source-evidence`
  - `cmap benchmark source-intelligence`
- Map source impact back to CMAP modules by matching impacted file paths against module `paths` from `src/core/module-index.ts`. This produces "source-evidence suggests module X may be affected", not a direct route match.
- Keep minimal output as the default for agent startup. Full snippets and edge lists should require an explicit detail flag or budget.
- Label all source-derived facts as `Generated / Non-canonical` when they appear in `brief`, `pack`, Review HTML, or inbox candidates.

## CMAP Modules Affected

- `cli`: new command family for `source`, `impact`, and source benchmark entrypoints.
- `context`: generated store paths, policy labels, and possibly template notes explaining source evidence boundaries.
- `graph`: must remain the reviewed module graph. If source graph is added, use a separate module/doc name to avoid reviving old import graph as canonical roadmap.
- `route`: can use source evidence only as optional related evidence or warnings. It must not score direct module matches from unreviewed source graph edges.
- `brief`: source-aware briefs should include a minimal source evidence block after routed `.context` facts.
- `pack`: source snippets and impact reports need deterministic budget enforcement and redaction.
- `benchmark`: add source-token A/B metrics distinct from existing route/context-pack benchmark metrics.
- `evidence`: source impact reports, source freshness records, and possible relation candidates belong here as generated support material.
- `view`: optional source evidence panel in Review HTML, clearly below canonical map and candidate review layers.
- `verify`: source-index freshness checks can warn, but should not fail canonical map verification unless explicitly configured.
- `hooks-doctor`: optional assist hooks may refresh source evidence, but must not write canonical `.context` semantics.
- `tests`: fixtures for TS/JS import graphs, changed-file impact, stale source index, budgeted source brief, and no-canonical-write guarantees.

## Risks And Verification

- Risk: path mismatch between Git diff paths, source-index paths, and CMAP module ownership paths. Verify repo-relative, absolute, nested package, renamed, and deleted file cases.
- Risk: stale source index produces confident wrong impact. Verify `source status` and impact commands report stale/missing hashes and distinguish read-only analysis from refresh-then-analyze.
- Risk: token-savings claims become marketing numbers. Verify changed-file review, whole-corpus lookup, and workflow-token benchmarks separately.
- Risk: source snippets leak secrets or oversized files. Reuse CMAP pack redaction and add snippet line/byte caps.
- Risk: generated source evidence starts steering canonical route results. Add tests that unreviewed source edges do not alter `route.modules` ranking or reviewed module relations.
- Risk: wide blast radius overwhelms the agent. Verify traversal caps, `truncated` flags, and next-step guidance.
- Risk: TypeScript parser misses dynamic imports or alias resolution. Start with conservative confidence tiers and show unresolved imports rather than pretending precision.
- Verification path for implementation:
  - Unit: source extractor fixtures for imports, exports, functions/classes, tests, and line ranges.
  - Unit: changed-file hash skip, deletion handling, rename handling, and dependent-file expansion.
  - Integration: `cmap impact file src/foo.ts --base HEAD~1` emits changed symbols, impacted files, likely modules, context savings, and no canonical writes.
  - Integration: `cmap brief "<task>" --with-source-evidence` includes routed `.context` first, then generated source evidence under budget.
  - Benchmark: compare baseline changed-file tokens vs minimal source-evidence tokens, and separately compare whole-corpus lookup vs graph lookup.
  - Regression: `cmap verify --changed` and existing route/pack/brief tests continue to pass with no source index present.
