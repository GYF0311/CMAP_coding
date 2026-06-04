# Capability Gap List

Date: 2026-06-04

## Current Gap

CMAP already has strong project-memory governance: route, brief, pack, generated evidence, candidate inbox, Review HTML, and closeout verification all preserve the boundary between reviewed facts and generated support material.

The missing layer is source intelligence: fast, indexed, source-derived answers about code structure that help an AI coding agent avoid broad grep/read loops.

## Capability Gaps To Close

| Gap | Current CMAP State | Desired CMAP-Native Capability | Trust Boundary |
|---|---|---|---|
| Symbol callers | No source-level caller index | Answer "who calls function/class/component A?" from a local source index | Generated evidence; never canonical by itself |
| Symbol callees | No source-level callee query | Answer "what does A call?" and show call sites/snippets | Generated evidence; may inform relation candidates |
| File impact | No dependency/blast-radius traversal | Answer "if file X changes, what files/symbols/tests/modules may be affected?" | Candidate impact report |
| Architecture scan | Reviewed module map only, not source-derived structure | Produce repo structure, entrypoints, hot files, hub symbols, and likely boundaries | Advisory report; human review before promotion |
| Token-saving code lookup | Brief/pack are context-map based, not source-index based | Add minimal source evidence packs so agents read fewer files and call fewer tools | Task-local generated output |
| Freshness of source evidence | Freshness exists for `.context` review, not source index | Track source index freshness against git/file hashes | Generated metadata |
| CLI/MCP surface | CMAP exposes project-map commands, not source queries | Add `source`, `symbol`, `impact`, and source-aware `brief` command candidates | Command outputs remain non-canonical |
| Skill guidance | Skills teach `.context` workflow, not source intelligence | Teach agents to ask source queries before broad code reading | Guidance only; canonical facts still in `.context` |
| Review HTML | Shows canonical map and candidates, not source evidence | Add optional external/source evidence panels | Read-only support layer |
| Benchmark | Route benchmark exists, but not source-token A/B | Measure files read, tool calls, source context tokens, and answer quality | Evaluation artifact |

## Why These Matter

These gaps are the difference between a reliable project memory layer and a full AI coding workflow assistant.

Without source intelligence, an agent still needs to repeatedly search the repo to answer structural questions such as:

- Which function calls this function?
- Which files import this module?
- Which tests should run after changing this file?
- Which implementation files are likely relevant to a task?

That increases token use, tool calls, latency, and risk of reading irrelevant code.

## Design Position

The upgrade should add a source-intelligence layer below CMAP's trust boundary:

```text
source files
  -> source index / symbol graph / impact traversal
  -> generated source evidence
  -> CMAP inbox / review surfaces
  -> reviewed `.context` memory only after human promotion
```

The goal is one installed CMAP tool for users, but internally the architecture should remain layered:

- Source intelligence finds structural evidence.
- CMAP decides what can be remembered.
- AI coding agents use both, with reviewed `.context` facts taking priority.

## Candidate Command Families

These are planning candidates, not shipped behavior:

- `cmap source index`
- `cmap source status`
- `cmap source architecture`
- `cmap symbol find <query>`
- `cmap symbol callers <symbol>`
- `cmap symbol callees <symbol>`
- `cmap impact file <path>`
- `cmap impact symbol <symbol>`
- `cmap brief "<task>" --with-source-evidence`
- `cmap benchmark source-intelligence`

## Prioritization

| Priority | Capability | Reason |
|---|---|---|
| P0 | Source index schema + TS/JS import/symbol extraction | CMAP itself is TS; this proves the loop on the native stack |
| P0 | File impact from import/dependent graph | Directly answers a high-frequency coding question |
| P0 | Source evidence output and freshness metadata | Preserves trust boundary while enabling real use |
| P1 | Symbol callers/callees | Strong value, but needs better name resolution |
| P1 | Source-aware brief | Converts index capability into token savings |
| P1 | Review HTML source evidence panel | Makes evidence inspectable by humans |
| P2 | Multi-language extraction | Useful but should follow a stable TS MVP |
| P2 | MCP source query surface | Valuable after CLI schema stabilizes |
| P2 | Cross-repo impact | Product extension; too wide for MVP |
