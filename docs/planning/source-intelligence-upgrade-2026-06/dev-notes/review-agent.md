# Source Intelligence Review Agent Notes

Date: 2026-06-04
Scope: prepare review checklist and P0 audit method only. Do not review unfinished implementation code. Do not edit `execution-plan.json`; the main Agent owns plan status updates.

## Review Position

Source Intelligence must remain below CMAP's trust boundary:

```text
reviewed .context map
  stays canonical

source files
  -> generated source index
  -> generated evidence / impact reports / query metrics
  -> brief, pack, Review HTML support panels, inbox candidates
  -> human review
  -> canonical .context only by explicit reviewed edits
```

P0 review should block anything that quietly turns generated source analysis into a second maintained fact store.

## Review Checklist

### 1. Trust Boundary

- Source analysis output is always labeled Generated / Non-canonical in Markdown and JSON.
- `source`, `symbol`, `impact`, `brief --with-source-evidence`, and Review HTML support panels never claim source graph facts are reviewed CMAP module truth.
- Source-derived module mappings are suggestions with confidence/provenance, not updates to canonical `relations`.
- If source evidence contradicts `.context`, the implementation creates or prints a candidate/review prompt; it must not silently rewrite canonical memory.
- `route` and benchmark direct module scoring must not consume unreviewed source-index edges as route facts.

### 2. Generated Evidence And Canonical Writes

Allowed generated writes:

- `.context/generated/source-index/**`
- `.context/generated/evidence/**`
- `.context/generated/stats/**`
- `.context/out/**`
- `.context/inbox/candidates/**` only when explicitly requested

Blocked direct writes by source-intelligence commands:

- `.context/MAP.md`
- `.context/modules/*.md`
- `.context/DECISIONS.md`
- `.context/VERIFY.md`
- implementation source files, README, skill templates, or Review HTML exports as side effects of a query

Review must verify that P0 commands can rebuild or overwrite generated source-index files without deleting unrelated user data. Avoid adding `source clean` in P0; any future delete-like command must use the project deletion rules and never use `rm`.

### 3. CLI Output Contract

For P0 commands `cmap source index`, `cmap source status`, and `cmap impact file <path>`:

- Markdown is useful by default; JSON is available with `--json`.
- Output includes query target, generated/non-canonical label, freshness summary, confidence/provenance, parse errors or unresolved refs when present, truncated/omitted counts when capped, and a recommended next command.
- Ambiguous path or symbol targets return candidates instead of choosing silently.
- Stale index state is visible before the user trusts impact results.
- JSON fields are machine-checkable; labels must not exist only as prose.
- Exit codes distinguish expected user errors from successful stale/partial reports.

### 4. Tests And Coverage

P0 should have integration tests that spawn the public CLI in temp projects and prove:

- TS/JS discovery respects project root, ignore policy, generated/build/vendor folders, and path safety.
- Source index records files, imports, re-exports, functions/classes/methods/exported constants, high-confidence calls, test files/blocks, parse errors, hashes, git/worktree metadata, and freshness.
- `impact file` separates direct changed files/symbols from expanded impacted files/tests/modules.
- Wide traversal is capped and reports `truncated` plus omitted counts.
- Generated commands do not modify canonical `.context` files.
- Markdown and JSON outputs both include freshness, confidence/provenance, generated/non-canonical labels, and ambiguity/truncation signals.
- Path traversal and evidence paths outside the project root are rejected.
- Existing route/brief/view/evidence tests still pass when touched indirectly.

Minimum P0 test gate:

```bash
pnpm test tests/integration/source-intelligence.test.ts
pnpm typecheck
git diff --check
cmap verify --changed
```

### 5. Source Copy / License Risk

- Do not copy competitor source, schema strings, prompts, hook scripts, skill text, UI components, or tests.
- GitNexus is design-only because of PolyForm Noncommercial; no code/template reuse.
- Search changed implementation files for competitor names and copied attribution markers.
- Similar capability shape is allowed only as a TypeScript rewrite consistent with CMAP's local APIs and naming.

Suggested review search:

