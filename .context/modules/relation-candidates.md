---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-13T21:45:00+08:00
confidence: ai-drafted
module: relation-candidates
paths:
  - src/commands/relate.ts
  - src/core/relation-patch.ts
  - src/context/relation-schema.ts
aliases:
  - relate
  - relation candidate
  - RelationPatch
  - relation workflow
  - 关系候选
  - 关系补丁
relations:
  depends_on:
    - context
    - evidence
  used_by:
    - view
    - route
---
# Module: relation-candidates

## Purpose
Accept AI-authored relation proposals as candidate-only RelationPatch input, validate them deterministically, and route accepted candidates into the inbox for human review.

## Code Paths
- `src/commands/relate.ts`
- `src/core/relation-patch.ts`
- `src/context/relation-schema.ts`

## Responsibilities
- Render `cmap relate request` templates for AI review workflows.
- Parse `cmap.relation_patch.v1` JSON.
- Validate source/target module ids, evidence files, base relation types, confidence, and risk fields.
- Reject unknown relation types and tell the user to extend the relation schema first.
- Write accepted relation candidates into `.context/inbox/relations/*.json|md`.
- Create relation ingest audit files under `.context/audit/`.
- Skip duplicate candidates by stable fingerprint.
- Keep `relate promote <id> --dry-run` candidate-only; it must not edit canonical module docs.

## Boundaries
- Does not parse imports, call graphs, symbols, or tests.
- Does not auto-apply relations into `.context/modules/*.md`.
- Relation candidates are non-canonical until a human edits reviewed module docs.
- Route may warn that relation candidates exist, but must not consume them as route facts.

## Tests / Verification
- `pnpm test tests/integration/m20-relation-candidates.test.ts`
- `pnpm dev relate request --task "..." --changed src/commands/route.ts`
- `pnpm dev relate ingest --from .context/out/relation-patch.json --dry-run`
- `pnpm dev relate promote <id> --dry-run`

## When to Update This Doc
When RelationPatch schema, relation candidate validation, inbox output, or candidate promotion behavior changes.
