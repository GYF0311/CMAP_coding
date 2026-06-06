# Code Review Graph Agent Note 03: Technical Architecture

Date: 2026-06-04
Agent focus: parser, graph storage, SQLite, query tools, MCP/CLI/daemon
Mode: local read-only research

## Research Scope

Studied:

- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/graph.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/parser.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/search.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/postprocessing.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/enrich.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/tsconfig_resolver.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/jedi_resolver.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/main.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/cli.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/daemon.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/tools/query.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/docs/schema.md`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/docs/architecture.md`

## One-Sentence Conclusion

Code Review Graph is a local source graph engine: it parses code into nodes and edges, stores them in SQLite, and answers review-focused questions from that database.

## Architecture Sketch

```text
source / notebook / SQL files
  -> CodeParser / Tree-sitter
     turns code into functions, classes, calls, imports
  -> NodeInfo / EdgeInfo
     normalizes code into points and lines
  -> GraphStore / SQLite
     stores graph in a local database file
  -> post-processing
     adds signatures, full-text search, flows, communities, risk index
  -> query tools
     answers callers, callees, impact, tests, review context
  -> CLI / MCP / daemon / hooks
     exposes the same graph to humans, AI tools, and background updates
```

## Main Technical Components

### Parser

Core parser: `parser.py`.

Plain meaning: it reads different programming languages and extracts files, classes, functions, tests, and types.

### GraphStore

Core storage: `graph.py`.

Plain meaning: it is the local source graph repository. It stores `nodes`, `edges`, and `metadata` in SQLite.

### SQLite Schema

Documented in `docs/schema.md`.

Plain meaning: it uses ordinary database tables to represent code elements and code relationships, rather than requiring a heavy graph database.

### FTS5

Core search: `search.py`.

Plain meaning: it creates a fast full-text search index over names, paths, and signatures.

### Recursive CTE

Core impact traversal: `GraphStore.get_impact_radius_sql`.

Plain meaning: SQLite itself repeatedly expands the "impact radius", so Python does not need to load and walk the whole graph for every query.

### Query Tools

Core tool surface: `tools/query.py`.

Plain meaning: complex graph queries are reduced to fixed questions such as callers, callees, imports, tests, and impact.

### MCP / CLI / Daemon

Entrypoints: `main.py`, `cli.py`, `daemon.py`.

Plain meaning:

- MCP serves AI tools.
- CLI serves humans and scripts.
- daemon serves background multi-repo watching and updates.

### Language Resolvers

Examples: `tsconfig_resolver.py`, `jedi_resolver.py`.

Plain meaning: Tree-sitter alone is not enough. Extra rules help reconnect TypeScript aliases and Python dynamic references.

## Data Flow

1. `build` collects parsable files and skips ignored, binary, or generated outputs.
2. `CodeParser` emits `NodeInfo` and `EdgeInfo`.
3. `GraphStore.store_file_nodes_edges()` atomically replaces graph data for each file and uses hashes for incremental updates.
4. `postprocessing` adds signatures, FTS, flows, communities, and risk index.
5. `query_graph`, `get_impact_radius`, and `detect_changes` package graph answers into review outputs and token-savings metadata.

## Technical Strengths

- Simple graph model: nodes plus edges.
- Impact traversal lives in SQLite recursive queries, which scales better for large repositories than hand-walking everything in Python.
- Small query vocabulary helps AI tools avoid guessing.
- Incremental update uses changed files, dependents, and hashes.
- Token saving is treated as output metadata rather than only a marketing statement.

## Risks And Complexity

- The parser is already large, which shows the cost of broad multi-language support.
- Accuracy is not compiler-level. Dynamic calls, aliases, and framework behavior can still be wrong or missing.
- The MCP surface is wide, which itself can add cognitive and context overhead.
- Daemon adds background state: child processes, logs, PID files, health checks, and multi-repo state.
- Risk score is heuristic. It can prioritize review, but it should not become an objective quality score.

## Lessons For CMAP

CMAP should absorb the generated source evidence pattern, not the whole platform.

Good first scope:

- TS/JS graph only.
- File and symbol nodes.
- `CALLS`, `IMPORTS`, `TESTED_BY`, `REFERENCES` edges.
- Fixed query vocabulary: callers, callees, imports, impact, tests.
- Review HTML can show source evidence with freshness, confidence, and truncation labels.

Avoid for CMAP MVP:

- daemon
- wide MCP tool surface
- Python/Jedi enrichment stack
- all-language parser ambition
- background memory/wiki generation
