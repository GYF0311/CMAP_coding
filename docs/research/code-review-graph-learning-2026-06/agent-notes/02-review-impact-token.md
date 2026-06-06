# Code Review Graph Agent Note 02: Review, Impact, And Token Saving

Date: 2026-06-04
Agent focus: diff-driven review, impact analysis, risk, tests, and token savings
Mode: local read-only research

## Research Scope

Studied review/impact/token-saving paths:

- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/changes.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/incremental.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/context_savings.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/tools/review.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/tools/context.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/token_benchmark.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/code_review_graph/eval/token_benchmark.py`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/docs/FEATURES.md`
- `research/coding-knowledge-graphs-2026-06/repos/code-review-graph/docs/COMMANDS.md`
- selected CSVs under `evaluate/results/`

## One-Sentence Conclusion

The strongest reusable idea is diff-driven minimal review context: find changed files and symbols, walk the graph for impact, then give AI a small evidence-backed review package.

## Review Flow

```text
git diff / PR diff
  -> changed files
  -> diff ranges
  -> changed symbols
  -> impact radius
  -> risk + test gaps
  -> minimal review context
  -> token savings panel
```

Plain meaning:

- changed files: which files changed.
- diff ranges: which lines changed.
- changed symbols: which functions/classes/tests were touched.
- impact radius: what the change may affect.
- risk + test gaps: what deserves more review and where tests may be missing.
- minimal review context: the smallest useful package for AI review.
- token savings panel: an estimate of how much text was avoided.

## Key Review Functions

- `detect_changes`: the main review entry. It maps diffs to changed functions, affected flows, test gaps, and review priorities.
- `get_review_context`: builds a review package from changed files, impact radius, and source snippets.
- `get_impact_radius`: uses SQLite recursive CTE traversal to expand impact through graph relationships.
- `get_minimal_context`: starts with a small route card instead of dumping a large context.
- `update --brief`: refreshes the graph and then analyzes.
- `detect-changes --brief`: analyzes against the existing graph without refreshing it first.

## How It Reduces Context

It does not compress the whole repository. It shrinks the problem boundary.

The default review flow starts from changed files, maps to changed symbols, then walks around those symbols. It includes only changed nodes, nearby impacted nodes, likely tests, risk notes, and bounded snippets.

For large files, it avoids dumping the whole file. It extracts the lines around changed symbols instead.

`context_savings` estimates tokens with a simple `characters / 4` rule. A `--verify` path can use `tiktoken` for calibration, but it remains a measurement estimate, not proof of model understanding.

Important nuance: token saving depends on scenario.

- Whole-repository Q&A can show large reductions because the graph avoids reading the entire corpus.
- Small diff review may not save tokens. The structured graph response can be larger than directly reading a tiny changed file.

Local CSVs show this caveat clearly: impact recall is high, but token savings on small commits are not guaranteed.

## Risk And Impact Logic

Impact comes from graph traversal. Starting from changed files/symbols, it follows calls, imports, inheritance, tests, and related edges. It has depth limits and truncation signals.

Risk score is heuristic. It considers:

- flow criticality: whether changed code participates in important flows.
- cross-community callers: whether other areas call this code.
- test coverage: whether graph edges show tests.
- security keywords: whether names look security-sensitive.
- caller count: how many things call this symbol.

Test gaps depend on `TESTED_BY` edges. If the parser misses test links, the tool may report a gap even when tests exist.

Impact accuracy is conservative: the local benchmark summary shows high recall and lower precision. In plain terms: it tries not to miss affected files, but it may include extra files.

## Limits

- The graph must be fresh. `detect-changes --brief` does not refresh the graph first.
- Small diffs do not guarantee token savings.
- Risk weights are product heuristics, not objective truth.
- Test gap warnings are evidence, not proof.
- Multi-language parsing and optional dependencies are heavy; CMAP should not copy the full Python/Jedi/embedding stack.

## Lessons For CMAP

CMAP can absorb a `SourceImpactReport` shape:

- changed files
- diff ranges
- changed symbols
- impacted files/symbols
- likely tests
- risk factors
- context savings
- truncation
- freshness

These reports should live under `.context/generated` or a Review HTML support panel. They should not automatically edit canonical `.context` files.

CMAP should measure token savings separately for whole-repository understanding and diff review. Using large whole-corpus savings to advertise tiny diff review would be misleading.
