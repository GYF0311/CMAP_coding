# Understand Anything Research

Date: 2026-06-04
Local snapshot: `e5dded6`
License: MIT
Runtime: TypeScript / plugin scripts / React dashboard

## Research Scope

Understand Anything was studied as a source-graph UX, onboarding, diff, and review-surface reference. It should not be treated as the parser baseline for CMAP's MVP; its strongest ideas are how generated source evidence becomes usable to humans and agents.

Primary intermediate note:

- `agent-notes/understand-anything-source-adapter.md`

## Source Files Inspected

The Understand Anything agent inspected:

- `README.md`
- `package.json`
- `understand-anything-plugin/package.json`
- `understand-anything-plugin/skills/understand/*.mjs`
- `understand-anything-plugin/skills/understand*/SKILL.md`
- `understand-anything-plugin/agents/*.md`
- `understand-anything-plugin/src/context-builder.ts`
- `understand-anything-plugin/src/understand-chat.ts`
- `understand-anything-plugin/src/explain-builder.ts`
- `understand-anything-plugin/src/diff-analyzer.ts`
- `understand-anything-plugin/src/onboard-builder.ts`
- `understand-anything-plugin/hooks/hooks.json`
- `packages/core/src/types.ts`
- `packages/core/src/schema.ts`
- `packages/core/src/fingerprint.ts`
- `packages/core/src/change-classifier.ts`
- `packages/core/src/staleness.ts`
- `packages/core/src/search.ts`
- `packages/core/src/analyzer/graph-builder.ts`
- `packages/core/src/analyzer/normalize-graph.ts`
- `packages/core/src/plugins/tree-sitter-plugin.ts`
- `packages/core/src/plugins/extractors/typescript-extractor.ts`
- `packages/dashboard/src/App.tsx`
- `packages/dashboard/src/store.ts`
- dashboard components for graph view, overview, search, diff, onboarding, node info, and code viewer

## Core Implementation Mechanisms

Understand Anything's main flow is a prompt-orchestrated graph building pipeline:

```text
scan project
  -> deterministic structure/import extraction
  -> graph-aware batching
  -> file/batch LLM analysis
  -> merge/normalize graph
  -> architecture layers
  -> guided tour and dashboard
  -> chat/explain/diff/onboard prompt builders
```

Important mechanisms:

- `scan-project.mjs` uses git-aware enumeration, ignore rules, language/category detection, line counts, and complexity estimates.
- `extract-import-map.mjs` resolves project-local imports across TS/JS, Python, Go, Java, Rust, C/C++, and other languages.
- `compute-batches.mjs` uses import graph neighborhoods before LLM analysis so each batch gets relevant neighbors.
- `extract-structure.mjs` delegates deterministic structure extraction to a plugin/tree-sitter layer.
- Batch graph merge normalizes node ids, rewrites edge references, deduplicates, drops dangling edges, recovers import edges, and links tests.
- Core graph schema is broad: code, config, document, service, endpoint, schema, resource, domain, flow, topic, claim, and source nodes.
- Freshness uses fingerprints over functions, classes, imports, exports, git state, and structural-change classification.
- Hooks can prompt targeted updates after file changes, commits, merges, rebases, or stale sessions.
- `buildChatContext`, `buildExplainContext`, `buildDiffContext`, and `buildOnboardingGuide` turn graph evidence into agent-facing context.
- Dashboard uses progressive disclosure: overview, layers, graph, selected node, diff overlay, search, tour, and code viewer.

## Relevant Capabilities

| CMAP Need | Understand Anything Lesson |
|---|---|
| Architecture scan | Show layers, entrypoints, hotspots, and tour as review aids |
| File impact | Diff analysis should include changed nodes, affected nodes, layers, edges, unmapped files, and risk |
| Token saving | Context builders should expand only relevant graph nodes and one-hop relations |
| Review HTML | Humans need freshness, warnings, drill-down, search, and optional guided reading |
| Skills | Agent-facing commands should say what evidence is generated and when to refresh |

## What CMAP Should Absorb

- Progressive disclosure for Review HTML: overview first, then generated source support panels.
- Source index freshness panel with indexed commit, stale files, changed files, and extraction errors.
- `explain` style symbol/file context: target, owning file, imports, callers/callees, layer/module candidate, freshness, and confidence.
- `diff` style impact overlay: changed files, affected symbols/files/modules, unmapped files, likely tests, and risk notes.
- Post-analysis normalization and validation for generated evidence before it reaches `brief`, `view`, or inbox.
- Structural fingerprinting to distinguish no-op, cosmetic, and structural source changes.
- Source-derived onboarding/tour ideas, but only as generated support material.

## What CMAP Should Not Absorb

- A broad `knowledge-graph.json` as a second canonical fact store.
- LLM batch analysis as the P0 source of architecture truth.
- Auto-updating `.context` from hooks.
- Full dashboard product scope before CLI/query primitives are proven.
- Multi-language extraction breadth in the MVP.
- Semantic/domain graph nodes as part of source-intelligence P0.
- Any behavior that makes generated layers appear reviewed.

## CMAP TypeScript Rewrite Direction

CMAP should adapt the UX builders, not the whole graph product:

```text
source index
  -> freshness summary
  -> symbol/file explain evidence
  -> diff/file impact evidence
  -> source-aware brief
  -> Review HTML support panels
```

Recommended implementation additions:

- `source-intelligence/freshness.ts` for file hash/git/index status.
- `source-intelligence/explain.ts` for symbol/file context packs.
- `source-intelligence/diff.ts` for diff-to-symbol and diff-to-module evidence.
- `view` support panels that render generated evidence without applying it.
- `brief --with-source-evidence` that preserves reviewed CMAP context first.

## CMAP Modules Affected

- `view`: optional source evidence, freshness, impact, and architecture support panels.
- `brief`: source-evidence section after reviewed route/module context.
- `evidence`: generated source evidence, freshness, and validation reports.
- `skill`: source-query-before-broad-read guidance with `.context` priority.
- `benchmark`: source-intelligence token/tool-call and quality metrics.
- `showcase`: planning and research artifacts.

## Risks And Verification

Risks:

- A polished generated graph can look more authoritative than reviewed `.context`.
- LLM graph summaries may silently invent architecture claims.
- Dashboard-style scope can distract from CLI primitives.
- Hooks that auto-refresh generated graph can obscure what changed and when.

Verification:

- Review HTML labels generated source panels as non-canonical.
- Source-aware brief keeps reviewed context before generated evidence.
- Freshness warnings appear in explain/diff outputs.
- No source command writes canonical `.context` files.
- Diff impact fixtures include unmapped files and stale index cases.

## CMAP Fit

Understand Anything is useful for making source intelligence legible. It is not the right model for CMAP's trust boundary.

The safe absorption is:

```text
learn UX/context-builder patterns
  -> rewrite narrow CMAP source evidence builders in TypeScript
  -> render as generated support layers
  -> require human review before durable memory changes
```
