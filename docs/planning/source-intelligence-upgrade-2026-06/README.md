# CMAP Source Intelligence Upgrade

Date: 2026-06-04
Workspace: `/Users/gaoyifan/Desktop/CMAP_coding`

## Purpose

Plan a source-intelligence upgrade for CMAP without copying competitor source code or changing CMAP's current Trust Boundary + Human Review Layer direction.

This planning set studies source graph projects as implementation references, then translates useful patterns into CMAP-native TypeScript designs. Automatic code analysis remains generated evidence or candidate input until reviewed.

## Source Snapshot

The local research repositories live under:

`research/coding-knowledge-graphs-2026-06/repos/`

Reviewed projects:

- CodeGraph
- Code Review Graph
- Graphify
- Understand-Anything
- CodeGraphContext
- LeanKG
- GitNexus

GitNexus is design-only because its local `LICENSE` is PolyForm Noncommercial 1.0.0.

## Research Method

Subagents inspect isolated project or capability slices and write intermediate notes under `agent-notes/`. The controller then consolidates those notes into:

- `research/*.md` project reports
- `module-notes/*.md` capability reports
- `implementation-roadmap.md` final upgrade manual

Each note must identify the source files inspected, the mechanism found, CMAP-fit, TS rewrite approach, risks, and verification path.

## Required Outputs

- `capability-gap-list.md`
- `license-and-snapshot.md`
- `research/codegraph.md`
- `research/code-review-graph.md`
- `research/graphify.md`
- `research/understand-anything.md`
- `research/codegraphcontext.md`
- `research/leankg.md`
- `research/gitnexus-design-only.md`
- `module-notes/source-index.md`
- `module-notes/symbol-query.md`
- `module-notes/impact-analysis.md`
- `module-notes/architecture-scan.md`
- `module-notes/token-saving-brief.md`
- `module-notes/mcp-cli-surface.md`
- `module-notes/skills-docs-map-updates.md`
- `implementation-roadmap.md`

## Non-Goals

- Do not copy third-party source into CMAP.
- Do not turn CMAP into a competing full source graph engine in this planning slice.
- Do not treat generated source graph output as canonical `.context` truth.
- Do not revive old import graph, route v2, or pack v2 as the active roadmap without a new reviewed decision.
