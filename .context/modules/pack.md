---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T21:59:49+08:00
confidence: ai-drafted
module: pack
paths:
  - src/commands/pack.ts
aliases:
  - pack
  - context pack
  - token budget
  - AI context pack
  - 上下文包
  - 阅读包
  - token 预算
relations:
  depends_on:
    - route
    - graph
    - handoff
    - verify
  observes:
    - update-agent
    - evidence
---
# Module: pack

## Purpose
Render a budgeted, redacted context pack for one AI coding task from the routed graph neighborhood.

## Code Paths
- `src/commands/pack.ts`

## Responsibilities
- Route the task with graph-aware context expansion.
- Include only routed direct and related modules, not the full repository.
- Include checkpoint/status, selected module docs, decisions, verify commands, verification source, and inbox warnings.
- Enforce a deterministic approximate token budget by converting tokens to a character ceiling.
- Redact obvious secret-looking values such as API keys, tokens, secrets, passwords, and Bearer tokens.
- Write the pack to stdout or a project-relative output file.

## Depends On
- `route`
- `graph`
- `handoff`
- `verify`
- `update-agent`
- `evidence`

## Used By
- `cmap pack "<task>" --budget <n> --format markdown`
- Future hook assist task startup output.

## Data Flow
Task text -> route graph neighborhood -> selected module docs and canonical context excerpts -> redaction -> budget truncation -> stdout or `.context/out/*`.

## State / Storage
Read-only unless `--out` is provided, in which case the pack is written to a project-relative file.

## Constraints
- Do not scan or embed the whole repository.
- Do not treat generated evidence or inbox candidates as canonical facts.
- Do not promote pack v2 priority assembly as current roadmap; the next review surface is `cmap view export`.
- Generated evidence may be included only when clearly labeled `Generated / Non-canonical`.
- Budget enforcement is approximate and deterministic; it is not model-tokenizer exact.

## Traps
- A too-small budget can truncate useful context; rerun with a larger budget when the task is broad.
- Redaction is a safety net for obvious strings, not a full secret scanner.

## Tests / Verification
- `pnpm test tests/integration/m16-context-pack.test.ts`
- `pnpm dev pack "route aliases 模块定位" --budget 900 --out .context/out/pack.md`

## When to Update This Doc
When pack sections, budget semantics, redaction rules, or output contracts change.
