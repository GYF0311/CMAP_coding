---
cmap_version: 0.1
context_type: map
project: CMAP_coding
source_commit: unknown
updated_at: 2026-07-19T17:35:00+08:00
confidence: ai-drafted
---
# Project Map

## Purpose
CMAP 是一个放在仓库里的轻量项目记忆工具，服务对象是人和 AI 编码 agent。它维护确定性的 `.context` 结构、候选事实治理、安全边界，以及可导出的 Review HTML 审阅页，让项目在上下文压缩、新会话、模块变多之后仍然能被接手。

核心产品功能：CMAP 是 AI 交接和模块解释层。agent 写代码时同步更新 `.context` 的模块文档、checkpoint 和 status，让下一个 agent 不必重新读大量源码，也能知道每个模块负责什么、关联哪些模块、哪些文件重要、应该怎么验证。

Trust Boundary + Human Review Layer 是围绕 AI 写入上下文的一套纪律：生成证据、候选内容、已接受的模块解释要分清楚；上下文更新要能看 diff、能验证、能审阅、能回退。

本地项目约定：结构标题保留稳定英文锚点，正文、模块解释、交接说明、决策记录和审阅内容默认写中文。源码级事实，例如 import、谁调用谁、符号、影响分析，交给 CodeGraph 或其他代码智能工具；CMAP 只记录耐用的项目记忆，不再维护重复的源码图谱。

## Tech Stack & Runtime
- 运行环境：Node.js >= 20
- 主要语言：TypeScript ESM
- 包管理：pnpm
- CLI 框架：commander
- Markdown/frontmatter：gray-matter
- 测试框架：Vitest
- 打包：tsup

## Entry Points
- CLI 源码入口：`src/cli.ts`
- 构建后的可执行文件：`dist/cli.js`
- 包命令：`cmap`
- 集成测试：`tests/integration/*.test.ts`
- 产品说明：`cmap_v0.1_PRD_and_execution_manual.md`
- 用户 README：`README.md`
- 交互式产品介绍：`docs/cmap-product-overview.html`
- 构建后 smoke 测试：`scripts/smoke-test.mjs`

