# Understand Anything Source Adapter Agent Note
## Research Scope

Local snapshot inspected only:

- `research/coding-knowledge-graphs-2026-06/repos/understand-anything`
- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`

This note treats Understand Anything as an implementation reference for CMAP's Source Intelligence Upgrade. It summarizes mechanisms and cites local paths, functions, classes, and prompt surfaces. It does not copy source code or propose importing Understand Anything as a dependency.

CMAP boundary from the planning docs: source intelligence should become generated evidence, candidate input, and review support. It must not become canonical `.context` truth without human review.

## Source Files Inspected

Planning and CMAP context:

- `docs/planning/source-intelligence-upgrade-2026-06/README.md`
- `docs/planning/source-intelligence-upgrade-2026-06/capability-gap-list.md`
- `.context/MAP.md`
- `.context/CHECKPOINT.md`
- `.context/STATUS.md`
- `.context/VERIFY.md`
- `.context/modules/graph.md`
- `.context/modules/hooks-doctor.md`
- `.context/modules/obsidian-adapter.md`
- `.context/modules/evidence.md`
- `.context/modules/route.md`
- `.context/modules/context.md`

Understand Anything project docs, manifests, and command surface:

- `README.md`
- `package.json`
- `understand-anything-plugin/package.json`
- `understand-anything-plugin/skills/understand/SKILL.md`
- `understand-anything-plugin/skills/understand-dashboard/SKILL.md`
- `understand-anything-plugin/skills/understand-chat/SKILL.md`
- `understand-anything-plugin/skills/understand-diff/SKILL.md`
- `understand-anything-plugin/skills/understand-explain/SKILL.md`
- `understand-anything-plugin/skills/understand-onboard/SKILL.md`
- `understand-anything-plugin/skills/understand-domain/SKILL.md`
- `understand-anything-plugin/skills/understand-knowledge/SKILL.md`
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.cursor-plugin/plugin.json`
- `.copilot-plugin/plugin.json`
- `understand-anything-plugin/.claude-plugin/plugin.json`

Understand Anything project scanner, analyzers, and graph assembly:

- `understand-anything-plugin/agents/project-scanner.md`
- `understand-anything-plugin/agents/file-analyzer.md`
- `understand-anything-plugin/agents/architecture-analyzer.md`
- `understand-anything-plugin/agents/tour-builder.md`
- `understand-anything-plugin/agents/assemble-reviewer.md`
- `understand-anything-plugin/agents/graph-reviewer.md`
- `understand-anything-plugin/agents/domain-analyzer.md`
- `understand-anything-plugin/agents/article-analyzer.md`
- `understand-anything-plugin/agents/knowledge-graph-guide.md`
- `understand-anything-plugin/skills/understand/scan-project.mjs`
- `understand-anything-plugin/skills/understand/extract-import-map.mjs`
- `understand-anything-plugin/skills/understand/extract-structure.mjs`
- `understand-anything-plugin/skills/understand/compute-batches.mjs`
- `understand-anything-plugin/skills/understand/build-fingerprints.mjs`
- `understand-anything-plugin/skills/understand/merge-batch-graphs.py`

Core schema, parsing, freshness, and persistence:

- `packages/core/src/types.ts`
- `packages/core/src/schema.ts`
- `packages/core/src/fingerprint.ts`
- `packages/core/src/change-classifier.ts`
- `packages/core/src/staleness.ts`
- `packages/core/src/persistence/index.ts`
- `packages/core/src/search.ts`
- `packages/core/src/embedding-search.ts`
- `packages/core/src/analyzer/graph-builder.ts`
- `packages/core/src/analyzer/normalize-graph.ts`
- `packages/core/src/plugins/registry.ts`
- `packages/core/src/plugins/tree-sitter-plugin.ts`
- `packages/core/src/plugins/discovery.ts`
- `packages/core/src/languages/configs/index.ts`
- `packages/core/src/plugins/extractors/typescript-extractor.ts`
- `packages/core/src/ignore-filter.ts`

