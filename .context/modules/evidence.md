---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-13T02:38:30+08:00
confidence: ai-drafted
module: evidence
paths:
  - src/commands/evidence.ts
  - src/commands/inbox.ts
  - src/commands/freshness.ts
  - src/core/generated-store.ts
  - src/core/generated-stats.ts
  - src/core/freshness.ts
aliases:
  - evidence
  - generated evidence
  - module activity
  - stats
  - inbox status
  - inbox triage
  - promote dry-run
  - promote apply
  - archive
  - stale
  - freshness
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
Maintain deterministic support evidence, generated module/route usage stats, and candidate inbox health without promoting generated notes or candidate facts into trusted project semantics.

## Code Paths
- `src/commands/evidence.ts`
- `src/commands/inbox.ts`

## Responsibilities
- Append bounded generated evidence to `.context/generated/evidence/modules/<module>.jsonl`.
- List and migrate legacy generated evidence blocks out of module docs.
- Record deterministic module activity stats under `.context/generated/stats/module-activity.json` when policy allows `stats.update`.
- Record deterministic route usage stats under `.context/generated/stats/route-usage.json` when policy allows `stats.update`.
- Maintain `.context/generated/freshness.json` snapshots and freshness review markers.
- Treat the first freshness snapshot as a baseline, not a human semantic review; `mark-reviewed` is the explicit review marker.
- Surface missing snapshot, frontmatter semantic drift, generated evidence drift, high-risk/routine inbox candidates, and relation candidate subdirectory signals through `verify --freshness`.
- Require explicit module id or alias, evidence file, and summary before writing evidence.
- Verify evidence files exist inside the project root.
- Keep generated evidence non-canonical and separate from reviewed module semantics.
- Print `.context/inbox/` candidate counts through `cmap inbox status`.
- Group inbox candidates by risk and type through `cmap inbox triage`.
- Preview candidate promotion guidance through `cmap inbox promote <id> --dry-run` without editing canonical context.
- Apply only low-risk alias/path/evidence candidates through `cmap inbox promote <id> --apply` with backup, audit, verify, and archive.
- Reject false candidates through `cmap inbox reject <id> --reason "..."` while retaining the original candidate in archive.
- Move reviewed candidates into `.context/inbox/archive/` through `cmap inbox archive <id>` without deleting data.
- Count simple high-risk inbox markers so semantic backlog remains visible.
- Support `verify --stale` and `verify --freshness` by keeping evidence, freshness, and inbox maintenance as deterministic signals.
- Expose internal append helpers so assist-mode hooks and MapPatch v2 can record generated evidence without rewriting module semantics.
- Expose internal stats helpers so route commands, local assist prompt tests, and Codex assist prompt ingest can update generated counters without changing canonical facts.

## Depends On
- `core/module-index.ts` for module lookup and aliases.
- `fs/safe-path.ts` for project-root evidence path safety.
- `context/scanner.ts` for existence checks.
- `context/policy.ts` for generated evidence and stats policy.
- `update-agent` as the main producer of inbox candidates.
- `verify` as the deterministic warning surface.

## Used By
- `cmap evidence append --module <id> --file <path> --summary "..."`
- `cmap evidence list --module <id>`
- `cmap evidence migrate --from-module-docs --dry-run|--apply`
- `cmap freshness snapshot`
- `cmap freshness diff`
- `cmap freshness mark-reviewed --module <id> --evidence "..."`
- `cmap inbox status`
- `cmap inbox triage`
- `cmap inbox promote <id> --dry-run`
- `cmap inbox promote <id> --apply`
- `cmap inbox reject <id> --reason "..."`
- `cmap inbox archive <id>`
- `cmap verify --stale`
- `cmap verify --freshness`
- `cmap hooks stop --profile assist --changed <files>`
- `cmap route "<task>"`
- `cmap hooks test --event UserPromptSubmit --mode assist --prompt "..."`
- `cmap hooks ingest --host codex --event UserPromptSubmit --mode assist`

## Data Flow
User, assist hook, or MapPatch v2 provides explicit evidence -> generated-store helper resolves module and evidence file -> command appends JSONL evidence under `.context/generated/evidence/` and updates generated stats -> `verify --stale`, `verify --freshness`, and human review can use that evidence as support, not as canonical semantics. Route commands, local assist prompt tests, and Codex assist prompt ingest can update route usage counters as generated telemetry. External AI/update/reconcile outputs write candidate Markdown into `.context/inbox/`; inbox commands count, triage, preview, apply allowed low-risk metadata, reject false candidates with reasons, and archive reviewed candidates without promoting semantic facts.

## State / Storage
- Writes `.context/generated/evidence/modules/*.jsonl`.
- Writes `.context/generated/evidence/verification.jsonl`.
- Writes `.context/generated/stats/module-activity.json` when `stats.update` is enabled.
- Writes `.context/generated/stats/route-usage.json` when `stats.update` is enabled.
- Writes `.context/generated/freshness.json` when snapshotting freshness.
- Reads `.context/inbox/*.md` for backlog counts.
- Writes `.context/audit/inbox-promote-*.md` and `.context/backups/*.json` before low-risk promotion writes.
- Moves reviewed top-level inbox candidates into `.context/inbox/archive/`.
- May update only allowed module frontmatter metadata (`aliases`, `paths.include`, `paths.exclude`) during low-risk promotion.

## Constraints
- Does not call a model API.
- Does not infer module responsibilities.
- Does not promote semantic or decision inbox candidates.
- Does not write `MAP.md`, `DECISIONS.md`, or `VERIFY.md`.
- Generated evidence is support data only and must not override reviewed module docs.
- Low-risk promotion must create backup/audit records and pass verify checks before archiving the candidate.

## Traps
- Evidence can show activity or verification; it cannot prove a module boundary by itself.
- Module activity stats are deterministic counters, not semantic ownership.
- Route usage stats show working patterns, not module truth.
- `inbox promote --dry-run` is review guidance only; `--apply` is limited to alias/path/evidence metadata and never writes semantic sections.
- Archived inbox files are retained as records, not deleted.
- Stale/freshness warnings are review prompts, not proof that a doc is wrong.

## Tests / Verification
- `pnpm test tests/integration/m8-evidence-stale-inbox.test.ts`
- `pnpm test tests/integration/m13-policy-stats.test.ts`
- `pnpm test tests/integration/m9-hooks-assist.test.ts`
- `pnpm test tests/integration/m18-freshness-inbox-promote.test.ts`
- `pnpm dev evidence append --module route --file src/commands/route.ts --summary "Route inspected"`
- `pnpm dev evidence list --module route`
- `pnpm dev evidence migrate --from-module-docs --dry-run`
- `pnpm dev freshness snapshot`
- `pnpm dev freshness diff`
- `pnpm dev inbox status`
- `pnpm dev inbox triage`
- `pnpm dev inbox promote <id> --dry-run`
- `pnpm dev inbox promote <id> --apply`
- `pnpm dev inbox reject <id> --reason "not true"`
- `pnpm dev inbox archive <id>`
- `pnpm dev verify --stale`
- `pnpm dev verify --freshness`

## When to Update This Doc
When generated evidence schema changes, when inbox governance commands change, or when hooks change how they write generated evidence.