## Module Map
| Module | Purpose | Paths | Doc | Aliases |
|---|---|---|---|---|
| cli | 注册命令、解析参数、管理退出码边界 | `src/cli.ts`, `src/commands` | `.context/modules/cli.md` | cli, command, 命令, version, init, install |
| context | 生成 `.context` 模板，加载确定性 policy，并扫描项目初始信号 | `src/context` | `.context/modules/context.md` | context, template, skeleton, .context, policy, 模板, 骨架 |
| verify | 检查 `.context` 结构、标题锚点、freshness/stale 状态，并输出 CI 报告 | `src/commands/verify.ts` | `.context/modules/verify.md` | verify, check, drift, 校验, 检查, placeholder |
| host | 非破坏式生成 AGENTS/CLAUDE 入口说明 | `src/host`, `src/commands/install.ts` | `.context/modules/host.md` | install, AGENTS, CLAUDE, host, 入口 |
| skill | 导出项目本地 Skill/reference，并提供 bootstrap 接入流程 | `src/commands/skill.ts`, `src/commands/bootstrap.ts`, `src/skill` | `.context/modules/skill.md` | skill, bootstrap, IDE, AGENTS, CLAUDE, start-here, 接入 |
| route | 根据任务文本定位模块，并给出受控的相关模块阅读包 | `src/commands/route.ts` | `.context/modules/route.md` | route, aliases, routing, 路由, 模块定位 |
| graph | 从已审阅模块关系生成项目关系投影和关系解释 | `src/commands/graph.ts`, `src/core/context-graph.ts` | `.context/modules/graph.md` | graph, context graph, graph build, graph explain, 关系图, 图谱 |
| brief | 根据 route、checkpoint、模块文档和验证提醒生成 AI 开工包 | `src/commands/brief.ts` | `.context/modules/brief.md` | brief, AI brief, 开工包, AI 开工包 |
| pack | 根据路由邻域生成有 token 预算和脱敏处理的上下文包 | `src/commands/pack.ts` | `.context/modules/pack.md` | pack, context pack, token budget, 上下文包, 阅读包 |
| benchmark | 用 JSONL fixture 评测 route 命中率和相关上下文命中率 | `src/commands/benchmark.ts`, `bench` | `.context/modules/benchmark.md` | benchmark, bench, 评测, 命中率, top-k |
| handoff | 读取当前状态，并显式写入 checkpoint 交接信息 | `src/commands/status.ts`, `src/commands/checkpoint.ts` | `.context/modules/handoff.md` | status, checkpoint, handoff, 续接, 主线, 上下文 |
| cp | 安全复制、移动、删除、恢复行块，并保留备份 | `src/commands/cp.ts`, `src/fs` | `.context/modules/cp.md` | cp, copy, move, delete, restore, line block, 行块, 搬运, 备份 |
| finish | 任务收尾时生成轻量上下文检查报告 | `src/commands/finish.ts` | `.context/modules/finish.md` | finish, closeout, report, 收尾, 上下文收尾 |
| update-agent | 接收 MapPatch，按 policy 自动处理 routine/generated 更新，并把语义变更送入候选池 | `src/commands/update.ts`, `src/core/map-patch.ts`, `src/fs/backup.ts` | `.context/modules/update-agent.md` | update, MapPatch, agent update, 自主维护, 自动维护, inbox, rollback |
| evidence | 管理生成证据、统计、freshness/drift signals、候选池 triage/archive/promote 和 stale 检查 | `src/commands/evidence.ts`, `src/commands/inbox.ts`, `src/commands/freshness.ts`, `src/commands/drift.ts`, `src/core/generated-stats.ts`, `src/core/generated-store.ts`, `src/core/freshness.ts`, `src/core/drift.ts` | `.context/modules/evidence.md` | evidence, generated evidence, inbox status, stats, stale, freshness, drift, 证据, 候选池 |
| view | 导出只读 HTML 审阅页，展示可信地图和候选/生成支持层 | `src/view`, `src/commands/view.ts` | `.context/modules/view.md` | view, dashboard, HTML review, human review |
| relation-candidates | 接收 AI 关系候选，验证后写入 inbox，并支持候选态 promote dry-run | `src/commands/relate.ts`, `src/core/relation-patch.ts`, `src/context/relation-schema.ts` | `.context/modules/relation-candidates.md` | relate, relation candidate, RelationPatch, 关系候选 |
| obsidian-adapter | 导出 Obsidian 友好的 Markdown 视图，支持 open/pull/check | `src/commands/obsidian.ts`, `_cmap` | `.context/modules/obsidian-adapter.md` | obsidian, graph, 图谱, 关系图谱, 可视化, export |
| reconcile-adapter | 从外部工作流产物生成 dry-run 候选事实报告 | `src/commands/reconcile.ts` | `.context/modules/reconcile-adapter.md` | reconcile, adapter, GSD adapter, gsd-v1, gsd-v2, 候选事实 |
| showcase | 保存产品介绍页和轻量研究材料，辅助人类/外部模型理解 | `docs/cmap-product-overview.html`, `docs/research/**` | `.context/modules/showcase.md` | showcase, product overview, HTML, research, planning, comparison, 介绍页, 产品介绍, 思维导图, 竞品研究 |
| memory-lite | 显式追加工作日志和临时想法 | `src/commands/log.ts`, `src/commands/idea.ts` | `.context/modules/memory-lite.md` | log, idea, 工作日志, 灵感, inbox |
| adoption | 接管已有项目时生成候选扫描结果，不直接写入可信地图 | `src/commands/adopt.ts`, `src/context/adoption-scanner.ts` | `.context/modules/adoption.md` | adopt, adoption, existing project, 接管, 候选模块 |
| module-docs | 创建候选模块文档，不直接修改 MAP | `src/commands/add-module.ts` | `.context/modules/module-docs.md` | add-module, module doc, module template, 模块文档 |
| hooks-doctor | 管理 hook 模板、Codex 生命周期渲染/摄入、诊断和 session brief 生成 | `src/commands/hooks.ts`, `src/hooks`, `src/commands/doctor.ts`, `src/commands/install.ts` | `.context/modules/hooks-doctor.md` | hooks, doctor, reminder, maintain, observe, assist, strict, 诊断 |
| tests | 用集成测试和构建后 smoke 测试保护 CLI 行为 | `tests`, `scripts/smoke-test.mjs` | `.context/modules/tests.md` | test, vitest, smoke, 自测, 集成测试, 行为测试 |

