# Graphify

Repository: `safishamsi/graphify`
Local checkout: `/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/graphify`
Commit: `ec3cb5e`
Agents: Architecture Agent + Product Boundary Agent

## Verdict

Graphify is a strong upstream signal generator for CMAP, not a CMAP replacement.

It automatically builds a multi-modal knowledge graph from code, docs, PDFs, images, and video, then exposes that graph through CLI commands, generated reports, HTML, Obsidian exports, and MCP. CMAP's core value remains different: a reviewed, repo-local project memory map with deterministic maintenance, candidate governance, and human review boundaries.

Classification: **Complement / upstream candidate source; partial peer on graph UX; not a superset.**

## What It Is

Graphify is a Python CLI and assistant skill. Its main workflow is:

1. `graphify install` or platform-specific install.
2. Invoke `/graphify .` or `graphify extract`.
3. Detect files and parse code locally with Tree-sitter.
4. Use an LLM backend for semantic extraction from non-code or explanatory content.
5. Merge results into a NetworkX graph.
6. Cluster and analyze the graph.
7. Export `graphify-out/graph.html`, `GRAPH_REPORT.md`, `graph.json`, and optional MCP/Neo4j/Obsidian outputs.

Source evidence:

- `pyproject.toml` defines the package, CLI entry, and dependencies such as `networkx`, `tree-sitter-*`, `datasketch`, and `rapidfuzz`.
- `graphify/__main__.py` owns the CLI and extract/query/path/explain command surface.
- `graphify/detect.py`, `graphify/extract.py`, `graphify/llm.py`, `graphify/build.py`, `graphify/cluster.py`, and `graphify/export.py` form the main pipeline.
- `graphify/serve.py` exposes MCP tools and resources.
- `ARCHITECTURE.md` describes the detect/extract/build/analyze/export/serve module split.

## Graph And Storage Model

Graphify uses a JSON graph schema with nodes, edges, and hyperedges. Nodes carry fields such as `id`, `label`, `file_type`, and `source_file`; edges carry `source`, `target`, `relation`, `confidence`, and provenance fields. Validation distinguishes `EXTRACTED`, `INFERRED`, and `AMBIGUOUS`.

The graph is mostly generated, not reviewed:

- AST extraction emits imports, calls, inheritance, implementations, references, and other structural edges.
- LLM extraction emits semantic concepts and relationships.
- `build.py` merges these into NetworkX.
- `report.py` generates confidence audits, god nodes, surprising connections, ambiguous edges, and suggested questions.
- `graphify-out/graph.json` is the durable query artifact.

## Trust Boundary

Graphify has useful provenance markers, but it does not have CMAP's hard candidate promotion boundary.

It can mark a relation as extracted, inferred, or ambiguous. It can show review sections in `GRAPH_REPORT.md`. It can sanitize paths, skip sensitive files, and constrain URL ingestion. But the main graph remains an automatically generated artifact that assistants are encouraged to query. There is no first-class "candidate inbox -> human promote -> canonical project memory" lifecycle.

That is the key difference from CMAP: Graphify is optimized for broad automatic discovery; CMAP is optimized for controlled project memory governance.

## Where It Is Stronger Than CMAP

- Multi-modal extraction: code, docs, SQL schemas, PDFs, images, video/audio.
- Fast visual graph artifact: `graph.html`, `graph.json`, `GRAPH_REPORT.md`.
- Rich query surface: `query`, `path`, `explain`, `affected`, `global`, MCP tools.
- Edge confidence and graph audit concepts are well aligned with review workflows.
- Assistant integration breadth is wide: Claude, Codex, OpenCode, Aider, Copilot, Gemini, Cursor, Devin, and others.

## Where CMAP Remains Different

- CMAP's `.context` is a reviewed fact store, not a generated graph dump.
- CMAP separates canonical facts, generated support evidence, and inbox candidates.
- CMAP's current roadmap deliberately avoids letting the CLI create trusted project semantics from source code.
- CMAP's review HTML is meant to render reviewed project map content, not perform new semantic analysis.

## CMAP Takeaways

- Treat Graphify output as a source for `.context/generated` or `.context/inbox`, not as canonical `.context/MAP.md`.
- Borrow confidence labels: `EXTRACTED`, `INFERRED`, `AMBIGUOUS` maps cleanly to CMAP's candidate review language.
- Borrow query ergonomics: `query/path/explain` over a generated support graph could become a useful source-evidence adapter.
- Borrow incremental cache and manifest discipline for source-derived candidate evidence.
- Keep CMAP's stronger trust boundary intact.
