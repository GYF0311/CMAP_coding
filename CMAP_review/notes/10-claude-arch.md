# CMAP_coding Architectural Review

**Project:** Repo-local project memory map CLI for AI coding (Node >=20, TypeScript, ESM, 576-line cli.ts, 55 .ts files, 23 test files, vitest)

**Review Date:** 2026-05-14
**Reviewer:** Claude Haiku Architecture Agent

---

## Summary

CMAP is a well-structured TypeScript CLI project with clear layering (commands → core → context → fs) and appropriate separation of concerns. However, several architectural debts and design gaps exist that compound maintenance friction and test flakiness. This review identifies 10 actionable issues across error handling, input validation, module structure, and test architecture.

---

## Findings

### 1. [HIGH] Error Handling: Inconsistent Throw Pattern (Ad-Hoc vs. Typed)

**Issue:** 64 throw statements across codebase; 51 use `CmapCommandError`, 13 use bare `throw new Error`. Creates inconsistent error semantics and loses exit-code context.

**Evidence:**
- `src/errors.ts:1-8` — Single error class with optional exitCode (default=1)
- `src/fs/line-block.ts:31,37,74,81` — Raw Error throws for validation failures
- `src/core/relation-patch.ts:194,196` — Raw Error throws for unknown relation types
- `src/commands/checkpoint.ts:39,47,102` — Mix of Error and CmapCommandError
- `src/hooks/events.ts:96,109` — CmapCommandError with exitCode=2

**Problem:** Code with `throw new Error(...)` bypasses exit-code semantics entirely. CLI wrapper catches both types (cli.ts:566-575) but bare Error gets exitCode=2 regardless of context. FS boundary errors (line-block, safe-path) should be caught/wrapped by commands but aren't.

**Recommended Direction:**
1. Define error hierarchy: base `CmapError` (extends Error, includes exitCode), subclasses for `ValidationError`, `ContextError`, `FsError`.
2. Add no-bare-throw lint rule.
3. Wrap fs module throws at command level (e.g., `cp move` command catches line-block throws).
4. Update errors.ts from 215 bytes to ~300 bytes with proper typing.

**Risk & Cost:**
- Risk: **Low**. CLI already catches both types; refactor is mechanical.
- Cost: 4-6 hours; touches 13 files; benefits testing and debuggability.
- No impact on published behavior if exit codes remain unchanged.

---

### 2. [HIGH] Input Validation: Zod Schemas at Semantic Layer, Not I/O Boundary

**Issue:** Zod is used only for view export and map-patch JSON; CLI args, file frontmatter, and hook stdin are parsed ad-hoc with unsafe type assertions.

**Evidence:**
- `src/view/schema.ts:1-100` — Comprehensive zod for view data output (100 lines)
- `src/core/map-patch.ts:25-56` — Zod for JSON input, proper validation (lines 85-119)
- `src/hooks/events.ts:44-86` — Raw type assertions with `firstString()` fallback, no schema validation
- `src/core/module-index.ts:69-87` — Frontmatter data read via `matter()`, no zod validation on fields like `paths`, `aliases`, `relations`
- `src/commands/verify.ts:58-64` — `options.format` passed directly without enum validation; same in route.ts:87, pack.ts:156
- `src/commands/hooks.ts:91,134` — `splitCsv()` trusts input (line 527-528: split(",").map().filter() with no bounds or sanitization)

**Problem:**
1. CLI options like `--format`, `--max-context`, `--mode` are strings until use, no compile-time validation.
2. Frontmatter paths like `["src/**/*.ts"]` are parsed as strings without glob validation.
3. Hook payloads are normalized via manual field extraction (firstString), vulnerable to missing fields.
4. CSV splitting has no length limits; 10k-item CSV parses without warning.

**Recommended Direction:**
1. Define schema module: `src/schemas/cli-options.ts`, `src/schemas/frontmatter.ts`, `src/schemas/hook-payload.ts`.
2. Validate at entry: cli.ts option callbacks validate before dispatch; commands receive typed options.
3. Add frontmatter schema (e.g., `paths: z.union([z.array(z.string()), z.object({include: z.array(z.string()), exclude: z.array(z.string())})])`)
4. Bound CSV parsing: `splitCsv(value, maxItems=1000)`.

**Risk & Cost:**
- Risk: **Medium**. Schema changes may reject currently-accepted-but-invalid configs.
- Cost: 8-10 hours; adds ~400 lines of schema code; improves type safety significantly.
- Could tighten validation and reject loose frontmatter (documented breaking change for v0.2).