Builders, hooks, dashboard, and synthetic test graph:

- `understand-anything-plugin/src/index.ts`
- `understand-anything-plugin/src/context-builder.ts`
- `understand-anything-plugin/src/understand-chat.ts`
- `understand-anything-plugin/src/explain-builder.ts`
- `understand-anything-plugin/src/diff-analyzer.ts`
- `understand-anything-plugin/src/onboard-builder.ts`
- `understand-anything-plugin/hooks/hooks.json`
- `understand-anything-plugin/hooks/auto-update-prompt.md`
- `packages/dashboard/src/App.tsx`
- `packages/dashboard/src/store.ts`
- `packages/dashboard/src/components/GraphView.tsx`
- `packages/dashboard/src/components/ProjectOverview.tsx`
- `packages/dashboard/src/components/SearchBar.tsx`
- `packages/dashboard/src/components/NodeInfo.tsx`
- `packages/dashboard/src/components/DiffToggle.tsx`
- `packages/dashboard/src/components/LearnPanel.tsx`
- `packages/dashboard/src/components/OnboardingOverlay.tsx`
- `packages/dashboard/src/components/CodeViewer.tsx`
- `scripts/generate-large-graph.mjs`

## Core Mechanisms

1. The main `/understand` flow is a prompt-orchestrated pipeline, not a conventional CLI-only indexer.

   `understand-anything-plugin/skills/understand/SKILL.md` defines the command behavior: preflight, optional ignore setup, scan, batch planning, file-agent analysis, graph assembly, architecture layering, tour generation, validation, persistence, fingerprinting, and dashboard launch. It stores project state under `.understand-anything/`, mainly `knowledge-graph.json`, `meta.json`, `config.json`, `fingerprints.json`, and selected `intermediate/` artifacts.

2. Project scanning separates deterministic file facts from LLM synthesis.

   `agents/project-scanner.md` tells the agent to rely on deterministic scripts for file enumeration, language/category detection, line counts, and imports. `skills/understand/scan-project.mjs` implements `enumerateViaGit`, `enumerateViaWalk`, `detectLanguage`, `detectCategory`, `estimateComplexity`, `buildDefaultsOnlyFilter`, `hasUserIgnoreFile`, and `countLines`. The scanner prefers `git ls-files -z -co --exclude-standard`, falls back to recursive walking, applies Understand Anything ignore rules, and outputs `scan-result.json`.

3. Import mapping is resolver-heavy and language-aware.

   `skills/understand/extract-import-map.mjs` uses `PluginRegistry` and `TreeSitterPlugin` to extract imports, then resolves project-local imports through functions such as `resolveTsJsImport`, `resolvePythonImport`, `resolveGoImport`, `resolveJavaImport`, `resolveKotlinImport`, `resolveCSharpImport`, `resolveRubyImport`, `resolvePhpImport`, `resolveRustImport`, and `resolveCppImport`. The TS/JS resolver handles nearest `tsconfig` path aliases and common extension/index variants. The result is an `importMap` from file path to resolved project files.

4. Batching is graph-aware before LLM analysis starts.

   `skills/understand/compute-batches.mjs` builds code batches from the import graph with `runLouvain`, `buildBatchOfMap`, `countBasedAssignment`, and `mergeSmallBatches`. It groups non-code files through `buildNonCodeBatches`, including workflows, Docker files, SQL migrations, parent directories, and other semantic clusters. It also writes `batchImportData` and `neighborMap`, so a batch analyzer sees local files plus cross-batch neighbors and exported symbols.

5. File analysis combines deterministic structure extraction with LLM graph summarization.

   `agents/file-analyzer.md` requires the agent to run `skills/understand/extract-structure.mjs` for the batch before writing nodes and edges. `extract-structure.mjs` delegates to `TreeSitterPlugin` through `PluginRegistry`, producing functions, classes, imports, exports, calls, sections, services, endpoints, steps, resources, and metrics. The LLM then creates graph nodes and edges, with strict batch output naming and significance filters for functions/classes. This gives rich summaries, but it also means semantic quality depends on prompt compliance.

