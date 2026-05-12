---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T17:42:00+08:00
confidence: ai-drafted
module: update-agent
paths:
  - src/commands/update.ts
  - src/core/map-patch.ts
  - src/fs/backup.ts
aliases:
  - update
  - MapPatch
  - agent update
  - 自主维护
  - 自动维护
  - rollback
  - inbox
relations:
  depends_on:
    - handoff
    - finish
    - verify
    - cp
    - evidence
---
# Module: update-agent

## Purpose
Accept AI-authored MapPatch proposals and safely maintain routine `.context` state without letting AI directly rewrite trusted project semantics.

## Code Paths
- `src/commands/update.ts`
- `src/core/map-patch.ts`
- `src/fs/backup.ts`

## Responsibilities
- Parse and validate `cmap.map_patch.v1` MapPatch JSON.
- Classify operations into routine auto-apply, inbox candidate, or reject.
- Apply only low-risk checkpoint state with explicit task, next step, confidence, and file evidence.
- Route module semantics, decisions, verification policy, and unknown operations to `.context/inbox/`.
- Leave inbox backlog visible through `cmap inbox status` and `cmap verify --stale`.
- Create `.context/backups/` records before canonical writes.
- Write `.context/audit/` records for MapPatch apply runs.
- Run post-verify and roll back when the update introduces new structural errors.
- Restore from a printed backup id through `cmap update rollback <backupId>`.

## Depends On
- `zod` for structured MapPatch validation.
- `gray-matter` for preserving `CHECKPOINT.md` frontmatter.
- `src/fs/safe-path.ts` for project-root path safety.
- `src/fs/backup.ts` for reversible writes.
- `src/commands/verify.ts` for post-apply structural checks.

## Used By
- `cmap update --agent --from <file>`
- `cmap update --agent --from <file> --apply-routine`
- `cmap update --agent --from <file> --write-inbox`
- `cmap update rollback <backupId>`
- `cmap finish --agent` as the request-generation step.

## Data Flow
AI or host writes MapPatch JSON -> `update` reads file/stdin -> `map-patch` validates schema and paths -> routine `checkpoint.write` updates `CHECKPOINT.md` with backup/audit -> high-risk candidates are written to `.context/inbox/`.

## State / Storage
- Reads MapPatch JSON from `--from <file>` or stdin.
- May write `.context/CHECKPOINT.md` for routine `checkpoint.write`.
- Writes `.context/audit/update-*.md` for apply runs.
- Writes `.context/backups/*.json` before canonical writes.
- Writes `.context/inbox/update-*.md` for high-risk candidates.
- Reads are handled by `cmap inbox status`; promotion remains manual/reviewed.

## Constraints
- Does not call a model API.
- Does not run arbitrary shell commands from MapPatch input.
- Does not write code files.
- Does not auto-write `MAP.md`, `DECISIONS.md`, `VERIFY.md`, or `.context/modules/*.md`.
- Does not auto-create, rename, delete, or reassign modules.
- Treats AI confidence as input only; policy still caps what can be applied.

## Traps
- `--agent` means “process an external AI proposal”, not “cmap becomes an autonomous coding agent”.
- Missing file evidence routes a proposal to inbox instead of blocking the whole run.
- Inbox must remain visible in finish/verify workflows; otherwise semantic candidates can be silently forgotten.
- `inbox status` is a visibility command, not an approval workflow.
- `rollback` restores the files captured in one backup id; it is not a git reset.

## Tests / Verification
- `pnpm test tests/integration/m7-update-agent.test.ts`
- `pnpm dev update --agent --from <patch.json>`
- `pnpm dev update --agent --from <patch.json> --apply-routine`
- `pnpm dev verify`

## When to Update This Doc
When MapPatch schema changes, when new routine auto-apply operations are allowed, or when inbox/rollback policy changes.
