# CodeGraph Agent Note 04: CMAP Boundary Review

Date: 2026-06-04
Agent focus: what CMAP should absorb and what it should reject
Mode: local read-only research

## Research Scope

Studied CMAP boundary files:

- `.context/MAP.md`
- `.context/CHECKPOINT.md`
- `.context/modules/source-intelligence.md`
- `.context/modules/showcase.md`
- `.context/modules/evidence.md`
- `.context/modules/view.md`

Studied existing planning and research:

- `docs/planning/source-intelligence-upgrade-2026-06/research/codegraph.md`
- `docs/planning/source-intelligence-upgrade-2026-06/implementation-roadmap.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`

Studied CodeGraph reference points:

- `research/coding-knowledge-graphs-2026-06/repos/codegraph/README.md`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/package.json`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/db/schema.sql`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/types.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/server-instructions.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/mcp/tools.ts`

## One-Sentence Conclusion

CodeGraph is valuable because it reduces blind source exploration; CMAP must not let its source graph become canonical project truth.

## Where CodeGraph Is Strong

- It turns the repository into a local index with problem-shaped query entry points: symbol, callers, callees, impact, context, and status.
- It is an integrated experience, not just a parser: SQLite/FTS, tree-sitter, multi-language extraction, framework bridges, watcher, stale warnings, worktree mismatch warnings, output budgets, and MCP guidance.
- It productizes "read fewer files": the agent asks the graph first, then reads fewer targeted source files.
- It makes freshness visible: pending files, stale results, and mismatched worktrees are user-facing warnings.

## What CMAP Should Absorb

- Architecture pattern:

```text
source files
  -> generated source index
  -> source evidence
  -> inbox / review surface
  -> human promotion
  -> canonical .context only after review
```

- A narrow TS/JS-first MVP serving CMAP's own codebase.
- Commands such as `source status`, `symbol find`, `symbol callers`, `symbol callees`, and `impact file`.
- Every result should show generated/non-canonical status, freshness, provenance, confidence, omitted/truncated counts, and suggested next step.
- Source evidence can support `brief`, Review HTML, and benchmark, but only as a support panel.
- Agent guidance should say when to query source index and when to fall back to reading source directly.
- CMAP should run its own evaluation instead of reusing CodeGraph's marketing performance numbers.

## What CMAP Should Not Absorb

- Do not copy CodeGraph source, schema text, README copy, MCP instructions, or installer language.
- Do not copy the "trust graph, do not grep" stance. In CMAP, source graph is evidence, not judge.
- Do not default to daemon, watcher, git hooks, global MCP installer, or auto-allow permissions.
- Do not clone CodeGraph's full multi-language matrix, framework route bridge, React Native/iOS cross-language bridge, or dead-code claims.
- Do not let source graph automatically edit `MAP.md`, module docs, route scoring, or reviewed relations.
- Do not revive old import graph, route v2, or pack v2 under the new source-intelligence name.

## Three Judgments For Non-Technical Readers

1. CodeGraph solves "the agent spends too much time finding code"; it does not solve "which project facts are trusted".
2. CMAP's moat is the trust boundary. The stronger source graph becomes, the more clearly it must stay below reviewed memory.
3. The right absorption path is a narrow source evidence layer first, then human review before anything enters `.context`.

## Recommendation For Final Report

Use this positioning:

> CodeGraph is a source evidence engine, not a replacement for CMAP's project fact map.

The final report should show three columns: CodeGraph strengths, what CMAP can absorb, and what CMAP must reject. It should repeat that source graph is not canonical truth in both the summary and conclusion.
