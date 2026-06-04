# LeanKG Research

Date: 2026-06-04
Local snapshot: `f1f51ad`
License: Apache-2.0 in `LICENSE` and `Cargo.toml`; README also says MIT
Runtime: Rust / CozoDB / MCP / Axum / Web UI

## Research Scope

LeanKG was studied as an infrastructure and evaluation reference: graph storage, query/cache design, MCP/API/Web surfaces, token metrics, benchmark methodology, plugin packaging, hooks, and Obsidian-style integration.

Primary intermediate note:

- `agent-notes/leankg-infrastructure.md`

## License Boundary

LeanKG has conflicting local license signals. This plan follows the stricter concrete files: `LICENSE` and `Cargo.toml` identify Apache-2.0. CMAP still treats it as design reference only and should independently rewrite any useful idea in TypeScript.

Do not copy LeanKG source, schema strings, hook scripts, plugin text, benchmark fixtures, or UI code.

## Source Files Inspected

The LeanKG agent inspected:

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
- `src/db/models.rs`
- `src/db/schema.rs`
- `src/db/mod.rs`
- `src/graph/query.rs`
- `src/graph/traversal.rs`
- `src/graph/cache.rs`
- `src/graph/persistent_cache.rs`
- `src/indexer/mod.rs`
- `src/indexer/parser.rs`
- `src/indexer/extractor.rs`
- `src/indexer/call_graph.rs`
- `src/mcp/tools.rs`
- `src/mcp/handler.rs`
- `src/mcp/server.rs`
- `src/mcp/token_budget.rs`
- `src/mcp/tracker.rs`
- `src/api/mod.rs`
- `src/api/handlers.rs`
- `src/web/mod.rs`
- `src/web/handlers.rs`
- `src/orchestrator/mod.rs`
- `src/orchestrator/intent.rs`
- `src/orchestrator/cache.rs`
- `src/compress/reader.rs`
- `src/config/project.rs`
- `src/mcp/watcher.rs`
- `src/watcher/mod.rs`
- `src/obsidian/mod.rs`
- `src/obsidian/note_generator.rs`
- `src/obsidian/sync.rs`
- plugin and hook files for Claude, Cursor, OpenCode, Codex, and other hosts
- MCP/graph/cache tests and orchestrator benchmarks

## Core Implementation Mechanisms

LeanKG's product shape is:

```text
polyglot indexer
  -> Cozo graph store
  -> graph queries / caches / metrics
  -> MCP + REST API + Web UI
  -> plugin hooks and benchmark runner
```

Important mechanisms:

- CozoDB stores code elements, relationships, metrics, cache, knowledge, teams, incidents, service metadata, and more.
- `CodeElement` and `Relationship` model typed graph nodes/edges with confidence and JSON metadata.
- Tree-sitter indexer covers many languages and domain-specific files.
- Batch indexing parses in parallel, detects frameworks, resolves call edges, and writes elements/relationships in chunks.
- Incremental indexing uses git changes, removes deleted-file rows, finds dependents, and reindexes changed plus dependent files.
- `GraphEngine` supports search, dependencies, dependents, callers, bounded call graphs, traceability, service graph, incidents, environment conflicts, oversized functions, and annotations.
- `ImpactAnalyzer.calculate_impact_radius_with_confidence` walks outgoing and reverse relationships up to depth with confidence filtering.
- `QueryCache` and persistent cache store bounded query results with TTL and invalidation.
- MCP is the primary AI-agent interface and includes token budgets, write tracking, auto-init, auto-index, project routing, stdio, HTTP, and streaming.
- Metrics record tool name, tokens, execution time, baseline lines/tokens, saved tokens, savings percent, success, and quality fields.
- Benchmark runner compares tool-enabled and baseline runs against expected files, precision, recall, F1, and token totals.
- Plugin hooks push agents toward "LeanKG first, grep fallback."
- Obsidian integration writes managed notes while treating CozoDB as source of truth.