6. The graph JSON is broad and presentation-ready.

   `packages/core/src/types.ts` defines `KnowledgeGraph` with `nodes`, `edges`, `layers`, and optional `tour`. Node types include code, config, document, service, table, endpoint, pipeline, schema, resource, domain, flow, step, article, entity, topic, claim, and source. Edge types cover structural, behavioral, data, dependency, semantic, infrastructure, schema, domain, and knowledge relationships. This breadth is useful for a dashboard, but it is wider than CMAP's source-intelligence P0.

7. Schema validation is corrective as well as checking.

   `packages/core/src/schema.ts` exposes `sanitizeGraph`, `autoFixGraph`, `normalizeGraph`, and `validateGraph`. It normalizes aliases for node type, edge type, complexity, and direction, can drop invalid references, and reports structured `GraphIssue` entries. `packages/core/src/analyzer/normalize-graph.ts` adds batch-output normalization with `normalizeNodeId`, `normalizeComplexity`, and `normalizeBatchOutput`.

8. Batch assembly repairs common LLM graph output errors.

   `skills/understand/merge-batch-graphs.py` loads `batch-*.json`, normalizes node ids and complexity, rewrites edge references, deduplicates nodes and edges, drops dangling edges, recovers missing import edges from the scan import map, and adds deterministic `tested_by` links through `link_tests`. It writes an assembled graph and a stderr report of fixed and unfixable issues. CMAP should absorb the idea of post-agent normalization, not the Python implementation.

9. Architecture layers and tour steps are computed from existing graph evidence.

   `agents/architecture-analyzer.md` asks for a script-generated evidence base: directory groups, node type groups, fan-in/fan-out, cross-category edges, import direction, pattern matches, deployment topology, data pipeline, docs coverage, and dependency direction. It then assigns 3-10 layers. `agents/tour-builder.md` similarly asks for computed entrypoints, fan-in/out, BFS paths, non-code inventory, clusters, and layer coverage before writing tour steps. The UX is good, but the source-derived architecture should remain candidate evidence in CMAP.

10. Freshness is based on structural fingerprints and git metadata.

   `packages/core/src/fingerprint.ts` provides `contentHash`, `extractFileFingerprint`, `compareFingerprints`, `buildFingerprintStore`, and `analyzeChanges`. It compares functions, classes, imports, and exports to classify changes as `NONE`, `COSMETIC`, or `STRUCTURAL`. `packages/core/src/change-classifier.ts` maps changed files and structural counts to `SKIP`, `PARTIAL_UPDATE`, `ARCHITECTURE_UPDATE`, or `FULL_UPDATE`. `packages/core/src/staleness.ts` supplies `getChangedFiles`, `isStale`, and `mergeGraphUpdate`.

11. Hooks try to keep the graph fresh automatically.

   `understand-anything-plugin/hooks/hooks.json` defines Claude hook behavior for `PostToolUse` and `SessionStart`. When commits, merges, rebases, cherry-picks, or stale sessions are detected, the hook prints instructions from `hooks/auto-update-prompt.md`. That prompt performs a zero-token gate, filters source changes, compares fingerprints, dispatches targeted file analysis, conditionally reruns architecture/tour work, and merges graph updates. This is a strong freshness design, but CMAP should adapt it into explicit source status/evidence warnings, not auto-mutating canonical memory.

12. Chat, explain, diff, and onboarding are graph-derived context builders.

   `understand-anything-plugin/src/context-builder.ts` has `buildChatContext` and `formatContextForPrompt`, using `SearchEngine` to find relevant nodes, expand one-hop edges, and include related layers. `src/understand-chat.ts` wraps that as `buildChatPrompt`. `src/explain-builder.ts` implements `buildExplainContext` and `formatExplainPrompt` around a target file or `path:function`. `src/diff-analyzer.ts` implements `buildDiffContext` and `formatDiffAnalysis`, mapping changed files to nodes, affected one-hop nodes, impacted layers, unmapped files, and risk signals. `src/onboard-builder.ts` renders graph overview, layers, concepts, tour, file map, and complexity hotspots through `buildOnboardingGuide`.

