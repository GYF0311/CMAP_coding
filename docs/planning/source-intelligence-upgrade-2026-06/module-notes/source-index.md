# Source Index

Date: 2026-06-04

## Capability

CMAP needs a generated source index that can answer code-structure questions without scanning the repo repeatedly during every AI coding task.

The index is not canonical memory. It is rebuildable generated evidence.

## Competitor Evidence

| Project | Useful Pattern |
|---|---|
| CodeGraph | TS/Node local index, SQLite schema, file freshness, unresolved refs, bounded traversal |
| Code Review Graph | SQLite graph store, hash-based incremental update, recursive CTE impact traversal |
| Graphify | manifest hashes, confidence labels, source-location provenance |
| GitNexus | phase DAG, source freshness metadata, direct CLI plus MCP over same backend |

## CMAP-Native Design

Recommended new module:

```text
source-intelligence
```

Recommended implementation layout:

```text
src/source-intelligence/
  scanner.ts
  schema.ts
  indexer.ts
  extractors/typescript.ts
  resolver.ts
  store.ts
  queries.ts
  impact.ts
  evidence.ts
```

Generated state:

```text
.context/generated/source-index/
  source-index.meta.json
  files.json
  symbols.json
  edges.json
  unresolved-refs.json
  evidence/*.jsonl
```

SQLite can be introduced later if JSON files become too slow. The public query API should not depend on physical storage.

## Minimum Schema

```ts
type SourceFileRecord = {
  path: string;
  language: "typescript" | "javascript" | "unknown";
  hash: string;
  size: number;
  modifiedAt: string;
  indexedAt: string;
  parseErrors: string[];
};

type SourceSymbol = {
  id: string;
  kind: "File" | "Function" | "Class" | "Method" | "Type" | "Variable" | "Test";
  name: string;
  qualifiedName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  parentId?: string;
  signature?: string;
};

type SourceEdge = {
  kind: "CONTAINS" | "IMPORTS_FROM" | "EXPORTS" | "CALLS" | "REFERENCES" | "TESTED_BY";
  sourceId: string;
  targetId: string;
  filePath: string;
  line?: number;
  confidenceTier: "parsed" | "resolved-local" | "resolved-import" | "typechecker" | "heuristic" | "unresolved";
  confidence: number;
  provenance: string;
};
```

## MVP Scope

P0 should index TypeScript/JavaScript only:

- `.ts`
- `.tsx`
- `.js`
- `.jsx`
- `.mjs`
- `.cjs`

P0 should extract:

- files
- imports
- exports
- re-exports
- functions
- classes
- methods
- exported constants
- call expressions where target is high-confidence
- test files and test blocks

## Commands

Candidate commands:

```bash
cmap source index
cmap source status
cmap source clean --generated-only
```

`source clean` should be postponed unless needed; generated files can usually be overwritten. Any delete-like operation must respect the project deletion rules and avoid `rm`.

## Trust Boundary

Source index writes only:

```text
.context/generated/source-index/**
.context/inbox/candidates/** when explicitly requested
```

It must not write:

```text
.context/MAP.md
.context/modules/*.md
.context/DECISIONS.md
.context/VERIFY.md
```

## Verification

- Fixture extraction tests.
- Generated path safety tests.
- Hash/freshness tests.
- Deleted/renamed file tests.
- Trust-boundary tests proving no canonical writes.