## Relevant Capabilities

| CMAP Need | LeanKG Lesson |
|---|---|
| Token saving | Measure tokens, files, tool calls, precision, recall, and failures |
| File impact | Bounded dependency/dependent traversal with confidence |
| Query performance | Cache results but keep freshness metadata visible |
| MCP surface | Use token budgets and explicit status before wide outputs |
| Skills/hooks | Source-query guidance can reduce broad grep/read loops |
| Review layer | View/export integrations must not become canonical truth |

## What CMAP Should Absorb

- A generated source graph store below `.context`.
- Confidence and provenance on source relationships.
- Bounded `symbol callers`, `symbol callees`, `impact file`, and `impact symbol` outputs.
- Query metrics as generated evidence: tool calls, source tokens, output tokens, elapsed time, stale warnings, success, and later precision/recall/F1.
- A benchmark family with expected impacted files/tests and negative evidence.
- Token budgets and explicit truncated/omitted counts.
- Agent guidance that queries source intelligence before broad source reads.
- Freshness-aware caching after query correctness is stable.

## What CMAP Should Not Absorb

- Cozo/RocksDB as mandatory MVP storage.
- Full product DB breadth: teams, incidents, invites, service metadata, knowledge entries, env conflicts, API keys, and business annotations.
- Full polyglot extraction scope in the first upgrade.
- Always-on hooks that block raw `rg`/grep.
- Natural-language query orchestration as P0.
- Web UI as a separate control plane.
- Obsidian as a source-graph write-back IDE.
- Auto-index/auto-init that hides generated state changes.
- Token-saving claims without CMAP-owned benchmark proof.

## CMAP TypeScript Rewrite Direction

CMAP should rewrite the measurable, bounded parts:

```text
TS/JS source index
  -> source queries
  -> source evidence packs
  -> query metrics
  -> benchmark source-intelligence
```

Candidate schema additions:

- `SourceFile`
- `SourceSymbol`
- `SourceEdge`
- `SourceFreshnessSummary`
- `SourceQueryMetric`
- `SourceBenchmarkCase`

Candidate commands:

- `cmap source index`
- `cmap source status`
- `cmap symbol find <query>`
- `cmap symbol callers <symbol>`
- `cmap symbol callees <symbol>`
- `cmap impact file <path>`
- `cmap impact symbol <symbol>`
- `cmap brief "<task>" --with-source-evidence`
- `cmap benchmark source-intelligence`

## CMAP Modules Affected

- New future module: `source-intelligence`.
- `cli`: source/symbol/impact/benchmark commands.
- `evidence`: generated metrics and source reports.
- `brief` and `pack`: bounded source evidence.
- `view`: generated source evidence panels.
- `benchmark`: source-intelligence A/B evaluation.
- `skill`: query-before-broad-read guidance.
- `hooks-doctor`: future advisory checks only.
- `obsidian-adapter`: remain view/export only unless reviewed separately.
- `graph` and `route`: reviewed map stays canonical.

## Risks And Verification

Risks:

- Query caches can hide stale evidence.
- Tool instructions can become too forceful and block legitimate source inspection.
- Benchmarks can overstate savings if they only count wins.
- Product breadth can pull CMAP away from its trust-boundary value.

Verification:

- Source query metrics include negative and stale cases.
- Benchmark reports precision, recall, F1, files read, tool calls, token deltas, and failures.
- Cache invalidation tests include changed, deleted, renamed, and stale files.
- Source evidence never writes canonical `.context`.
- Skill text keeps reviewed `.context` above generated source graph.

## CMAP Fit

LeanKG is most useful for evaluation discipline. Its own benchmark artifacts show both token wins and token overhead, which is exactly the honesty CMAP needs before claiming "saves tokens."

The safe absorption is:

```text
bounded source queries
  -> generated metrics
  -> A/B benchmark
  -> careful skill guidance
  -> no automatic canonical memory updates
```
