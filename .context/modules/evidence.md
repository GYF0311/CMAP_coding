---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T21:18:31+08:00
confidence: ai-drafted
module: evidence
paths:
  - src/commands/evidence.ts
  - src/commands/inbox.ts
  - src/core/generated-stats.ts
aliases:
  - evidence
  - generated evidence
  - module activity
  - stats
  - inbox status
  - inbox triage
  - promote dry-run
  - archive
  - stale
  - hooks assist
  - 证据
  - 候选池
relations:
  depends_on:
    - verify
    - update-agent
    - context
---
# Module: evidence

## Purpose
Maintain deterministic support evidence, generated module activity stats, and candidate inbox health without promoting generated notes or candidate facts into trusted project semantics.

## Code Paths
- `src/commands/evidence.ts`
- `src/commands/inbox.ts`

## Responsibilities
- Append bounded generated evidence blocks to `.context/modules/*.md`.
- Record deterministic module activity stats under `.context/stats/module-activity.json` when policy allows `stats.update`.
- Require explicit module id or alias, evidence file, and summary before writing evidence.
- Verify evidence files exist inside the project root.
- Keep generated evidence clearly marked with `cmap:generated:evidence` markers.
- Print `.context/inbox/` candidate counts through `cmap inbox status`.
- Group inbox candidates by risk and type through `cmap inbox triage`.
- Preview candidate promotion guidance through `cmap inbox promote <id> --dry-run` without editing canonical context.
- Move reviewed candidates into `.context/inbox/archive/` through `cmap inbox archive <id>` without deleting data.
- Count simple high-risk inbox markers so semantic backlog remains visible.
- Support `verify --stale` by keeping evidence and inbox maintenance as deterministic signals.
- Expose an internal append helper so assist-mode hooks can record bounded generated evidence without rewriting module semantics.

## Depends On
- `core/module-index.ts` for module lookup and aliases.
- `fs/safe-path.ts` for project-root evidence path safety.
- `context/scanner.ts` for existence checks.
- `context/policy.ts` for generated evidence and stats policy.
- `update-agent` as the main producer of inbox candidates.
- `verify` as the deterministic warning surface.

## Used By
- `cmap evidence append --module <id> --file <path> --summary "..."`
- `cmap inbox status`
- `cmap inbox triage`
- `cmap inbox promote <id> --dry-run`
- `cmap inbox archive <id>`
- `cmap verify --stale`
- `cmap hooks stop --profile assist --changed <files>`

## Data Flow
User or assist hook provides explicit evidence -> evidence append helper resolves module and evidence file -> command updates the module doc generated evidence block and module activity stats -> `verify --stale` and human review can use that evidence as support, not as canonical semantics. External AI/update/reconcile outputs write candidate Markdown into `.context/inbox/`; inbox commands count, triage, preview, and archive those candidates without promoting facts.

## State / Storage
- Writes bounded generated sections inside `.context/modules/*.md`.
- Writes `.context/stats/module-activity.json` when `stats.update` is enabled.
- Reads `.context/inbox/*.md` for backlog counts.
- Moves reviewed top-level inbox candidates into `.context/inbox/archive/`.
- Does not create new canonical semantic files.

## Constraints
- Does not call a model API.
- Does not infer module responsibilities.
- Does not promote inbox candidates.
- Does not write `MAP.md`, `DECISIONS.md`, or `VERIFY.md`.
- Generated evidence is support data only and must not override reviewed module docs.

## Traps
- Evidence can show activity or verification; it cannot prove a module boundary by itself.
- Module activity stats are deterministic counters, not semantic ownership.
- `inbox promote --dry-run` is review guidance only; it is not canonical promotion.
- Archived inbox files are retained as records, not deleted.
- Stale warnings are heuristic mtime checks; they are prompts to review, not proof that a doc is wrong.

## Tests / Verification
- `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts`
- `pnpm test tests/integration/m13-policy-stats.test.ts`
- `pnpm test tests/integration/m9-hooks-assist.test.ts`
- `pnpm dev evidence append --module route --file src/commands/route.ts --summary "Route inspected"`
- `pnpm dev inbox status`
- `pnpm dev inbox triage`
- `pnpm dev inbox promote <id> --dry-run`
- `pnpm dev inbox archive <id>`
- `pnpm dev verify --stale`

## When to Update This Doc
When generated evidence schema changes, when inbox governance commands change, or when hooks change how they write generated evidence.

<!-- cmap:generated:evidence:start -->
## Generated Evidence

This section is generated support evidence. It is not a semantic source of truth.

- 2026-05-12T09:43:47.009Z: Implemented generated evidence append command for the v0.2 maintenance slice. Evidence: `src/commands/evidence.ts`; command: `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts`
<!-- cmap:generated:evidence:end -->