## Natural Language Route
| User Words | Module | Read First |
|---|---|---|
| 初始化、骨架、模板、.context、policy、init | context | `.context/MAP.md`, `.context/modules/context.md`, `src/context/templates.ts`, `src/context/policy.ts` |
| 命令、参数、退出码、version、install | cli | `.context/modules/cli.md`, `src/cli.ts` |
| 校验、漂移、TODO、missing file、verify | verify | `.context/modules/verify.md`, `src/commands/verify.ts` |
| AGENTS、CLAUDE、宿主入口、host | host | `.context/modules/host.md`, `src/host/entrypoint-template.ts` |
| skill、bootstrap、IDE 接入、start-here、技能包 | skill | `.context/modules/skill.md`, `src/commands/skill.ts`, `src/commands/bootstrap.ts`, `src/skill/templates.ts` |
| route、alias、模块定位、推荐读取文件 | route | `.context/modules/route.md`, `src/commands/route.ts` |
| graph、context graph、graph build、graph explain、图谱、关系图 | graph | `.context/modules/graph.md`, `src/commands/graph.ts`, `src/core/context-graph.ts` |
| brief、AI brief、开工包、AI 开工包、启动包 | brief | `.context/modules/brief.md`, `src/commands/brief.ts`, `.context/CHECKPOINT.md`, `.context/STATUS.md` |
| pack、context pack、token budget、上下文包、阅读包、token 预算 | pack | `.context/modules/pack.md`, `src/commands/pack.ts`, `.context/CHECKPOINT.md`, `.context/VERIFY.md` |
| benchmark、bench、route benchmark、评测、命中率、top-k | benchmark | `.context/modules/benchmark.md`, `src/commands/benchmark.ts`, `bench/tasks.jsonl` |
| checkpoint、status、续接、上下文压缩、当前主线 | handoff | `.context/modules/handoff.md`, `src/commands/checkpoint.ts`, `src/commands/status.ts` |
| cp、copy、move、delete、restore、行块、搬运、备份 | cp | `.context/modules/cp.md`, `src/commands/cp.ts`, `src/fs/line-block.ts` |
| finish、收尾、closeout、context review | finish | `.context/modules/finish.md`, `src/commands/finish.ts` |
| update、MapPatch、agent update、自动维护、自主维护、rollback、inbox | update-agent | `.context/modules/update-agent.md`, `src/commands/update.ts`, `src/core/map-patch.ts` |
| evidence、generated evidence、stats、module activity、freshness、drift、sourceSignals、inbox status、inbox triage、promote、archive、stale、证据、候选池 | evidence | `.context/modules/evidence.md`, `src/commands/evidence.ts`, `src/commands/inbox.ts`, `src/commands/freshness.ts`, `src/commands/drift.ts`, `src/core/generated-stats.ts`, `src/core/generated-store.ts`, `src/core/freshness.ts`, `src/core/drift.ts` |
| view、dashboard、HTML review、human review、审阅台、项目地图页面 | view | `.context/modules/view.md`, `src/commands/view.ts`, `src/view` |
| relate、RelationPatch、relation candidate、关系候选、关系补丁 | relation-candidates | `.context/modules/relation-candidates.md`, `src/commands/relate.ts`, `src/core/relation-patch.ts`, `src/context/relation-schema.ts` |
| obsidian、图谱、关系图谱、可视化、export、vault | obsidian-adapter | `.context/modules/obsidian-adapter.md`, `src/commands/obsidian.ts` |
| reconcile、GSD adapter、gsd-v1、gsd-v2、外部产物、候选事实 | reconcile-adapter | `.context/modules/reconcile-adapter.md`, `src/commands/reconcile.ts` |
| 产品介绍、展示页、HTML、思维导图、DeepSeek handoff、竞品研究、项目对比、升级规划 | showcase | `.context/modules/showcase.md`, `docs/cmap-product-overview.html`, `docs/research/` |
| log、idea、工作日志、灵感、ideas inbox | memory-lite | `.context/modules/memory-lite.md`, `src/commands/log.ts`, `src/commands/idea.ts` |
| adopt、接管已有项目、候选模块、ADOPTION | adoption | `.context/modules/adoption.md`, `src/commands/adopt.ts` |
| add-module、新模块文档、module template | module-docs | `.context/modules/module-docs.md`, `src/commands/add-module.ts` |
| hooks、doctor、render、ingest、test、reminder、maintain、observe、assist、strict、诊断 | hooks-doctor | `.context/modules/hooks-doctor.md`, `src/commands/hooks.ts`, `src/hooks/templates.ts`, `src/hooks/events.ts`, `src/commands/doctor.ts` |
| 测试、红绿、M1 验收、fixture | tests | `.context/modules/tests.md`, `tests/integration/m1.test.ts` |

