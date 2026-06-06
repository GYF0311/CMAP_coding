# CodeGraph Agent Note 02: Source Architecture

Date: 2026-06-04
Agent focus: indexing, graph model, storage, traversal, and freshness
Mode: local read-only research

## Research Scope

Studied these core paths:

- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/types.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/extraction/index.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/extraction/tree-sitter.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/db/schema.sql`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/db/queries.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/graph/traversal.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/graph/queries.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/sync/watcher.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/sync/worktree.ts`
- `research/coding-knowledge-graphs-2026-06/repos/codegraph/src/index.ts`

## One-Sentence Conclusion

CodeGraph is not just "code search"; it parses source code into a typed graph stored in local SQLite, then answers focused questions over that graph.

## Architecture Sketch

```text
project files
  -> git-aware scan + ignore rules
  -> language detection
  -> tree-sitter parser + language extractors
  -> nodes / contains edges / unresolved refs
  -> SQLite: .codegraph/codegraph.db
  -> reference resolver
  -> calls/imports/extends/references edges
  -> traversal/query/MCP/CLI answers

freshness layer:
  files table hash + mtime
  + sync
  + watcher pending files
  + optional git hooks
  + worktree mismatch warning
```

## Key Technical Mechanisms

### Source Index

Plain meaning: CodeGraph turns the project into a local query database.

It uses `git ls-files` where possible to collect tracked and untracked non-ignored files. Non-git projects fall back to filesystem walking. It also has built-in ignore rules for dependency, build, cache, and vendor directories such as `node_modules`, `dist`, `build`, and `.cache`.

Each indexed file records content hash, size, modification time, index time, language, node count, and extraction errors.

### Extractor

Plain meaning: CodeGraph breaks a source file into named code pieces.

Tree-sitter parses code. Language-specific extractors identify files, classes, functions, methods, variables, imports, calls, and other symbols. CodeGraph creates `file` and symbol nodes, then uses `contains` edges for nesting such as file contains class, class contains method.

Calls, imports, inheritance, and type references often begin as unresolved references. CodeGraph stores them first and resolves them after all symbols are indexed.

### Database

Plain meaning: the graph is stored locally, so agents do not repeatedly reread the whole repository.

The main SQLite tables are `nodes`, `edges`, `files`, `unresolved_refs`, and `project_metadata`. `nodes_fts` provides full-text search over symbol names, qualified names, docstrings, and signatures. Edge indexes make incoming and outgoing relationship queries fast.

### Reference Resolution

Plain meaning: when CodeGraph sees `foo()`, it first records "something called foo" and later decides which actual function this probably points to.

Resolution filters built-ins and external symbols, applies framework and import rules, then matches names. Successful resolution converts unresolved references into `calls`, `imports`, `extends`, `implements`, `references`, and `instantiates` edges.

### Traversal

Plain meaning: CodeGraph walks only the relevant neighborhood of a symbol rather than dumping the whole graph.

Traversal supports depth, edge kinds, node kinds, direction, and result limits. `getCallers` follows incoming call/reference/import edges. `getCallees` follows outgoing relationships. `getImpactRadius` follows incoming dependents and expands container nodes when necessary.

### Freshness And Staleness

Plain meaning: CodeGraph tries to tell the agent when the graph may be behind the real files.

Sync compares the filesystem with the database. It uses size and mtime as a fast check, then hashes contents when needed. Deleted files are removed from the database. The watcher records pending edited files. MCP responses can show staleness banners so the agent knows when to read a specific live file. Worktree mismatch detection warns if an index from another branch or worktree is being reused.

## Strengths

1. Query shapes match how agents ask questions: callers, callees, impact, context.
2. Local SQLite plus FTS is practical: fast, incremental, and cloud-free.
3. Extraction and resolution are separated, which makes multi-language and framework support easier to grow.
4. Freshness is treated seriously through hashes, mtimes, pending files, and worktree warnings.
5. Output limits, traversal depth, generated-file downranking, and source budgets reduce context bloat.

## Limits And Risks

1. Static analysis is not runtime truth. Dynamic calls, reflection, dependency injection, and framework magic can be missed.
2. Multi-language coverage creates many edge cases.
3. Staleness cannot be eliminated. If watcher is disabled, users must sync or force index.
4. SQLite write locks can still be a real issue under multiple writer processes.
5. Generated-file detection is a relevance hint, not a reliable fact.
6. This graph knows code structure, not product intent or reviewed project decisions.

## Lessons For CMAP

CMAP should absorb the architecture pattern, not the full ambition.

The best fit is a TS/JS-first generated source index under `.context/generated/source-index/`, with every answer clearly marked as `generated=true` and `canonical=false`.

The first useful loop is narrow: `source status`, `symbol find`, `symbol explain`, `symbol callers`, `symbol callees`, and `impact file/symbol`, each with freshness and staleness notices. CMAP should not start with daemon, all-language coverage, or a wide MCP surface.

Most important boundary: source graph can support judgment, but it must not automatically edit `.context/MAP.md` or module docs.
