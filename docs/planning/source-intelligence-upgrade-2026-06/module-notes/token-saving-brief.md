# Token Saving Brief

Date: 2026-06-04

## Capability

CMAP should reduce token/tool-call cost by adding a source-evidence section to task briefs.

Current `brief` is project-map based. Future source-aware brief should combine:

```text
reviewed `.context` route
  + generated source evidence
  + freshness and confidence labels
  + bounded snippets
```

## Competitor Evidence

| Project | Useful Pattern |
|---|---|
| Code Review Graph | minimal review context and context-savings metadata |
| CodeGraph | `context` and `explore` budgeted outputs |
| GitNexus | context/explain command and summary-first output |
| Graphify | query graph text pack and confidence breakdown |

## Candidate Command

```bash
cmap brief "<task>" --with-source-evidence
```

Candidate options:

```bash
--source-budget <tokens>
--source-target <symbol-or-file>
--source-depth <n>
--refresh-source
```

## Output Order

The brief must preserve trust priority:

```text
1. Reviewed CMAP route/module context
2. Current checkpoint/status
3. Suggested verification from module docs
4. Generated source evidence
5. Omitted/stale/ambiguous notes
```

Generated evidence should never appear before reviewed `.context` facts.

## Context Savings Metadata

Every source-aware brief should optionally include:

```text
estimated: true
baselineTokens: changed-file or candidate-file token estimate
evidenceTokens: generated source evidence token estimate
savedTokens
savedPercent
```

Keep the panel small. Token savings metadata should not become its own token tax.

## Snippet Rules

- Include only relevant line ranges.
- Redact secrets using current pack/view redaction helpers.
- Enforce per-file and total source budgets.
- Include omitted counts when output is capped.
- Warn on stale files.

## Verification

- Brief includes reviewed context first.
- Source evidence is optional.
- Stale source index warning appears.
- Budget is enforced.
- No canonical writes.
- Benchmark compares baseline file-reading tokens vs source brief tokens.