---

### 3. [MEDIUM] CLI.ts Monolith: 576 Lines of Command Registration Without Abstraction

**Issue:** All 28+ commands imported and registered directly in src/cli.ts. No command factory, plugin interface, or dynamic loading.

**Evidence:**
- `src/cli.ts:1-576` — 576 lines, lines 3-30 are 28 imports of command runners
- Lines 34-562 are sequential `.command()` chains
- No metaprogramming; every command wired by hand
- Test files: 23 integration tests, each spawns CLI via tsx (tests/helpers.ts:19-25)

**Problem:**
1. **Onboarding friction:** New command requires edit in 3 places (import, register, export from command file).
2. **Testing cost:** Each test execs tsx + ts transpilation (~1-2s per test); cumulative 442s for 134 tests (65% of CI time).
3. **Discoverability:** No metadata registry; help text lives in option descriptions, no programmatic command list.
4. **Type safety:** Options objects are locally defined types (e.g., `VerifyOptions`), no single source of truth for all option schemas.

**Recommended Direction:**
1. **Not urgent to refactor.** Project is v0.1.0; command count is manageable.
2. **If scaled to 50+ commands:** Introduce command registry:
   ```ts
   const commands = [
     { name: 'init', runner: runInit, description: '...' },
     ...
   ] as const;
   for (const cmd of commands) {
     program.command(cmd.name).description(cmd.description).action(cmd.runner);
   }
   ```
3. **For testing:** Replace tsx + CLI with direct runner imports in integration tests (e.g., `await runVerify(cwd, options)`). Cuts test time by ~50%.

**Risk & Cost:**
- Risk: **Very Low**. Current structure is fine for v0.1-v0.3 scope.
- Cost: **Defer** unless command count exceeds 40. Test refactor: 8-10 hours, ~60s saved per test run.
- Benefit: Better on-call diagnostics; faster CI feedback loops.

---

### 4. [MEDIUM] Module Coupling: Commands Import Directly from Core; No Facade

**Issue:** Command files import 7-12 dependencies each (generators, scanners, stores, policy). Creates tight coupling and makes it hard to reason about data flow.

**Evidence:**
- `src/commands/inbox.ts:1-12` — 12 imports: stdlib, matter, 6 internal modules
- `src/commands/verify.ts:1-10` — 10 imports, including execFile for CLI invocation
- `src/commands/route.ts` — 7 imports
- `src/commands/hooks.ts:1-20` — 20 imports; orchestrates route, module-index, evidence, hooks/templates, hooks/events
- No intermediate "service" or "facade" layer; each command directly uses core modules

**Problem:**
1. **Blast radius:** Changes to `generated-store.ts` require auditing all 5+ commands that call `appendModuleEvidence()`.
2. **Testability:** Hard to mock the full dependency tree; integration tests spawn CLI rather than unit-test commands.
3. **Cohesion:** `hooks.ts` (529 lines) orchestrates unrelated concerns: session start (stdout only), stop (log event or append evidence), ingest (stdin parsing + hook processing), test (simulated events). Should be split by intent.

**Recommended Direction:**
1. Define service interfaces: `src/services/evidence.ts`, `src/services/verification.ts`, `src/services/context.ts`.
2. Commands import from services, not core modules directly.
3. Example:
   ```ts
   // src/services/evidence.ts
   export interface EvidenceService {
     appendToModule(moduleId, summary, files, opts?): Promise<void>;
     queryByModule(moduleId): Promise<Evidence[]>;
   }
   // src/commands/evidence.ts imports EvidenceService, not generated-store directly
   ```
4. Split `hooks.ts` into: `session-hooks.ts`, `event-ingest.ts`, `hook-test.ts` (3x 150-180 lines each).

**Risk & Cost:**
- Risk: **Low**. Layers are additive; old imports still work if services delegate to core.
- Cost: 12-16 hours; adds ~400 lines of service stubs; improves maintainability for next 100+ commands.
- Defer until command count reaches 40+ or coupling pain becomes acute.

---

### 5. [MEDIUM] Path Manipulation: 170 Ad-Hoc path.join() Calls; No Centralized Path Builder

**Issue:** Paths constructed via `path.join(cwd, ...)` throughout; no reusable path builders. Makes refactoring .context structure brittle.

