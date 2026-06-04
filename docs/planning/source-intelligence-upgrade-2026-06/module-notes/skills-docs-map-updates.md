# Skills Docs Map Updates

Date: 2026-06-04

## Research Scope

This note maps the future source-intelligence upgrade onto CMAP's current documentation and project-memory surfaces.

CMAP files inspected:

- `src/skill/templates.ts`
- `README.md`
- `.context/MAP.md`
- `.context/modules/skill.md`
- `.context/modules/showcase.md`
- `.context/modules/graph.md`
- `.context/modules/route.md`
- `.context/modules/brief.md`
- `.context/modules/evidence.md`
- `.context/modules/view.md`
- `.context/modules/benchmark.md`

## Current Product Contract

CMAP currently tells agents to:

1. Read checkpoint and project map.
2. Run `cmap route`.
3. Read routed module docs.
4. Use `brief` / `pack` for bounded context.
5. Finish through verify/finish/update/evidence/inbox.

That remains correct. The source-intelligence upgrade should add an earlier optional step for code-structure questions:

```text
When the task requires source-level coupling, query source evidence before broad grep/read.
```

## Skill Updates Needed

Future `src/skill/templates.ts` should teach source-intelligence commands as non-canonical support commands.

Candidate additions to `SKILL.md`:

- Source intelligence is generated evidence, not canonical `.context` truth.
- Use source queries for callers/callees/impact before reading broad source trees.
- Promote durable semantic conclusions only through candidate review.

Candidate additions to `commands.md`:

- `cmap source index`
- `cmap source status`
- `cmap source architecture`
- `cmap symbol find <query>`
- `cmap symbol callers <symbol>`
- `cmap symbol callees <symbol>`
- `cmap impact file <path>`
- `cmap impact symbol <symbol>`
- `cmap brief "<task>" --with-source-evidence`
- `cmap benchmark source-intelligence`

Candidate additions to `boundaries.md`:

- `.context/generated/source-index/**` is generated support material.
- Source graph facts can be wrong or stale.
- Source evidence can suggest relation candidates but must not write module relationships directly.

## README Updates Needed

Future README should keep the current trust-boundary positioning and add one new block:

```text
Source Intelligence

cmap can optionally build a local source index to answer symbol and impact questions.
These answers reduce tool calls and context size, but remain generated evidence until reviewed.
```

The boundary section should explicitly distinguish:

- Canonical module graph: reviewed `.context/modules/*.md`.
- Source graph: generated code-structure evidence.
- Review HTML: read-only human review of both.

## .context Map Updates Needed

There are two possible ways to model the future implementation:

1. Add one new module, `source-intelligence`.
2. Split into `source-index`, `symbol-query`, and `impact`.

The recommended MVP is one module first:

```text
source-intelligence
  owns src/commands/source.ts
  owns src/commands/symbol.ts
  owns src/commands/impact.ts
  owns src/source-intelligence/**
```

Reason: the trust boundary and storage schema are still the risky part. Splitting too early could make `.context` noisy before the implementation is stable.

The module should relate to:

- `evidence`: writes generated source evidence and freshness metadata.
- `brief`: can include minimal source evidence packs.
- `view`: can render source evidence panels.
- `benchmark`: measures token/tool-call reduction.
- `graph`: stays canonical module graph and must not be confused with source graph.

## Review HTML Updates Needed

Future `view` should add an optional section gated by `--include-support` or a new flag:

- Source Index Status
- Symbol Evidence
- File Impact Evidence
- Architecture Scan Evidence
- Candidate Relation Suggestions

The UI must label all source-analysis output as Generated / Non-canonical.

The browser view should never apply or promote evidence. Promotion remains a CLI/inbox review flow.

## Benchmark Updates Needed

Current `benchmark` evaluates route matching. The upgrade needs a separate benchmark family because source intelligence optimizes different outcomes:

- Tool calls reduced.
- Files read reduced.
- Tokens spent on source reading reduced.
- Correct impacted files found.
- Correct tests suggested.
- No false canonical promotion.

Candidate command:

```bash
cmap benchmark source-intelligence --file bench/source-intelligence.jsonl
```

Candidate fixture fields:

- `task`
- `changed_files`
- `target_symbol`
- `expected_callers`
- `expected_callees`
- `expected_impacted_files`
- `expected_tests`
- `bad_files`

## Documentation Risks

- Do not describe planned commands as shipped before implementation.
- Do not rebrand CMAP as primarily a code graph generator.
- Do not bury the trust-boundary rule under tool excitement.
- Do not imply source evidence can replace module docs.

## Verification

When implementation begins, update and verify:

- `pnpm test tests/integration/m28-skill-bootstrap.test.ts`
- `pnpm dev skill export --check`
- `pnpm dev view export --check --out _cmap-view`
- `pnpm dev benchmark route --file bench/tasks.jsonl`
- New source-intelligence integration tests.
