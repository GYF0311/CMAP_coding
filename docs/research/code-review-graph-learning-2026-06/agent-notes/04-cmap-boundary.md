# Code Review Graph Agent Note 04: CMAP Boundary Review

Date: 2026-06-04
Agent focus: what CMAP should absorb or reject
Mode: local read-only research

## Research Scope

Studied CMAP framing and Code Review Graph boundary-sensitive files:

- `.context/CHECKPOINT.md`
- `.context/MAP.md`
- `docs/research/coding-knowledge-graphs-2026-06/projects/code-review-graph.md`
- `docs/planning/source-intelligence-upgrade-2026-06/research/code-review-graph.md`
- `docs/planning/source-intelligence-upgrade-2026-06/implementation-roadmap.md`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/memory.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/wiki.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/refactor.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/daemon.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/main.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/skills.py`
- README, commands, and schema docs.

## One-Sentence Conclusion

CMAP should learn Code Review Graph's review-time source evidence layer, but should not copy its all-in-one memory/wiki/daemon/refactor expansion.

## Where Code Review Graph Is Strong

Its strongest part is review-time source graph:

```text
git diff
  -> changed symbols
  -> impact radius
  -> minimal review context
  -> risk hints
  -> test gaps
  -> token-saving estimate
```

It also has useful engineering details:

- SQLite graph storage
- full-text search
- recursive traversal
- edge confidence
- path normalization
- incremental update
- compact query vocabulary
- minimal-context-first interaction

## What CMAP Should Absorb

CMAP should absorb these as generated source evidence:

- impact report shape: changed files, changed symbols, impacted files/symbols, likely tests, risk factors, truncated/freshness/confidence.
- stable query vocabulary: callers, callees, imports, importers, tests, file impact.
- confidence, provenance, and freshness on every source evidence item.
- token-saving metrics, clearly labeled as estimates and verified by CMAP's own benchmarks.
- Review HTML and brief support panels for source evidence, placed after reviewed `.context`.
- path normalization, stale warnings, and ambiguous symbol candidates.
- dry-run and candidate-first posture: source discoveries go to `.context/generated` or inbox before review.

## What CMAP Should Not Absorb

- memory loop: writing Q&A results to Markdown and re-ingesting them can disguise generated answers as reviewed knowledge.
- auto wiki: automatically generated architecture docs can become a second fact source.
- default daemon/watch/global hooks: background changes make evidence freshness harder for users to reason about.
- wide MCP/skills surface, especially instructions that force the graph before project map or source reads.
- refactor apply: useful, but it is source-code writing and outside CMAP's project-memory layer.
- risk score as truth: it is review priority, not objective architecture quality.
- all-language parser, embeddings, community detection, and flow tracing as MVP.

## Three Key Judgments

1. Code Review Graph answers "where should we look for this code change?" CMAP answers "how should future agents understand, hand off, and verify this project?"
2. Memory/wiki/skills/daemon are powerful but risky for CMAP because they blur generated analysis and reviewed context.
3. Safe absorption path: source graph creates evidence; evidence enters brief/view/inbox; human review decides what becomes `.context`.

## Recommendation For Final Report

Do not say CMAP should become Code Review Graph.

Say:

```text
CMAP should add a source-evidence layer inspired by Code Review Graph:
source graph -> generated evidence -> review surface / inbox -> human promotion -> canonical .context.
```

Frame it as:

- Worth learning: diff-to-symbol, impact radius, minimal context, confidence/provenance, context-saving benchmark.
- Not directly adoptable: memory loop, auto wiki, default daemon/watch, wide MCP/skills, refactor apply, risk score canonicalization.
