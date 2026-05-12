---
cmap_version: 0.1
context_type: map
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-12T18:28:00+08:00
confidence: ai-drafted
---
# Project Map

## Purpose
实现 cmap v0.1：一个 host-neutral、repo-local、人和 AI 都能读的项目地图 CLI。它负责维护 `.context/` 的确定性结构和工作流入口，帮助 AI coding 项目在上下文压缩、新会话和模块增长后仍可续接。

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
| context | `.context` templates and deterministic project signal scanning | `src/context` | `.context/modules/context.md` | context, template, skeleton, .context, 模板, 骨架 |
| verify | deterministic L0 structure checks and report formatting | `src/commands/verify.ts` | `.context/modules/verify.md` | verify, check, drift, 校验, 检查, placeholder |
| host | AGENTS/CLAUDE short entrypoint generation | `src/host`, `src/commands/install.ts` | `.context/modules/host.md` | install, AGENTS, CLAUDE, host, 入口 |
| route | direct module routing plus graph/test context pack | `src/commands/route.ts` | `.context/modules/route.md` | route, aliases, routing, 路由, 模块定位 |
| brief | AI coding startup brief from route/checkpoint/context pack/module docs | `src/commands/brief.ts` | `.context/modules/brief.md` | brief, AI brief, 开工包, AI 开工包 |
| benchmark | route benchmark over JSONL task fixtures | `src/commands/benchmark.ts`, `bench` | `.context/modules/benchmark.md` | benchmark, bench, 评测, 命中率, top-k |
| handoff | current status printing and explicit checkpoint handoff updates | `src/commands/status.ts`, `src/commands/checkpoint.ts` | `.context/modules/handoff.md` | status, checkpoint, handoff, 续接, 主线, 上下文 |
| cp | safe line-block copy/move/delete/restore with backups | `src/commands/cp.ts`, `src/fs` | `.context/modules/cp.md` | cp, copy, move, delete, restore, line block, 行块, 搬运, 备份 |
| finish | QA-lite context closeout report | `src/commands/finish.ts` | `.context/modules/finish.md` | finish, closeout, report, 收尾, 上下文收尾 |
| update-agent | MapPatch intake, routine apply policy, backup/audit, and candidate inbox routing | `src/commands/update.ts`, `src/core/map-patch.ts`, `src/fs/backup.ts` | `.context/modules/update-agent.md` | update, MapPatch, agent update, 自主维护, 自动维护, inbox, rollback |
| evidence | generated module evidence, inbox visibility, and stale maintenance checks | `src/commands/evidence.ts`, `src/commands/inbox.ts` | `.context/modules/evidence.md` | evidence, generated evidence, inbox status, stale, 证据, 候选池 |
| obsidian-adapter | Obsidian-friendly markdown export and module note links | `src/commands/obsidian.ts`, `_cmap` | `.context/modules/obsidian-adapter.md` | obsidian, graph, 图谱, 关系图谱, 可视化, export |
| reconcile-adapter | dry-run candidate facts from external workflow artifacts | `src/commands/reconcile.ts` | `.context/modules/reconcile-adapter.md` | reconcile, adapter, GSD adapter, gsd-v1, gsd-v2, 候选事实 |
| showcase | interactive product overview and external-review handoff artifact | `docs/cmap-product-overview.html` | `.context/modules/showcase.md` | showcase, product overview, HTML, 介绍页, 产品介绍, 思维导图 |
| memory-lite | explicit work log and idea append commands | `src/commands/log.ts`, `src/commands/idea.ts` | `.context/modules/memory-lite.md` | log, idea, 工作日志, 灵感, inbox |
| adoption | existing-project adoption workspace and candidate scanning | `src/commands/adopt.ts`, `src/context/adoption-scanner.ts` | `.context/modules/adoption.md` | adopt, adoption, existing project, 接管, 候选模块 |
| module-docs | candidate module document creation | `src/commands/add-module.ts` | `.context/modules/module-docs.md` | add-module, module doc, module template, 模块文档 |
| hooks-doctor | hook templates, hook reminder/observe/assist output, and diagnostics | `src/commands/hooks.ts`, `src/hooks`, `src/commands/doctor.ts`, `src/commands/install.ts` | `.context/modules/hooks-doctor.md` | hooks, doctor, reminder, maintain, observe, assist, 诊断 |
| tests | integration and built-CLI smoke coverage for CLI milestones | `tests`, `scripts/smoke-test.mjs` | `.context/modules/tests.md` | test, vitest, smoke, 自测, 集成测试, 行为测试 |

