---
cmap_version: 0.1
context_type: map
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-13T21:30:29+08:00
confidence: ai-drafted
---
# Project Map

## Purpose
实现 cmap v0.2 Trust Boundary + Human Review Layer：一个 host-neutral、repo-local、人和 AI 都能读的项目地图 CLI。它负责维护 `.context/` 的确定性结构、候选治理、安全边界和 HTML 审阅入口，帮助 AI coding 项目在上下文压缩、新会话和模块增长后仍可续接。

## Tech Stack & Runtime
- Runtime: Node.js >= 20
- Language: TypeScript ESM
- Package manager: pnpm
- CLI framework: commander
- Markdown/frontmatter: gray-matter
- Tests: Vitest
- Bundling: tsup

## Entry Points
- CLI source: `src/cli.ts`
- Built bin: `dist/cli.js`
- Package bin: `cmap`
- Tests: `tests/integration/*.test.ts`
- Product spec: `cmap_v0.1_PRD_and_execution_manual.md`
- User-facing README: `README.md`
- Interactive product overview: `docs/cmap-product-overview.html`
- Built CLI smoke test: `scripts/smoke-test.mjs`

## Module Map
| Module | Purpose | Paths | Doc | Aliases |
|---|---|---|---|---|
| cli | command registration, option parsing, exit-code boundary | `src/cli.ts`, `src/commands` | `.context/modules/cli.md` | cli, command, 命令, version, init, install |
| context | `.context` templates, deterministic policy v2 loading, and project signal scanning | `src/context` | `.context/modules/context.md` | context, template, skeleton, .context, policy, 模板, 骨架 |
| i18n | localized reading-layer scaffold and project locale config without changing canonical facts | `src/i18n`, `src/commands/i18n.ts`, `src/commands/config.ts` | `.context/modules/i18n.md` | i18n, config, locale, zh-CN, 中文地图, 本地化 |
| verify | deterministic L0 structure checks, freshness/stale checks, and CI report formatting | `src/commands/verify.ts` | `.context/modules/verify.md` | verify, check, drift, 校验, 检查, placeholder |
| host | AGENTS/CLAUDE short entrypoint generation | `src/host`, `src/commands/install.ts` | `.context/modules/host.md` | install, AGENTS, CLAUDE, host, 入口 |
| route | direct module routing, generated route usage stats, and bounded reviewed-relation context pack | `src/commands/route.ts` | `.context/modules/route.md` | route, aliases, routing, 路由, 模块定位 |
| graph | canonical module relation projection and typed relation explanation | `src/commands/graph.ts`, `src/core/context-graph.ts` | `.context/modules/graph.md` | graph, context graph, graph build, graph explain, 关系图, 图谱 |
| brief | AI coding startup brief from route/checkpoint/bounded context pack/module docs | `src/commands/brief.ts` | `.context/modules/brief.md` | brief, AI brief, 开工包, AI 开工包 |
| pack | budgeted redacted context pack from routed graph neighborhood | `src/commands/pack.ts` | `.context/modules/pack.md` | pack, context pack, token budget, 上下文包, 阅读包 |
| benchmark | route benchmark over direct/context-pack JSONL fixtures with optional CI thresholds | `src/commands/benchmark.ts`, `bench` | `.context/modules/benchmark.md` | benchmark, bench, 评测, 命中率, top-k |
| handoff | current status printing and explicit checkpoint handoff updates | `src/commands/status.ts`, `src/commands/checkpoint.ts` | `.context/modules/handoff.md` | status, checkpoint, handoff, 续接, 主线, 上下文 |
| cp | safe line-block copy/move/delete/restore with backups | `src/commands/cp.ts`, `src/fs` | `.context/modules/cp.md` | cp, copy, move, delete, restore, line block, 行块, 搬运, 备份 |
| finish | QA-lite context closeout report | `src/commands/finish.ts` | `.context/modules/finish.md` | finish, closeout, report, 收尾, 上下文收尾 |
| update-agent | MapPatch v1/v2 intake, routine/generated apply policy, backup/audit, and candidate inbox routing | `src/commands/update.ts`, `src/core/map-patch.ts`, `src/fs/backup.ts` | `.context/modules/update-agent.md` | update, MapPatch, agent update, 自主维护, 自动维护, inbox, rollback |
| evidence | generated evidence/stats store, freshness index, inbox triage/archive/promote apply, and stale maintenance checks | `src/commands/evidence.ts`, `src/commands/inbox.ts`, `src/commands/freshness.ts`, `src/core/generated-stats.ts`, `src/core/generated-store.ts`, `src/core/freshness.ts` | `.context/modules/evidence.md` | evidence, generated evidence, inbox status, stats, stale, 证据, 候选池 |
| view | read-only HTML human review dashboard for canonical map plus generated/candidate support layers | `src/view`, `src/commands/view.ts` | `.context/modules/view.md` | view, dashboard, HTML review, human review |
| relation-candidates | AI RelationPatch intake, validation, inbox writing, and candidate-only promote dry-run | `src/commands/relate.ts`, `src/core/relation-patch.ts`, `src/context/relation-schema.ts` | `.context/modules/relation-candidates.md` | relate, relation candidate, RelationPatch, 关系候选 |
| obsidian-adapter | Obsidian-friendly markdown export, open/pull, and view drift check | `src/commands/obsidian.ts`, `_cmap` | `.context/modules/obsidian-adapter.md` | obsidian, graph, 图谱, 关系图谱, 可视化, export |
| reconcile-adapter | dry-run candidate facts from external workflow artifacts | `src/commands/reconcile.ts` | `.context/modules/reconcile-adapter.md` | reconcile, adapter, GSD adapter, gsd-v1, gsd-v2, 候选事实 |
| showcase | interactive product overview and external-review handoff artifact | `docs/cmap-product-overview.html` | `.context/modules/showcase.md` | showcase, product overview, HTML, 介绍页, 产品介绍, 思维导图 |
| memory-lite | explicit work log and idea append commands | `src/commands/log.ts`, `src/commands/idea.ts` | `.context/modules/memory-lite.md` | log, idea, 工作日志, 灵感, inbox |
| adoption | existing-project adoption workspace and candidate scanning | `src/commands/adopt.ts`, `src/context/adoption-scanner.ts` | `.context/modules/adoption.md` | adopt, adoption, existing project, 接管, 候选模块 |
| module-docs | candidate module document creation | `src/commands/add-module.ts` | `.context/modules/module-docs.md` | add-module, module doc, module template, 模块文档 |
| hooks-doctor | hook templates, Codex-first lifecycle render/ingest, lifecycle tests, session brief generation, hook reminder/observe/assist/strict output, and diagnostics | `src/commands/hooks.ts`, `src/hooks`, `src/commands/doctor.ts`, `src/commands/install.ts` | `.context/modules/hooks-doctor.md` | hooks, doctor, reminder, maintain, observe, assist, strict, 诊断 |
| tests | integration and built-CLI smoke coverage for CLI milestones | `tests`, `scripts/smoke-test.mjs` | `.context/modules/tests.md` | test, vitest, smoke, 自测, 集成测试, 行为测试 |