## Module Relationships
- `cli` dispatches to command modules and owns process exit behavior.
- `context` provides templates, deterministic policy v2 defaults/loading, and project signal scanning used by `init`.
- `verify` reads `.context` files created by `context`, validates deterministic structure, warns on non-English structural heading anchors, checks stale/freshness warnings, and can render stable CI Markdown reports.
- `host` generates entrypoint text used by `install`, merging cmap marker blocks by default so existing project rules outside the block are preserved.
- `skill` exports a project-local instruction pack and bootstraps onboarding by delegating non-destructive host install plus optional skill export/start-here generation; new projects must opt in with `bootstrap --init`.
- `route` reads the shared module index, recommends direct modules, expands bounded reviewed-relation context, and surfaces module-owned verification commands plus read-only drift review signals; normal queries do not write usage telemetry, while explicit `--record-usage` records generated stats when policy allows. It must not propose nonexistent modules, treat related context as direct matches, consume unpromoted relation candidates as route facts, or write freshness/sourceSignals while routing.
- `graph` writes generated graph projections and explains typed module relations derived from reviewed module docs. It is a canonical module-relation projection, not an import graph or test ownership graph.
- `brief` packages route result, bounded route context pack, read-only drift review signals, `CHECKPOINT.md` or `STATUS.md`, selected module docs, verification reminders, and optional Obsidian links into a task-local AI brief.
- `pack` renders a redacted, budgeted task context pack from route's graph neighborhood, checkpoint/status, decisions, verify source, module docs, and inbox warnings.
- `benchmark` runs JSONL task fixtures through route scoring, reports top-k/context-pack metrics, and can fail CI on explicit threshold regressions.
- `handoff` reads `STATUS.md`, writes task-local `CHECKPOINT.md`, and keeps the legacy explicit `STATUS.md` update path compatible.
- `cp` uses shared fs helpers to preserve line blocks and create backups for destructive line edits.
- `finish` reads changed file hints through the shared module index and produces a closeout report; with `--agent` it writes a MapPatch request artifact under `.context/out/` but does not apply it.
- `update-agent` parses AI-authored MapPatch v1/v2 JSON, classifies operations by policy, applies routine checkpoint and generated evidence/stats updates with backup/audit, routes semantic updates to `.context/inbox/`, rejects blocked operations, and supports rollback.
- `evidence` appends bounded generated support evidence under `.context/generated/`, records generated module activity and route usage stats, maintains freshness snapshots and commit-aware drift sourceSignals, prints inbox backlog status, groups candidates for triage, previews/applies low-risk promotion with backup/audit/verify, archives reviewed candidates, and gives `verify --stale` / `verify --freshness` deterministic signals before semantic facts are promoted.
- `obsidian-adapter` exports `.context` modules into `_cmap/<project>/` notes with Properties and body wikilinks for Obsidian Graph, and can check whether the ignored view layer is stale.
- `reconcile-adapter` scans external workflow Markdown and writes only dry-run candidate reports or inbox entries.
- `showcase` turns current product facts, workflow framing, and lightweight research notes into static artifacts for human and external-model review.
- `memory-lite` appends explicit logs and ideas without changing canonical map files.
- `adoption` creates `ADOPTION.md` with deterministic candidate signals but leaves MAP as untrusted placeholders.
- `module-docs` creates candidate module docs without editing MAP.
- `hooks-doctor` writes project-local hook templates, renders Codex lifecycle settings to `.codex/hooks.json`, keeps Claude lifecycle render/test compatibility, ingests real host stdin JSON payloads, records observe/session logs, can generate `.context/out/session-brief.md` with read-only drift review signals from assist prompt events, can append generated evidence in assist stop mode, blocks direct semantic canonical writes in strict PreToolUse ingest/tests, and diagnoses install state.
- `tests` exercise public CLI behavior through temporary projects, not just internal functions.