13. Search is useful but not foundational for CMAP P0.

   `packages/core/src/search.ts` implements `SearchEngine` with Fuse over name, tags, summary, and language notes. `packages/core/src/embedding-search.ts` adds `SemanticSearchEngine` over precomputed embeddings and cosine similarity. CMAP should start with deterministic symbol/file queries and add fuzzy or semantic search only after source-index correctness is stable.

14. Dashboard state is rich and graph-first.

   `packages/dashboard/src/App.tsx` loads graph, meta, config, diff overlay, and optional domain graph, validates with `validateGraph`, handles demo/token gates, and wires many panels. `packages/dashboard/src/store.ts` uses Zustand to maintain graph indexes, selected node, layer mapping, search mode, diff mode, focus mode, tour state, code viewer state, and view mode. `components/GraphView.tsx` uses ReactFlow and ELK layouts for layer overview, drilldown, containers, search highlighting, focus, diff, and tour overlays.

15. Plugin packaging is skill-centric.

   The Claude, Cursor, and Copilot plugin manifests point to skills, agents, hooks, and plugin metadata. The command surface is mostly slash-command skill behavior, not a standalone TypeScript CLI. CMAP can learn from the agent-facing command shape while keeping CMAP commands in its own CLI.

## Onboarding And Review UX Lessons

Understand Anything's strongest UX lesson is progressive disclosure:

- Start with a project overview, language/framework summary, node type distribution, and complexity hotspots.
- Let the user move from layers to nodes to source file context, instead of dropping them into a raw graph.
- Provide search first, then graph navigation, not the other way around.
- Keep a guided tour as an optional path through the graph, especially for onboarding.
- Show diff impact as a first-class overlay: changed components, affected components, affected layers, unmapped files, and risk.
- Include warnings when graph validation, missing nodes, stale metadata, or unmapped files reduce confidence.

For CMAP Review HTML, the right adaptation is a read-only support layer, not a second dashboard product. Useful panels:

- Source index freshness: current commit, indexed commit, stale files, changed files, and last index time.
- Source evidence for a module: files, symbols, imports, dependents, callers/callees, and tests found by generated analysis.
- Impact preview: changed file or symbol, reverse dependents, nearby callers/callees, affected modules, and confidence.
- Candidate architecture hints: source-derived modules, clusters, or ownership mismatches, clearly labeled as candidates.
- Diff/evidence overlay for Review HTML exports, while keeping reviewed `.context` facts visually primary.

The tour and onboarding ideas should be derived from reviewed CMAP map content plus generated source evidence. They should not create a second maintained fact store or auto-promote source-derived layers.

## Capabilities CMAP Should Absorb

- A generated source-index layer below the trust boundary:

  ```text
  repository source
    -> source scan / symbol index / import graph / impact traversal
    -> generated source evidence
    -> CMAP inbox or Review HTML support panel
    -> human-reviewed .context memory only after promotion
  ```

- Git-aware file enumeration with project ignore rules, modeled after `scan-project.mjs`, but rewritten for CMAP's path policy and safe generated-state locations.
- Deterministic TS/JS import and dependency graph as P0, inspired by `extract-import-map.mjs` and `TypeScriptExtractor`, with special attention to path aliases, re-exports, default exports, dynamic imports, and test files.
- A structural source fingerprint store, inspired by `fingerprint.ts`, to distinguish no-op, cosmetic, and structural changes.
- Explicit source freshness commands and status output, inspired by `staleness.ts`, `change-classifier.ts`, and the hook prompt, but without automatic canonical writes.
- Post-analysis normalization and validation for generated evidence, inspired by `schema.ts`, `normalize-graph.ts`, and `merge-batch-graphs.py`.
- File and symbol impact traversal, inspired by `diff-analyzer.ts`, with bounded reverse dependents, callers, callees, imports, and tests.
- Source-aware `brief` and `pack` support: include a bounded source evidence section when requested, with stale warnings and exact path/line anchors.
- Review HTML support panels for source evidence, candidate relations, impact previews, and freshness metadata.
- Candidate architecture hints from source clusters, but only as inbox candidates or review material.
- Benchmark cases for source intelligence: fewer broad file reads, lower token usage, better affected-file recall, and better explanation accuracy.

