# cmap Pro Deep Research Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the remaining ChatGPT Pro deep research recommendations so cmap becomes a safer, more automatic repo-local AI coding project map CLI.

**Architecture:** Keep `.context` canonical facts protected. Add deterministic generated data, inbox governance, hook lifecycle adapters, graph/index/stats, CI reports, and selected context packing as separate testable slices. Each slice must preserve the boundary: AI proposes semantics; cmap performs deterministic, auditable, reversible maintenance actions.

**Tech Stack:** TypeScript CLI, Commander, Vitest integration tests, Markdown/YAML frontmatter, JSON/JSONL generated artifacts.

---

## Slice 1: Inbox Governance And Adoption Stale Cleanup

**Files:**
- Modify `src/commands/inbox.ts`
- Modify `src/cli.ts`
- Modify `tests/integration/m8-evidence-stale-inbox.test.ts`
- Modify `.context/modules/inbox.md` if created; otherwise update `.context/modules/update-agent.md`, `.context/modules/verify.md`, `.context/modules/tests.md`
- Modify `.context/modules/adoption.md`
- Modify `.context/STATUS.md`, `.context/CHECKPOINT.md`, `.context/VERIFY.md`, `.context/MAP.md`

- [x] Add failing tests for `cmap inbox triage`, `cmap inbox archive <id>`, and safe `cmap inbox promote <id> --dry-run`.
- [x] Implement stable inbox IDs from candidate filenames.
- [x] Implement `triage` summary with pending count, high-risk count, oldest age, by-type buckets, and recommended action.
- [x] Implement `archive <id>` by moving the candidate into `.context/inbox/archive/` without deleting data.
- [x] Implement `promote <id> --dry-run` as a review report only; canonical semantic promotion remains manual.
- [x] Update adoption module doc to remove the current stale warning.
- [x] Run focused tests and full verification.
- [x] Commit and push.

## Slice 2: Policy And Generated Data Foundations

**Files:**
- Create `.context/policy.yml`
- Create `src/context/policy.ts`
- Create or modify `src/commands/evidence.ts`
- Create or modify `src/commands/verify.ts`
- Add integration tests under `tests/integration/`

- [x] Add `.context/policy.yml` with auto-apply rules for checkpoint, verification evidence, evidence append, stats update, and semantic rejection.
- [x] Parse policy with deterministic defaults when the file is absent.
- [x] Enforce generated evidence max entries from policy.
- [x] Add generated module activity stats output to `.context/stats/module-activity.json`.
- [x] Extend `verify --stale` to read policy thresholds for inbox.
- [x] Run tests and commit.

## Slice 3: Hook Lifecycle Adapter

**Files:**
- Modify `src/commands/hooks.ts`
- Modify `src/hooks/templates.ts`
- Modify `src/commands/install.ts`
- Modify `src/commands/doctor.ts`
- Add tests under `tests/integration/`

- [x] Add `hooks render --host claude --mode observe|assist|strict`.
- [x] Add `hooks test --event SessionStart|UserPromptSubmit|PreToolUse|PostToolUse|Stop`.
- [x] Generate Claude-compatible lifecycle settings as a project-local file.
- [x] Implement observe mode session event logging to `.context/logs/session-events.jsonl`.
- [x] Implement assist mode route/brief output to `.context/out/session-brief.md`.
- [x] Implement strict dry-run guards for direct semantic canonical writes.
- [x] Verify hooks never directly mutate high-risk canonical semantic sections in lifecycle tests.
- [x] Run tests and commit.

## Slice 4: Index, Stats, And Graph v0

**Files:**
- Create `src/commands/graph.ts`
- Create `src/core/context-graph.ts`
- Modify `src/core/module-index.ts`
- Modify `src/commands/route.ts`
- Add tests under `tests/integration/`

- [x] Add `cmap graph build` to write `.context/graph/modules.json`, `files.json`, `edges.json`, and `graph.meta.json`.
- [x] Add `.context/stats/route-usage.json` and `.context/stats/module-activity.json` updates from route and hooks.
- [x] Add `cmap graph explain <module>` for deterministic typed relation explanation.
- [x] Add `route --graph` to expose graph mode without hiding direct score reasons.
- [x] Run route benchmark after graph mode.
- [x] Run tests and commit.

## Slice 5: CI Verify And Benchmark Thresholds

**Files:**
- Modify `src/commands/verify.ts`
- Modify `src/commands/benchmark.ts`
- Create `.github/workflows/cmap.yml` if absent
- Add tests under `tests/integration/`

- [x] Add `verify --ci --format markdown|json` that writes stable CI-friendly output.
- [x] Add pending inbox threshold and stale threshold behavior.
- [x] Add route benchmark threshold options for top-1, top-3, context, and bad-module hits.
- [x] Add GitHub Actions workflow for test/typecheck/build/verify/benchmark.
- [x] Run tests and commit.

## Slice 6: Context Pack

**Files:**
- Create `src/commands/pack.ts`
- Modify `src/cli.ts`
- Modify `src/commands/brief.ts` only where sharing helpers is useful
- Add tests under `tests/integration/`

- [x] Add `cmap pack "<task>" --budget <n> --format markdown --out <path>`.
- [x] Pack only routed graph neighborhood, not the whole repository.
- [x] Include status/checkpoint, top module docs, graph neighbors, related tests, decisions, verify commands, and inbox warnings.
- [x] Enforce a deterministic approximate token/character budget.
- [x] Add secret-looking value redaction for obvious keys and tokens.
- [x] Run tests and commit.

## Slice 7: Product Documentation And Showcase

**Files:**
- Modify `README.md`
- Modify `PROJECT_MAP.md` if present
- Modify `docs/`
- Modify `.context/`

- [ ] Reorganize commands into Start, Navigate, Maintain, Verify, View/Adapters.
- [ ] Document canonical/generated/candidate boundaries.
- [ ] Document hooks safety policy.
- [x] Document graph and pack workflow.
- [x] Update HTML/product showcase if present.
- [ ] Run full verification and push final state.

## Final Verification

- [x] `pnpm test`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm dev verify`
- [x] `pnpm dev verify --stale`
- [x] `pnpm dev obsidian export --check`
- [x] `pnpm smoke`
- [x] `pnpm dev benchmark route --file bench/tasks.jsonl`
- [x] `git diff --check`
- [ ] GitHub push verified on `origin/main`
