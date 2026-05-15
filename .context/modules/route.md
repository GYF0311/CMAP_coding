---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-15T22:30:02+08:00
confidence: ai-drafted
module: route
paths:
  - src/commands/route.ts
  - src/core/module-index.ts
aliases:
  - route
  - aliases
  - routing
  - 路由
  - 模块定位
relations:
  depends_on:
    - module-docs
  used_by:
    - brief
    - obsidian-adapter
    - relation-candidates
relation_explanations:
  depends_on:
    module-docs:
      why: "route reads module frontmatter, paths, aliases, relations, and verification sections as its deterministic source."
      produces: "Likely modules, related context modules, read-first files, and suggested verification commands."
      impact: "Changes to module doc schema, relation fields, or verification headings may require updates in src/core/module-index.ts and src/commands/route.ts."
  used_by:
    brief:
      why: "brief relies on route selection to decide which project map context to include for a task."
      produces: "Task brief sections scoped to direct and related modules."
      impact: "Route scoring or context expansion changes can alter brief inputs and expected integration assertions."
    obsidian-adapter:
      why: "Obsidian export reuses route and module-index behavior to keep map navigation consistent with CLI routing."
      produces: "Reviewable graph/navigation hints that match routed module relationships."
      impact: "Changing route relation semantics may require Obsidian export and stale-check expectations to be refreshed."
    relation-candidates:
      why: "route surfaces pending relation candidates as review warnings without using them as canonical routing facts."
      produces: "Non-canonical candidate warnings in route output when relation proposals exist."
      impact: "Changing relation candidate storage or dedupe rules may require route warning and benchmark tests to change."
---
# Module: route

## Purpose
Recommend which `.context` files an AI should read first for a natural-language task, including direct module matches, graph-related context, and module-owned verification commands.

## Code Paths
- `src/commands/route.ts`
- `src/core/module-index.ts`

## Responsibilities
- Read `.context/modules/*.md` frontmatter.
- Use the shared module index so route, finish, brief, and Obsidian export agree on module ids/paths.
- Score alias, module-name, and path-keyword matches.
- Keep direct high-confidence matches separate from graph-related context modules.
- Expand a bounded context pack from typed module relations such as `depends_on` and `used_by`.
- Support `--graph` as an explicit graph-aware route output flag without changing direct route labels.
- Respect `--max-context` so route output can stay compact for small handoffs.
- Extract suggested verification commands from each selected module's `## Tests / Verification` section.
- Record generated route usage stats under `.context/generated/stats/route-usage.json` when policy allows `stats.update`.
- Output a route card with likely modules, related context, read-first files, suggested verify commands, and low-confidence notes.
- Surface pending relation candidates only as non-canonical review warnings when that workflow exists.
- De-duplicate relation candidate warnings by candidate id so `.json` + `.md` pairs count once.
- Avoid inventing modules when no high-confidence match exists.

## Depends On
- `gray-matter`
- `core/module-index.ts`

## Used By
- `cmap route "<task>"`
- `cmap brief "<task>"`
- Future `finish` and hooks as a hint source.
- `cmap hooks test --event UserPromptSubmit --mode assist`

## Data Flow
Task text -> shared module index -> deterministic direct scoring -> bounded relation expansion -> verification command extraction from selected context modules -> optional generated route usage stats -> text/JSON route report.

## State / Storage
Writes generated `.context/generated/stats/route-usage.json` when policy allows stats updates; it does not write canonical context facts.

## Constraints
- No embeddings, no model calls, no semantic guessing.
- ASCII aliases require word-like boundaries so `check` does not match `checkpoint`.
- Non-ASCII aliases can use substring matching for Chinese task phrases.
- Related context is a reading suggestion only; it must not be treated as a direct route match or edit target.
- `--max-context` changes context pack size only; it must not change the direct `modules` ranking.
- Unpromoted candidates must not affect `route.modules`, `route.contextModules`, or route benchmark scoring.
- Route does not consume generated evidence, import graphs, or test ownership candidates as route facts.

## Traps
- Short English aliases can create false positives inside longer words.
- Route output is a reading suggestion, not a code modification plan.
- Verification commands are parsed from module docs and can become stale; keep `.context/modules/*` updated when tests move.
- Route v2 is a paused historical idea. Current roadmap only allows small warnings for pending candidates after human-review surfaces exist.

## Tests / Verification
- `pnpm test tests/integration/m2.test.ts`
- `pnpm test tests/integration/m6-brief-obsidian.test.ts`
- `pnpm test tests/integration/m10-route-context-pack.test.ts`
- `pnpm test tests/integration/m11-context-size-controls.test.ts`
- `pnpm test tests/integration/m14-graph-route.test.ts`
- `pnpm test tests/integration/m20-relation-candidates.test.ts`
- `pnpm test tests/integration/m13-policy-stats.test.ts`
- `pnpm dev route "checkpoint 更新当前主线"`

## When to Update This Doc
When scoring, output format, confidence rules, or alias parsing change.
