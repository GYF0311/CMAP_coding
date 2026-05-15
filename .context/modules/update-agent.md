---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-15T22:35:51+08:00
confidence: ai-drafted
module: update-agent
paths:
  - src/commands/update.ts
  - src/core/map-patch.ts
  - src/core/candidate-store.ts
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
relation_explanations:
  depends_on:
    handoff:
      why: "update-agent consumes handoff-style MapPatch proposals generated from AI closeout workflows."
      produces: "Validated routine updates, generated evidence writes, or candidate inbox artifacts."
      impact: "Changing handoff request fields may require MapPatch parser and update command contract changes."
    finish:
      why: "finish --agent creates update-request artifacts that update-agent later validates and routes through policy."
      produces: "A reviewable bridge from changed files to MapPatch candidate or routine operations."
      impact: "Finish request format changes may require src/core/map-patch.ts and m7 update-agent tests to change."
    verify:
      why: "update-agent runs post-verify and rolls back when an applied routine change introduces new structural errors."
      produces: "Backup-backed apply runs with verification evidence and rollback instructions."
      impact: "Verify error semantics can change which updates are rolled back or reported as safe."
    cp:
      why: "update-agent shares backup and safe-path primitives used by reversible file updates."
      produces: "Backup records for canonical writes and rollback support."
      impact: "Backup format or path safety changes may affect update rollback and inbox promotion behavior."
    evidence:
      why: "update-agent writes generated evidence and structured candidates into stores owned by evidence/inbox workflows."
      produces: "Generated evidence JSONL, verification evidence, and .context/inbox/candidates JSON+Markdown pairs."
      impact: "Evidence store or candidate-store changes must be reflected in MapPatch routing and update tests."
---
# Module: update-agent

## Purpose
Accept AI-authored MapPatch proposals and safely maintain routine `.context` state without letting AI directly rewrite trusted project semantics.

## Code Paths
- `src/commands/update.ts`
- `src/core/map-patch.ts`
- `src/core/candidate-store.ts`
- `src/fs/backup.ts`

## Responsibilities
- Parse and validate `cmap.map_patch.v1` and `cmap.map_patch.v2` MapPatch JSON.
- Classify operations into routine auto-apply, inbox candidate, or reject.
- Apply only policy-approved checkpoint, generated evidence, verification evidence, and generated stats operations with explicit confidence and evidence.
- Validate `evidence.append` module ids and `fields.files` before writing generated evidence; unknown modules or missing evidence files route to inbox.
- Allow command-only `verification.evidence`, while validating any provided file evidence through project-root safe paths.
- Route module semantics, decisions, verification policy, status updates, and low-risk metadata candidates to `.context/inbox/`.
- For MapPatch operations routed to inbox, write structured `cmap.candidate.v1` JSON+Markdown pairs under `.context/inbox/candidates/` while retaining legacy `update-*.md` reports for compatibility.
- Share the candidate-store schema with other producers such as low-confidence route alias requests; update-agent itself only produces MapPatch-derived candidates.
- Deduplicate structured MapPatch candidates by stable fingerprint so repeated agent proposals do not spam inbox.
- Reject blocked operations such as code writes, shell runs, module delete/rename, and semantic map overwrite.
- Leave inbox backlog visible and governable through `cmap inbox status`, `cmap inbox triage`, `cmap inbox promote --dry-run|--apply`, `cmap inbox archive`, `cmap verify --stale`, and `cmap verify --freshness`.
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
- `src/context/policy.ts` for deterministic policy v2 gates.
- `src/core/generated-store.ts` and `src/core/generated-stats.ts` for non-canonical generated writes.

## Used By
- `cmap update --agent --from <file>`
- `cmap update --agent --from <file> --apply-routine`
- `cmap update --agent --from <file> --write-inbox`
- `cmap update rollback <backupId>`
- `cmap finish --agent` as the request-generation step.

## Data Flow
AI or host writes MapPatch JSON -> `update` reads file/stdin -> `map-patch` validates schema, confidence, evidence, and paths -> policy-approved routine/generated operations write only allowed stores with backup/audit where needed -> candidate-only semantic or metadata operations are written as structured `cmap.candidate.v1` JSON+Markdown under `.context/inbox/candidates/` plus a legacy compatibility report under `.context/inbox/update-*.md` -> blocked operations are rejected.

## State / Storage
- Reads MapPatch JSON from `--from <file>` or stdin.
- May write `.context/CHECKPOINT.md` for routine `checkpoint.write`.
- May append `.context/generated/evidence/modules/*.jsonl` and `.context/generated/evidence/verification.jsonl`.
- May update `.context/generated/stats/*.json`/`.jsonl`.
- Writes `.context/audit/update-*.md` for apply runs.
- Writes `.context/backups/*.json` before canonical writes.
- Writes `.context/inbox/update-*.md` for legacy high-risk candidate reports.
- Writes `.context/inbox/candidates/candidate-<timestamp>-<hash>.json|md` for structured MapPatch candidates.
- Reads are handled by `cmap inbox status` and `cmap inbox triage`; `cmap inbox promote --dry-run|--apply` previews or applies allowed low-risk metadata, and `cmap inbox archive` retains reviewed candidates under `.context/inbox/archive/`.

## Constraints
- Does not call a model API.
- Does not run arbitrary shell commands from MapPatch input.
- Does not write code files.
- Does not auto-write `MAP.md`, `DECISIONS.md`, `VERIFY.md`, or `.context/modules/*.md`.
- Does not auto-create, rename, delete, or reassign modules.
- Does not auto-apply semantic module updates, decisions, or verify policy changes.
- Treats AI confidence as input only; policy still caps what can be applied.

## Traps
- `--agent` means “process an external AI proposal”, not “cmap becomes an autonomous coding agent”.
- Missing file evidence routes a proposal to inbox instead of blocking the whole run.
- Inbox must remain visible in finish/verify workflows; otherwise semantic candidates can be silently forgotten.
- `inbox promote --apply` belongs to the evidence/inbox module and remains limited to alias/path/evidence metadata.
- `rollback` restores the files captured in one backup id; it is not a git reset.

## Tests / Verification
- `pnpm test tests/integration/m7-update-agent.test.ts`
- `pnpm test tests/integration/m21-candidate-store.test.ts`
- `pnpm dev update --agent --from <patch.json>`
- `pnpm dev update --agent --from <patch.json> --apply-routine`
- `pnpm dev verify`

## When to Update This Doc
When MapPatch schema changes, when new routine auto-apply operations are allowed, or when inbox/rollback policy changes.
