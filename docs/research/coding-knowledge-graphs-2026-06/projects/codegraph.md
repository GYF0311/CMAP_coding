# CodeGraph

Repository: `colbymchenry/codegraph`
Local checkout: `/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/codegraph`
Commit: `8629f7a`
Agents: Architecture Agent + Product Boundary Agent

## Verdict

CodeGraph is one of the closest technical complements to CMAP, but it still sits below CMAP in the stack.

It builds a pre-indexed, local code knowledge graph from source symbols, calls, imports, references, routes, and framework-specific structures. It serves that graph through MCP so agents can query code structure instead of repeatedly grepping and reading files. It is not a reviewed project memory system.

Classification: **Complement; partial peer on route/context acceleration; not a superset.**

## What It Is

CodeGraph is a TypeScript/Node CLI, SDK, and MCP server. Its core workflow is:

1. Install CodeGraph into agent tooling.
2. Run `codegraph init` to create `.codegraph/`.
3. Index source files into a local SQLite database.
4. Keep the index fresh with file watchers, catch-up sync, and optional git hooks.
5. Expose MCP tools such as context, search, trace, callers, callees, impact, explore, files, and status.

Source evidence:

- `src/index.ts` is the main facade.
- `src/types.ts` defines node and edge vocabulary.
- `src/db/schema.sql` defines SQLite tables, indexes, and FTS search.
- `src/extraction/index.ts` and `src/resolution/index.ts` implement extraction and reference resolution.
- `src/mcp/tools.ts` exposes the agent tool surface.
- `src/mcp/server-instructions.ts` instructs agents to query CodeGraph before grep/read.

## Graph And Storage Model

CodeGraph has a fixed graph vocabulary:

- Node kinds include files, modules, classes, functions, methods, routes, and components.
- Edge kinds include contains, calls, imports, extends, references, and decorates.
- Storage is local `.codegraph/codegraph.db`.
- SQLite schema includes `nodes`, `edges`, `files`, `unresolved_refs`, `project_metadata`, and FTS5 search.
- Freshness is managed with watcher sync, pending-file notices, and staleness banners.

This is more deterministic and code-structure-oriented than Graphify. It is less multi-modal, but more agent-tool optimized.

## Trust Boundary

CodeGraph's trust model is source-derived rather than human-reviewed.

It gives useful provenance, including AST-derived edges and heuristic edges. It also warns that compiler/test/linter validation is still required. But it lacks CMAP-style canonical memory governance: no candidate inbox, no semantic promotion gate, no reviewed project decision store.

The strongest CMAP-compatible framing is:

CodeGraph tells an agent what the source graph currently looks like. CMAP tells the agent which project facts are reviewed, what the current handoff says, and how changes should be closed out.

## Where It Is Stronger Than CMAP

- Fast local code graph over symbols and call/import/reference relations.
- MCP-first agent surface.
- SQLite/FTS5 storage suitable for large codebases.
- Watcher and staleness UX are concrete and mature.
- Tool design is very agent-shaped: one primary context tool plus narrow follow-up tools.

## Where CMAP Remains Different

- CMAP owns reviewed module responsibilities, handoff, decisions, and verification discipline.
- CMAP explicitly distinguishes canonical `.context` from generated support layers and relation candidates.
- CMAP's graph projection is a reviewed module relation projection, not an import/call graph.
- CMAP's route/brief/pack commands are task governance tools, not code search tools.

## CMAP Takeaways

- CodeGraph could feed CMAP relation candidates and source evidence.
- CMAP could borrow CodeGraph's freshness banner pattern for generated support layers.
- SQLite/FTS5 may be worth considering for large generated evidence, route stats, and candidate search.
- CodeGraph's MCP tool copy is useful: agents need strong "query graph first, read files second" guidance.
- CMAP should not collapse into CodeGraph's layer; reviewed project memory remains the differentiator.
