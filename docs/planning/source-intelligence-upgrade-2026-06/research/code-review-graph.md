# Code Review Graph Research

Date: 2026-06-04
Local snapshot: `0c9a5ff`
License: MIT
Runtime: Python

## Research Scope

This report consolidates Code Review Graph findings for impact analysis, minimal review context, token-saving benchmarks, parser/schema design, and CMAP adaptation.

Primary intermediate notes:

- `agent-notes/code-review-graph-impact-token.md`
- `agent-notes/code-review-graph-parser-schema.md`

## Source Files Inspected

The impact/token agent inspected:

- `code_review_graph/graph.py`
- `code_review_graph/changes.py`
- `code_review_graph/incremental.py`
- `code_review_graph/context_savings.py`
- `code_review_graph/tools/review.py`
- `code_review_graph/tools/context.py`
- `code_review_graph/tools/query.py`
- `code_review_graph/tools/_common.py`
- `code_review_graph/main.py`
- `code_review_graph/token_benchmark.py`
- `code_review_graph/eval/token_benchmark.py`
- `docs/schema.md`
- `docs/COMMANDS.md`
- `docs/USAGE.md`
- `docs/FEATURES.md`
- related tests for context savings, changes, incremental update, tools, CLI, and main wrappers
- `code_review_graph/parser.py`
- `code_review_graph/search.py`
- `code_review_graph/postprocessing.py`
- `code_review_graph/enrich.py`
- `code_review_graph/tsconfig_resolver.py`
- `code_review_graph/jedi_resolver.py`

## Core Implementation Mechanisms

Code Review Graph is the strongest reference for review-time impact and token-saving behavior.

Its pattern is:

```text
graph index
  -> changed files / git diff ranges
  -> map changed lines to symbols
  -> traverse graph impact radius
  -> compute risk/test gaps
  -> return minimal review context
  -> attach token-savings estimate
```

Important mechanisms:

- SQLite-backed `GraphStore` models nodes, edges, and metadata.
- `get_impact_radius_sql()` uses a recursive CTE to traverse incoming and outgoing graph edges.
- Changed files are mapped to changed functions/classes/tests by line ranges.
- If line ranges are unavailable, it falls back to nodes in changed files.
- Risk scoring is explainable and additive.
- Minimal context is a first-class output mode, not a post-hoc truncation.
- Source snippets are range-bounded around changed symbols.
- Context-savings metadata is compact: estimated baseline, saved tokens, saved percent.
- Incremental update reparses changed plus dependent files and preserves truncation signals.
- Parser emits generic `NodeInfo` and `EdgeInfo` records for files, classes, functions, tests, types, calls, imports, containment, inheritance, references, and test edges.
- TS config resolution handles `baseUrl`, `paths`, local `extends`, JSONC, extension probing, and index-file probing.
- Barrel/re-export handling recursively follows `export { X } from` and `export * from` patterns with cycle guards.
- Query surface keeps a small vocabulary: `callers_of`, `callees_of`, `imports_of`, `importers_of`, `children_of`, `tests_for`, `inheritors_of`, and `file_summary`.
- Ambiguous symbol names return candidates rather than silently picking one.

## Relevant Capabilities

| CMAP Gap | Code Review Graph Mechanism |
|---|---|
| File impact | Recursive impact radius from changed files/symbols |
| Review priority | Changed-symbol mapping plus risk/test-gap summary |
| Token saving | Minimal context output and benchmark metadata |
| Source freshness | Incremental hash-based update |
| Candidate evidence | Impact report can feed review/inbox without canonical write |

## What CMAP Should Absorb

