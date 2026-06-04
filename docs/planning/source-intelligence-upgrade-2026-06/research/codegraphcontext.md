# CodeGraphContext Research

Date: 2026-06-04
Local snapshot: `38f5289`
License: MIT
Runtime: Python / MCP / FastAPI / graph backends

## Research Scope

CodeGraphContext was studied as an infrastructure reference for MCP tools, guarded source indexing, graph backend abstraction, watch mode, bundle snapshots, and CLI/MCP parity.

Primary intermediate note:

- `agent-notes/codegraphcontext-infrastructure.md`

## Source Files Inspected

The CodeGraphContext agent inspected:

- `src/codegraphcontext/server.py`
- `src/codegraphcontext/tool_definitions.py`
- `src/codegraphcontext/prompts.py`
- `src/codegraphcontext/api/mcp_sse.py`
- `src/codegraphcontext/api/router.py`
- `src/codegraphcontext/tools/handlers/indexing_handlers.py`
- `src/codegraphcontext/tools/handlers/query_handlers.py`
- `src/codegraphcontext/tools/handlers/analysis_handlers.py`
- `src/codegraphcontext/tools/handlers/watcher_handlers.py`
- `src/codegraphcontext/tools/graph_builder.py`
- `src/codegraphcontext/tools/code_finder.py`
- `src/codegraphcontext/tools/indexing/discovery.py`
- `src/codegraphcontext/tools/indexing/pipeline.py`
- `src/codegraphcontext/tools/indexing/pre_scan.py`
- `src/codegraphcontext/tools/indexing/schema.py`
- `src/codegraphcontext/tools/indexing/schema_contract.py`
- `src/codegraphcontext/tools/indexing/resolution/calls.py`
- `src/codegraphcontext/tools/indexing/persistence/writer.py`
- `src/codegraphcontext/core/database*.py`
- `src/codegraphcontext/core/watcher.py`
- `src/codegraphcontext/core/cgc_bundle.py`
- `src/codegraphcontext/core/bundle_registry.py`
- `src/codegraphcontext/cli/main.py`
- `src/codegraphcontext/cli/cli_helpers.py`
- `src/codegraphcontext/cli/config_manager.py`
- `ARCHITECTURE.md`
- `docs/MCP_TOOLS.md`
- `docs/CLI_COMPLETE_REFERENCE.md`
- `docs/BUNDLE_ARCHITECTURE.md`
- `docs/ON_DEMAND_BUNDLES.md`
- unit, integration, and e2e tests for path traversal, read-only queries, watcher ignore rules, MCP, CLI, and backend parity

## Core Implementation Mechanisms

CodeGraphContext's useful implementation pattern is:

```text
tool manifest
  -> shared guarded handlers
  -> indexing/query/watch/bundle services
  -> MCP stdio/SSE, FastAPI, and CLI adapters
```

Important mechanisms:

- A static MCP tool manifest describes context discovery, indexing, search, analysis, raw query, watch, bundle, job, and status tools.
- `MCPServer` centralizes tool dispatch, disabled-tool loading, response token caps, JSON-RPC loop, context switching, and service reinitialization.
- Indexing is rooted in allowed-path checks, file discovery, pre-scan import mapping, tree-sitter parsing, graph writing, and post-processing.
- Graph schema separates repository, directory, file, function, class, interface, variable, module, and relationship types such as contains/imports/calls/inherits/implements.
- Call resolution can carry confidence such as extracted, inferred, or ambiguous.
- `CodeFinder` exposes curated queries: fuzzy search, related code, callers, callees, importers, class hierarchy, dead code, call chains, module dependencies, and complexity.
- Multiple graph backends are hidden behind a Neo4j-like session shape.
- Watch mode debounces file events, updates import maps, reindexes changed files, and relinks affected neighbors.
- `.cgc` bundle export/import gives reproducible graph snapshots and includes Zip Slip path guards.

## Guardrail Lessons

The strongest CMAP-relevant material is guardrails:

- Allowed-root checks reject path traversal, home secret access, symlink escape, and unapproved external roots.
- Read-only raw query checks block graph writes and force read-mode sessions.
- Project config can disable individual MCP tools.
- Tool responses are capped and truncated with explicit notes.
- Long-running indexing returns job ids instead of flooding the agent context.
- Ignore files apply consistently to index and watcher paths.

CMAP should implement shared guards once and call them from CLI, MCP, and any future HTTP adapter.

## Relevant Capabilities

| CMAP Need | CodeGraphContext Lesson |
|---|---|
| MCP/CLI surface | One guarded core can serve both CLI and MCP |
| Source index | File discovery, root containment, schema contract, and confidence labels |
| Symbol query | Curated query functions are safer than raw graph query |
| File impact | Incremental reindex and affected-neighbor relinking |
| Token saving | Response caps, result limits, and status tools |
| Trust boundary | Disable tools and avoid implicit external-root expansion |

## What CMAP Should Absorb

- Shared `source/guards` layer for root containment, symlink checks, ignore rules, and output caps.
- Curated read-only source query functions before raw graph access.
- Tool manifest style that can later power MCP from the same CLI handlers.
- `source status` before source answers are trusted.
- Optional job/status model for expensive indexing.
- Confidence labels on resolved and inferred source edges.
- Path-safety tests that cover traversal, symlink escape, and allowlisted roots.

## What CMAP Should Not Absorb

- Multi-backend graph database abstraction.
- Raw Cypher query as a primary feature.
- Public bundle registry and remote graph snapshot workflow.
- Broad Java/Spring/data-source analyzers.
- A second project context system beside `.context`.
- Always-on watcher or daemon behavior in MVP.
- MCP-first broad tool catalog before CLI contracts stabilize.

## CMAP TypeScript Rewrite Direction

Recommended CMAP shape:

```text
src/source-intelligence/
  guards.ts
  discovery.ts
  schema.ts
  indexer.ts
  store.ts
  queries.ts
  impact.ts
  evidence.ts
  freshness.ts
```

CLI first:

- `cmap source index`
- `cmap source status`
- `cmap symbol find`
- `cmap symbol callers`
- `cmap symbol callees`
- `cmap impact file`

Future MCP tools should be thin wrappers around the same handlers:

- `cmap_source_status`
- `cmap_symbol_find`
- `cmap_symbol_callers`
- `cmap_symbol_callees`
- `cmap_impact_file`

## CMAP Modules Affected

- `cli`: command families and output contracts.
- `evidence`: generated source reports and query metrics.
- `brief`: optional source-evidence block.
- `view`: read-only generated source panels.
- `verify`: future generated-state sanity checks.
- `hooks-doctor`: future advisory freshness diagnostics.
- `skill`: tool guidance after commands exist.
- `graph` and `route`: must not treat source graph as canonical module graph.

## Risks And Verification

Risks:

- Guard behavior can diverge between CLI and MCP if not shared.
- Raw graph query features can bypass trust-boundary language.
- Watch mode can create hidden background state.
- Backend abstraction can consume effort without helping CMAP's immediate workflow.

Verification:

- Path traversal and symlink escape tests.
- Same handler output parity for CLI and future MCP.
- Response budget/truncation tests.
- Disabled-tool or capability-gate tests if MCP ships.
- No canonical write tests for every source query path.

## CMAP Fit

CodeGraphContext is best used as a guardrail and adapter reference. CMAP should keep a smaller TS-native source-index core and expose MCP only after the CLI surface and trust-boundary tests are stable.
