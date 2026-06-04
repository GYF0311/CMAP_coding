# Architecture Scan

Date: 2026-06-04

## Capability

CMAP should produce a generated architecture scan:

- entrypoints
- hot files
- hub symbols
- import cycles
- cross-module source couplings
- unresolved/ambiguous areas
- likely source-derived module relation candidates

This is not the same as CMAP's reviewed module graph.

## Competitor Evidence

| Project | Useful Pattern |
|---|---|
| Graphify | god nodes, surprising connections, import cycles, graph diff |
| CodeGraph | module structure, dead-code candidates, context query |
| Code Review Graph | hub/bridge/gap analysis and review priorities |
| GitNexus | web UI summary/drill-down and process/module impact panels |

## Candidate Command

```bash
cmap source architecture
```

Options:

```bash
--json
--module <module>
--include-candidates
--max-items <n>
```

## Output Shape

```text
Source Architecture Scan
Freshness: fresh / stale

Entrypoints:
- src/cli.ts

Hot Files:
- src/commands/route.ts: many incoming references

Cross-Module Couplings:
- route -> evidence via generated route stats

Import Cycles:
- none found

Unresolved Areas:
- dynamic imports not resolved

Candidate Follow-up:
- Consider relation candidate: brief uses source-intelligence evidence
```

## CMAP Fit

Architecture scan should help humans review source structure, not rewrite `.context`.

It should live below:

```text
Review HTML support layers
generated evidence
candidate inbox
```

## MVP Boundary

Do not include:

- semantic module truth claims
- dead-code assertions as facts
- LLM architecture summaries
- multi-language graph mining
- automatic promotion

## Verification

- Hot file/hub detection fixtures.
- Cycle detection fixtures.
- Generated/non-canonical labels in view.
- Candidate-only write tests.
