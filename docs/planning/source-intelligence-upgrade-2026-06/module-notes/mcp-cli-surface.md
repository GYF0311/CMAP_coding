# MCP CLI Surface

Date: 2026-06-04

## Capability

CMAP should eventually expose source intelligence through one installed tool. The CLI should come first; MCP can wrap stable query functions later.

## Competitor Evidence

| Project | Useful Pattern |
|---|---|
| CodeGraph | CLI/MCP parity and server instructions |
| Code Review Graph | many MCP tools, but minimal/context-first is the useful part |
| GitNexus | direct CLI commands plus MCP/server/web over same backend |
| Graphify | MCP serve plus skills that guide graph-first lookup |

## Recommended Command Families

P0:

```bash
cmap source index
cmap source status
cmap impact file <path>
```

P1:

```bash
cmap symbol find <query>
cmap symbol explain <symbol>
cmap symbol callers <symbol>
cmap symbol callees <symbol>
cmap brief "<task>" --with-source-evidence
```

P2:

```bash
cmap source architecture
cmap impact symbol <symbol>
cmap impact diff --scope staged
cmap benchmark source-intelligence
```

Future MCP:

```text
cmap_source_status
cmap_symbol_find
cmap_symbol_explain
cmap_symbol_callers
cmap_symbol_callees
cmap_impact_file
cmap_source_brief
```

## Tool Design Rules

- Commands must output Markdown by default and JSON with `--json`.
- Every response must include freshness and generated/non-canonical label.
- Ambiguous targets return candidates.
- Wide results return `truncated: true` and omitted counts.
- Source snippets are budgeted and redacted.
- MCP tools must not bypass CLI trust-boundary rules.

## Skills Guidance

Skill text should teach:

```text
For source-level questions, query source intelligence before broad grep/read.
For durable project facts, trust reviewed `.context` over generated source evidence.
If source evidence contradicts `.context`, create/review a candidate instead of editing canonical memory directly.
```

## Verification

- CLI JSON schema tests.
- Markdown output snapshot tests.
- MCP wrapper parity tests if MCP ships.
- Skill export stale-check tests.
- Trust-boundary tests.