**Evidence:**
- `src/fs/safe-path.ts:5-36` — Only validates/resolves paths; doesn't generate them
- `src/core/module-index.ts:56,64` — `path.join(cwd, ".context", "modules")`
- `src/core/generated-store.ts:45-58` — `generatedRoot()` and `moduleEvidencePath()` functions (good)
- `src/core/candidate-store.ts:56,79` — `path.join(cwd, ".context", "inbox", "candidates")`
- `src/commands/verify.ts:70,264,265,277` — Ad-hoc joins for contextRoot, agentsPath, claudePath, packagePath
- **Grep result:** 170 total path.join/resolve calls across codebase, ~30% are duplicated patterns

**Problem:**
1. **Refactoring cost:** If .context layout changes (e.g., move modules to .context/schema/modules/), must edit 10+ files.
2. **Type safety:** No validation that paths conform to expected structure (e.g., module id must match filename).
3. **Duplication:** `path.join(cwd, ".context", "inbox", "candidates")` appears in 2+ files.

**Recommended Direction:**
1. Create `src/core/paths.ts`:
   ```ts
   export function contextRoot(cwd: string): string { ... }
   export function modulesDir(cwd: string): string { ... }
   export function modulePath(cwd: string, moduleId: string): string { ... }
   export function inboxCandidatesDir(cwd: string): string { ... }
   export function inboxArchiveDir(cwd: string): string { ... }
   // etc.
   ```
2. Replace all ad-hoc joins with named functions.
3. Add unit tests for path generation (ensure no path traversal escapes, validate structure).

**Risk & Cost:**
- Risk: **Very Low**. Pure refactor; no behavior change.
- Cost: 4-6 hours; extracts ~80 lines of path logic into `paths.ts`.
- Benefit: Future .context migrations become 1-file edits; tests can validate path contracts.

---

### 6. [MEDIUM] Test Architecture: Integration-Only; Slow, Flaky, Hard to Debug

**Issue:** 23 test files, all integration tests (spawn CLI via tsx). No unit tests. 1 test timeouts at 15s; cumulative runtime 65.37s for 134 tests.

**Evidence:**
- `tests/helpers.ts:19-38` — `runCmap()` spawns CLI: `execFile(tsxBin, [cliPath, ...args], {cwd})`
- Every test creates temp dir, runs CLI subprocess, checks outputs
- `tests/integration/m22-freshness-policy.test.ts` — 1 test fails with 15s timeout (line 42)
- Test count: 134 passed, 1 failed; test file naming suggests milestone-driven (m1-m23 = 23 files)
- No unit test directory; all tests are under `tests/integration/`

**Problem:**
1. **Slow feedback:** 65s total, but many tests could run sub-100ms if called directly.
2. **Flakiness:** Timeout suggests long-running subprocess (likely `freshness review --module` or graph building).
3. **Debugging:** To trace failure, must read test output, infer which command failed, then reproduce CLI invocation manually.
4. **Coverage gaps:** Commands like `install`, `doctor`, `obsidian open` may not be tested.

