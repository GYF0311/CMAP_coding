# GitNexus Design Only Research

Date: 2026-06-04
Local snapshot: `50715e3`
License: PolyForm Noncommercial 1.0.0
Runtime: TypeScript / Node / React

## Research Scope

GitNexus was studied only for product and architecture ideas. Its code, schemas, templates, UI components, skills, and hooks should not be copied into CMAP.

Primary intermediate note:

- `agent-notes/gitnexus-design-only.md`

## License Boundary

GitNexus's local `LICENSE` is PolyForm Noncommercial 1.0.0 and its package metadata also declares a noncommercial license. CMAP may study its public design, but should reimplement ideas independently from scratch.

Allowed:

- Product/command-family inspiration.
- Abstract architecture patterns.
- Independent TypeScript implementation in CMAP style.

Not allowed:

- Copying source code.
- Copying skill text or templates.
- Translating implementation function-by-function.
- Reusing DB query text, UI components, fixtures, or hook scripts.

## Source Files Inspected

The GitNexus agent inspected:

- `LICENSE`
- `README.md`
- `ARCHITECTURE.md`
- `package.json`
- `gitnexus/package.json`
- `gitnexus/src/cli/*`
- `gitnexus/src/mcp/*`
- `gitnexus/src/server/*`
- `gitnexus/src/storage/*`
- `gitnexus/src/core/run-analyze.ts`
- `gitnexus/src/core/ingestion/pipeline*`
- `gitnexus/src/core/group/*`
- `gitnexus-shared/src/*`
- `gitnexus-shared/src/scope-resolution/*`
- `gitnexus-web/src/*`
- `gitnexus/skills/*.md`
- plugin/hook integration files

## Core Design Mechanisms

GitNexus product shape:

```text
CLI
  + MCP
  + local HTTP bridge
  + React web UI
  + repo registry
  + group/cross-repo workflows
```

Important design mechanisms:

- Direct CLI commands and MCP tools share backend behavior.
- `analyze` builds/updates a source index.
- `query`, `context`, `impact`, and `detect-changes` can run without MCP.
- Pipeline phases are explicit and dependency-ordered.
- Registry tracks indexed repos globally.
- Source freshness uses file hashes, git commit, dirty state, and interrupted-build state.
- Symbol context provides a 360-degree view: definition, incoming/outgoing refs, process participation, metadata, and disambiguation candidates.
- Impact supports direction, depth, pagination, confidence, affected modules/processes, and partial/truncated markers.
- Diff impact maps git hunks to symbols, then symbols to affected processes.
- Web UI uses summary-first drill-down panels.
- Skills tell agents to query graph before broad reading and to check staleness first.

## Design Lessons CMAP Can Reimplement

Safe CMAP reinterpretation:

- `symbol explain`: definition, file/line, exports/imports, callers/callees, owning CMAP module candidate, freshness, confidence, unresolved notes.
- `impact file` / `impact symbol`: dependency traversal, affected files, likely tests, mapped CMAP modules, candidate relation suggestions.
- `impact diff`: changed source spans mapped to symbols and modules, feeding `brief`, `finish`, and Review HTML.
- `source status`: local generated index health before trusting source evidence.
- Summary-first drill-down in Review HTML.
- Future MCP over the same query functions after CLI stabilizes.
- Static phase DAG for the source indexer.

## What CMAP Should Not Absorb

- GitNexus source code or template text.
- Full multi-language scope-resolution machinery as near-term goal.
- Process/community graph product as MVP.
- Browser-side apply/promote behavior.
- Destructive graph-assisted rewrite tools.
- Global repo registry as default MVP storage.
- Auto wiki generation or LLM docs generation.
- Presentation i18n/locale structures.

## CMAP TypeScript Rewrite Direction

CMAP can independently reimplement a narrower version:

```text
scan
  -> parse TS/JS
  -> imports
  -> symbols
  -> references
  -> freshness
  -> source evidence
```

Candidate generated state:

- `source-index.meta.json`
- `files.json`
- `imports.json`
- `symbols.json`
- `refs.json`
- `evidence/*.jsonl`

Candidate commands:

- `cmap source index`
- `cmap source status`
- `cmap source architecture`
- `cmap symbol find <query>`
- `cmap symbol explain <symbol>`
- `cmap symbol callers <symbol>`
- `cmap symbol callees <symbol>`
- `cmap impact file <path>`
- `cmap impact symbol <symbol>`
- `cmap impact diff --scope staged|unstaged|compare`
- `cmap brief "<task>" --with-source-evidence`
- `cmap benchmark source-intelligence`

## CMAP Modules Affected

- `cli`
- `evidence`
- `view`
- `brief`
- `pack`
- `hooks-doctor`
- `route`
- `graph`
- `relation-candidates`
- `verify`
- `benchmark`
- `showcase`
- `tests`

## Risks And Verification

Risks:

- Noncommercial license makes direct code absorption unsafe.
- The product surface is too broad for CMAP MVP.
- Global registry and web UI can distract from local trust boundary.
- Agent instructions can become too forceful and conflict with CMAP's reviewed memory priority.

Verification:

- Treat GitNexus ideas as independent product requirements only.
- No copied source or copied templates in CMAP.
- New CMAP implementation must pass trust-boundary tests.
- Source evidence must stay generated/non-canonical.

## CMAP Fit

GitNexus is useful as a product-direction reference: it shows what a broad, one-tool source-intelligence experience can feel like. Because of the license, its value to CMAP is design vocabulary, not implementation reuse.
