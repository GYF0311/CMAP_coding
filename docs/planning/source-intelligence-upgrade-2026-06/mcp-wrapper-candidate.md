# MCP Wrapper Candidate

Date: 2026-06-04

## Status

Documentation only. This file does not implement MCP and does not claim CMAP has a shipped MCP server.

The preferred path is to keep source-intelligence behavior in the CLI first, then wrap stable commands with thin MCP tools only after schemas and trust-boundary wording are stable.

## Boundary

- MCP tools must call the same local CLI/query functions as the CLI surface.
- MCP tools must not write canonical `.context` facts.
- Every response should carry `generated=true`, `canonical=false`, freshness, and truncation/omission metadata where relevant.
- If source evidence contradicts reviewed `.context`, the wrapper should recommend candidate review rather than canonical edits.

## Candidate Wrappers Over Current CLI Surface

| Candidate wrapper | CLI command to wrap | Notes |
|---|---|---|
| `cmap_source_status` | `cmap source status --json` | Safe freshness check before source evidence is trusted. |
| `cmap_symbol_find` | `cmap symbol find <query> --json` | Returns generated symbol candidates; ambiguity stays visible. |
| `cmap_symbol_explain` | `cmap symbol explain <query> --json` | Returns callers, callees, imports, confidence, omitted counts, and freshness. |
| `cmap_symbol_callers` | `cmap symbol callers <query> --json` | Bounded caller evidence. |
| `cmap_symbol_callees` | `cmap symbol callees <query> --json` | Bounded callee evidence. |
| `cmap_impact_file` | `cmap impact file <path> --json` | Generated file impact, likely tests, related modules, and freshness. |
| `cmap_impact_diff` | `cmap impact diff --files <csv> --json` | Generated diff impact for explicit files, worktree diff, or staged diff. |
| `cmap_impact_symbol` | `cmap impact symbol <query> --json` | Generated symbol impact with callers, callees, likely tests, and file-impact fallback. |
| `cmap_source_architecture` | `cmap source architecture --json --include-candidates` | Generated architecture advisory; candidate-only hints stay non-canonical. |
| `cmap_source_brief` | `cmap brief "<task>" --with-source-evidence` | Source evidence must appear after reviewed route/module context. |
| `cmap_benchmark_source_intelligence` | `cmap benchmark source-intelligence --file bench/source-intelligence.jsonl` | Reports precision/recall/F1, token/tool-call proxies, and `falseCanonicalWrites=0`. |

## Deferred

Do not implement any MCP wrapper in this upgrade slice. The CLI schemas above are candidates for a later thin wrapper pass after at least one release cycle of CLI dogfooding.

## Suggested MCP Tool Behavior

- Prefer JSON output from the wrapped command.
- Preserve exit codes and threshold failures instead of hiding them.
- Redact or omit source snippets using the same redaction/budget rules as CLI source brief output.
- Return a short `nextCommands` or `reviewNeeded` hint when evidence is stale, ambiguous, missing, or contradictory.

## Verification Before MCP Ships

- CLI JSON schema tests for each wrapped command.
- MCP wrapper parity tests against CLI output.
- Trust-boundary tests proving wrapper calls do not modify canonical `.context` files.
- Stale/ambiguous/truncated response tests.
