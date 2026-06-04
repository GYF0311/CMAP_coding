# Coding Knowledge Graph Projects Research

Date: 2026-06-02
Workspace: `/Users/gaoyifan/Desktop/CMAP_coding`

## Purpose

Compare recent code knowledge graph projects against CMAP and decide whether they are peers, complements, or upstream/superset competitors.

CMAP baseline: repo-local canonical project map plus deterministic CLI maintenance, route/brief/pack support, candidate-only AI proposals, and a human review/trust-boundary layer. CMAP intentionally does not auto-generate trusted project semantics from source code.

## Source Checkout Location

Third-party source checkouts are local research artifacts and are intentionally outside git tracking:

`/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/`

## Projects

| Project | Local folder | Stars at capture | Main language | Current checkout | Why included |
|---|---:|---:|---|---|---|
| safishamsi/graphify | `graphify` | 57,848 | Python | `ec3cb5e` | Multi-modal knowledge graph skill for AI coding assistants; strongest viral match. |
| Lum1104/Understand-Anything | `understand-anything` | 48,605 | TypeScript | `e5dded6` | Interactive codebase knowledge graph and onboarding dashboard. |
| colbymchenry/codegraph | `codegraph` | 36,576 | TypeScript | `8629f7a` | Pre-indexed local code graph for multiple agents via MCP. |
| tirth8205/code-review-graph | `code-review-graph` | 17,834 | Python | `0c9a5ff` | Review-oriented persistent code intelligence graph for MCP/CLI. |
| CodeGraphContext/CodeGraphContext | `codegraphcontext` | 3,548 | Python | `38f5289` | MCP + CLI property graph index for local code. |
| FreePeak/LeanKG | `leankg` | 193 | Rust | `f1f51ad` | Lightweight Rust local knowledge graph with MCP and web UI. |
| nxpatterns/gitnexus | `gitnexus` | 166 | TypeScript | `50715e3` | Browser/client-side Git repo knowledge graph; included because external articles mention it heavily. |

## Agent Method

Each project is reviewed by at least two agents working on the same project:

- Architecture Agent: source layout, graph model, indexing pipeline, storage, CLI/MCP integration, verification evidence.
- Product Boundary Agent: user workflow, trust model, review layer, comparison to CMAP, whether it is a peer/complement/superset.

The final reports synthesize the multiple agent findings per project rather than treating one agent's view as authoritative.