## Natural Language Route
| User Words | Module | Read First |
|---|---|---|
| 初始化、骨架、模板、.context、init | context | `.context/MAP.md`, `.context/modules/context.md`, `src/context/templates.ts` |
| 命令、参数、退出码、version、install | cli | `.context/modules/cli.md`, `src/cli.ts` |
| 校验、漂移、TODO、missing file、verify | verify | `.context/modules/verify.md`, `src/commands/verify.ts` |
| AGENTS、CLAUDE、宿主入口、host | host | `.context/modules/host.md`, `src/host/entrypoint-template.ts` |
| route、alias、模块定位、推荐读取文件 | route | `.context/modules/route.md`, `src/commands/route.ts` |
| brief、AI brief、开工包、AI 开工包、启动包 | brief | `.context/modules/brief.md`, `src/commands/brief.ts`, `.context/CHECKPOINT.md`, `.context/STATUS.md` |
| benchmark、bench、route benchmark、评测、命中率、top-k | benchmark | `.context/modules/benchmark.md`, `src/commands/benchmark.ts`, `bench/tasks.jsonl` |
| checkpoint、status、续接、上下文压缩、当前主线 | handoff | `.context/modules/handoff.md`, `src/commands/checkpoint.ts`, `src/commands/status.ts` |
| cp、copy、move、delete、restore、行块、搬运、备份 | cp | `.context/modules/cp.md`, `src/commands/cp.ts`, `src/fs/line-block.ts` |
| finish、收尾、closeout、context review | finish | `.context/modules/finish.md`, `src/commands/finish.ts` |
| update、MapPatch、agent update、自动维护、自主维护、rollback、inbox | update-agent | `.context/modules/update-agent.md`, `src/commands/update.ts`, `src/core/map-patch.ts` |
| evidence、generated evidence、inbox status、stale、证据、候选池 | evidence | `.context/modules/evidence.md`, `src/commands/evidence.ts`, `src/commands/inbox.ts` |
| obsidian、图谱、关系图谱、可视化、export、vault | obsidian-adapter | `.context/modules/obsidian-adapter.md`, `src/commands/obsidian.ts` |
| reconcile、GSD adapter、gsd-v1、gsd-v2、外部产物、候选事实 | reconcile-adapter | `.context/modules/reconcile-adapter.md`, `src/commands/reconcile.ts` |
| 产品介绍、展示页、HTML、思维导图、DeepSeek handoff | showcase | `.context/modules/showcase.md`, `docs/cmap-product-overview.html` |
| log、idea、工作日志、灵感、ideas inbox | memory-lite | `.context/modules/memory-lite.md`, `src/commands/log.ts`, `src/commands/idea.ts` |
| adopt、接管已有项目、候选模块、ADOPTION | adoption | `.context/modules/adoption.md`, `src/commands/adopt.ts` |
| add-module、新模块文档、module template | module-docs | `.context/modules/module-docs.md`, `src/commands/add-module.ts` |
| hooks、doctor、reminder、maintain、observe、assist、诊断 | hooks-doctor | `.context/modules/hooks-doctor.md`, `src/commands/hooks.ts`, `src/commands/doctor.ts` |
| 测试、红绿、M1 验收、fixture | tests | `.context/modules/tests.md`, `tests/integration/m1.test.ts` |

## Module Relationships
- `cli` dispatches to command modules and owns process exit behavior.
- `context` provides templates and project signal scanning used by `init`.
- `verify` reads `.context` files created by `context` and validates deterministic structure.
- `host` generates entrypoint text used by `install`.
- `route` reads the shared module index, recommends direct modules, expands graph-related context, and surfaces module-owned verification commands; it must not propose nonexistent modules or treat related context as direct matches.
- `brief` packages route result, route context pack, `CHECKPOINT.md` or `STATUS.md`, selected module docs, verification reminders, and optional Obsidian links into a task-local AI brief.
- `benchmark` runs JSONL task fixtures through route scoring and reports top-k hit rates.
- `handoff` reads `STATUS.md`, writes task-local `CHECKPOINT.md`, and keeps the legacy explicit `STATUS.md` update path compatible.
- `cp` uses shared fs helpers to preserve line blocks and create backups for destructive line edits.
- `finish` reads changed file hints through the shared module index and produces a closeout report; with `--agent` it writes a MapPatch request artifact under `.context/out/` but does not apply it.
- `update-agent` parses AI-authored MapPatch JSON, classifies operations by policy, applies only routine checkpoint updates with backup/audit, routes semantic updates to `.context/inbox/`, and supports rollback.
- `evidence` appends bounded generated support evidence to module docs, prints inbox backlog status, and gives `verify --stale` something deterministic to check before semantic facts are promoted.
- `obsidian-adapter` exports `.context` modules into `_cmap/<project>/` notes with Properties and body wikilinks for Obsidian Graph.
- `reconcile-adapter` scans external workflow Markdown and writes only dry-run candidate reports or inbox entries.
- `showcase` turns current product facts and workflow framing into a static interactive overview for human and external-model review.
- `memory-lite` appends explicit logs and ideas without changing canonical map files.
- `adoption` creates `ADOPTION.md` with deterministic candidate signals but leaves MAP as untrusted placeholders.
- `module-docs` creates candidate module docs without editing MAP.
- `hooks-doctor` writes project-local hook templates, prints reminders, records observe logs, can append generated evidence in assist mode, and diagnoses install state.
- `tests` exercise public CLI behavior through temporary projects, not just internal functions.