## Natural Language Route
| User Words | Module | Read First |
|---|---|---|
| 初始化、骨架、模板、.context、policy、init | context | `.context/MAP.md`, `.context/modules/context.md`, `src/context/templates.ts`, `src/context/policy.ts` |
| 中文地图、本地化、locale、i18n、config、翻译镜像 | i18n | `.context/modules/i18n.md`, `src/commands/i18n.ts`, `src/i18n` |
| 命令、参数、退出码、version、install | cli | `.context/modules/cli.md`, `src/cli.ts` |
| 校验、漂移、TODO、missing file、verify | verify | `.context/modules/verify.md`, `src/commands/verify.ts` |
| AGENTS、CLAUDE、宿主入口、host | host | `.context/modules/host.md`, `src/host/entrypoint-template.ts` |
| route、alias、模块定位、推荐读取文件 | route | `.context/modules/route.md`, `src/commands/route.ts` |
| graph、context graph、graph build、graph explain、图谱、关系图 | graph | `.context/modules/graph.md`, `src/commands/graph.ts`, `src/core/context-graph.ts` |
| brief、AI brief、开工包、AI 开工包、启动包 | brief | `.context/modules/brief.md`, `src/commands/brief.ts`, `.context/CHECKPOINT.md`, `.context/STATUS.md` |
| pack、context pack、token budget、上下文包、阅读包、token 预算 | pack | `.context/modules/pack.md`, `src/commands/pack.ts`, `.context/CHECKPOINT.md`, `.context/VERIFY.md` |
| benchmark、bench、route benchmark、评测、命中率、top-k | benchmark | `.context/modules/benchmark.md`, `src/commands/benchmark.ts`, `bench/tasks.jsonl` |
| checkpoint、status、续接、上下文压缩、当前主线 | handoff | `.context/modules/handoff.md`, `src/commands/checkpoint.ts`, `src/commands/status.ts` |
| cp、copy、move、delete、restore、行块、搬运、备份 | cp | `.context/modules/cp.md`, `src/commands/cp.ts`, `src/fs/line-block.ts` |
| finish、收尾、closeout、context review | finish | `.context/modules/finish.md`, `src/commands/finish.ts` |
| update、MapPatch、agent update、自动维护、自主维护、rollback、inbox | update-agent | `.context/modules/update-agent.md`, `src/commands/update.ts`, `src/core/map-patch.ts` |
| evidence、generated evidence、stats、module activity、freshness、inbox status、inbox triage、promote、archive、stale、证据、候选池 | evidence | `.context/modules/evidence.md`, `src/commands/evidence.ts`, `src/commands/inbox.ts`, `src/commands/freshness.ts`, `src/core/generated-stats.ts`, `src/core/generated-store.ts`, `src/core/freshness.ts` |
| view、dashboard、HTML review、human review、审阅台、项目地图页面 | view | `.context/modules/view.md`, `src/commands/view.ts`, `src/view` |
| relate、RelationPatch、relation candidate、关系候选、关系补丁 | relation-candidates | `.context/modules/relation-candidates.md`, `src/commands/relate.ts`, `src/core/relation-patch.ts`, `src/context/relation-schema.ts` |
| obsidian、图谱、关系图谱、可视化、export、vault | obsidian-adapter | `.context/modules/obsidian-adapter.md`, `src/commands/obsidian.ts` |
| reconcile、GSD adapter、gsd-v1、gsd-v2、外部产物、候选事实 | reconcile-adapter | `.context/modules/reconcile-adapter.md`, `src/commands/reconcile.ts` |
| 产品介绍、展示页、HTML、思维导图、DeepSeek handoff | showcase | `.context/modules/showcase.md`, `docs/cmap-product-overview.html` |
| log、idea、工作日志、灵感、ideas inbox | memory-lite | `.context/modules/memory-lite.md`, `src/commands/log.ts`, `src/commands/idea.ts` |
| adopt、接管已有项目、候选模块、ADOPTION | adoption | `.context/modules/adoption.md`, `src/commands/adopt.ts` |
| add-module、新模块文档、module template | module-docs | `.context/modules/module-docs.md`, `src/commands/add-module.ts` |
| hooks、doctor、render、ingest、test、reminder、maintain、observe、assist、strict、诊断 | hooks-doctor | `.context/modules/hooks-doctor.md`, `src/commands/hooks.ts`, `src/hooks/templates.ts`, `src/hooks/events.ts`, `src/commands/doctor.ts` |
| 测试、红绿、M1 验收、fixture | tests | `.context/modules/tests.md`, `tests/integration/m1.test.ts` |

