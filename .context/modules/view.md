---
context_type: module
module: view
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
  - 中文审阅页
  - 项目地图页面
relations:
  depends_on:
    - evidence
    - context
    - relation-candidates
    - i18n
confidence: ai-drafted
---
# Module: view

## Purpose
Render a read-only, single-file HTML review dashboard from trusted `.context` project facts plus clearly marked generated support layers, with English/Chinese UI and optional localized reading-layer content.

## Boundaries
- Owns `cmap view export/open` command handlers and the vanilla HTML/CSS/JS-free view renderer.
- Emits `cmap.view_data.v1` as embedded JSON for deterministic checks and future UI iteration.
- Supports `cmap view export --lang en|zh-CN`; when no language is provided, view export can use `.context/config.yml` locale.
- Default export shows canonical Overview, Modules, Canonical Relations, Verification, and Warnings.
- Chinese output sets `html lang="zh-CN"` and renders UI labels from a locale dictionary.
- When `.context/i18n/zh-CN/modules/<module>.md` exists, module descriptions prefer that localized reading mirror and fall back to canonical module docs.
- Reads optional `relation_explanations` from module frontmatter and renders `why`, `produces`, and `impact` without changing the canonical `relations: string[]` schema.
- `--include-generated`, `--include-inbox`, and `--include-freshness` gate generated/support-layer detail sections.
- Treats generated evidence, legacy inbox Markdown, structured inbox candidates, freshness metadata, and relation candidates as support signals only.
- Reads structured `cmap.candidate.v1` JSON files from `.context/inbox/candidates/*.json` so candidate-store output is visible in the human review dashboard.
- Marks relation candidates as Candidate / Non-canonical and never offers browser-side apply/promote.
- Missing support layers must degrade to warnings and "Not available", not hard failures.
- `--check` compares normalized full HTML, not only embedded JSON, so renderer/template drift is caught while volatile `generatedAt` is ignored.
- `--check` is language-sensitive: a zh-CN export is stale when checked as en, and vice versa.
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
- `pnpm dev view export --lang zh-CN --out _cmap-view`
- `pnpm dev view export --check --out _cmap-view`
- `pnpm typecheck`
