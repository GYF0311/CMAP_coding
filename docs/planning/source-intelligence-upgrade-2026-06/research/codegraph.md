# CodeGraph Research

Date: 2026-06-04
Local snapshot: `8629f7a`
License: MIT
Runtime: TypeScript / Node

## Research Scope

This report consolidates CodeGraph source architecture research for CMAP's source-intelligence upgrade. The source is treated as an implementation reference only; no CodeGraph code should be copied into CMAP.

Primary intermediate notes:

- `agent-notes/codegraph-source-architecture.md`
- `agent-notes/codegraph-query-mcp.md`

## Source Files Inspected

The source architecture agent inspected:

- `src/types.ts`
- `src/extraction/index.ts`
- `src/extraction/tree-sitter.ts`
- `src/extraction/tree-sitter-types.ts`
- `src/extraction/grammars.ts`
- `src/extraction/parse-worker.ts`
- `src/extraction/tree-sitter-helpers.ts`
- `src/extraction/generated-detection.ts`
- `src/extraction/languages/*.ts`
- `src/extraction/svelte-extractor.ts`
- `src/extraction/vue-extractor.ts`
- `src/db/schema.sql`
- `src/db/index.ts`
- `src/db/migrations.ts`
- `src/db/sqlite-adapter.ts`
- `src/db/queries.ts`
- `src/graph/traversal.ts`
- `src/graph/queries.ts`
- `src/sync/watcher.ts`
- `src/sync/watch-policy.ts`
- `src/sync/git-hooks.ts`
- `src/sync/worktree.ts`
- `src/mcp/tools.ts`
- `src/mcp/server-instructions.ts`
- `src/mcp/session.ts`
- `src/mcp/engine.ts`
- `src/context/index.ts`
- `src/context/formatter.ts`
- `src/search/query-parser.ts`
- `src/search/query-utils.ts`
- `src/bin/codegraph.ts`

## Core Implementation Mechanisms

CodeGraph is the most directly relevant implementation reference because it is already TypeScript/Node and local-first.

Its implementation pattern is:

```text
scan files
  -> detect language
  -> parse with tree-sitter
  -> create file/symbol nodes
  -> record unresolved refs
  -> resolve refs into edges
  -> store nodes/edges/files/unresolved refs in SQLite
  -> query with bounded traversal
```

Important mechanisms:

- File scanning is git-aware but supports non-git fallback.
- Ignore rules are reused across index and watcher behavior.
- Language detection is extension-driven.
- Extraction creates typed nodes and containment edges.
- Calls/imports/inheritance often start as unresolved references.
- SQLite stores `nodes`, `edges`, `files`, and `unresolved_refs`.
- `files` records hash/size/mtime/index time/error counts for freshness.
- FTS5 supports fast symbol search.
- Traversal APIs are bounded by depth, edge kinds, node kinds, and limits.
- Watcher and git hooks are optional freshness accelerators.
- Worktree mismatch detection prevents using an index from another branch/worktree.
- MCP tools expose search, context, callers, callees, impact, trace, explore, files, and status over the same graph/query core.
- Tool descriptions and server instructions teach agents which query to use before broad source reads.
- Output budgets are enforced by limits, truncation notes, omitted-result notes, and adaptive explore budgets.
- Staleness notices are attached to query results when the watcher or catch-up sync sees pending files.

## Relevant Capabilities

CodeGraph directly addresses CMAP's four current gaps:

| CMAP Gap | CodeGraph Mechanism |
|---|---|
| Function/symbol callers | Incoming call/reference edges through graph traversal |
| Function/symbol callees | Outgoing call edges and context query |
| File impact | File dependency/dependent queries and impact traversal |
| Token-saving lookup | Query-specific context instead of broad file reads |

## What CMAP Should Absorb

CMAP should absorb the architecture pattern, not the code:

