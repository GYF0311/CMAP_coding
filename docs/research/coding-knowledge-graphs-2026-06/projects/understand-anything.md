# Understand-Anything

Repository: `Lum1104/Understand-Anything`
Local checkout: `/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/understand-anything`
Commit: `e5dded6`
Agents: Architecture Agent + Product Boundary Agent

## Verdict

Understand-Anything is a strong onboarding and inspection product: automatic codebase knowledge graph, dashboard, guided tours, chat, diff, and domain views. It is not a CMAP replacement because its generated graph becomes the product artifact, while CMAP's core is reviewed project memory and trust governance.

Classification: **Complement / upstream analyzer; partial peer on dashboard and onboarding; not a superset.**

## What It Is

Understand-Anything is a TypeScript monorepo. The core implementation lives under `understand-anything-plugin/`:

- `skills/` drives slash-command workflows.
- `agents/` contains LLM agent prompts for graph analysis and review.
- `packages/core` defines schemas, parsers, search, persistence, and context assembly.
- `packages/dashboard` renders the interactive graph UI.

The main `/understand` pipeline is:

1. Preflight.
2. Scan project files.
3. Extract import map and compute batches.
4. Analyze files with deterministic structure extraction plus LLM agents.
5. Merge batch graphs.
6. Review and repair the assembled graph.
7. Generate architecture layers, tour, review, and save output.

Output is saved mainly to `.understand-anything/knowledge-graph.json`.

## Graph And Storage Model

The durable graph is a JSON document containing project metadata, nodes, edges, layers, and tour data.

Agent findings noted that current core types support a broad schema, including code, non-code, domain, and knowledge nodes. The deterministic indexing layer uses:

- `scan-project.mjs` for file discovery, ignore rules, language/category metadata, line counts, and complexity.
- `extract-import-map.mjs` for import extraction and path resolution.
- `compute-batches.mjs` for Louvain batching over the import graph.
- `extract-structure.mjs` for parser-backed structural extraction.
- `merge-batch-graphs.py` for graph merge and normalization.
- `persistence/index.ts` for JSON storage, metadata, fingerprints, and path sanitization.

The dashboard builds runtime indexes over the graph and uses fuzzy search for exploration. Some product copy says semantic search, but the current implementation appears to route search through fuzzy matching rather than a full embedding search path.

## Trust Boundary

Understand-Anything has graph QA and review, but not a CMAP-style human promotion gate.

It validates schema, referential integrity, completeness, layers, and tours. It can run a graph-reviewer agent and repair broken graph output. This improves artifact usability. It does not, however, enforce that LLM-generated semantic claims remain candidates until human promotion.

The notable risk is that the tool encourages committing the generated graph for team use. That can be good for onboarding, but it can also make generated explanations feel canonical.

## Where It Is Stronger Than CMAP

- First-run onboarding experience is much richer.
- Interactive dashboard has graph exploration, guided tours, layers, source preview, chat, and diff views.
- It can infer architecture layers and business/domain views.
- It has practical incremental update ideas via fingerprints and post-commit hooks.
- It targets a wider end-user experience, not just agent handoff.

## Where CMAP Remains Different

- CMAP's trusted facts are reviewed `.context` files, not generated graph JSON.
- CMAP's review layer renders reviewed project memory and candidate/support layers; it is not a graph generator.
- CMAP's `route`, `brief`, `pack`, `finish`, `verify`, and MapPatch workflow govern task continuity and closeout.
- CMAP's risk model is stricter: AI proposes; CLI validates/routes/audits; human review promotes semantic facts.

## CMAP Takeaways

- Borrow deterministic scanner/import resolver ideas as generated support evidence.
- Borrow fingerprint-based incremental freshness checks.
- Borrow dashboard interaction patterns: layer drill-down, one-hop neighborhood, diff overlay, guided tour.
- Do not borrow the trust model wholesale. LLM summaries, layers, tours, and graph repairs should become candidates or support evidence in CMAP, not canonical map facts.
- Note a data-safety issue before dogfooding: the skill cleanup path includes `rm -rf` for `.understand-anything/intermediate/tmp`, which conflicts with this workspace's deletion red lines.
