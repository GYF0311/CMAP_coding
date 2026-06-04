# CodeGraph Query MCP Agent Note

## Research Scope

This note inspects the local CodeGraph snapshot only:

- `research/coding-knowledge-graphs-2026-06/repos/codegraph`

It focuses on the query, MCP, and agent-facing surfaces that answer:

- search-style questions: "where is X?"
- context questions: "what files/symbols matter for task Y?"
- callers/callees questions: "who calls X?" and "what does X call?"
- dependents/impact questions: "what changes if X changes?"
- freshness and output-budget questions: "can the agent trust this indexed answer?"

The CMAP planning baseline read for comparison was:

- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`

The comparison assumes CMAP's current direction remains Trust Boundary + Human Review Layer. Source intelligence should feed generated evidence and candidate review, not become a second canonical fact store.

## Source Files Inspected

Planning context:

- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`

CodeGraph query and graph core:

- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/types.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/db/schema.sql`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/db/queries.ts` - `QueryBuilder`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/search/query-parser.ts` - `parseQuery`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/search/query-utils.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/graph/traversal.ts` - `GraphTraverser`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/graph/queries.ts` - `GraphQueryManager`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/context/index.ts` - `ContextBuilder`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/context/formatter.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/index.ts` - `CodeGraph`

CodeGraph agent-facing surfaces:

- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/bin/codegraph.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/tools.ts` - `ToolHandler`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/server-instructions.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/session.ts` - `MCPSession`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/engine.ts` - `MCPEngine`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/index.ts` - `MCPServer`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/sync/watcher.ts` - `FileWatcher`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/sync/worktree.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/site/src/content/docs/reference/cli.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/site/src/content/docs/reference/mcp-server.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/README.md`

## Core Mechanisms

CodeGraph's query layer is built around a local SQLite graph index. `src/db/schema.sql` stores files, nodes, edges, unresolved references, project metadata, and an FTS5 index over symbol text. `src/types.ts` defines the source model: file records carry hashes and index timestamps; nodes carry symbol identity, file locations, signatures, docstrings, and export flags; edges carry relation kind, location, and provenance.

Search-style questions start in `QueryBuilder.searchNodes` in `src/db/queries.ts`. The mechanism is layered: `parseQuery` in `src/search/query-parser.ts` extracts field filters such as kind, language, path, and name; `QueryBuilder` tries FTS, LIKE fallback, fuzzy fallback, and exact-name supplementation; `src/search/query-utils.ts` adds term extraction, path relevance, and test/generated-file downranking. CLI `codegraph query` in `src/bin/codegraph.ts` and MCP `codegraph_search` through `ToolHandler.handleSearch` expose this as a location/symbol lookup surface.

Callers and callees questions are graph traversals, not text searches. `GraphTraverser.getCallers` and `GraphTraverser.getCallees` in `src/graph/traversal.ts` walk incoming or outgoing calls/references/imports with depth and limit controls. MCP `ToolHandler.handleCallers` and `ToolHandler.handleCallees` in `src/mcp/tools.ts` first resolve all matching symbols with `findAllSymbols`, then aggregate and dedupe caller/callee results across matches. CLI `codegraph callers` and `codegraph callees` mirror this with JSON-capable output in `src/bin/codegraph.ts`.

Dependents and impact questions split into symbol-level and file-level paths. `GraphTraverser.getImpactRadius` expands incoming dependents and nearby container children for a symbol-centered impact view. `GraphQueryManager.getFileDependencies` and `GraphQueryManager.getFileDependents` in `src/graph/queries.ts` answer file import/dependent questions, including exported symbol dependents. CLI `codegraph impact` uses symbol impact, while CLI `codegraph affected` performs transitive file-dependent traversal to identify affected tests.

Context questions are intentionally a higher-level composition. `ContextBuilder.buildContext` and `ContextBuilder.findRelevantContext` in `src/context/index.ts` combine exact symbol extraction, search results, compound/CamelCase matching, import-to-definition recovery, type-hierarchy expansion, BFS graph expansion, per-file caps, non-production caps, edge recovery, and bounded source extraction. `src/context/formatter.ts` turns the result into compact Markdown or JSON. MCP `ToolHandler.handleContext` wraps this as the primary "what matters for this task?" tool.

Trace and explore are agent convenience tools on top of the same graph. `ToolHandler.handleTrace` searches candidate source and target symbols, scores candidate pairs, tries bounded call-path discovery with `GraphTraverser.findPath`, and returns either a hop-by-hop path or endpoint-centered fallback context. `ToolHandler.handleExplore` builds a broader source bundle by combining context search, named-symbol seeding, same-file grouping, relationship maps, source sections, skeletonized large structures, and explicit "not shown" budget notes.

Output budget control is present at several layers. `ContextBuilder` defaults keep context small: bounded node count, code block count, code block size, search limit, traversal depth, and minimum score. `src/mcp/tools.ts` adds hard input limits, path length limits, result limits, `MAX_OUTPUT_LENGTH`, `truncateOutput`, per-tool limit clamping, and adaptive `getExploreOutputBudget` tiers based on project size. Small repositories expose fewer tools through `ToolHandler.getTools`; large explore answers get relationship maps and completeness notes only when the budget allows.

Freshness is treated as a first-class agent-facing concern. `FileWatcher` in `src/sync/watcher.ts` tracks pending changed files and only clears them after successful sync. `MCPEngine.catchUpSync` in `src/mcp/engine.ts` reconciles the index when the MCP session starts and gates the first tool call until catch-up finishes. `ToolHandler.withStalenessNotice` in `src/mcp/tools.ts` warns when a response references pending files and adds a footer when other pending files exist. `codegraph_status` and CLI `codegraph status` expose pending sync details, while `src/sync/worktree.ts` detects index/current worktree mismatches.

The MCP surface is not just a raw API list. `SERVER_INSTRUCTIONS` in `src/mcp/server-instructions.ts` tells agents when to use search, context, trace, callers, callees, impact, node, explore, files, and status, and warns about index lag and best-effort resolution. `MCPSession` returns these instructions during initialize, before heavy index initialization. The public docs reinforce the same tool-selection story in `site/src/content/docs/reference/mcp-server.md`, while `site/src/content/docs/reference/cli.md` documents equivalent machine-readable CLI commands.

## Agent Tool Surface Lessons

CMAP should expose source intelligence as a small set of question-shaped tools, not as a generic graph dump. The useful split is:

- `search`: find candidate symbols/files quickly.
- `context`: answer "what should I read for this task?" in one bounded response.
- `callers` and `callees`: answer direct relation questions without forcing the agent to manually chain search, read, and grep.
- `impact`: answer symbol/file blast-radius questions with explicit depth and confidence.
- `status`: make freshness and index health visible before the agent trusts results.

The main lesson is that agent instructions are part of the product surface. CodeGraph uses MCP initialize instructions, tool descriptions, CLI docs, and installer guidance to steer the model toward the right tool chain. CMAP should do the same through its CLI help, skill guidance, MCP descriptions if added, and review HTML labels.

The second lesson is that a good `context` tool should compose lower-level primitives. Agents should not have to manually call `search`, then `node`, then `callers`, then `callees` for every task. CMAP can keep the first version simpler than CodeGraph, but the top-level source-evidence command should still return ranked entry points, related symbols, relevant files, freshness, and budget metadata together.

The third lesson is that output budget belongs in the API contract. Limits, omitted-result notes, stale-file notes, and "not shown" summaries are more useful than silently truncating. CMAP should report what was searched, what was included, what was omitted, and whether the index was fresh enough for the answer.

## Capabilities CMAP Should Absorb

- A generated source index with file hashes, indexed timestamps, symbols, edges, provenance, and confidence. This maps directly to the planning gaps around source evidence freshness, symbol callers/callees, file impact, and token-saving lookup.
- `cmap source status` with index existence, file count, symbol count, edge count, stale files, last indexed time, and working-tree/root mismatch warnings.
- `cmap symbol find`, `cmap symbol callers`, and `cmap symbol callees` with `--json`, `--limit`, `--kind`, and `--path` filters.
- `cmap impact file` for import-dependent file impact and test candidates. `cmap impact symbol` can follow once symbol resolution is stable enough.
- A source-aware context/evidence builder for `cmap brief --with-source-evidence`, returning ranked entry points, related files, excerpts, freshness status, provenance, and omitted-result notes.
- Staleness warnings based on content hash comparison. CMAP does not need a daemon watcher for the first version, but it should never answer from a stale index silently.
- Machine-readable CLI output first, MCP wrapping second. CodeGraph's CLI/MCP parity is a good pattern because it lets tests, agents, and humans exercise the same query engine.
- Tool-selection guidance embedded into CMAP's agent instructions, not left as tribal knowledge.

## Parts CMAP Should Not Absorb

- Do not copy CodeGraph source or reproduce its implementation structure. The relevant artifact is the mechanism shape, not the code.
- Do not make a full multi-language source graph engine part of the CMAP MVP. CMAP's immediate rewrite direction should prioritize TypeScript/JavaScript for its own codebase and project-near usage.
- Do not import the "trust the graph instead of reading files" agent stance wholesale. CMAP's trust boundary says generated source intelligence is evidence, not canonical truth. For edits touching a stale or ambiguous file, direct file reads remain appropriate.
- Do not revive old import graph, route v2, pack v2, or locale/i18n plans under a new source-intelligence name.
- Do not add a second maintained fact store beside `.context`. Source index output should live under generated evidence/candidate surfaces and only become durable CMAP memory after human review.
- Do not absorb daemon, installer, detached MCP server, cross-agent hook, or broad watcher complexity in the first iteration. A manual/index-on-demand path is enough to validate the planning gap.
- Do not absorb highly specialized heuristics such as dynamic-dispatch trace synthesis, framework route manifests, polymorphic skeleton expansion, or very broad language/framework coverage until CMAP has a verified core source index.
- Do not expose destructive index removal/unlock flows as part of the source-query planning surface.

## TypeScript Rewrite Direction For CMAP

CMAP should implement a small TypeScript-native source intelligence layer that follows existing CMAP trust boundaries:

1. Build a generated source index for TypeScript/JavaScript first.
2. Store it outside canonical project memory, for example under a generated source-evidence area rather than in `MAP.md` or `modules/*.md`.
3. Expose stable CLI commands before adding MCP wrappers.
4. Return provenance, confidence, freshness, and output-budget metadata with every source answer.
5. Feed briefs, review HTML, and candidate workflows without promoting generated source facts automatically.

Recommended first schema:

- `SourceFileRecord`: path, hash, size, mtime, language, indexedAt, parseErrors.
- `SourceSymbol`: id, kind, name, qualifiedName, filePath, startLine, endLine, exported, signature, containerId.
- `SourceEdge`: sourceId, targetId, kind, filePath, line, confidence, provenance.
- `SourceQueryResult`: query, matches, staleFiles, omitted, budget, generatedAt.

Recommended first command set:

- `cmap source index`
- `cmap source status --json`
- `cmap symbol find <query> --json --limit --kind --path`
- `cmap symbol callers <symbol> --json --limit`
- `cmap symbol callees <symbol> --json --limit`
- `cmap impact file <path> --json --depth`
- `cmap brief --with-source-evidence --source-budget <n>`

Implementation should prefer TypeScript's compiler API for initial parsing and import/export resolution. Best-effort call/reference edges can be introduced behind explicit confidence labels. If performance becomes an issue, CMAP can later move from JSON/SQLite-lite generated evidence to a proper SQLite-backed index, but that should be a scaling decision after the first verified command set.

## CMAP Modules Affected

- `cli`: add source, symbol, and impact command families with JSON output.
- `evidence`: define generated source evidence records, freshness metadata, and candidate promotion boundaries.
- `brief`: optionally include source evidence with explicit budget and omitted-result notes.
- `pack`: allow source evidence attachments without making them canonical facts.
- `route`: use source results as hints only; do not replace reviewed module routing.
- `view`: optionally render source evidence and stale-index warnings in Review HTML.
- `benchmark`: add source-intelligence benchmarks for file lookup, caller lookup, impact lookup, and token/tool-call reduction.
- `verify`: warn on stale/generated source evidence when source-aware outputs are used.
- `graph`: keep CMAP project-map graph separate from generated source graph concepts, or introduce a clearly named source-graph submodule if needed.
- `skills` or agent guidance: document when to use source intelligence, when to fall back to direct file reads, and how generated evidence becomes a candidate for review.

## Risks And Verification

Risks:

- Generated source facts may be mistaken for canonical `.context` facts unless every output is labeled.
- Stale index answers can mislead agents after edits, branch switches, or generated-file changes.
- Ambiguous symbol names can produce false caller/callee or impact results.
- Call graph edges are especially prone to false positives and false negatives in TypeScript unless confidence/provenance is visible.
- Source evidence can bloat briefs and packs unless budgets and omitted-result notes are part of the output contract.
- Reintroducing old import-graph work under new names would conflict with the current planning constraints.

Verification for the CMAP rewrite should include:

- fixture tests for `source index` on imports, exports, default exports, re-exports, classes, methods, functions, and React-style components;
- caller/callee tests with ambiguous names and overloaded-looking methods;
- stale-index tests that modify a fixture file after indexing and require visible warnings;
- file-impact tests that trace import dependents and affected tests;
- budget tests that prove large files and many matches produce bounded output with explicit omissions;
- integration tests that confirm `brief --with-source-evidence` adds generated evidence without mutating canonical `.context` facts;
- review checks that source intelligence does not revive import graph, route v2, pack v2, or translation-roadmap work.
