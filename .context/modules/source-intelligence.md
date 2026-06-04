---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-06-04T16:58:00+08:00
confidence: ai-drafted
module: source-intelligence
paths:
  - src/source-intelligence
  - src/commands/source.ts
  - src/commands/symbol.ts
  - src/commands/impact.ts
  - tests/integration/source-intelligence*.test.ts
aliases:
  - source intelligence
  - source index
  - symbol query
  - callers
  - callees
  - impact analysis
  - architecture scan
  - impact diff
  - impact symbol
  - 源码图谱
  - 符号查询
  - 调用关系
  - 影响分析
  - 谁调用
  - 调用谁
  - 改文件影响谁
  - 架构扫描
relations:
  depends_on:
    - cli
    - evidence
    - brief
    - view
    - benchmark
    - tests
---
# Module: source-intelligence

## Purpose
Build and query generated, non-canonical TS/JS source evidence so agents can answer symbol, caller/callee, file impact, diff impact, architecture advisory, and source-evidence brief questions without broad repository reads.

## Code Paths
- `src/source-intelligence/**`
- `src/commands/source.ts`
- `src/commands/symbol.ts`
- `src/commands/impact.ts`
- `tests/integration/source-intelligence*.test.ts`

## Responsibilities
- Build `.context/generated/source-index/**` from TypeScript and JavaScript source files.
- Store source index files, symbols, edges, unresolved refs, query metrics, and generated evidence records as generated support material only.
- Report source-index freshness from current file state.
- Answer generated symbol queries through `symbol find`, `symbol explain`, `symbol callers`, and `symbol callees`.
- Answer generated impact queries through `impact file`, `impact diff`, and `impact symbol`.
- Produce source architecture advisory output through `source architecture`.
- Keep every source-derived report labelled `generated=true`, `canonical=false`, and non-canonical.
- Bound caller/callee/snippet output and surface omitted/truncated counts.
- Preserve trust boundary tests proving source commands do not write canonical `.context` facts.

## Depends On
- `cli` for public command registration.
- `evidence` for generated evidence/query metric storage.
- `brief` for optional source evidence appended after reviewed context.
- `view` for source evidence support panels.
- `benchmark` for source-intelligence precision/recall/F1 and token/tool-call proxy evaluation.
- `tests` for CLI and trust-boundary regression coverage.

## Used By
- `cmap source index`
- `cmap source status`
- `cmap source architecture`
- `cmap symbol find <query>`
- `cmap symbol explain <query>`
- `cmap symbol callers <query>`
- `cmap symbol callees <query>`
- `cmap impact file <path>`
- `cmap impact diff`
- `cmap impact symbol <query>`
- `cmap brief "<task>" --with-source-evidence`
- `cmap benchmark source-intelligence --file bench/source-intelligence.jsonl`

## Data Flow
Source files -> TS/JS source indexer -> `.context/generated/source-index/**` -> symbol/impact/architecture/brief/view/benchmark query reports. Reviewed `.context` module docs may be referenced for related-module hints, but source-derived facts never promote themselves into canonical memory.

## State / Storage
- `.context/generated/source-index/source-index.meta.json`
- `.context/generated/source-index/files.json`
- `.context/generated/source-index/symbols.json`
- `.context/generated/source-index/edges.json`
- `.context/generated/source-index/unresolved-refs.json`
- `.context/generated/source-index/evidence/*.json`
- `.context/generated/source-index/metrics/*.json`

## Constraints
- TS/JS only for the current implementation.
- Do not copy competitor source code.
- Do not revive the old import graph, route v2, or pack v2 as the active route/pack path.
- Generated source evidence is support material, not reviewed project memory.
- Source architecture hints are candidate-only advisory signals.
- MCP wrappers are documentation candidates only until CLI schemas are stable and separately implemented.

## Traps
- Freshness can make otherwise plausible impact output stale; check `cmap source status`.
- Ambiguous symbol queries must stay ambiguous instead of silently choosing the wrong symbol.
- Benchmark token/tool-call savings are proxies, not measured model billing.
- Related CMAP modules in impact reports are review hints, not canonical ownership changes.

## Tests / Verification
- `pnpm test tests/integration/source-intelligence.test.ts`
- `pnpm test tests/integration/source-intelligence-package.test.ts`
- `pnpm test tests/integration/source-intelligence-symbol.test.ts`
- `pnpm test tests/integration/source-intelligence-brief-view.test.ts`
- `pnpm test tests/integration/source-intelligence-p2.test.ts`
- `pnpm test tests/integration/source-intelligence-benchmark.test.ts`
- `pnpm typecheck`
- `pnpm dev verify --changed`

## When to Update This Doc
When source index schema, generated storage paths, command surface, freshness policy, trust-boundary behavior, benchmark format, or source-evidence view/brief integration changes.
