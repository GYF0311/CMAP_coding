# cmap v0.2 Trust Boundary + Human Review Layer

> Active roadmap as of 2026-05-13. This supersedes the older import graph / route v2 / pack v2 sequence in `research/cmap·打通方案.md`.

## One-line Direction

AI reads code and proposes candidates. CLI validates structure, safety, inbox, and audit. HTML lets humans review the project map. Canonical facts stay protected.

## Why This Reset Exists

The previous roadmap leaned toward CLI-owned code analysis:

- import graph + test ownership
- route v2 complex scoring
- pack v2 priority assembly

That direction risks turning cmap into a cross-language code indexer. The product center should remain a project memory map with deterministic safety rails:

- graph = canonical module relations projection from reviewed module docs
- route = canonical routing plus bounded reviewed-relation context
- generated evidence = support layer, not semantic truth
- inbox = candidate layer, not canonical facts
- view = human review layer, not source of truth

## PR Order

| PR | Name | Goal |
|---|---|---|
| PR-A | Roadmap Reset | Stop old route pollution and update project memory. |
| PR-B | `cmap view export` MVP | Build a read-only HTML project-map review dashboard. |
| PR-C | Trust-Boundary Hygiene + Lifecycle Ingest + Codex Workflow | Align generated/canonical/candidate storage and lifecycle workflows. |
| PR-C2 | Freshness v2 | Track baseline vs reviewed freshness without using module-doc mtime as semantic truth. |
| PR-D | AI Relation Candidate Workflow | Let AI propose relation/alias/path candidates while CLI validates, audits, and writes inbox. |

## Current Boundaries

- `graph build` projects reviewed `.context/modules/*.md` relations. It is not an import graph, test ownership graph, symbol graph, or call graph.
- `route` must not consume unpromoted relation candidates, generated evidence, or external research as facts.
- `route.modules`, `route.contextModules`, and route benchmark scoring must remain based on canonical docs and reviewed relations.
- `pack` may include generated evidence only when clearly labeled `Generated / Non-canonical`.
- `view` is read-only. It can show canonical facts, generated evidence, freshness warnings, and candidates, but it cannot apply or promote changes.
- Relation candidates stay candidate-only in v0.2. No automatic canonical graph writes.

## PR-A Acceptance

- `.context/CHECKPOINT.md`, `.context/STATUS.md`, `.context/MAP.md`, README, PRD, and relevant module docs point to this roadmap.
- Old import graph / route v2 / pack v2 mentions are explicitly paused, superseded, or historical.
- `research/cmap·打通方案.md` keeps its historical content but starts with a superseded notice.
- Next step is PR-B `cmap view export`, not import/test ownership.

## PR-B Preview

`cmap view export` should produce a read-only HTML review dashboard:

- Overview: purpose, active goal, checkpoint, next step, last verified.
- Modules: paths, aliases, responsibilities, verification commands.
- Relations: canonical relation graph/table from reviewed module docs.
- Inbox: pending candidates, risk, evidence, suggested commands.
- Evidence: generated evidence summary when included.
- Freshness: Baseline only / Reviewed / Stale / Pending candidates.

Missing generated/freshness/relation data must degrade to `Not available`.

## PR-D Preview

`cmap relate` should accept AI-authored RelationPatch files, validate them, write JSON + Markdown inbox records, and keep them non-canonical until reviewed.

First version:

- `cmap relate request --task "..."`
- `cmap relate ingest --from relation-patch.json --dry-run`
- `cmap relate ingest --from relation-patch.json --write-inbox`
- `cmap relate promote <id> --dry-run`

No automatic relation apply in v0.2.