```bash
rg -n "CodeGraph|Code Review Graph|Graphify|GitNexus|LeanKG|PolyForm|MCP" src tests package.json pnpm-lock.yaml
```

### 6. Dependency, MCP, Daemon, And Scope Expansion

P0 should stay TS/JS-only and CLI-first:

- No MCP server/tool wrappers in P0.
- No daemon, watcher, git hook auto-refresh, background process, telemetry, cloud call, or model API.
- No SQLite/graph DB/storage abstraction unless JSON is proven inadequate later.
- No multi-language tree-sitter matrix in P0.
- No raw graph query surface.
- Any new dependency in `package.json` / `pnpm-lock.yaml` must be small, necessary, license-compatible, and justified; prefer existing TypeScript/compiler tooling already in the repo.

### 7. Review HTML Support Layer Boundary

Review HTML should remain read-only:

- P0 should not need Review HTML changes. If touched, treat it as high-risk scope expansion.
- Future source panels must be gated by `--include-support` or equivalent support-layer flag.
- Panels must label source index, symbol evidence, impact evidence, architecture candidates, and candidate relation suggestions as Generated / Non-canonical.
- The browser must never apply, promote, rewrite canonical context, or run new semantic analysis.
- Missing source-index support data should degrade to warnings / Not available, not hard failures.
- Source snippets must use existing redaction/escaping rules and remain budgeted.

## P0 Review Method

Start P0 review only after the main Agent marks P0 implementation ready. Until then, do not inspect or judge unfinished implementation code.

### Files To Read

Control and planning:

- `docs/planning/source-intelligence-upgrade-2026-06/execution-plan.json` read-only
- `docs/planning/source-intelligence-upgrade-2026-06/implementation-roadmap.md`
- `docs/planning/source-intelligence-upgrade-2026-06/module-notes/source-index.md`
- `docs/planning/source-intelligence-upgrade-2026-06/module-notes/impact-analysis.md`
- `docs/planning/source-intelligence-upgrade-2026-06/module-notes/mcp-cli-surface.md`

Expected P0 implementation files:

- `src/source-intelligence/**`
- `src/commands/source.ts`
- `src/commands/impact.ts`
- `src/cli.ts`
- `tests/integration/source-intelligence.test.ts`

Inspect if touched:

- `src/core/generated-store.ts`
- `src/core/generated-stats.ts`
- `src/fs/safe-path.ts`
- `src/context/policy.ts`
- `.context/MAP.md`
- `.context/modules/*.md`
- `README.md`
- `src/skill/templates.ts`
- `src/view/**`
- `package.json`
- `pnpm-lock.yaml`

### Commands To Run

Lightweight plan validity:

```bash
node -e "JSON.parse(require('fs').readFileSync('docs/planning/source-intelligence-upgrade-2026-06/execution-plan.json','utf8')); console.log('execution-plan.json OK')"
```

Review orientation:

```bash
git status --short
git diff --name-only
git diff --check
```

P0 behavior and type gate:

```bash
pnpm test tests/integration/source-intelligence.test.ts
pnpm typecheck
```

Manual CLI spot checks after P0 commands exist:

```bash
pnpm dev source index --json
pnpm dev source status --json
pnpm dev impact file src/commands/route.ts --json
pnpm dev impact file src/commands/route.ts
```

CMAP consistency:

```bash
cmap verify --changed
```

Use the command outputs as evidence, but do not update `execution-plan.json`; report findings in this dev note or final review summary for the main Agent to apply.

## P0 Blockers

Treat these as P0 findings:

- Any source-intelligence command writes canonical `.context` facts directly.
- Generated source facts affect route direct scoring or benchmark truth without review.
- CLI output lacks generated/non-canonical, freshness, confidence/provenance, or truncation labels.
- `impact file` produces unbounded output or hides omitted results.
- Path safety allows indexing or writing outside the project root.
- Implementation adds MCP/daemon/watch/global hooks/model calls in P0.
- Competitor code/template/schema text appears copied into implementation.
- Tests do not prove no canonical writes.
- Review HTML applies/promotes candidates or performs new source semantic analysis.