## Module Relationships
- `cli` dispatches to command modules and owns process exit behavior.
- `context` provides templates, deterministic policy v2 defaults/loading, and project signal scanning used by `init`.
- `i18n` mirrors reviewed `.context` files into `.context/i18n/<locale>/` scaffolds, writes translation rules, and stores default locale config without changing canonical facts.
- `verify` reads `.context` files created by `context`, validates deterministic structure, checks stale/freshness warnings, and can render stable CI Markdown reports.
- `host` generates entrypoint text used by `install`.
- `route` reads the shared module index, recommends direct modules, expands bounded reviewed-relation context, surfaces module-owned verification commands, and records generated route usage stats when policy allows; it must not propose nonexistent modules, treat related context as direct matches, or consume unpromoted relation candidates as route facts.
- `graph` writes generated graph projections and explains typed module relations derived from reviewed module docs. It is a canonical module-relation projection, not an import graph or test ownership graph.
- `brief` packages route result, bounded route context pack, `CHECKPOINT.md` or `STATUS.md`, selected module docs, verification reminders, and optional Obsidian links into a task-local AI brief.
- `pack` renders a redacted, budgeted task context pack from route's graph neighborhood, checkpoint/status, decisions, verify source, module docs, and inbox warnings.
- `benchmark` runs JSONL task fixtures through route scoring, reports top-k direct/context-pack hit rates, and can fail CI on explicit threshold regressions.
- `handoff` reads `STATUS.md`, writes task-local `CHECKPOINT.md`, and keeps the legacy explicit `STATUS.md` update path compatible.
- `cp` uses shared fs helpers to preserve line blocks and create backups for destructive line edits.
- `finish` reads changed file hints through the shared module index and produces a closeout report; with `--agent` it writes a MapPatch request artifact under `.context/out/` but does not apply it.
- `update-agent` parses AI-authored MapPatch v1/v2 JSON, classifies operations by policy, applies routine checkpoint and generated evidence/stats updates with backup/audit, routes semantic updates to `.context/inbox/`, rejects blocked operations, and supports rollback.
- `evidence` appends bounded generated support evidence under `.context/generated/`, records generated module activity and route usage stats, maintains freshness snapshots, prints inbox backlog status, groups candidates for triage, previews/applies low-risk promotion with backup/audit/verify, archives reviewed candidates, and gives `verify --stale` / `verify --freshness` deterministic signals before semantic facts are promoted.
- `obsidian-adapter` exports `.context` modules into `_cmap/<project>/` notes with Properties and body wikilinks for Obsidian Graph, and can check whether the ignored view layer is stale.
- `reconcile-adapter` scans external workflow Markdown and writes only dry-run candidate reports or inbox entries.
- `showcase` turns current product facts and workflow framing into a static interactive overview for human and external-model review.
- `memory-lite` appends explicit logs and ideas without changing canonical map files.
- `adoption` creates `ADOPTION.md` with deterministic candidate signals but leaves MAP as untrusted placeholders.
- `module-docs` creates candidate module docs without editing MAP.
- `hooks-doctor` writes project-local hook templates, renders Codex lifecycle settings to `.codex/hooks.json`, keeps Claude lifecycle render/test compatibility, ingests real host stdin JSON payloads, records observe/session logs, can generate `.context/out/session-brief.md` from assist prompt events, can append generated evidence in assist stop mode, blocks direct semantic canonical writes in strict PreToolUse ingest/tests, and diagnoses install state.
- `tests` exercise public CLI behavior through temporary projects, not just internal functions.

