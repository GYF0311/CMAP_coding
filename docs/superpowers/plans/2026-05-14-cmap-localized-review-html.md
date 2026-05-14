# CMAP Localized Review HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Chinese/English localized project-map review layer without changing canonical `.context` facts.

**Architecture:** Keep `.context` canonical files as the stable source of truth. Add an i18n mirror under `.context/i18n/zh-CN/`, locale config under `.context/config.yml`, localized view rendering, and optional `relation_explanations` data for human-readable relation explanations.

**Tech Stack:** TypeScript CLI, Commander, gray-matter, Vitest integration tests, single-file HTML rendering.

---

### Task 1: i18n Mirror and Locale Config

**Files:**
- Create: `src/commands/i18n.ts`
- Create: `src/commands/config.ts`
- Create: `src/i18n/context-mirror.ts`
- Create: `src/i18n/config.ts`
- Modify: `src/commands/init.ts`
- Modify: `src/cli.ts`
- Test: `tests/integration/*i18n*.test.ts`

- [ ] Write failing tests for `cmap i18n export --lang zh-CN`, `cmap i18n check --lang zh-CN`, `cmap config set/get locale`, and `cmap init --auto --lang zh-CN`.
- [ ] Implement scaffold export to `.context/i18n/zh-CN/` without model calls.
- [ ] Preserve canonical `.context/*.md` and `.context/modules/*.md`; write only mirror files and config.
- [ ] Add `TRANSLATION_RULES.md` with explicit translation constraints.
- [ ] Verify targeted tests pass.

### Task 2: Localized View Export

**Files:**
- Modify: `src/commands/view.ts`
- Modify: `src/view/collect.ts`
- Modify: `src/view/render.ts`
- Modify: `src/view/schema.ts`
- Create: `src/view/messages.ts` or equivalent message dictionary
- Test: `tests/integration/*view*.test.ts`

- [ ] Write failing tests for `cmap view export --lang zh-CN`, embedded `locale`, Chinese UI labels, and `--check` language separation.
- [ ] Route all UI labels through a locale dictionary.
- [ ] Set `<html lang="zh-CN">` for Chinese output.
- [ ] Prefer `.context/i18n/zh-CN/modules/<module>.md` descriptions when available; fallback to canonical English.
- [ ] Verify targeted view tests pass.

### Task 3: Relation Explanation Layer

**Files:**
- Modify: `src/core/module-index.ts`
- Modify: `src/view/collect.ts`
- Modify: `src/view/render.ts`
- Modify: `src/view/schema.ts`
- Test: `tests/integration/*view*.test.ts`

- [ ] Write failing tests for module frontmatter `relation_explanations`.
- [ ] Parse `relation_explanations` without changing existing `relations: Record<string, string[]>`.
- [ ] Render `why`, `produces`, and `impact` in relation tables and module details.
- [ ] Show localized empty states when explanations are missing.
- [ ] Verify graph/route behavior remains unchanged.

### Task 4: Review and Verification

**Files:**
- All changed implementation and tests.

- [ ] Dispatch a review agent to inspect requirements coverage, bug risks, compatibility, and test gaps.
- [ ] Fix Critical and Important review findings.
- [ ] Run `pnpm typecheck`, `pnpm test`, `pnpm smoke`, `cmap verify --changed`, and `git diff --check`.
- [ ] Complete the goal only after fresh verification output confirms success.
