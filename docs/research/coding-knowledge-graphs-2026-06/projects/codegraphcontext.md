# CodeGraphContext

Repository: `CodeGraphContext/CodeGraphContext`
Local checkout: `/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/codegraphcontext`
Commit: `38f5289`
Agents: Architecture Agent + Product Boundary Agent

## Verdict

CodeGraphContext is a mature source-derived property graph engine for code intelligence. It is useful as a candidate evidence source for CMAP, but it does not replace CMAP's reviewed project memory and trust boundary.

Classification: **Complement; partial peer on graph-assisted source understanding; not a superset.**

## What It Is

CodeGraphContext is a Python MCP server plus CLI toolkit. It indexes local repositories into a queryable graph database and exposes source-structure queries to AI tools and humans.

Main workflow:

1. Install `cgc`.
2. Run `cgc index [path]` or use MCP `add_code_to_graph`.
3. Query callers, callees, call chains, dead code, complexity, and relationship data.
4. Optionally run `watch`, visualizer, bundles, and registry/context switching.

Key runtime pieces:

- `MCPServer` composes database, jobs, graph builder, finder, and watcher.
- `GraphBuilder` orchestrates indexing.
- `CodeFinder` handles graph queries and relationship analysis.
- Typer CLI, stdio JSON-RPC MCP, optional MCP-over-SSE FastAPI, and a local graph visualization server provide entrypoints.

## Graph And Storage Model

The graph is symbol-level and property-graph oriented.

Nodes include:

- `Repository`
- `Directory`
- `File`
- `Function`
- `Class`
- `Module`
- `Parameter`
- language/build/datasource-specific nodes

Edges include:

- `CONTAINS`
- `CALLS`
- `IMPORTS`
- `INHERITS`
- `IMPLEMENTS`
- `HAS_PARAMETER`
- `INCLUDES`
- Spring/build/datasource relations

Indexing flow:

1. Discover files with `.cgcignore` and ignore rules.
2. Pre-scan imports.
3. Concurrently parse files with Tree-sitter.
4. Write nodes, ownership, and import edges.
5. Post-process inheritance and call edges.
6. Optionally use SCIP when configured and suitable.

Storage is backend-pluggable: FalkorDB Lite/Remote, KuzuDB, Neo4j, Nornic, Ladybug. Agents noted doc/source drift around the default backend, so source configuration should be treated as the stronger evidence.

## Trust Boundary

CodeGraphContext has some good safety controls:

- MCP indexing is restricted to current working directory or `CGC_ALLOWED_ROOTS`.
- Direct Cypher query tools block write keywords.
- Query responses can be token-capped.
- Repository and nodes carry provenance-like metadata such as commit, path, line, source, and docstring.

But it is still an automatically written graph database from parsed source. It does not have CMAP's "AI proposal -> inbox -> human promote -> canonical map" lifecycle.

## Where It Is Stronger Than CMAP

- Rich source-level graph query surface.
- Multiple graph backend choices.
- MCP and CLI breadth.
- Watch mode, visualizer, bundles, registry/context switching.
- Useful root guards and read-only query enforcement patterns.

## Where CMAP Remains Different

- CMAP's source of truth is reviewed `.context` Markdown.
- CMAP distinguishes canonical facts from generated support and candidates.
- CMAP's graph is a reviewed module-relation projection, not a symbol database.
- CMAP has task handoff, route, pack, finish, verify, and MapPatch policy gates.

## CMAP Takeaways

- Borrow `allowed-roots` style protections for any future external analyzer integration.
- Borrow read-only query enforcement and response budgets.
- Borrow portable graph snapshot/bundle thinking for non-canonical evidence exports.
- Use CodeGraphContext as a source evidence producer into `.context/inbox`, not a canonical writer.
- Be cautious about syntactic graph certainty: Tree-sitter is useful but not sufficient to prove product semantics.
