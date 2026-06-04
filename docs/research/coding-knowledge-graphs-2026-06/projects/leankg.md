# LeanKG

Repository: `FreePeak/LeanKG`
Local checkout: `/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/leankg`
Commit: `f1f51ad`
Agents: Architecture Agent + Product Boundary Agent

## Verdict

LeanKG is a strong local graph database and MCP/Web query engine for source-derived code context. It is not a CMAP superset because it treats its operational database as the working source of truth, while CMAP's key value is reviewed project memory and human promotion boundaries.

Classification: **Complement; not a direct peer; not a superset.**

## What It Is

LeanKG is a Rust local-first binary. Its workflow is:

1. Install and configure target AI tools.
2. `init`, `index`, `watch`, `query`, `impact`, `web`, `export`, or `obsidian`.
3. Parse source into `CodeElement` and `Relationship` models.
4. Store graph data in embedded CozoDB.
5. Expose query, impact, review, orchestration, Web/API, and Obsidian surfaces.

Major module areas include:

- `cli`
- `db`
- `graph`
- `indexer`
- `mcp`
- `web`
- `api`
- `ontology`
- `obsidian`
- `orchestrator`

## Graph And Storage Model

LeanKG uses an embedded property graph model.

Nodes are `CodeElement` records with fields such as:

- qualified name;
- element type;
- file path;
- line range;
- parent qualified name;
- cluster;
- metadata;
- environment.

Edges are `Relationship` records with:

- source;
- target;
- relationship type;
- confidence;
- metadata;
- environment.

Relationship types cover imports, calls, tests, contains, Android/resource/service/environment/incident relations, and more.

Storage uses CozoDB. Default local storage is `.leankg/leankg.db`, with RocksDB available by environment setting. Schema includes `code_elements`, `relationships`, `business_logic`, `context_metrics`, `query_cache`, `service_metadata`, `teams`, and related operational tables.

## Trust Boundary

LeanKG has confidence and metadata fields. It also has RBAC and write-lock concepts. But many tools write directly into its database: annotations, knowledge additions, environment promotion, and auto-index/auto-init paths.

This is almost the opposite of CMAP's canonical model:

- LeanKG: the DB is the operational source of truth.
- CMAP: reviewed `.context` is canonical; generated evidence and candidates stay separate.

The Obsidian integration is a good example of the distinction: LeanKG treats LeanKG data as source of truth and pushes/pulls annotations, while CMAP treats Obsidian-style outputs as view layers.

## Where It Is Stronger Than CMAP

- Runtime code graph database with broad MCP/Web/API surface.
- Large MCP tool registry for search, context, impact, orchestration, knowledge, environment, incidents, ontology.
- Rich Web UI with progressive graph drill-down.
- Query cache, metrics, and token budget concepts.
- Strong immediate code navigation and blast-radius workflows.

## Where CMAP Remains Different

- CMAP has a stricter source-of-truth model.
- CMAP does not auto-init or auto-index trusted project semantics.
- CMAP's Review HTML should stay read-only and should not perform semantic analysis.
- CMAP has explicit `scan -> candidate -> review -> promote` style governance for future source-derived facts.

## CMAP Takeaways

- Borrow typed relationship + confidence + metadata as candidate evidence shape.
- Borrow token metrics/query cache ideas for generated support-layer evaluation.
- Borrow UI drill-down patterns, while keeping CMAP review surfaces read-only.
- Avoid LeanKG's high-risk defaults for CMAP: auto-init, auto-index, and direct fact writes.
- If integrated, LeanKG should feed `.context/generated` or `.context/inbox`, never `.context/MAP.md` directly.