## Data Flow
User command -> `src/cli.ts` -> command handler -> filesystem reads/writes under cwd -> text or JSON report. For `init`, package scripts are scanned only as deterministic signals for `VERIFY.md`; project semantics stay in AI/user-written markdown. `route` first scores direct matches, then builds a `--max-context` bounded context pack from module relations and documented verification commands. `brief` reads `CHECKPOINT.md` first and falls back to `STATUS.md`; it writes task-local output under `.context/out/`. `pack` uses the routed graph neighborhood to build a redacted budgeted context pack without reading the whole repository. `finish --agent` writes a local MapPatch request; `update --agent` processes filled MapPatch JSON and auto-applies only policy-approved checkpoint/generated operations while routing semantic candidates to inbox. `obsidian export` writes view-layer notes under `_cmap/<project>/`; `obsidian export --check` compares expected view files without writing.
Generated evidence and stats are support layers: `evidence append`, MapPatch v2 `evidence.append`, and `hooks stop --profile assist` write `.context/generated/evidence/**`; `route`, `hooks test`, and Codex `hooks ingest` assist prompt events update `.context/generated/stats/route-usage.json`; `freshness` writes `.context/generated/freshness.json`; `inbox status`, `inbox triage`, `inbox promote --dry-run|--apply`, `inbox archive`, `verify --stale`, and `verify --freshness` keep review backlog and source/doc drift visible without promoting semantic facts beyond explicitly allowed low-risk metadata.

## State / Storage
- Project memory: `.context/`
- Localized reading mirror: `.context/i18n/<locale>/`
- Project locale config: `.context/config.yml`
- Deterministic maintenance policy: `.context/policy.yml`
- Current handoff checkpoint: `.context/CHECKPOINT.md`
- Task-local generated outputs: `.context/out/`
- Candidate fact inbox for future adapters: `.context/inbox/`
- Archived reviewed inbox candidates: `.context/inbox/archive/`
- Generated evidence store: `.context/generated/evidence/**/*.jsonl`
- Generated stats: `.context/generated/stats/*.json`
- Generated freshness index: `.context/generated/freshness.json`
- Generated assist startup brief: `.context/out/session-brief.md`
- Codex project-local lifecycle hook settings: `.codex/hooks.json`
- Generated graph projections: `.context/graph/*.json`
- MapPatch audit trail: `.context/audit/`
- Hook observation log: `.context/logs/hooks.jsonl`
- Hook lifecycle event journal: `.context/logs/session-events.jsonl`
- Reversible canonical-write backups: `.context/backups/`
- Obsidian view export: `_cmap/<project>/`
- Product overview artifact: `docs/cmap-product-overview.html`
- Route benchmark fixtures: `bench/tasks.jsonl`
- GitHub Actions quality gate: `.github/workflows/cmap.yml`
- External workflow candidates: `.context/inbox/`
- Host entrypoints: `AGENTS.md`, `CLAUDE.md`
- Build output: `dist/`
- Dependency lock: `pnpm-lock.yaml`

