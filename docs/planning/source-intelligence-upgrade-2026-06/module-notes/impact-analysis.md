# Impact Analysis

Date: 2026-06-04

## Capability

CMAP should answer:

- "If file X changes, who might be affected?"
- "If symbol A changes, which callers/tests/modules should I inspect?"
- "What did this diff likely affect?"

## Competitor Evidence

| Project | Useful Pattern |
|---|---|
| Code Review Graph | changed-file to symbol mapping, recursive CTE impact, minimal review context |
| CodeGraph | file dependencies/dependents and symbol impact radius |
| Graphify | bounded reverse traversal over selected relation types |
| GitNexus | impact direction/depth/confidence/truncated design and diff impact |

## CMAP Impact Layers

Impact should be layered:

```text
changed files
  -> changed symbols
  -> impacted symbols
  -> impacted files
  -> likely tests
  -> mapped CMAP modules
  -> candidate relation suggestions
```

Direct changed files/symbols must stay separate from expanded impact.

## Candidate Commands

```bash
cmap impact file <path>
cmap impact symbol <symbol>
cmap impact diff --scope staged
cmap impact diff --base HEAD~1
```

## SourceImpactReport

```ts
type SourceImpactReport = {
  changedFiles: string[];
  changedSymbols: SourceSymbolRef[];
  impactedSymbols: SourceSymbolRef[];
  impactedFiles: string[];
  likelyTests: string[];
  relatedModules: Array<{ module: string; reason: string; confidence: string }>;
  riskFactors: Array<{ kind: string; reason: string; evidence: string[] }>;
  truncated: boolean;
  freshness: SourceFreshnessSummary;
};
```

## MVP Algorithm

P0:

1. Resolve file path to indexed file.
2. Find symbols in that file.
3. Traverse reverse `IMPORTS_FROM` edges to file dependents.
4. Traverse incoming `CALLS` for high-confidence symbol callers.
5. Map impacted file paths to CMAP modules via module `paths`.
6. Suggest likely tests by naming and import/call edges.
7. Emit generated evidence only.

P1:

- diff hunk to changed symbol mapping
- symbol-level impact
- confidence/risk grouping
- source-aware brief integration

## Trust Boundary

Impact report can:

- write generated evidence
- feed `brief`
- feed Review HTML
- create explicit candidate inbox entries when requested

Impact report cannot:

- update canonical relations
- change route scoring
- mark a module dependency as reviewed

## Verification

- File importer/dependent fixtures.
- Symbol caller/callee impact fixtures.
- Test suggestion fixtures.
- Wide traversal cap and `truncated` tests.
- Related module mapping tests.
- No canonical write tests.
