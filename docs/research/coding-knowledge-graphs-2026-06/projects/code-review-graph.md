# Code Review Graph

Repository: `tirth8205/code-review-graph`
Local checkout: `/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/code-review-graph`
Commit: `0c9a5ff`
Agents: Architecture Agent + Product Boundary Agent

## Verdict

Code Review Graph is a strong review-time source graph and MCP companion. It is not a CMAP superset.

It is very close to CMAP's "reduce context and guide AI coding" concern, but it attacks the problem from source-code structure and review context. CMAP attacks the problem from project memory governance, handoff, reviewed module boundaries, and safe promotion of semantic facts.

Classification: **Strong complement; partial peer on AI review context compression; not a superset.**

## What It Is

Code Review Graph is a local-first Python code intelligence graph:

1. Discover source files with git/SVN and ignore rules.
2. Parse files with Tree-sitter and language-specific fallbacks.
3. Store graph nodes and edges in SQLite.
4. Add FTS, flows, communities, risk summaries, and memory/wiki features.
5. Expose CLI, MCP, daemon, watch, visualization, and VS Code surfaces.

Its main use case is code review and change impact:

- minimal context first;
- impact radius;
- review context;
- detect changes;
- risk/test-gap summaries;
- AI review assistance.

## Graph And Storage Model

The graph model is source-derived and SQLite-backed.

Nodes include:

- `File`
- `Class`
- `Function`
- `Test`
- `Type`

Edges include:

- `CALLS`
- `IMPORTS_FROM`
- `INHERITS`
- `IMPLEMENTS`
- `CONTAINS`
- `TESTED_BY`
- `DEPENDS_ON`
- `REFERENCES`
- plus enhanced edges such as `INJECTS`, `CONSUMES`, `PRODUCES`, and temporal stubs.

Storage defaults to `.code-review-graph/graph.db` with SQLite WAL, migrations, FTS5, summary tables, edge confidence, and recursive CTE traversal for impact radius.

## Trust Boundary

Code Review Graph has mechanical provenance: file path, line, hash, qualified name, and edge confidence tiers. That is useful. It is still not CMAP's reviewed semantic fact lifecycle.

Important boundary notes:

- `detect-changes --brief` is read-only.
- `update --brief` refreshes graph state.
- Refactor tools can eventually write source files after dry-run paths.
- Memory/wiki outputs can turn graph or Q&A material into Markdown, which can blur "generated analysis" vs "reviewed knowledge".

For CMAP, Code Review Graph output should enter `.context/generated` or `.context/inbox`, not `.context/MAP.md` directly.

## Where It Is Stronger Than CMAP

- Source-code blast radius and review-time impact analysis.
- SQLite graph implementation with FTS5 and recursive traversal.
- Rich MCP and IDE integration surface.
- Practical context-savings framing and minimal-context entrypoint.
- Review-focused tooling: tests, risk, changed files, affected symbols.

## Where CMAP Remains Different

- CMAP's canonical project memory is reviewed Markdown under `.context`.
- CMAP explicitly separates generated support evidence, candidates, and canonical facts.
- CMAP's route/brief/pack are task-context governance tools, not automatic code graph queries.
- CMAP currently avoids reviving import graph/test ownership as the active roadmap.

## CMAP Takeaways

- Borrow the "minimal context first" entry pattern.
- Borrow context-savings metrics, but label them as estimates.
- Consider SQLite + FTS5 + recursive CTE for generated evidence and source-derived relation candidates.
- Treat CRG-style impact data as evidence for review, not a replacement for module ownership decisions.
- Keep CMAP's stronger promotion boundary and avoid silent canonicalization.