## Data Flow
User command -> `src/cli.ts` -> command handler -> filesystem reads/writes under cwd -> text or JSON report. For `init`, package scripts are scanned only as deterministic signals for `VERIFY.md`; project semantics stay in AI/user-written markdown. `route` first scores direct matches, then builds a bounded context pack from module relations and documented verification commands. `brief` reads `CHECKPOINT.md` first and falls back to `STATUS.md`; it writes task-local output under `.context/out/`. `finish --agent` writes a local MapPatch request; `update --agent` processes filled MapPatch JSON and only auto-applies low-risk checkpoint state. `obsidian export` writes view-layer notes under `_cmap/<project>/`.
Generated evidence is a support layer: `evidence append` and `hooks stop --profile assist` update marked generated sections inside module docs, while `inbox status` and `verify --stale` keep review backlog and source/doc drift visible without promoting semantic facts.

## State / Storage
- Project memory: `.context/`
- Current handoff checkpoint: `.context/CHECKPOINT.md`
- Task-local generated outputs: `.context/out/`
- Candidate fact inbox for future adapters: `.context/inbox/`
- Generated evidence blocks: bounded sections inside `.context/modules/*.md`
- MapPatch audit trail: `.context/audit/`
- Hook observation log: `.context/logs/hooks.jsonl`
- Reversible canonical-write backups: `.context/backups/`
- Obsidian view export: `_cmap/<project>/`
- Product overview artifact: `docs/cmap-product-overview.html`
- Route benchmark fixtures: `bench/tasks.jsonl`
- External workflow candidates: `.context/inbox/`
- Host entrypoints: `AGENTS.md`, `CLAUDE.md`
- Build output: `dist/`
- Dependency lock: `pnpm-lock.yaml`

## External Integrations
Obsidian integration is file-based only: `cmap obsidian export` writes Markdown view files and `cmap obsidian open` prints an `obsidian://` URI. The CLI remains local-only and has no telemetry, no cloud account, no model API, and no daemon.

## Risk Areas
- Accidentally letting CLI generate trusted project semantics.
- Over-expanding templates until `.context` becomes noisy.
- `verify` producing too many warnings and making users ignore it.
- Future `cp`/delete behavior must preserve data and avoid irreversible deletion.
- Host hooks must remind only; they must not write canonical memory.
- Assist hooks may write generated evidence blocks only; they must not write canonical semantic sections.
- Route graph-related context must remain a reading hint; it must not be counted as the task's direct module match.
- Obsidian `_cmap` output is a view layer; do not treat it as the canonical fact source.
- `update --agent` is a policy gate for external AI proposals, not a model call or autonomous daemon.
- `update-agent` must not auto-write `MAP.md`, `DECISIONS.md`, module responsibilities, module relationships, or code files.
- Generated evidence must stay clearly marked and must not be treated as a replacement for reviewed module purpose, boundaries, or decisions.

## Verification Summary
Run `pnpm test`, `pnpm typecheck`, and `pnpm build` before claiming implementation status. For CLI behavior, prefer integration tests that spawn `tsx src/cli.ts` in temporary project directories. Brief/Obsidian behavior is covered by `tests/integration/m6-brief-obsidian.test.ts`; MapPatch/update-agent behavior is covered by `tests/integration/m7-update-agent.test.ts`; generated evidence, inbox status, and stale checks are covered by `tests/integration/m8-evidence-stale-inbox.test.ts`; route context pack behavior is covered by `tests/integration/m10-route-context-pack.test.ts`.

## Handoff Notes
Current implementation covers v0.1 CLI commands plus explicit `CHECKPOINT.md` handoff, AI brief, Obsidian view-layer export/pull dry-run, changed-file coverage checks, relation checks, route benchmarking, conservative GSD v1/v2 dry-run reconciliation, a P0 MapPatch gate, generated evidence / inbox visibility / stale verify, observe/assist hook evidence collection, and route context packing from module graph plus module-owned verification commands. Next work should add selected context size controls and richer route benchmark fixtures.
