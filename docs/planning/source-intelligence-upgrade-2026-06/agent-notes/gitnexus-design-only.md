# GitNexus Design Only Agent Note

## Research Scope

This note studies the local GitNexus repository snapshot only:

- `research/coding-knowledge-graphs-2026-06/repos/gitnexus`

Planning context read:

- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`

Scope focus:

- CLI commands and MCP/direct tool surface.
- Symbol context/explain and blast-radius impact design.
- Multi-repo registry and group/contract bridge design.
- Web UI and HTTP bridge shape.
- Agent skills/hooks workflow.
- Source index pipeline, freshness, and storage metadata.

GitNexus is treated as design-only due to its license. This note extracts product and architecture lessons CMAP can reimplement from scratch without copying source code, schemas verbatim, or bundled templates.

## Source Files Inspected

License and overview:

- `LICENSE`
- `README.md`
- `ARCHITECTURE.md`
- `package.json`
- `gitnexus/package.json`

CLI and setup surface:

- `gitnexus/src/cli/index.ts`
- `gitnexus/src/cli/analyze.ts`
- `gitnexus/src/cli/tool.ts`
- `gitnexus/src/cli/group.ts`
- `gitnexus/src/cli/status.ts`
- `gitnexus/src/cli/serve.ts`
- `gitnexus/src/cli/augment.ts`
- `gitnexus/src/cli/ai-context.ts`
- `gitnexus/src/cli/skill-gen.ts`

MCP, resources, and local backend:

- `gitnexus/src/mcp/tools.ts`
- `gitnexus/src/mcp/resources.ts`
- `gitnexus/src/mcp/local/local-backend.ts`
- `gitnexus/src/mcp/server.ts`
- `gitnexus/src/server/api.ts`
- `gitnexus/src/server/analyze-job.ts`
- `gitnexus/src/server/mcp-http.ts`

Storage, registry, freshness, and incremental metadata:

- `gitnexus/src/storage/repo-manager.ts`
- `gitnexus/src/storage/file-hash.ts`
- `gitnexus/src/storage/parse-cache.ts`
- `gitnexus/src/storage/git.ts`

Source index pipeline and graph model:

- `gitnexus/src/core/run-analyze.ts`
- `gitnexus/src/core/ingestion/pipeline.ts`
- `gitnexus/src/core/ingestion/pipeline-phases/index.ts`
- `gitnexus/src/core/ingestion/pipeline-phases/types.ts`
- `gitnexus/src/core/ingestion/pipeline-phases/runner.ts`
- `gitnexus/src/core/ingestion/pipeline-phases/scan.ts`
- `gitnexus/src/core/ingestion/pipeline-phases/parse.ts`
- `gitnexus/src/core/graph/types.ts`
- `gitnexus-shared/src/graph/types.ts`
- `gitnexus-shared/src/index.ts`
- `gitnexus-shared/src/languages.ts`
- `gitnexus-shared/src/pipeline.ts`
- `gitnexus-shared/src/scope-resolution/types.ts`
- `gitnexus-shared/src/scope-resolution/finalize-algorithm.ts`

Multi-repo and cross-repo design:

- `gitnexus/src/core/group/service.ts`
- `gitnexus/src/core/group/sync.ts`
- `gitnexus/src/core/group/cross-impact.ts`
- `gitnexus/src/core/group/types.ts`

Web UI and bridge:

- `gitnexus-web/package.json`
- `gitnexus-web/src/services/backend-client.ts`
- `gitnexus-web/src/App.tsx`
- `gitnexus-web/src/components/*` file list, including graph, process, file tree, onboarding, settings, and query panels.

Agent skills and hooks:

- `gitnexus/skills/gitnexus-guide.md`
- `gitnexus/skills/gitnexus-impact-analysis.md`
- `gitnexus/skills/gitnexus-exploring.md`
- `gitnexus/skills/gitnexus-pr-review.md`
- `gitnexus-claude-plugin/hooks/gitnexus-hook.js`
- `gitnexus-claude-plugin/hooks/hooks.json`
- `gitnexus-claude-plugin/.claude-plugin/plugin.json`
- `gitnexus-cursor-integration/README.md`

## License Boundary

GitNexus local `LICENSE` is PolyForm Noncommercial License 1.0.0. The `gitnexus/package.json` also declares `PolyForm-Noncommercial-1.0.0`.

For CMAP planning, this means:

- Use GitNexus only as a design study and product reference.
- Do not copy implementation code, bundled skill text, schemas verbatim, CLI strings, UI components, test fixtures, or generated templates into CMAP.
- Do not derive CMAP implementation by transliterating GitNexus functions or preserving its internal control flow.
- Safe outputs are abstracted product ideas, command families, boundary patterns, data-flow concepts, and verification lessons that can be independently implemented.
- Any future CMAP source-intelligence implementation should be written from scratch against CMAP's existing TypeScript style, trust-boundary rules, and generated evidence model.

## Core Mechanisms

GitNexus positions itself as a local code-intelligence graph for AI agents. Its main product split is:

- CLI + MCP: local repository indexing, persistent graph storage, agent tools, and editor integration.
- Web UI: graph explorer and chat-style frontend that can run in browser mode or connect to a local HTTP bridge.

CLI command surface:

- `analyze` builds or updates a repository index and can generate agent context/skills.
- `mcp` starts a stdio MCP server over all indexed repos.
- `serve` starts a local HTTP bridge for the Web UI and MCP-over-HTTP.
- `list`, `status`, `clean`, `remove`, `doctor`, `wiki`, `publish`, and `setup` provide operations around index lifecycle.
- Direct tool commands `query`, `context`, `impact`, `cypher`, and `detect-changes` bypass MCP and call the same backend. This is useful for CI, eval, scripts, and terminal-first workflows.
- `group` subcommands manage multi-repo groups: create/add/remove/list/status/sync/query/impact/contracts.

Source index pipeline:

- The core pipeline is a static phase DAG with explicit dependencies and typed phase outputs.
- The phase list is roughly `scan -> structure -> markdown/cobol -> parse -> routes/tools/orm -> crossFile -> scopeResolution -> mro -> communities -> processes`.
- A single mutable knowledge graph is the primary accumulator. Phase outputs are typed side channels for downstream phases.
- The runner topologically sorts phases, rejects duplicate/missing/cyclic dependencies, wraps phase errors with phase names, and passes each phase only its declared dependencies.
- The parse phase is chunked and can use worker pools. Parse cache is content-addressed at chunk level.
- `runFullAnalysis` wraps pipeline execution, DB writeback, FTS repair, embedding preservation, generated AI context, metadata persistence, and registry update.
- Incremental indexing is based on per-file hashes in `meta.json`; changed/added/deleted sets drive selective DB writeback. A dirty flag forces full rebuild after interrupted incremental runs.

Storage and registry:

- Each repo stores generated index state under repo-local `.gitnexus/`.
- Global `~/.gitnexus/registry.json` tracks indexed repos so MCP/server commands can discover them from any cwd.
- Registry entries include name, path, storage path, indexed time, commit, remote URL, and stats.
- Repo resolution supports names, paths, duplicate aliases, worktree/canonical-root handling, and sibling-clone drift warnings.
- Staleness is commit-based, with special handling for dirty working trees and linked worktrees.

Query, symbol explain, and impact:

- `query` performs concept search over indexed symbols/processes and groups results by execution flow.
- `context` gives a single symbol "360-degree" view: resolved symbol, incoming refs, outgoing refs, process participation, metadata, and disambiguation candidates.
- `impact` resolves a target symbol, traverses graph edges upstream or downstream by depth, and returns risk, direct dependents, affected processes, affected modules, per-depth results, pagination, confidence, and partial/truncated markers.
- `detect_changes` maps git diff hunks to indexed symbols by line range overlap, then maps changed symbols to affected processes.
- Several tools explicitly distinguish ambiguous lookup from not found, instead of silently choosing one candidate.

Multi-repo registry and groups:

- Basic multi-repo support comes from the global registry and per-tool `repo` parameter.
- Group mode adds `@group` and `@group/memberPath` scoping.
- Groups have `group.yaml`, extracted contracts, cross-links, snapshots, missing repos, and a `contracts.json` registry.
- Cross-repo impact is two phase: run local impact in one member, then fan out across a contract bridge with bounded timeout and cross-depth.
- Contract types include HTTP, gRPC, Thrift, topics, library/include-style links, and custom/manifest links.

Web UI:

- `gitnexus-web` is a React/Vite client with graph canvas, file tree, process panels, code reference panels, onboarding, settings, query controls, i18n, and e2e coverage.
- The browser client talks through a consolidated typed HTTP client.
- The server exposes endpoints for health, heartbeat, info, repos, repo detail/delete, graph streaming, query/search/grep/file, clusters/processes, analyze jobs, embedding jobs, and MCP over HTTP.
- Long-running analyze/embed jobs use job state plus SSE progress.
- The server defaults to local binding and applies CORS restrictions.

Skills and hooks:

- Skills teach agent workflows for exploration, impact analysis, debugging, refactoring, PR review, and CLI/reference use.
- Skill workflows consistently tell agents to check repo context/staleness first, query the graph before broad reading, then inspect source files for implementation detail.
- Claude hook integration uses `PreToolUse` to augment Grep/Glob/Bash searches with graph context and `PostToolUse` to warn after git mutations if the index is stale.
- Cursor integration documents similar MCP + skills + hooks layering.
- Hooks are intentionally fail-open: empty output means continue normally.

## Design Lessons CMAP Can Reimplement

CMAP should reimplement only the abstract design patterns that fit the current Trust Boundary + Human Review Layer.

Useful product lessons:

- Add source-intelligence as a generated support layer below canonical `.context`, not as canonical memory.
- Offer both CLI commands and future MCP tools over the same internal query functions.
- Keep direct CLI commands for scripts and evaluation, even if MCP exists.
- Split user questions into stable families:
  - source status/freshness
  - source architecture scan
  - symbol find/explain
  - symbol callers/callees
  - file impact
  - symbol impact
  - diff impact
  - source-aware brief
- Return disambiguation candidates when symbol lookup is ambiguous.
- Include confidence, source file path, line range, relation type, and freshness metadata in every generated source evidence result.
- Prefer "summary first, drill-down available" for hub symbols to avoid enormous outputs.
- Make tool descriptions and command help explicitly say when to use each tool, what to do next, and whether output is generated/non-canonical.

Useful architecture lessons:

- Use a static TypeScript phase DAG for the source indexer.
- Keep scan, parse, import graph, symbol table, query index, and evidence rendering as separate phases/modules.
- Make phase outputs typed and explicit; avoid hidden cross-phase reads.
- Store source-index metadata separately from canonical `.context`, likely under `.context/generated/source-index/`.
- Track source freshness with file hashes and git commit, not only timestamps.
- Treat index state as rebuildable generated data.
- Use a schema version so incompatible source-index changes force rebuild.
- Write source evidence as structured JSON plus human-readable Markdown where useful, mirroring CMAP's candidate-store pattern.
- Integrate source evidence into Review HTML as read-only optional support panels.
- Add source-aware brief/pack as task-local output, clearly marked generated and freshness-scoped.
- Keep hooks as assistive context injection and stale reminders only.

CMAP-native command candidates:

- `cmap source index`
- `cmap source status`
- `cmap source architecture`
- `cmap symbol find <query>`
- `cmap symbol explain <symbol>`
- `cmap symbol callers <symbol>`
- `cmap symbol callees <symbol>`
- `cmap impact file <path>`
- `cmap impact symbol <symbol>`
- `cmap impact diff --scope staged|unstaged|compare`
- `cmap brief "<task>" --with-source-evidence`
- `cmap view export --include-source-evidence`
- `cmap benchmark source-intelligence`

Safe CMAP reinterpretation:

- GitNexus `context` becomes CMAP `symbol explain`: definition, file/line, imports, exported name, callers/callees when known, owning `.context` module candidate, freshness, confidence, and unresolved notes.
- GitNexus `impact` becomes CMAP impact evidence: dependency traversal from file/symbol, affected files, likely tests, mapped CMAP modules, and candidate relation suggestions.
- GitNexus `detect_changes` becomes CMAP diff evidence: changed source spans mapped to symbols and modules, then used by `finish`, `brief`, and Review HTML.
- GitNexus skills become CMAP skill guidance: "ask source index before broad grep/read loops", while preserving "reviewed `.context` wins over generated evidence".

## Parts CMAP Should Not Absorb

Do not absorb:

- Any GitNexus source code, skill text, hook code, command implementation, UI implementation, test fixtures, schema constants, or DB query text.
- Its PolyForm-licensed implementation details around LadybugDB, tree-sitter pipeline internals, embeddings, worker-pool parse cache, web client components, or MCP tool definitions.
- The full multi-language scope-resolution machinery as a near-term goal.
- The full Process/Community graph product as CMAP MVP.
- Auto-generated `AGENTS.md` / `CLAUDE.md` sections that tell agents they must always run graph impact before every symbol edit. CMAP should provide source intelligence as an assistive step, not an unconditional blocker.
- Browser-side apply/promote behavior. CMAP Review HTML should remain read-only.
- Destructive graph-assisted rewrite tools such as rename in the first source-intelligence phase.
- Auto wiki generation or LLM documentation generation as part of the source-index MVP.
- A global registry as the default MVP storage model. CMAP should start repo-local and add cross-repo later if proven necessary.
- Presentation-level i18n/locale structures from GitNexus. CMAP's current roadmap keeps Review HTML English by default and avoids a second fact store.

## TypeScript Rewrite Direction For CMAP

Recommended CMAP TypeScript rewrite direction:

1. Define a minimal generated source-index schema.
   - `source-index.meta.json`: schema version, generatedAt, git commit, dirty status, file hashes, counts.
   - `files.json`: file path, language, hash, size, owning CMAP module candidates.
   - `imports.json`: file-to-file import edges for TS/JS first.
   - `symbols.json`: exported/local symbols with kind, file, line range, export status.
   - `refs.json`: lightweight references/call-ish edges when reliable.
   - `evidence/*.jsonl`: task/query outputs that can feed inbox/review.

2. Build a small phase DAG.
   - `scan`: respect ignore rules and collect TS/JS files.
   - `parseTs`: use TypeScript compiler API or a maintained parser, not ad hoc regex.
   - `imports`: resolve relative TS/JS imports and package boundaries.
   - `symbols`: collect definitions and exports.
   - `refs`: start conservative; only emit high-confidence references.
   - `freshness`: compare file hashes and commit metadata.
   - `emitEvidence`: write generated evidence without touching canonical `.context`.

3. Query layer.
   - File impact from reverse import graph is P0.
   - Symbol explain/find is P0/P1 depending on parser effort.
   - Callers/callees should start conservative and expose "unknown/unresolved" honestly.
   - Diff impact can map changed files first, then changed line ranges when symbol ranges are stable.

4. CMAP integration.
   - `route` may display source evidence availability, but must not use source-index results as direct module routing truth.
   - `brief` and `pack` can include bounded source evidence under a generated/non-canonical label.
   - `view` can show optional source evidence panels with freshness warnings.
   - `finish` can recommend rerunning source index when source files changed.
   - `verify --freshness` can check source-index staleness separately from canonical `.context` freshness.
   - `inbox` can accept relation/module candidate suggestions derived from source evidence, requiring human promotion.

5. Verification.
   - Golden fixtures for TS import graphs and symbol extraction.
   - Drift tests for stale source index metadata.
   - CLI tests for ambiguity, not-found, stale, and summary-only outputs.
   - Review HTML tests proving source evidence is optional, read-only, escaped, and labeled non-canonical.
   - Benchmark comparing broad grep/read loops against source-aware brief on fixed tasks.

## CMAP Modules Affected

Primary affected modules:

- `cli`: new command families for `source`, `symbol`, and `impact`; stable exit codes and JSON/Markdown output contracts.
- `evidence`: store generated source evidence and freshness metadata under generated support layers.
- `view`: optional read-only source evidence panels and freshness warnings.
- `brief`: optional `--with-source-evidence` task-local evidence pack.
- `pack`: bounded source evidence inclusion with redaction and freshness labels.
- `hooks-doctor`: assist-mode guidance to query source index before broad source reading; stale-index reminder hooks only.
- `route`: possible warnings or availability hints, but no direct scoring from source-index evidence.
- `graph`: keep canonical `.context` graph separate from source-derived graph; source graph must not become reviewed module relations automatically.
- `relation-candidates`: source-derived relation suggestions can enter candidate-only workflow.
- `verify`: source-index freshness and generated evidence checks.
- `tests`: new integration fixtures for source commands, source-aware brief/view, and stale detection.
- `showcase`: planning/research artifacts and product explanation pages may need an updated source-intelligence narrative.

Secondary or later modules:

- `benchmark`: source-token A/B benchmark.
- `skill`: update project-local instructions after command contracts stabilize.
- `adoption`: optional future use of source index for existing-project candidate scanning.

## Risks And Verification

Risks:

- License contamination: avoid copying code, command text, schema constants, templates, or UI implementation from GitNexus.
- Scope creep: full multi-language graph, embeddings, communities, process traces, web daemon, and cross-repo registry are too large for CMAP's first source-intelligence phase.
- Trust-boundary drift: generated source facts may look authoritative; every output must label freshness, confidence, and non-canonical status.
- False confidence in symbol callers/callees: TS/JS dynamic imports, re-exports, aliases, decorators, framework routing, and generated code can make static answers incomplete.
- Output explosion: hub files/symbols need summary-only and pagination-style controls.
- Staleness: source-index results must be tied to git commit/file hashes and warn loudly when stale.
- Review HTML safety: source evidence must be escaped/redacted and read-only.
- Route contamination: source-derived module candidates must not affect `route.modules` or benchmark scoring until promoted into reviewed `.context`.

Verification path for this planning note:

- Confirm only this note is written in the current task.
- Run `git diff -- docs/planning/source-intelligence-upgrade-2026-06/agent-notes/gitnexus-design-only.md`.
- Run `git status --short` and ensure no other file was changed by this agent.

Verification path for future implementation:

- Unit tests for parser/source-index schema and freshness hash diff.
- Integration tests for `cmap source index/status`, `cmap symbol explain`, `cmap impact file`, and `cmap impact diff`.
- `cmap verify --changed` plus targeted tests for affected modules.
- Review HTML export/check tests proving source evidence panels are read-only and non-canonical.
- Fixture-based benchmark tracking files read, tool calls, context bytes, and answer correctness with and without source evidence.
