---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-15T22:28:19+08:00
confidence: ai-drafted
module: showcase
paths:
  - docs/cmap-product-overview.html
aliases:
  - showcase
  - product overview
  - HTML
  - 介绍页
  - 产品介绍
  - 思维导图
---
# Module: showcase

## Purpose
Explain cmap's current product shape as a user-facing, interactive overview that can be opened locally or handed to an external model for review.

Roadmap note: `docs/cmap-product-overview.html` is an explanatory product artifact. The next planned HTML review layer is `cmap view export`, which should render the live project map as a read-only dashboard without becoming a canonical fact source.

## Code Paths
- `docs/cmap-product-overview.html`

## Responsibilities
- Present cmap as `.context` canonical facts plus experience layers such as Obsidian and HTML.
- Explain the AI coding workflow from route/checkpoint/brief/pack/hooks through finish/verify/Obsidian/reconcile.
- Provide a searchable module directory and an interactive module map for product understanding.
- Show current dogfood evidence, shipped command families, verification status, and remaining product risks without becoming a canonical fact source.

## Depends On
- `.context/MAP.md`
- `.context/STATUS.md`
- `.context/modules/*.md`

## Used By
- Human project review.
- External model handoff.
- Product demonstration and feasibility discussion.

## Data Flow
Canonical cmap facts and current implementation notes -> static interactive HTML -> human/external-model review.

## State / Storage
The overview is a static generated artifact in `docs/`. It does not write project state.

## Constraints
- The HTML overview is a view, not the source of truth.
- Product claims should be refreshed when `.context` module responsibilities or workflow status changes.
- External model feedback is advisory until reviewed and promoted into canonical `.context` files.
- Future `cmap view export` output must also stay read-only and non-canonical.

## Traps
- Do not let the showcase page drift into a second product map.
- Do not describe planned features as shipped behavior unless the page labels them clearly.

## Tests / Verification
- Static HTML content check with Node.
- Browser preview on desktop and mobile viewport.
- Console check after loading the page.

## When to Update This Doc
When adding/removing product overview artifacts, changing the showcase's role, or turning the static page into a generated export workflow.