## External Integrations
Obsidian integration is file-based only: `cmap obsidian export` writes Markdown view files, `cmap obsidian export --check` detects stale view mirrors, and `cmap obsidian open` prints an `obsidian://` URI. The CLI remains local-only and has no telemetry, no cloud account, no model API, and no daemon.

## Risk Areas
- Accidentally letting CLI generate trusted project semantics.
- Over-expanding templates until `.context` becomes noisy.
- `verify` producing too many warnings and making users ignore it.
- Future `cp`/delete behavior must preserve data and avoid irreversible deletion.
- Host hooks must not write canonical memory.
- Assist hooks may write generated evidence under `.context/generated/` only; they must not write canonical semantic sections.
- Strict hook guards may block direct semantic canonical writes, but should be introduced gradually.
- Route graph-related context must remain a reading hint; it must not be counted as the task's direct module match.
- Context size controls must not hide the direct module match from `route.modules`; they only trim context pack modules and derived verify commands.
- Obsidian `_cmap` output is a view layer; do not treat it as the canonical fact source.
- `update --agent` is a policy gate for external AI proposals, not a model call or autonomous daemon.
- `update-agent` must not auto-write `MAP.md`, `DECISIONS.md`, module responsibilities, module relationships, or code files.
- Generated evidence must stay clearly marked and must not be treated as a replacement for reviewed module purpose, boundaries, or decisions.
- Relation candidates may be shown for review, but route and benchmark must not score from unpromoted candidates.
- Translation mirrors must not overwrite canonical `.context` facts; Chinese aliases and relation explanations should remain reviewable changes instead of silent semantic rewrites.
- Import graph, route v2, and pack v2 are paused historical ideas; the current roadmap is localized HTML review and relation explanations on top of reviewed project maps.

## Verification Summary
Run `pnpm test`, `pnpm typecheck`, and `pnpm build` before claiming implementation status. For CLI behavior, prefer integration tests that spawn `tsx src/cli.ts` in temporary project directories. Brief/Obsidian behavior is covered by `tests/integration/m6-brief-obsidian.test.ts`; MapPatch/update-agent behavior is covered by `tests/integration/m7-update-agent.test.ts`; generated evidence, inbox status, and stale checks are covered by `tests/integration/m8-evidence-stale-inbox.test.ts`; route context pack behavior is covered by `tests/integration/m10-route-context-pack.test.ts`; context size controls are covered by `tests/integration/m11-context-size-controls.test.ts`; route benchmark context metrics are covered by `tests/integration/m12-route-benchmark-context.test.ts`; context pack budget/redaction behavior is covered by `tests/integration/m16-context-pack.test.ts`; inbox evidence path safety is covered by `tests/integration/m24-inbox-path-escape.test.ts`; structured candidate visibility in HTML view is covered by `tests/integration/m25-view-structured-candidates.test.ts`; localized view/i18n config behavior is covered by `tests/integration/m19-view-export.test.ts` and `tests/integration/m26-i18n-config.test.ts`; HTML view secret redaction is covered by `tests/unit/redact.test.ts`.

## Handoff Notes
Current implementation covers v0.1 CLI commands plus explicit `CHECKPOINT.md` handoff, AI brief, budgeted/redacted `pack`, Obsidian view-layer export/check/pull dry-run, changed-file coverage checks, relation checks, route benchmarking with context-pack metrics and CI thresholds, conservative GSD v1/v2 dry-run reconciliation, MapPatch v1/v2 policy gate, generated/canonical evidence separation, generated stats store, freshness v2, controlled low-risk inbox promotion with project-root evidence path validation, structured candidate visibility in the HTML review view, strengthened HTML secret redaction, observe/assist hook evidence collection, assist hook session brief generation, Codex-first lifecycle render/ingest, Claude hook lifecycle render/test compatibility, deterministic graph projections, graph explanation, route context packing from reviewed module relations plus module-owned verification commands, `--max-context` size controls, CI Markdown verify reports, GitHub Actions quality gate, and refreshed product showcase.

Next roadmap is v0.2 Trust Boundary + Human Review Layer: PR-B `cmap view export` read-only HTML dashboard, PR-C trust-boundary hygiene/lifecycle ingest/Codex workflow/generated evidence migration, PR-C2 Freshness v2, and PR-D AI Relation Candidate Workflow. Old import graph/test ownership, route v2, and pack v2 are paused historical ideas, not current work.