**Recommended Direction:**
1. Split into 2 tiers:
   - **Unit tests** (src/*/tests/): Test individual functions (parseMapPatch, mapChangedFilesToModules, etc.). 5-10 files, ~200 tests, <5s total.
   - **Integration tests** (tests/integration/): E2E workflows only (init → add-module → verify → finish). Keep ~10-15 core flow tests.
2. Convert slow integration tests to unit tests:
   - `m13-policy-stats` → unit test for policy validation logic
   - `m14-graph-route` → unit test for graph building + routing
   - `m22-freshness-policy` → debug timeout, then split into unit + 1 integration test
3. Add command coverage matrix: document which commands are tested.

**Risk & Cost:**
- Risk: **Low**. Unit tests are isolated; integration tests remain as regression suite.
- Cost: 16-20 hours; refactor existing tests to unit form; add 20-30 new unit tests.
- Benefit: Feedback loop <10s for local dev; easier CI debugging.

---

### 7. [MEDIUM] CLAUDE.md and AGENTS.md: Identical Content (1301 bytes), No Differentiation

**Issue:** Both files are byte-for-byte identical. Developer instructions should differ by audience (CLAUDE.md for humans, AGENTS.md for AI agents).

**Evidence:**
- `CLAUDE.md:1-26` and `AGENTS.md:1-26` are identical (wc confirms 1301 bytes each)
- Both contain same rules, tools, and start-here instructions
- No agent-specific guidance (e.g., "before making changes, run cmap route to find affected modules")
- No human-specific guidance (e.g., "read the README.md first if unfamiliar with cmap")

**Problem:**
1. **Maintainability:** Updates to dev conventions must be synced across 2 files; risk of divergence.
2. **Audience mismatch:** Humans benefit from step-by-step onboarding (read these 5 sections); agents benefit from structured directives (when X happens, run Y).
3. **Missing conventions:** Rules list lacks specifics on:
   - When to update .context/STATUS.md vs. CHECKPOINT.md
   - Whether to commit .context/generated/ files
   - Naming convention for module ids (snake_case? kebab-case?)
   - Risk assessment: when is a change "high-risk"?

**Recommended Direction:**
1. **CLAUDE.md** (for humans):
   - Start with "What is CMAP?" + repo overview
   - Step-by-step onboarding: init → route → read module docs → edit → finish
   - FAQ section: common tasks and patterns
   - Link to AGENTS.md for AI workflows

2. **AGENTS.md** (for AI agents):
   - Structured directives: "Before editing, run: cmap route '<task>'"
   - Decision tree: "If X lines changed, run verify --changed. If Y modules affected, update STATUS.md. If Z is uncertain, use inbox candidates."
   - Output format guidelines: "cmap finish returns JSON; parse it to decide next action."
   - Constraints: "Do not edit canonical .context files directly; use cmap update --agent instead."

3. Add **CONVENTIONS.md**: Single source for naming, risk levels, when to update metadata.

**Risk & Cost:**
- Risk: **Very Low**. Documentation-only; no code change.
- Cost: 2-3 hours to differentiate and add CONVENTIONS.md.
- Benefit: Smoother agent onboarding; clearer human mental model.

---

### 8. [MEDIUM] Test Flakiness: One Test Timeouts at 15s; Likely I/O-Bound

**Issue:** `tests/integration/m22-freshness-policy.test.ts:42` "freshness review --module renders..." exceeds 15s timeout.

**Evidence:**
- Test output: "Test timed out in 15000ms"
- Test name suggests it's testing `freshness review --module` command with stale/freshness data
- Test setup calls `makeRouteStale()`, likely generates large freshness state
- Subprocess execution may be reading large JSON files or running expensive operations

**Problem:**
1. **CI blocker:** Test fails locally; any freshness changes risk breaking CI.
2. **Root cause unclear:** Timeout could be in freshness.ts, view rendering, or module-index loading.
3. **Difficult to optimize:** Without profiling, can't tell if it's I/O, computation, or subprocess overhead.

**Recommended Direction:**
1. Add timeout breakpoint: `test(..., { timeout: 30000 })` as interim; don't mask problem.
2. Profile the test locally: Add console.time() around major operations (freshness.ts, view render, etc.).
3. Likely culprits:
   - `generateFreshnessState()` reads all modules + evidence JSONL files
   - `renderViewHtml()` (386 lines) generates large HTML on every invocation
   - `mapChangedFilesToModules()` runs expensive glob regex on large file set
4. Optimize:
   - Cache freshness state between test invocations
   - Mock large file reads in freshness tests
   - Pre-compute test fixtures (avoid regenerating on each test)

**Risk & Cost:**
- Risk: **Very Low**. Diagnostic effort only; no changes until root cause found.
- Cost: 2-4 hours to profile and identify; 4-8 hours to optimize if culprit is expensive operation.
- Benefit: Unblocks CI; faster developer feedback.

---

### 9. [LOW] Unused/Unclear Concerns in Module-Index: glob Pattern Matching Reimplemented

**Issue:** `src/core/module-index.ts` defines custom `globToRegExp()` function (lines 166-205) instead of using `fast-glob` (listed in dependencies but not used for matching).

**Evidence:**
- `package.json:32` — "fast-glob": "3.3.3" in dependencies
- `src/core/module-index.ts:166-205` — Manual glob-to-regex implementation
- `moduleOwnsFile()` (line 129) calls `pathPatternMatches()` which uses `globToRegExp()`
- `fast-glob` imported nowhere; never called in source code
- Function is complex (40 lines) and handles only basic glob patterns (*, ?, [...])

**Problem:**
1. **Maintenance burden:** Custom glob parser handles edge cases that fast-glob handles automatically (e.g., ** for recursive, negation patterns).
2. **Unused dependency:** fast-glob in package.json but not used; should either use it or remove.
3. **Correctness risk:** Custom parser may not handle all glob patterns users expect (e.g., `src/**/*.ts` vs. `src/*.ts` may behave unexpectedly).

**Recommended Direction (Not Urgent):**
1. Verify why fast-glob was added but not used (commit history/PRs may explain).
2. Either:
   a. **Use fast-glob:** Replace custom parser with `glob()` from fast-glob. More robust; aligns with package.json.
   b. **Remove dependency:** If custom parser is sufficient, remove fast-glob from package.json and document why.
3. Add unit tests for glob matching edge cases (recursive, negation, special chars).

**Risk & Cost:**
- Risk: **Very Low**. Glob matching is isolated; changes don't affect core logic.
- Cost: 1-2 hours to decide and implement.
- Benefit: Reduces technical debt; aligns dependencies with actual usage.

---

### 10. [LOW] Error Message Context Loss: CmapCommandError Doesn't Capture Stack Traces

**Issue:** When CmapCommandError is thrown, original stack context is lost if caught and re-thrown elsewhere.

**Evidence:**
- `src/errors.ts:1-9` — `CmapCommandError` extends Error; no fields for original error or context
- `src/hooks/events.ts:40` — Throws error from JSON.parse, message only: `throw new CmapCommandError("Invalid hook JSON payload: ${error.message}", 2)`
- `src/core/map-patch.ts:90` — Similar pattern: `throw new CmapCommandError("Invalid MapPatch JSON: ${error instanceof Error ? error.message : String(error)}")`
- CLI wrapper (cli.ts:566-575) catches and logs message only; no stack trace option

**Problem:**
1. **Debugging difficulty:** If cmap finish --agent fails with "Invalid MapPatch JSON: unexpected token", user can't see which field caused parse error or line number.
2. **No cause chain:** JavaScript Error.cause would allow `throw new Error(msg, { cause: originalError })`, but CmapCommandError doesn't support it.
3. **Silent failures:** Some caught errors in generated-store.ts (line 94) silently ignore malformed candidate files; no audit trail.

**Recommended Direction (Polish, Not Critical):**
1. Extend CmapCommandError to support cause:
   ```ts
   export class CmapCommandError extends Error {
     readonly exitCode: number;
     readonly cause?: Error;
     constructor(message: string, exitCode = 1, cause?: Error) {
       super(message);
       this.cause = cause;
       this.name = "CmapCommandError";
     }
   }
   ```
2. When re-throwing, include original error: `throw new CmapCommandError(msg, 2, originalError)`.
3. CLI wrapper can log cause chain if --debug flag provided.

**Risk & Cost:**
- Risk: **Very Low**. Purely additive; no breaking changes.
- Cost: 1-2 hours to add cause field and update throw sites.
- Benefit: Better UX for debugging; helps with issue reports (users can share full error context).

---

## Summary Table

| ID  | Severity | Category | Issue | Evidence | Recommendation | Effort | Risk |
|-----|----------|----------|-------|----------|-----------------|--------|------|
| 1   | HIGH     | Errors   | Inconsistent throw (Error vs CmapCommandError) | fs/line-block.ts, core/relation-patch.ts, commands/checkpoint.ts | Error hierarchy + lint rule | 4-6h | Low |
| 2   | HIGH     | Validation | Zod only at output; CLI args, frontmatter, stdin unvalidated | hooks/events.ts, module-index.ts, verify.ts, hooks.ts | Schema module for all inputs | 8-10h | Medium |
| 3   | MEDIUM   | Structure | cli.ts monolith (576 lines, 28 commands, no factory) | cli.ts:1-576, 28 imports, hand-wired registration | Defer; command registry if count >40 | 8-10h (defer) | Very Low |
| 4   | MEDIUM   | Coupling | Commands import core directly (7-12 deps each); no facade | inbox.ts:1-12, verify.ts:1-10, hooks.ts:1-20 | Service layer + split hooks.ts | 12-16h | Low |
| 5   | MEDIUM   | Paths | 170 ad-hoc path.join() calls; no centralized builder | 30% duplication; path.join(cwd, ".context", ...) repeated | Extract to paths.ts | 4-6h | Very Low |
| 6   | MEDIUM   | Testing | Integration-only tests; 65s runtime, 1 timeout, flaky | 23 tests all via tsx CLI; m22 timeout at 15s | Split unit+integration; debug timeout | 16-20h | Low |
| 7   | MEDIUM   | Docs | CLAUDE.md == AGENTS.md (1301 bytes); no differentiation | Byte-identical; missing audience-specific guidance | Split + add CONVENTIONS.md | 2-3h | Very Low |
| 8   | MEDIUM   | Testing | m22 test timeout at 15s; root cause unclear | Test name suggests freshness state generation | Profile + optimize I/O | 2-8h | Very Low |
| 9   | LOW      | Deps | fast-glob dependency unused; custom glob parser replaces it | package.json lists fast-glob; module-index.ts has globToRegExp() | Use fast-glob or remove | 1-2h | Very Low |
| 10  | LOW      | Errors | CmapCommandError loses stack context; no cause chain | errors.ts, hooks/events.ts, map-patch.ts | Add cause field | 1-2h | Very Low |

---

## Top 3 High-Priority Actions

### 1. **Establish Input Validation Schema (Issue #2) — 8-10 hours**

**Why First:**
- High risk gap: frontmatter paths, CLI options, hook payloads are unvalidated.
- Blocks v0.2 stability: users can write invalid .context configs that fail silently or inconsistently.
- Foundation for future features: once schemas exist, adding new commands/options is safe.

**What to Do:**
1. Create `src/schemas/` directory with zod schemas for:
   - CLI option enums (format, mode, risk, etc.)
   - Frontmatter fields (paths, aliases, tags, relations)
   - Hook payload structures (codex, claude, generic)
2. Update cli.ts to validate options via schema coercion before dispatch.
3. Update module-index.ts to validate frontmatter before use.
4. Test: 20-30 new unit tests covering schema validation + edge cases.

**Success Criterion:** All external inputs (CLI, files, stdin) are validated via zod; invalid inputs produce clear errors with exit code 2.

---

### 2. **Fix Error Handling Consistency (Issue #1) — 4-6 hours**

**Why Second:**
- Quick win: mechanical refactoring with high payoff.
- Enables debugging: consistent error types and exit codes make troubleshooting predictable.
- Prerequisite for error telemetry: once errors are typed, can build error aggregation in CI.

**What to Do:**
1. Define error class hierarchy in errors.ts:
   ```ts
   export class CmapError extends Error { exitCode: number; cause?: Error; }
   export class ValidationError extends CmapError { /* ... */ }
   export class ContextError extends CmapError { /* ... */ }
   export class FsError extends CmapError { /* ... */ }
   ```
2. Replace 13 bare `throw new Error()` with typed errors.
3. Add ESLint rule to forbid bare throw (use package eslint-plugin-no-throw or custom).
4. Test: Verify exit codes match expectations in cli-errors.test.ts.

**Success Criterion:** No bare Error throws; all errors are CmapError subclasses; exit codes are consistent and documented.

---

### 3. **Improve Test Architecture (Issue #6) — 16-20 hours, but staggered**

**Why Third:**
- Unblocks m22 timeout and future test flakiness.
- Enables fast feedback loop: unit tests <5s, integration tests <10s.
- Sets stage for CI performance: 65s -> ~15s total test time.

**What to Do (Phased):**
- **Phase 1 (2h):** Profile m22 test locally; identify bottleneck (freshness I/O? view rendering? module loading?).
- **Phase 2 (6h):** Extract 10-15 unit tests from existing integration tests (e.g., test parseMapPatch, validatePolicy, mapChangedFilesToModules in isolation).
- **Phase 3 (8h):** Refactor CLI test helper to also support direct runner calls; add command coverage matrix.
- **Phase 4 (4h):** Debug + fix m22 timeout once root cause known.

**Success Criterion:**
- Timeout fixed; m22 passes consistently.
- Unit tests run <1s each; integration tests <5s each.
- CI feedback loop <30s for 134 tests.

---

## Not Required (False Positives / Acceptable As-Is)

1. **CLI.ts monolith (Issue #3):** At 576 lines with 28 commands, still manageable. Refactor to command registry only if command count exceeds 40 or test time reaches >60s.

2. **Path duplication (Issue #5):** While 170 path.join calls exist, actual refactoring ROI is low because .context structure is stable in v0.1-v0.2. Worth doing when .context layout changes.

3. **fast-glob unused (Issue #9):** Removing or using fast-glob is low-priority. Custom globToRegExp is simple and works for current use cases (src/**, lib/**/*.ts, etc.). Revisit if module path matching becomes complex.

---

## References

- Project: `/Users/macbookpro/Desktop/CMAP_review/CMAP_coding`
- Test output: 134 tests, 1 failed (m22 timeout), 65.37s total runtime
- Build: tsup ESM, vitest, Node >=20
- Dependencies: commander 14, zod 4, gray-matter 4, fast-glob 3 (unused)
