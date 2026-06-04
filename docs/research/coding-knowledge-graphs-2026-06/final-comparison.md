# Coding Knowledge Graph Projects: Final Comparison

Date: 2026-06-02
Workspace: `/Users/gaoyifan/Desktop/CMAP_coding`

## Executive Summary

None of the reviewed projects is a clean superset of CMAP.

The repeated pattern is clear:

- These projects are stronger than CMAP at **automatic source-derived code graph generation**, especially call/import/reference/impact analysis and MCP query surfaces.
- CMAP is stronger at **trusted project memory governance**: reviewed `.context`, candidate-only AI proposals, generated evidence separation, human promotion gates, task handoff, and closeout verification.

The right strategic framing is:

> Use these projects as upstream analyzers and generated evidence producers. Do not let their automatic graph output become CMAP's canonical project memory.

## Project Ranking By Similarity To CMAP

| Rank | Project | Similarity | Why |
|---:|---|---|---|
| 1 | CodeGraph | Very high | Local source graph + MCP tools + freshness UX. Closest to CMAP's route/context problem, but source-derived. |
| 2 | Code Review Graph | Very high | Review-time context compression, blast radius, impact analysis. Closest to "AI coding workflow" outcomes. |
| 3 | GitNexus | High | Broad MCP/source graph/product surface; has multi-repo registry and impact tooling. Claims need discounting. |
| 4 | Understand-Anything | High | Strong onboarding dashboard and generated codebase graph; more product/UX oriented. |
| 5 | Graphify | Medium-high | Viral, broad multi-modal graph generator; less focused on deterministic code review and project memory. |
| 6 | CodeGraphContext | Medium-high | Mature graph backend/CLI/MCP source analyzer; narrower product layer. |
| 7 | LeanKG | Medium | Powerful local graph DB/MCP/Web engine; more operational graph database than CMAP-like memory tool. |

## Superset Question

| Project | Is It CMAP's Superset? | Reason |
|---|---|---|
| Graphify | No | It auto-generates graph evidence, but lacks reviewed canonical memory and human promotion gates. |
| Understand-Anything | No | It has stronger generated dashboard/onboarding, but generated graph becomes the main artifact. |
| CodeGraph | No | It is excellent source graph infrastructure, not project memory governance. |
| Code Review Graph | No | It is close for review workflows, but not for canonical project facts/handoff/decision memory. |
| CodeGraphContext | No | It is a source graph database and MCP toolkit, not a reviewed `.context` layer. |
| LeanKG | No | It treats its DB as operational truth; CMAP intentionally separates truth/candidates/generated evidence. |
| GitNexus | No | Strongest product breadth, but it still trusts generated impact/source graph more than CMAP should. |

## Capability Matrix

| Capability | CMAP | Graphify | Understand-Anything | CodeGraph | Code Review Graph | CodeGraphContext | LeanKG | GitNexus |
|---|---|---|---|---|---|---|---|---|
| Reviewed project memory | Strong | Weak | Weak | Weak | Weak | Weak | Weak | Weak |
| Auto source graph | Paused / not canonical | Strong | Strong | Strong | Strong | Strong | Strong | Strong |
| MCP integration | Partial / local roadmap | Strong | Weak-medium | Strong | Strong | Strong | Strong | Strong |
| Human review boundary | Strong | Medium | Medium | Weak-medium | Medium | Weak-medium | Weak-medium | Weak-medium |
| Candidate promotion model | Strong | Weak | Weak | Weak | Weak | Weak | Weak | Weak |
| Route/task handoff | Strong | Weak | Medium | Medium | Medium | Medium | Medium | Medium |
| Impact/blast radius | Weak-current | Medium | Medium | Strong | Strong | Strong | Strong | Strong |
| Dashboard/graph UX | Medium-current | Strong | Strong | Medium | Medium | Medium | Strong | Strong |
| Multi-repo support | Weak-current | Medium | Weak | Medium | Medium | Medium | Medium | Strong |
| Data-safety conservatism | Strong | Medium | Medium-risk | Medium | Medium | Medium | Medium-risk | Medium-risk |

## Per-Project Conclusions

### Graphify

Graphify is the broadest viral project in this set. It supports code, docs, PDFs, images, video/audio, exports graph/report/HTML/MCP, and uses confidence labels like `EXTRACTED`, `INFERRED`, and `AMBIGUOUS`.

Best CMAP use: source/multimodal candidate evidence generator.

Risk: LLM/AST graph output is easy to treat as fact. CMAP should only ingest it into `.context/generated` or `.context/inbox`.

### Understand-Anything

Understand-Anything is the best onboarding/dashboard reference. Its `/understand` pipeline scans code, batches files, uses deterministic extraction plus LLM agents, writes `.understand-anything/knowledge-graph.json`, and serves dashboard/chat/diff/tour flows.

Best CMAP use: UX inspiration for review HTML, guided graph navigation, diff overlay, and incremental freshness.

Risk: graph QA is not the same as fact promotion. Its generated graph can feel canonical.