## Parts CMAP Should Not Absorb

- Do not absorb Understand Anything's `knowledge-graph.json` as a canonical fact model. CMAP already has reviewed `.context` memory, and source evidence must stay below it.
- Do not make LLM batch agents the source of canonical architecture truth. `file-analyzer.md`, `architecture-analyzer.md`, and `tour-builder.md` are useful as UX references, but CMAP's source-index P0 should be deterministic.
- Do not auto-update project memory from hooks. The UA `PostToolUse` and `SessionStart` flow is useful for freshness reminders, but CMAP should avoid hidden background mutation and should never auto-promote generated source facts.
- Do not reproduce the full multi-language matrix. CMAP should start with TypeScript/JavaScript and expand only after the schema, freshness model, and trust boundary prove stable.
- Do not recreate the ReactFlow dashboard as the first deliverable. CMAP Review HTML should remain a review surface over existing map content plus support evidence.
- Do not revive i18n, locale mirroring, route v2, import graph as canonical route facts, pack v2, or translation workflows under this upgrade.
- Do not adopt broad node types such as article, claim, source, domain, flow, and step into CMAP's source MVP. They are useful for UA's product scope but too broad for CMAP's source-intelligence gap list.
- Do not treat semantic search or embeddings as foundational. They can hide stale or imprecise source facts behind fluent retrieval.
- Do not copy installer, symlink, or cleanup behavior from plugin scripts. Some UA prompts and install paths include destructive cleanup patterns that conflict with this workspace's deletion safety rules.
- Do not let generated architecture layers alter `route` results until humans review and promote the relevant CMAP facts.

## TypeScript Rewrite Direction For CMAP

Start with a narrow CMAP-native TypeScript source-intelligence layer.

Recommended generated state:

- `.context/generated/source/index.json`
- `.context/generated/source/freshness.json`
- `.context/generated/source/impact/*.json`
- `.context/generated/source/evidence/*.md`
- `.context/inbox/` or the existing candidate surface for optional source-derived review candidates

Recommended internal modules:

- `src/source/schema.ts`: define `SourceIndex`, `SourceFile`, `SourceSymbol`, `SourceEdge`, `SourceUnresolvedRef`, `SourceFingerprint`, `SourceEvidencePack`, and `SourceIndexMeta`.
- `src/source/scan.ts`: enumerate git-visible and untracked project files, apply CMAP ignore policy, classify language/category, and avoid absolute path leakage.
- `src/source/ts-indexer.ts`: parse `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs` with a TS-native parser. Extract file nodes, declarations, imports, exports, re-exports, classes, methods, functions, constants, call expressions, and test markers.
- `src/source/resolve.ts`: resolve imports, path aliases, re-exports, file dependents, and direct symbol references. Keep unresolved references queryable with reason codes.
- `src/source/fingerprint.ts`: compute content and structural fingerprints, then report fresh, stale, cosmetic, structural, added, deleted, and renamed files.
- `src/source/impact.ts`: implement file impact, symbol callers, symbol callees, reverse dependents, and test suggestions over bounded directed traversal.
- `src/source/evidence.ts`: format source evidence packs for `brief`, Review HTML, and candidate inbox without modifying canonical map files.
- `src/source/validate.ts`: validate generated source state, path safety, dangling edges, stale metadata, duplicate symbols, and invalid confidence values.

Recommended command family, aligned with the planning gap list:

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

Implementation policy:

