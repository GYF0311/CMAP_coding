# Code Review Graph Agent Note 01: Product Functions And Outputs

Date: 2026-06-04
Agent focus: product function, user-facing outputs, and non-technical explanation
Mode: local read-only research

## Research Scope

Studied local Code Review Graph snapshot:

- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/README.md`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/docs/FEATURES.md`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/docs/USAGE.md`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/docs/COMMANDS.md`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/docs/LLM-OPTIMIZED-REFERENCE.md`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/pyproject.toml`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code-review-graph-vscode/README.md`
- `docs/research/coding-knowledge-graphs-2026-06/projects/code-review-graph.md`
- `docs/planning/source-intelligence-upgrade-2026-06/research/code-review-graph.md`

## One-Sentence Conclusion

Code Review Graph is best understood as a code review assistant and blast-radius risk radar. It has a general source graph underneath, but its product center is helping AI and humans review changes with less irrelevant code.

## Problem It Solves

AI code review often wastes tokens by rereading large parts of a repository. It can also miss the real impact of a change: which functions changed, who calls them, which tests are related, and where risk is concentrated.

Code Review Graph parses code into a local SQLite graph, then uses that graph during review to answer:

- What changed?
- Which functions/classes/tests did the change touch?
- What could be affected downstream or upstream?
- Which tests look relevant or missing?
- What is the smallest useful review context?

## Main Features

- Install and configure Codex, Claude Code, Cursor, Copilot, and other tools through MCP, hooks, skills, or platform rules.
- `build`, `update`, and `watch` create and refresh the source graph.
- `detect-changes`, `review-delta`, and `review-pr` analyze diffs and pull requests.
- MCP tools provide minimal context, impact radius, review context, callers/callees/imports/tests queries.
- Full-text search and optional embeddings support semantic search.
- Flow, community, architecture overview, hub/bridge, knowledge gap, and surprising connection tools analyze higher-level structure.
- Visualization and export options include interactive HTML/D3, GraphML, SVG, Obsidian, Neo4j Cypher, and wiki pages.
- VS Code extension adds tree view, blast radius, review changes, callers/callees/tests, graph view, search, and watch mode.

## Main Outputs

- `.code-review-graph/graph.db`: local SQLite source graph database.
- AI tool configuration: MCP config, hooks, skills/slash commands, platform rules.
- Review outputs: risk panel, token savings panel, review context, impact radius, test gaps.
- Visual and knowledge outputs: `.code-review-graph/graph.html`, GraphML/SVG/Obsidian/Cypher exports, `.code-review-graph/wiki/`.
- Multi-repo daemon state: `~/.code-review-graph/watch.toml` and watch health state.
- VS Code views: graph tree, interactive graph, search, and change impact views.

## Typical Scenarios

- First setup: run `install` and `build` so AI tools can query the graph.
- Daily change review: run `detect-changes --brief` or `/review-delta` before committing.
- PR review: use branch diff analysis to find impact radius, affected flows, and test gaps.
- Large refactor: run `update --brief` to refresh the graph and then review the changed area.
- Onboarding: use architecture overview, communities, wiki, and search to understand a repository.
- VS Code use: inspect callers, callees, tests, and blast radius from the editor.

## Difference From CodeGraph

Both projects build a local source graph with SQLite/FTS/MCP and support calls/imports/impact queries.

The difference is product center:

- CodeGraph is closer to a general source map and agent source index. It helps agents navigate code and reduce grep/read during many kinds of tasks.
- Code Review Graph is closer to a code review assistant. It wraps the graph around review-delta, review-pr, detect-changes, risk scoring, test gaps, token savings, blast radius, review prompts, and VS Code review actions.

## Non-Technical Analogy

CodeGraph is like a city map: it shows streets, buildings, and routes.

Code Review Graph is like a construction impact assessor: if you dig up one road, it tells you which streets, pipes, shops, and inspections may be affected.

## Caveats For Controller Review

- Benchmark and token-saving numbers were read from local docs and not rerun.
- VS Code Marketplace status was not verified online.
- `install` writes MCP config, hooks, and platform rules; useful as a product feature, but CMAP should treat that as a risky external-write pattern.
- Memory/wiki/refactor outputs can blur generated analysis into apparent knowledge. For CMAP, they should enter generated evidence or inbox, not canonical facts.
- Broad language coverage was not audited language by language.
