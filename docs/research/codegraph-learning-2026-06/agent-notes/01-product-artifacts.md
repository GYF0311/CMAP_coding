# CodeGraph Agent Note 01: Product And Artifacts

Date: 2026-06-04
Agent focus: product value, user-facing features, and outputs
Mode: local read-only research

## Research Scope

Studied local CodeGraph snapshot:

- `research/coding-knowledge-graphs-2026-06/repos/codegraph/README.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/package.json`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/site/src/content/docs/getting-started/introduction.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/site/src/content/docs/getting-started/quickstart.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/site/src/content/docs/reference/cli.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/site/src/content/docs/reference/mcp-server.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/bin/codegraph.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/server-instructions.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/db/schema.sql`
- `docs/planning/source-intelligence-upgrade-2026-06/research/codegraph.md`

## One-Sentence Conclusion

CodeGraph is a local code-structure indexer: it turns a codebase into a searchable source relationship graph so AI agents can ask "who calls this?", "what changes if I edit this?", and "where should I start?" without repeatedly scanning files.

## Problem It Solves

When an AI coding agent enters an unfamiliar repository, it usually spends many steps on `grep`, `find`, and `Read`. That is slow, token-heavy, and noisy. CodeGraph pre-indexes the repository into symbols, calls, imports, files, and framework routes, so the agent can query the index first.

It is a source intelligence layer. It answers what the current source code appears to contain and how code elements connect. It does not maintain reviewed project facts or product decisions.

## Main Features In Plain Language

- Install and connect agents: `codegraph install` configures Claude Code, Cursor, Codex CLI, opencode, Gemini, Antigravity, Kiro, and other agent clients through MCP.
- Build a graph: `codegraph init` and `codegraph index` scan the project and create a local `.codegraph` index.
- Keep it fresh: `codegraph sync` updates the index. The MCP server can watch files and warn when results may be stale.
- Search code: `codegraph query UserService` finds functions, classes, methods, and other named code elements.
- Build task context: `codegraph context "fix login flow"` returns likely entry points, related symbols, and small code snippets.
- Inspect call relationships: `callers` shows what calls a symbol; `callees` shows what a symbol calls.
- Estimate impact: `impact` reports code likely affected by changing a symbol.
- Find affected tests: `affected` traces dependencies from changed files to likely relevant tests.
- Serve AI tools: the MCP server exposes `codegraph_search`, `codegraph_context`, `codegraph_trace`, `codegraph_explore`, `codegraph_node`, `codegraph_files`, and `codegraph_status`.

## Main Outputs

- `.codegraph/`: the project-local CodeGraph data directory.
- `.codegraph/codegraph.db`: a SQLite database containing `nodes`, `edges`, `files`, `unresolved_refs`, full-text search indexes, and metadata.
- CLI reports: search results, status reports, callers/callees lists, impact reports, affected test lists.
- Markdown or JSON context packs for AI agents or scripts.
- MCP tool responses with source snippets, relationship paths, and staleness warnings.
- Agent configuration entries for launching the CodeGraph MCP server.

## Non-Technical Explanation

If a codebase is a building, CodeGraph is not the meeting notes or the project manager. It is the building map, room directory, and wiring diagram.

When a person or agent asks "where does this button lead?", "which rooms lose power if this wire changes?", or "which door reaches this office?", CodeGraph avoids opening every door. It checks the map first.

## Caveats For Controller Review

- Documentation appears slightly out of sync around whether installer instructions are written into files or provided by MCP initialization.
- `init -i` language differs across README, docs, and source behavior.
- Benchmark claims vary across README sections. Prefer saying CodeGraph claims to reduce cost, tokens, time, and tool calls rather than treating one exact percentage as stable.
- CodeGraph instructions encourage agents to trust CodeGraph before grep. CMAP should downgrade that stance: source graph output is generated evidence, not reviewed project truth.
- This note did not run `codegraph init` or validate a live index; it is a read-only product/artifact review.
