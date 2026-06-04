---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-06-02T00:00:00+08:00
confidence: ai-drafted
module: showcase
paths:
  - docs/cmap-product-overview.html
  - docs/research/coding-knowledge-graphs-2026-06/**
  - docs/planning/source-intelligence-upgrade-2026-06/**
aliases:
  - showcase
  - product overview
  - HTML
  - research
  - planning
  - comparison
  - source intelligence
  - 介绍页
  - 产品介绍
  - 思维导图
  - 竞品研究
  - 升级规划
---
# Module: showcase

## Purpose
Explain cmap's current product shape and external comparison context as user-facing artifacts that can be opened locally, reviewed by humans, or handed to an external model.

Roadmap note: `docs/cmap-product-overview.html` is an explanatory product artifact. The next planned HTML review layer is `cmap view export`, which should render the live project map as a read-only dashboard without becoming a canonical fact source.

## Code Paths
- `docs/cmap-product-overview.html`
- `docs/research/coding-knowledge-graphs-2026-06/**`
- `docs/planning/source-intelligence-upgrade-2026-06/**`

## Responsibilities
- Present cmap as `.context` canonical facts plus experience layers such as Obsidian and HTML.
- Explain the AI coding workflow from route/checkpoint/brief/pack/hooks through finish/verify/Obsidian/reconcile.
- Provide a searchable module directory and an interactive module map for product understanding.
- Show current dogfood evidence, shipped command families, verification status, and remaining product risks without becoming a canonical fact source.
- Preserve external project comparison reports as reviewed research artifacts without turning competitor/source-analyzer claims into canonical cmap facts.
- Preserve source-intelligence upgrade planning, subagent research notes, capability gap analysis, and implementation roadmap as advisory planning artifacts until implementation creates reviewed module facts.

## Depends On
- `.context/MAP.md`
- `.context/STATUS.md`
- `.context/modules/*.md`

## Used By
- Human project review.
- External model handoff.
- Product demonstration and feasibility discussion.

## Data Flow
Canonical cmap facts, current implementation notes, reviewed external research, and advisory planning artifacts -> static or Markdown artifacts -> human/external-model review.

## State / Storage
The overview, research reports, and planning manuals are static artifacts in `docs/`. They do not write project state.

## Constraints
- The HTML overview is a view, not the source of truth.
- Research reports are advisory context, not canonical product facts.
- Planning manuals are advisory until implementation lands and reviewed `.context` modules are updated.
- Product claims should be refreshed when `.context` module responsibilities or workflow status changes.
- External model feedback is advisory until reviewed and promoted into canonical `.context` files.
- Future `cmap view export` output must also stay read-only and non-canonical.

## Traps
- Do not let the showcase page drift into a second product map.
- Do not describe planned features as shipped behavior unless the page labels them clearly.
- Do not let external source-graph project claims override CMAP's trust-boundary roadmap without explicit review.
- Do not map a future source-intelligence module as implemented before code and tests exist.

## Tests / Verification
- Static HTML content check with Node.
- Browser preview on desktop and mobile viewport.
- Console check after loading the page.

## When to Update This Doc
When adding/removing product overview, research, or planning artifacts, changing the showcase's role, or turning the static page into a generated export workflow.
