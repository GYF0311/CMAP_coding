---
context_type: module
module: view
updated_at: 2026-05-15T22:30:02+08:00
paths:
  - src/view
  - src/commands/view.ts
  - tests/integration/m19-view-export.test.ts
  - tests/integration/m25-view-structured-candidates.test.ts
  - tests/unit/redact.test.ts
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
relation_explanations:
  depends_on:
    evidence:
      why: "view reads generated evidence, freshness metadata, and inbox status as support layers for human review."
      produces: "Generated, freshness, and inbox sections in the HTML review dashboard when enabled."
      impact: "Changes to support-layer schemas may require updates in src/view/collect.ts, src/view/render.ts, and view export tests."
    context:
      why: "view renders canonical MAP, STATUS, CHECKPOINT, VERIFY, policy, and module docs from the .context skeleton."
      produces: "The canonical overview, module list, verification, and warning data embedded in cmap.view_data.v1."
      impact: "Changing context templates or required headings can affect collection, check-mode normalization, and dashboard copy."
    relation-candidates:
      why: "view displays relation proposals as candidate-only review signals without applying them."
      produces: "Candidate relation cards and non-canonical labels in the review dashboard."
      impact: "Candidate schema or path changes may require collect/render updates and structured candidate tests."
confidence: ai-drafted
---
# Module: view

## Purpose
Render a read-only, single-file English HTML review dashboard from trusted `.context` project facts plus clearly marked generated support layers.

## Boundaries
- Owns `cmap view export/open` command handlers and the vanilla HTML/CSS/JS-free view renderer.
- Emits `cmap.view_data.v1` as embedded JSON for deterministic checks and future UI iteration.
- Default export shows canonical Overview, Modules, Canonical Relations, Verification, and Warnings.
- HTML output is fixed to English UI (`html lang="en"`). Future translation work should be a separate product slice, not part of the current view command surface.
- Module descriptions come from canonical `.context/modules/*.md`; view does not read translation mirrors or locale config.
- Reads optional `relation_explanations` from module frontmatter and renders `why`, `produces`, and `impact` without changing the canonical `relations: string[]` schema.
- `--include-generated`, `--include-inbox`, and `--include-freshness` gate generated/support-layer detail sections.
- Treats generated evidence, legacy inbox Markdown, structured inbox candidates, freshness metadata, and relation candidates as support signals only.
- Reads structured `cmap.candidate.v1` JSON files from `.context/inbox/candidates/*.json` so candidate-store output is visible in the human review dashboard.
- Marks relation candidates as Candidate / Non-canonical and never offers browser-side apply/promote.
- Missing support layers must degrade to warnings and "Not available", not hard failures.
- `--check` compares normalized full HTML, not only embedded JSON, so renderer/template drift is caught while volatile `generatedAt` is ignored.
- Provides local-only review controls: search, stale/candidate/high-risk/generated filters, copy-command buttons, and a module detail dialog.
- Suggested commands remain copy-only; the browser view never applies or promotes candidates.

## Safety
- Escape all rendered text.
- Redact obvious token/secret/password/API key strings, common auth headers, cloud SDK key fields, and PEM private key blocks before HTML output.
- Do not load CDN assets, execute eval, or read owned source-code bodies for display.
- Keep the initial dashboard static and local-only.
- Use DOM text APIs and data attributes for interactivity; do not inject unsanitized HTML.

## Verification
- `pnpm test tests/integration/m19-view-export.test.ts`
- `pnpm test tests/integration/m25-view-structured-candidates.test.ts`
- `pnpm test tests/unit/redact.test.ts`
- `pnpm dev view export --out _cmap-view`
- `pnpm dev view export --check --out _cmap-view`
- `pnpm typecheck`