- Store source-derived outputs only under generated state, review output, or candidate inbox.
- Use directed edge kinds with confidence and provenance fields. Example categories: `contains`, `imports`, `exports`, `re_exports`, `calls`, `inherits`, `implements`, `tests`, `configures`, and `documents`.
- Treat direct parser evidence as high confidence; treat name-only or unique-label fallback as low confidence or disabled by default.
- Always include freshness metadata in query output.
- If a source query touches stale files, tell the agent to read the source files directly before making claims.
- Feed candidate relations to human review; never let source edges directly change `.context/MAP.md`, `.context/modules/*.md`, route facts, or decisions.
- Prefer a TS compiler API or ts-morph based implementation for the MVP. Tree-sitter breadth can be revisited later if CMAP expands beyond TypeScript/JavaScript.

## CMAP Modules Affected

- `graph`: generated source edges can inform review, but reviewed graph output must still come from promoted `.context` map facts.
- `evidence`: should own source evidence packs, source freshness snapshots, and source-derived candidate reports as generated support material.
- `route`: can suggest source evidence as supporting context, but must not route from unpromoted source candidates.
- `context`: may need templates or policy text for source-generated candidate sections and stable Review HTML labels.
- `hooks-doctor`: can surface source-index freshness warnings or assist-mode reminders, but should not write source-derived canonical facts.
- `obsidian-adapter`: should keep generated source evidence and pull candidates separate from canonical `.context` export/import behavior.
- `view`: should render source evidence panels, freshness warnings, and impact previews as read-only support layers.
- `brief` and `pack`: should optionally include bounded source evidence under `--with-source-evidence`.
- `verify`: should validate generated source-state shape and trust-boundary safety once the feature exists.
- `benchmark`: should measure source-intelligence usefulness against current route/brief workflows.
- `showcase`: should explain the upgrade as advisory source intelligence below the Trust Boundary + Human Review Layer.
- Future new module candidate: `source-index`, owning scan, index, freshness, symbol query, impact traversal, and generated source evidence formatting.

## Risks And Verification

Risks:

- Generated source facts may be mistaken for reviewed CMAP facts.
- LLM-authored graph summaries can sound more certain than parser evidence supports.
- Static TS/JS extraction can miss dynamic imports, runtime dependency injection, framework routes, CommonJS interop, generated code, and alias-heavy call sites.
- Import and re-export resolution can create false callers/callees if path aliases, barrel files, or package exports are mishandled.
- Stale source indexes can produce precise but wrong impact reports.
- Review HTML can become noisy if it tries to become a full graph dashboard.
- Source evidence packs can leak absolute paths, secrets, large snippets, or generated/vendor code.
- Background hooks can surprise users if they mutate files after commits or sessions start.
- Scope can drift into a full multi-language Understand Anything clone instead of a CMAP-native TS source MVP.

Verification for the CMAP implementation:

- Unit tests for TS/JS file scanning, ignore rules, path normalization, and no absolute path leakage.
- Unit tests for imports, default imports, namespace imports, path aliases, re-exports, star exports, dynamic imports, CommonJS `require`, classes, methods, functions, exported constants, calls, duplicate names, and unresolved refs.
- Unit tests for structural fingerprint classification: unchanged, cosmetic, structural, added, deleted, and renamed files.
- Query tests for `symbol find`, callers, callees, file dependents, symbol impact, and file impact.
- Safety tests proving source commands write only generated state, review output, or candidate inbox entries, never canonical `.context` files.
- Freshness tests for changed git HEAD, changed working-tree files, stale generated index, deleted files, and generated file down-ranking.
- Review HTML export checks for source evidence panels, stale warnings, diff/impact preview, and candidate-only labeling.
- Benchmark tests comparing current route/brief behavior against source-aware route/brief on representative CMAP coding tasks.
- Closeout checks for implementation work should include `cmap finish`, `cmap verify --changed`, and `git diff --check`.

Verification for this research note:

- Confirm only `docs/planning/source-intelligence-upgrade-2026-06/agent-notes/understand-anything-source-adapter.md` was added by this task.
- Run `cmap finish`.
- Run `cmap verify --changed`.
- Run `git diff --check`.