### CodeGraph

CodeGraph is the cleanest local code graph + MCP infrastructure reference. It uses SQLite/FTS5, Tree-sitter extraction, symbol/reference graph, watcher freshness, and tool-level agent guidance.

Best CMAP use: optional source graph adapter and freshness UX model.

Risk: "trust codegraph" style agent instructions must not override CMAP's reviewed fact boundary.

### Code Review Graph

Code Review Graph is the closest project for AI review context reduction. It has SQLite graph storage, recursive CTE impact traversal, minimal context, blast radius, review context, and VS Code/MCP/daemon surfaces.

Best CMAP use: review-time generated evidence, impact hints, and context-savings evaluation patterns.

Risk: memory/wiki outputs can blur generated analysis into knowledge. CMAP must keep generated evidence separate.

### CodeGraphContext

CodeGraphContext is a mature MCP + CLI graph database toolkit. It has multiple graph backends, code search, relationship analysis, watch, bundles, context switching, read-only query enforcement, and allowed-root guards.

Best CMAP use: external analyzer integration patterns: allowed roots, read-only query guards, response budgets, portable graph snapshots.

Risk: syntactic graph facts can be mistaken for semantic project truth.

### LeanKG

LeanKG is a Rust local-first graph database with MCP/Web/API/Obsidian surfaces, CozoDB storage, rich tool registry, token metrics, and graph drill-down UI.

Best CMAP use: candidate schema inspiration, metrics/cache ideas, UI drill-down patterns.

Risk: auto-init/auto-index and DB-as-source-of-truth posture conflicts with CMAP's trust model. Its Obsidian integration treats LeanKG as source of truth, while CMAP treats view exports as non-canonical.

### GitNexus

GitNexus is broad and productized: Node CLI/MCP/HTTP backend, React Web UI, LadybugDB graph storage, multi-repo registry, impact/detect_changes tools, skills/hooks, and group-aware workflows.

Best CMAP use: MCP tool ergonomics, multi-repo registry ideas, confidence/evidence fields, product packaging.

Risk: some marketing claims overreach source evidence. The current source center of gravity is backend CLI/MCP/HTTP, not purely browser-client-side. Also, its default posture is more willing to trust generated impact outputs than CMAP should.

## Strategic Recommendations For CMAP

### 1. Do Not Pivot CMAP Into Another Source Graph Engine

The market already has many source graph engines. CMAP should not compete by becoming yet another automatic AST/call/import graph generator.

CMAP's defensible position is:

> The layer that decides which generated/source-derived facts are safe to remember and route from.

### 2. Add An External Analyzer Adapter Layer

Add a future workflow shaped like:

```text
external source graph tool
  -> normalized evidence/candidate report
  -> .context/inbox/
  -> human review
  -> promoted module docs / MAP relations
  -> cmap verify / finish
```

Potential adapters:

- `graphify`
- `codegraph`
- `code-review-graph`
- `gitnexus`
- generic JSON/GraphML/Cypher import

This keeps CMAP aligned with its current trust boundary.

### 3. Borrow Tool UX, Not Trust Models

Good ideas to borrow:

- CodeGraph's one-primary-tool design and stale index banner.
- Code Review Graph's minimal-context-first and context-savings metrics.
- GitNexus's MCP tool descriptions and multi-repo registry.
- Understand-Anything's dashboard drill-down and guided tour.
- Graphify's confidence audit labels.
- CodeGraphContext's allowed-root and read-only query guards.
- LeanKG's metrics/query-cache and progressive graph drill-down.

Bad ideas to copy directly:

- "Generated graph is trusted."
- "Auto-init/auto-index on startup writes facts."
- "View or Obsidian output becomes source of truth."
- "Agent instructions override existing project AGENTS/CLAUDE boundaries."

### 4. Tighten CMAP Messaging

CMAP should describe itself as:

> A trust-boundary and project-memory governance layer for AI coding, designed to sit above source graph analyzers.

It should not describe itself as primarily a "code knowledge graph generator." That wording puts it in direct competition with better-resourced source analyzers and hides CMAP's real advantage.

### 5. Candidate Roadmap

Near-term possible roadmap:

1. `cmap evidence import --from <tool-output>` for non-canonical source graph evidence.
2. `cmap inbox promote --type relation` with explicit confidence/provenance display.
3. Review HTML panel for "External Source Evidence" beside canonical module relations.
4. Optional adapter specs for CodeGraph / Code Review Graph / GitNexus output.
5. Benchmark: compare CMAP route/brief/pack with and without external analyzer evidence.

## Bottom Line

These projects validate the problem space. They do not invalidate CMAP.

The winning architecture is layered:

```text
Source graph engines
  find structural facts and impact hints

CMAP
  governs what the project is allowed to remember and route from

AI coding agent
  uses both, but trusts reviewed CMAP facts over generated graph guesses
```

CMAP should become the review and memory governance layer above this ecosystem, not another competing auto-indexer.
