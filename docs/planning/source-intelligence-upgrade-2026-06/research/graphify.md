# Graphify Research

Date: 2026-06-04
Local snapshot: `ec3cb5e`
License: MIT
Runtime: Python

## Research Scope

Graphify was studied as a broad source/multimodal graph reference. CMAP should not copy its Python/NetworkX implementation or become a full multimodal corpus graph engine.

Primary intermediate note:

- `agent-notes/graphify-source-adapter.md`

## Source Files Inspected

The Graphify agent inspected:

- `ARCHITECTURE.md`
- `docs/how-it-works.md`
- `README.md`
- `pyproject.toml`
- `graphify/__main__.py`
- `graphify/detect.py`
- `graphify/manifest.py`
- `graphify/cache.py`
- `graphify/extract.py`
- `graphify/symbol_resolution.py`
- `graphify/build.py`
- `graphify/validate.py`
- `graphify/affected.py`
- `graphify/analyze.py`
- `graphify/global_graph.py`
- `graphify/watch.py`
- `graphify/serve.py`
- `graphify/mcp_ingest.py`
- `graphify/scip_ingest.py`
- `graphify/ingest.py`
- `graphify/google_workspace.py`
- `graphify/transcribe.py`
- `graphify/llm.py`
- `graphify/skill.md`
- `graphify/skill-codex.md`
- tests for pipeline, extraction, symbol resolution, confidence, affected, analyze, global graph, and MCP ingest

## Core Implementation Mechanisms

Graphify's core pipeline is:

```text
detect
  -> extract
  -> build graph
  -> cluster
  -> analyze
  -> report/export/serve
```

Useful mechanisms:

- File discovery classifies code, docs, papers, images, and video.
- Manifest state tracks separate AST and semantic hashes.
- Content-addressed caches split AST and semantic extraction.
- Tree-sitter extraction emits file/class/function nodes, call/import/type/reference edges, and source locations.
- Cross-file resolution is a second pass over declaration/import/export/use facts.
- JS/TS handling covers named imports, re-export clauses, star exports, aliases, top-level calls, and class heritage.
- Conservative fallback resolves raw calls only when a normalized label is unique.
- Confidence labels distinguish `EXTRACTED`, `INFERRED`, and `AMBIGUOUS`.
- `affected_nodes` reverse-traverses selected relations with a bounded depth.
- Query/MCP surface exposes graph query, node, neighbors, community, stats, shortest path, and PR impact helpers.
- Architecture analysis finds high-degree nodes, surprising connections, graph diffs, and import cycles.

## Relevant Capabilities

| CMAP Need | Graphify Lesson |
|---|---|
| Confidence labels | Every source edge should carry confidence and reason |
| Impact traversal | Reverse traversal over selected relations is enough for MVP file impact |
| Architecture scan | Hub nodes, cycles, and surprising connections can be advisory reports |
| Source evidence schema | Keep source file/location/provenance on every node and edge |
| Skills | Teach agents to query graph before broad grep/read loops |

## What CMAP Should Absorb

- Confidence model: extracted, inferred, ambiguous.
- Resolver reason and confidence score on every generated source edge.
- Separate source freshness/manifest metadata.
- Conservative duplicate-name handling.
- Directed edge schema with relation, source location, confidence, and provenance.
- `impact file` / `impact symbol` as bounded reverse traversal.
- Architecture scan as generated advisory output: hubs, cycles, cross-boundary links, hot files.
- Source evidence panels in Review HTML.
- Benchmark invariants for confidence, impact, and token reduction.

## What CMAP Should Not Absorb

- Python/NetworkX implementation.
- Multimodal ingestion as part of source-intelligence MVP.
- Video/audio transcription, Google Workspace export, URL fetching.
- LLM semantic extraction as the default source index.
- Multi-platform installer sprawl.
- Cross-repo global graph as canonical memory.
- Source-derived relation candidates feeding route before review.

## CMAP TypeScript Rewrite Direction

CMAP should rewrite the confidence and impact patterns into a TS/JS source index:

```text
parse TS/JS
  -> collect declaration/import/export/use facts
  -> resolve high-confidence edges
  -> mark uncertain edges as inferred/ambiguous
  -> expose bounded callers/callees/impact
```

Recommended edge fields:

- `relation`
- `confidence`
- `confidenceScore`
- `resolver`
- `sourceFile`
- `sourceLocation`
- `targetFile`
- `evidence`

Architecture scan should be a later command:

```bash
cmap source architecture
```

It should return generated/non-canonical:

- hub symbols
- hot files
- import cycles
- cross-module source couplings
- ambiguous or unresolved symbol clusters
- suggested `.context` relation candidates

## CMAP Modules Affected

- New `source-intelligence` module.
- `evidence`: generated source evidence with confidence.
- `view`: optional source evidence and architecture panels.
- `brief` / `pack`: bounded source evidence.
- `benchmark`: confidence/impact/token metrics.
- `skill`: query-first source guidance.
- `relation-candidates`: source-derived candidates remain candidate-only.

## Risks And Verification

Risks:

- False positives from inferred unique-label call resolution.
- TS path aliases and barrels make import resolution hard.
- Source evidence could become noisy and increase token use.
- Multimodal scope could distract from coding workflow.

Verification:

- Confidence invariant tests.
- Duplicate symbol ambiguity tests.
- Import/re-export resolution tests.
- Impact traversal tests.
- Source evidence freshness tests.
- No canonical write tests.

## CMAP Fit

Graphify is valuable for schema and confidence discipline. It is less suitable as a direct product model because CMAP should stay focused on AI coding source intelligence and trusted project memory governance.