## Data Flow
User command -> `src/cli.ts` -> command handler -> filesystem reads/writes under cwd -> text or JSON report. For `init`, package scripts are scanned only as deterministic signals for `VERIFY.md`; project semantics stay in AI/user-written markdown. `route` first scores direct matches, then builds a `--max-context` bounded context pack from module relations and documented verification commands. `brief` reads `CHECKPOINT.md` first and falls back to `STATUS.md`; it writes task-local output under `.context/out/`. `pack` uses the routed graph neighborhood to build a redacted budgeted context pack without reading the whole repository. `finish --agent` writes a local MapPatch request; `update --agent` processes filled MapPatch JSON and auto-applies only policy-approved checkpoint/generated operations while routing semantic candidates to inbox. `obsidian export` writes view-layer notes under `_cmap/<project>/`; `obsidian export --check` compares expected view files without writing.
Generated evidence and stats are support layers: `evidence append`, MapPatch v2 `evidence.append`, and `hooks stop --profile assist` write `.context/generated/evidence/**`; `route`, `hooks test`, and Codex `hooks ingest` assist prompt events update `.context/generated/stats/route-usage.json`; `freshness` writes `.context/generated/freshness.json`; `drift check` is read-only, while `drift snapshot` and `drift mark-reviewed` explicitly update the same freshness index with sourceSignals/review metadata; `inbox status`, `inbox triage`, `inbox promote --dry-run|--apply`, `inbox archive`, `verify --stale`, and `verify --freshness` keep review backlog and source/doc drift visible without promoting semantic facts beyond explicitly allowed low-risk metadata. CodeGraph owns local source facts such as import/call/symbol/impact relations; cmap may consult those facts during work, but does not store them as trusted project memory.

## State / Storage
- Project memory: `.context/`
- Deterministic maintenance policy: `.context/policy.yml`
- Current handoff checkpoint: `.context/CHECKPOINT.md`
- Task-local generated outputs: `.context/out/`
- Candidate fact inbox for future adapters: `.context/inbox/`
- Archived reviewed inbox candidates: `.context/inbox/archive/`
- Generated evidence store: `.context/generated/evidence/**/*.jsonl`
- Generated stats: `.context/generated/stats/*.json`
- Generated freshness/drift index: `.context/generated/freshness.json`
- External source-fact layer: `.codegraph/` when CodeGraph is enabled; generated by CodeGraph and not canonical cmap memory
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
- Project-local skill pack: `.cmap/skills/cmap/`
- Bootstrap guide: `.context/out/start-here.md`
- Build output: `dist/`
- Dependency lock: `pnpm-lock.yaml`