- Layered impact report: changed files, changed symbols, impacted symbols, impacted files, likely tests, risk factors.
- Direct vs expanded impact separation, matching CMAP's route direct vs related context boundary.
- Minimal source-evidence pack as the default output.
- Path normalization before matching user paths to indexed paths.
- Explicit traversal caps and `truncated` flags.
- Compact context-savings metadata.
- Separate benchmarks for changed-file review, whole-corpus lookup, and full workflow.
- Generated impact reports visible in Review HTML and source-aware brief.
- A typed edge query contract: callers are incoming `CALLS`; callees are outgoing `CALLS`; imports/importers are `IMPORTS_FROM`; impact is bounded traversal from changed file nodes.
- Confidence tiers for parsed, resolved-local, resolved-import, typechecker, heuristic, and unresolved evidence.

## What CMAP Should Not Absorb

- Python runtime or direct source code.
- Full multi-language parser scope in MVP.
- Embeddings as a required dependency.
- Community detection / flow tracing as MVP requirements.
- Large MCP tool surface before CLI schema stabilizes.
- Background daemon/watch as mandatory behavior.
- Risk weights as product truth.
- Its Python/Jedi enrichment stack as a TS-first CMAP dependency.
- Flow/community/risk-index tables as P0.

## CMAP TypeScript Rewrite Direction

CMAP should reimplement the pattern in TypeScript:

```text
git diff / explicit changed files
  -> source index path resolver
  -> changed symbol lookup
  -> bounded impact traversal
  -> likely test and module mapping
  -> SourceImpactReport
```

Parser/query rewrite direction:

```text
TypeScript compiler API
  -> file and symbol nodes
  -> import/export/re-export resolution
  -> call/reference edges with confidence tiers
  -> small query vocabulary
  -> impact report and source evidence pack
```

Proposed data shape:

```ts
type SourceImpactReport = {
  changedFiles: string[];
  changedSymbols: SourceSymbolRef[];
  impactedSymbols: SourceSymbolRef[];
  impactedFiles: string[];
  likelyTests: string[];
  riskFactors: Array<{ kind: string; reason: string; evidence: string[] }>;
  relatedModules: Array<{ module: string; reason: string; confidence: string }>;
  contextSavings?: {
    estimated: boolean;
    baselineTokens: number;
    evidenceTokens: number;
    savedTokens: number;
    savedPercent: number;
  };
  truncated: boolean;
  freshness: SourceFreshnessSummary;
};
```

Candidate commands:

- `cmap impact file <path>`
- `cmap impact changed --base <ref>`
- `cmap brief "<task>" --with-source-evidence`
- `cmap benchmark source-intelligence`

## CMAP Modules Affected

- New `source-intelligence` module.
- `brief`: source evidence block after routed `.context`.
- `pack`: optional bounded source snippets.
- `evidence`: source impact report storage.
- `view`: generated source evidence panel.
- `benchmark`: source-intelligence metrics.
- `route`: source evidence may suggest related modules but must not alter direct route scoring.
- `verify`: source index health can warn separately from canonical map verification.

## Risks And Verification

Risks:

- Path mismatches between git diff, source index, and CMAP module ownership.
- Stale index makes impact wrong.
- Token-saving claims become marketing instead of measured evidence.
- Source snippets leak secrets or too much code.
- Generated impact starts steering canonical route.

Verification:

- Diff-to-symbol fixture tests.
- File impact traversal tests.
- Likely-test mapping tests.
- Budgeted snippet/redaction tests.
- Context-savings benchmark tests with separate baselines.
- Regression tests proving source evidence does not change canonical `route.modules`.

## CMAP Fit

Code Review Graph is the strongest reference for the "why this saves token during code review" part of CMAP's upgrade.

CMAP should not copy its Python implementation. The right absorption is:

```text
recursive impact traversal + minimal context + context-savings metrics
  -> rewritten in TypeScript
  -> generated source evidence
  -> optional brief/view support
  -> human-reviewed promotion only for durable map facts
```

The core reusable lesson is not Python or multi-language breadth. It is this compact query contract over typed directed edges:

```text
callers = incoming CALLS
callees = outgoing CALLS
importers = incoming IMPORTS_FROM
imports = outgoing IMPORTS_FROM
impact = bounded bidirectional traversal from changed file nodes
```
