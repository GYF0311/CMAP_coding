# cmap v0.2 Route Context Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich `cmap route` and `cmap brief` with graph-related context modules and module-owned verification commands without letting route invent semantic matches.

**Architecture:** Keep existing direct route scoring as the only high-confidence match source. Add a deterministic context pack layer that expands from direct matches through typed module relations and extracts verification commands from module docs. `brief` consumes the context pack for selected module docs, while `route.modules` remains direct likely modules.

**Tech Stack:** TypeScript CLI, gray-matter module docs, Vitest integration tests, existing `module-index` and `routeTask` APIs.

---

## Task 1: Failing Context Pack Tests

**Files:**
- Create `tests/integration/m10-route-context-pack.test.ts`

- [x] Write a failing test where `chat` matches the task directly and `auth` appears only through `relations.depends_on`, expecting `auth` under related context and read-first files but not as a direct likely module.
- [x] Write a failing test where a matched module's `## Tests / Verification` section contributes a suggested verification command.
- [x] Write a failing brief test showing related context module bodies are included in `cmap brief`.
- [x] Run `pnpm test tests/integration/m10-route-context-pack.test.ts` and confirm it fails before production code.

## Task 2: Route Context Pack Implementation

**Files:**
- Modify `src/commands/route.ts`

- [x] Add `contextModules` and `verifyCommands` to `RouteReport`.
- [x] Keep `modules` as direct high-confidence candidates only.
- [x] Expand related context from top direct modules through frontmatter `relations`.
- [x] Extract verification commands from `## Tests / Verification` sections using backticked list items.
- [x] Include related context and suggested verification sections in text and JSON route output.

## Task 3: Brief Consumption

**Files:**
- Modify `src/commands/brief.ts`

- [x] Select module docs from `route.contextModules` instead of only `route.modules`.
- [x] Preserve existing route result output while including related context module docs in `## Module Context`.
- [x] Add suggested verification commands from route context pack to the brief's `## Verify` section.

## Task 4: Docs And Context

**Files:**
- Modify `README.md`
- Modify `.context/MAP.md`
- Modify `.context/STATUS.md`
- Modify `.context/CHECKPOINT.md`
- Modify `.context/VERIFY.md`
- Modify `.context/modules/route.md`
- Modify `.context/modules/brief.md`
- Modify `.context/modules/tests.md`

- [x] Document that graph-related modules are context pack suggestions, not direct likely modules.
- [x] Document verification command extraction as a deterministic module-doc signal.
- [x] Update current status/checkpoint with the route context pack slice.

## Task 5: Verification And Save

- [x] Run focused M10 tests.
- [x] Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm dev verify --stale`, `pnpm smoke`, `git diff --check`.
- [x] Commit and push.
