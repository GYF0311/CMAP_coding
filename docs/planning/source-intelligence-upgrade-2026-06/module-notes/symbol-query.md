# Symbol Query

Date: 2026-06-04

## Capability

CMAP should answer:

- "Where is symbol A?"
- "Who calls A?"
- "What does A call?"
- "What imports/exports A?"
- "Explain this symbol's local context."

## Competitor Evidence

| Project | Useful Pattern |
|---|---|
| CodeGraph | `search`, `context`, `callers`, `callees`, `trace`, output budget and staleness notices |
| Code Review Graph | Small fixed query vocabulary and ambiguity handling |
| GitNexus | `context` / 360-degree symbol view design |
| Graphify | Confidence labels and conservative duplicate-name handling |

## Query Contract

Use directed edges:

```text
callers = incoming CALLS
callees = outgoing CALLS
importers = incoming IMPORTS_FROM
imports = outgoing IMPORTS_FROM
explain = symbol + file + imports + callers + callees + freshness + confidence
```

Ambiguous symbol queries must return candidates, not pick silently.

## Candidate Commands

```bash
cmap symbol find <query>
cmap symbol explain <symbol>
cmap symbol callers <symbol>
cmap symbol callees <symbol>
```

Common options:

```bash
--json
--limit <n>
--kind <kind>
--path <glob>
--include-stale
```

## Default Output

Markdown output should be compact:

```text
Symbol: runVerify
Freshness: fresh at <time>
Matches: 1
Definition: src/commands/verify.ts:120
Callers:
- src/cli.ts:88 dispatches verify command
Callees:
- loadModuleIndex(...)
- verifyContext(...)
Omitted: 4 lower-confidence references
```

JSON output should include full provenance and confidence tiers.

## Trust Boundary

Symbol results are generated source evidence. They can be copied into a task brief or candidate report, but cannot directly update module docs.

## TS Rewrite Notes

Use TypeScript compiler APIs for:

- AST traversal
- import/export resolution
- line/position mapping
- optional type checker for high-confidence symbol resolution

Start conservative:

- same-file calls: high confidence
- imported symbol calls: medium/high if resolved
- member calls: unresolved or heuristic unless typechecker resolves target
- dynamic calls: unresolved

## Verification

- Function callers/callees fixtures.
- Class method fixtures.
- Ambiguous duplicate-name fixtures.
- Import alias fixtures.
- Re-export/barrel fixtures.
- Stale index warning tests.