- Generated source index below the `.context` trust boundary.
- TS/JS-first parser and symbol extractor.
- `source_files`, `source_symbols`, `source_edges`, `source_unresolved_refs`, and `source_metadata` schema.
- File freshness metadata in every query result.
- Explicit bounded traversal for callers, callees, dependents, and impact radius.
- Stale-index and worktree-mismatch warnings.
- Generated-file down-ranking.
- Optional future watch/sync, but not as the default MVP behavior.
- A question-shaped CLI/MCP surface rather than a raw graph dump.
- A `source status` command that exposes stale files, index health, and root/worktree mismatch.
- Tool-selection guidance in CMAP skills and future MCP descriptions.

## What CMAP Should Not Absorb

- Full multi-language support in MVP.
- Default daemon/watch behavior.
- Git hook installation as a default path.
- Component/template extraction before plain TS/JS works.
- Dead-code claims as product truth.
- Auto-promotion from source graph to canonical `.context`.
- Any wording that makes source graph equal reviewed module graph.
- A detached MCP daemon or broad tool surface as the first release.
- The stance that agents should trust the source graph instead of reading source when stale or ambiguous.

## CMAP TypeScript Rewrite Direction

Recommended CMAP-native design:

```text
src/source-intelligence/
  indexer.ts
  scanner.ts
  extractors/typescript.ts
  resolver.ts
  store.ts
  queries.ts
  impact.ts
```

Candidate generated state:

```text
.context/generated/source-index/
  index.sqlite
  metadata.json
  evidence/*.jsonl
```

Minimum schema:

- `source_files(path, language, content_hash, size, modified_at, indexed_at, status, error_json)`
- `source_symbols(id, kind, name, qualified_name, file_path, start_line, end_line, parent_id, export_kind, signature)`
- `source_edges(source_id, target_id, kind, file_path, line, col, provenance, confidence_tier)`
- `source_unresolved_refs(from_id, ref_name, ref_kind, file_path, line, col, candidates_json)`
- `source_metadata(key, value, updated_at)`

P0 extraction should target CMAP's own stack:

- `.ts` / `.tsx`
- imports and re-exports
- functions
- classes
- methods
- exported constants
- call expressions
- test files

## CMAP Modules Affected

- New module candidate: `source-intelligence`.
- `cli`: new `source`, `symbol`, `impact` commands.
- `evidence`: generated source evidence and freshness records.
- `brief`: optional source-evidence pack.
- `pack`: budgeted source snippets/symbol summaries.
- `view`: source evidence panel.
- `benchmark`: source-intelligence A/B metrics.
- `skill`: agent guidance for source queries.
- `graph`: must stay canonical module graph, not source graph.
- `route`: may show source evidence as support, not direct scoring truth.

## Risks And Verification

Risks:

- Static extraction misses dynamic behavior.
- Stale source index gives precise but wrong answers.
- Worktree mismatch returns another branch's facts.
- SQLite locks can hurt agent sessions.
- Feature creep turns CMAP into another CodeGraph clone.

Verification:

- TS fixture extraction tests.
- Import/re-export/call graph tests.
- Add/modify/delete sync tests.
- Stale source index tests.
- Worktree mismatch tests.
- No canonical write tests.
- Source-aware brief budget tests.

## CMAP Fit

CodeGraph is the best implementation reference for CMAP's TS-native source-intelligence MVP.

The correct absorption strategy is:

```text
study CodeGraph architecture
  -> rewrite narrow TS/JS MVP in CMAP style
  -> store as generated evidence
  -> expose minimal CLI queries
  -> integrate with brief/view/inbox only after trust-boundary tests pass
```

## Agent Surface Lesson

The most useful product lesson from CodeGraph is the one-primary-tool shape:

```text
search/find
  -> context/explain
  -> callers/callees/impact when structural precision is needed
  -> status whenever freshness is uncertain
```

CMAP should expose this through CLI first and MCP later. Every source command should output:

- query target
- matched symbols/files
- freshness state
- confidence/provenance
- omitted/truncated result counts
- next suggested command

This makes source intelligence usable by AI agents without letting it become canonical memory.
