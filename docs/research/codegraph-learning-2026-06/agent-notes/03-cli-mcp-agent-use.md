# CodeGraph Agent Note 03: CLI, MCP, And Agent Use

Date: 2026-06-04
Agent focus: user commands, MCP tools, and how agents use CodeGraph
Mode: local read-only research

## Research Scope

Studied these paths:

- `research/coding-knowledge-graphs-2026-06/repos/codegraph/site/src/content/docs/reference/cli.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/site/src/content/docs/reference/mcp-server.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/bin/codegraph.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/tools.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/server-instructions.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/context/index.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/search/query-parser.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/graph/traversal.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/db/queries.ts`
- `docs/planning/source-intelligence-upgrade-2026-06/research/codegraph.md`

## One-Sentence Conclusion

CodeGraph gives agents problem-shaped tools such as `context`, `trace`, `explore`, `callers`, and `impact`, so they can ask the graph before scanning files.

## CLI Capabilities

- `codegraph init`: create `.codegraph/` and build an index.
- `codegraph index`, `sync`, `status`: full index, incremental update, and health/statistics report.
- `codegraph query <search>`: search symbols by name, optionally with kind filters or JSON output.
- `codegraph files`: show indexed file structure.
- `codegraph context <task>`: produce a task-focused context pack with entry points, related symbols, and code snippets.
- `codegraph callers <symbol>`: find what calls a function or method.
- `codegraph callees <symbol>`: find what a function or method calls.
- `codegraph impact <symbol>`: estimate what code may be affected by changing a symbol.
- `codegraph affected [files...]`: find likely affected tests from changed source files.
- `codegraph serve --mcp`: start the MCP server for AI agents.

## MCP And Agent Tools

- `codegraph_context`: main tool; combines search, nodes, callers, callees, and key code in one call.
- `codegraph_search`: lightweight symbol search without source code.
- `codegraph_trace`: find a call path between two symbols and include source along the path.
- `codegraph_explore`: return source for several related symbols grouped by file, with relationship map and line numbers.
- `codegraph_node`: inspect one symbol, optionally with source or outline.
- `codegraph_callers`, `codegraph_callees`, `codegraph_impact`: focused relationship and impact questions.
- `codegraph_files`: inspect indexed file structure.
- `codegraph_status`: check index health, statistics, and pending changes.

The server instructions tell agents to try CodeGraph first for architecture, where-is-X, trace, and implementation questions, then read source files only when results are stale, incomplete, or require exact editing context.

## Typical Agent Workflow

1. Project is initialized with `codegraph init`; MCP server later watches and syncs changes.
2. Agent receives a task such as "change login flow".
3. Agent first calls `codegraph_context("change login flow")` to get entry points and related code.
4. If the question is path-like, it uses `codegraph_trace`.
5. If it needs a compact bundle of related source, it uses `codegraph_explore`.
6. Before editing, it checks `codegraph_impact`, `callers`, or `callees`.
7. It reads original files only when the index is stale, output is truncated, or it needs uncovered edit lines.

## How It Saves Tokens And Time

- It queries a prebuilt SQLite + FTS index instead of scanning the filesystem during the conversation.
- `context` compresses "find entry points, expand nearby graph, extract snippets, list relationships" into one call.
- `explore` returns line-numbered source, reducing follow-up file reads just to find lines.
- Limits, max nodes, adaptive explore budgets, and truncation notices control output size.
- Staleness banners narrow direct file reads to specific pending files.
- A shared daemon/proxy can avoid repeated watcher and database startup cost across sessions.

## What CMAP Should Not Copy Directly

- The instruction posture "trust CodeGraph, do not grep" is too strong for CMAP. CMAP should say: query source evidence first, but reviewed `.context` and live source checks still outrank generated guesses.
- Multi-language support, daemon, watcher, dynamic-dispatch heuristics, and broad MCP tools are too heavy for CMAP MVP.
- `trace` and `explore` contain many benchmark-driven heuristics. Copying them would import hidden product assumptions.
- `impact` is static approximation, not proof. It cannot replace tests, typechecks, or human review.
- CodeGraph helps find code structure; it does not decide requirements, reviewed decisions, or durable project memory.
