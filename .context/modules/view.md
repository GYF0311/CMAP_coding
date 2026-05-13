---
context_type: module
module: view
paths:
  - src/view
  - src/commands/view.ts
  - tests/integration/m19-view-export.test.ts
aliases:
  - view
  - dashboard
  - HTML review
  - human review
relations:
  depends_on:
    - evidence
    - context
    - relation-candidates
confidence: ai-drafted
---
# Module: view

## Purpose
Render a read-only, single-file HTML review dashboard from trusted `.context` project facts plus clearly marked generated support layers.

## Boundaries
- Owns `cmap view export/open` command handlers and the vanilla HTML/CSS/JS-free view renderer.
- Emits `cmap.view_data.v1` as embedded JSON for deterministic checks and future UI iteration.
- Default export shows canonical Overview, Modules, Canonical Relations, Verification, and Warnings.
- `--include-generated`, `--include-inbox`, and `--include-freshness` gate generated/support-layer detail sections.
- Treats generated evidence, inbox candidates, freshness metadata, and relation candidates as support signals only.
- Marks relation candidates as Candidate / Non-canonical and never offers browser-side apply/promote.
- Missing support layers must degrade to warnings and "Not available", not hard failures.
- `--check` compares normalized full HTML, not only embedded JSON, so renderer/template drift is caught while volatile `generatedAt` is ignored.
- Provides local-only review controls: search, stale/candidate/high-risk/generated filters, copy-command buttons, and a module detail dialog.
- Suggested commands remain copy-only; the browser view never applies or promotes candidates.

## Safety
- Escape all rendered text.
- Redact obvious token/secret/password/API key strings before HTML output.
- Do not load CDN assets, execute eval, or read owned source-code bodies for display.
- Keep the initial dashboard static and local-only.
- Use DOM text APIs and data attributes for interactivity; do not inject unsanitized HTML.

## Verification
- `pnpm test tests/integration/m19-view-export.test.ts`
- `pnpm dev view export --out _cmap-view`
- `pnpm dev view export --check --out _cmap-view`
- `pnpm typecheck`