## External Integrations
Obsidian integration is file-based only: `cmap obsidian export` writes Markdown view files, `cmap obsidian export --check` detects stale view mirrors, and `cmap obsidian open` prints an `obsidian://` URI. The CLI remains local-only and has no telemetry, no cloud account, no model API, and no daemon.

## Risk Areas
- Accidentally letting CLI generate trusted project semantics.
- Treating `.context` as magically true because it exists. Module explanations are often AI-authored during coding; they are accepted working memory only when their diff, evidence, and verification make sense.
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
- Source-level facts can be stale, ambiguous, truncated, or wrong; use CodeGraph for import/call/symbol/impact questions, and keep cmap focused on reviewed module explanations, handoff, decisions, and verification records.
- Relation candidates may be shown for review, but route and benchmark must not score from unpromoted candidates.
- Translation/i18n/locale mirrors are paused and not part of the current command surface. Review HTML UI label localization is presentation-only and must not create a hidden second fact store.
- Import graph, route v2, and pack v2 are paused historical ideas; the current roadmap is Review HTML and relation explanations on top of reviewed project maps.

## Verification Summary
Run `pnpm test`, `pnpm typecheck`, and `pnpm build` before claiming implementation status. For CLI behavior, prefer integration tests that spawn `tsx src/cli.ts` in temporary project directories. Brief/Obsidian behavior is covered by `tests/integration/m6-brief-obsidian.test.ts`; MapPatch/update-agent behavior is covered by `tests/integration/m7-update-agent.test.ts`; generated evidence, inbox status, and stale checks are covered by `tests/integration/m8-evidence-stale-inbox.test.ts`; route context pack behavior is covered by `tests/integration/m10-route-context-pack.test.ts`; context size controls are covered by `tests/integration/m11-context-size-controls.test.ts`; route benchmark context metrics are covered by `tests/integration/m12-route-benchmark-context.test.ts`; context pack budget/redaction behavior is covered by `tests/integration/m16-context-pack.test.ts`; inbox evidence path safety is covered by `tests/integration/m24-inbox-path-escape.test.ts`; structured candidate visibility in HTML view is covered by `tests/integration/m25-view-structured-candidates.test.ts`; HTML view behavior is covered by `tests/integration/m19-view-export.test.ts`; HTML view secret redaction is covered by `tests/unit/redact.test.ts`.

## Handoff Notes
Current implementation covers v0.1 CLI commands plus explicit `CHECKPOINT.md` handoff, AI brief, budgeted/redacted `pack`, Obsidian view-layer export/check/pull dry-run, changed-file coverage checks, relation checks, route benchmarking with context-pack metrics and CI thresholds, conservative GSD v1/v2 dry-run reconciliation, MapPatch v1/v2 policy gate, generated/canonical evidence separation, generated stats store, freshness v2, controlled low-risk inbox promotion with project-root evidence path validation, structured candidate visibility in the HTML review view, strengthened HTML secret redaction, observe/assist hook evidence collection, assist hook session brief generation, Codex-first lifecycle render/ingest, Claude hook lifecycle render/test compatibility, deterministic graph projections, graph explanation, route context packing from reviewed module relations plus module-owned verification commands, `--max-context` size controls, CI Markdown verify reports, GitHub Actions quality gate, and refreshed product showcase. Source-level code facts are delegated to CodeGraph instead of being duplicated inside cmap.

Next roadmap is v0.2 Trust Boundary + Human Review Layer: PR-B `cmap view export` read-only HTML dashboard, PR-C trust-boundary hygiene/lifecycle ingest/Codex workflow/generated evidence migration, PR-C2 Freshness v2, and PR-D AI Relation Candidate Workflow. Old import graph/test ownership, route v2, and pack v2 are paused historical ideas, not current work.
