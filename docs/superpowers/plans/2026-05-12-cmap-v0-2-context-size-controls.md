# cmap v0.2 Context Size Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit `--max-context` controls to `cmap route` and `cmap brief` so graph-expanded context packs stay bounded and predictable.

**Architecture:** Preserve the current default context-pack size of 6 modules. Route remains the single context-pack builder; CLI and brief pass an optional limit into `routeTask`, and invalid limits fail fast with exit code 2. Read-first files and suggested verification commands are derived only from the selected context modules.

**Tech Stack:** TypeScript CLI, Commander, Vitest integration tests, existing `routeTask` and `brief` command flow.

---

## Task 1: Failing Tests

**Files:**
- Create `tests/integration/m11-context-size-controls.test.ts`

- [x] Write a test for `cmap route --max-context 1 --format json` where only the direct module appears in `contextModules`, related modules are excluded, and related verification commands are not suggested.
- [x] Write a test for `cmap route --max-context 2 --format json` where one related module is included and the second related module remains excluded.
- [x] Write a test for `cmap brief --max-context 1` where the brief includes only the direct module body.
- [x] Write a test for invalid `--max-context 0` returning exit code 2 with a clear error.
- [x] Run `pnpm test tests/integration/m11-context-size-controls.test.ts` and confirm failure before production code.

## Task 2: Route Limit Implementation

**Files:**
- Modify `src/commands/route.ts`
- Modify `src/cli.ts`

- [x] Extend `RouteOptions` with `maxContext?: string | number`.
- [x] Validate `maxContext` as an integer from 1 to 20.
- [x] Pass the limit into `routeTask`.
- [x] Apply the limit in context pack expansion and read-first generation.
- [x] Keep default behavior at 6 context modules.

## Task 3: Brief Limit Implementation

**Files:**
- Modify `src/commands/brief.ts`
- Modify `src/cli.ts`

- [x] Add `--max-context <n>` to `cmap brief`.
- [x] Pass the limit through to `routeTask`.
- [x] Select module docs from already-limited `route.contextModules`.
- [x] Keep default brief behavior unchanged.

## Task 4: Docs And Context

**Files:**
- Modify `README.md`
- Modify `.context/MAP.md`
- Modify `.context/STATUS.md`
- Modify `.context/CHECKPOINT.md`
- Modify `.context/VERIFY.md`
- Modify `.context/modules/route.md`
- Modify `.context/modules/brief.md`
- Modify `.context/modules/cli.md`
- Modify `.context/modules/tests.md`

- [x] Document `--max-context` for route and brief.
- [x] Re-state that smaller context packs limit related context and verification commands.
- [x] Update status/checkpoint with this slice.

## Task 5: Verification And Save

- [x] Run focused M11 tests.
- [x] Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, `git diff --check`.
- [x] Commit and push.
