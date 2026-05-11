---
cmap_version: 0.1
context_type: map
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T09:44:43.433Z
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
- Built CLI smoke test: `scripts/smoke-test.mjs`

## Module Map
| Module | Purpose | Paths | Doc | Aliases |
|---|---|---|---|---|
| cli | command registration, option parsing, exit-code boundary | `src/cli.ts`, `src/commands` | `.context/modules/cli.md` | cli, command, 命令, version, init, install |
| context | `.context` templates and deterministic project signal scanning | `src/context` | `.context/modules/context.md` | context, template, skeleton, .context, 模板, 骨架 |
| verify | deterministic L0 structure checks and report formatting | `src/commands/verify.ts` | `.context/modules/verify.md` | verify, check, drift, 校验, 检查, placeholder |
| host | AGENTS/CLAUDE short entrypoint generation | `src/host`, `src/commands/install.ts` | `.context/modules/host.md` | install, AGENTS, CLAUDE, host, 入口 |
| route | keyword and alias based module routing | `src/commands/route.ts` | `.context/modules/route.md` | route, aliases, routing, 路由, 模块定位 |
| brief | AI coding startup brief from route/status/module docs | `src/commands/brief.ts` | `.context/modules/brief.md` | brief, AI brief, 开工包, AI 开工包 |
| handoff | current status printing and explicit checkpoint updates | `src/commands/status.ts`, `src/commands/checkpoint.ts` | `.context/modules/handoff.md` | status, checkpoint, handoff, 续接, 主线, 上下文 |
| cp | safe line-block copy/move/delete/restore with backups | `src/commands/cp.ts`, `src/fs` | `.context/modules/cp.md` | cp, copy, move, delete, restore, line block, 行块, 搬运, 备份 |
| finish | QA-lite context closeout report | `src/commands/finish.ts` | `.context/modules/finish.md` | finish, closeout, report, 收尾, 上下文收尾 |
| obsidian-adapter | Obsidian-friendly markdown export and module note links | `src/commands/obsidian.ts`, `_cmap` | `.context/modules/obsidian-adapter.md` | obsidian, graph, 图谱, 关系图谱, 可视化, export |
| memory-lite | explicit work log and idea append commands | `src/commands/log.ts`, `src/commands/idea.ts` | `.context/modules/memory-lite.md` | log, idea, 工作日志, 灵感, inbox |
| adoption | existing-project adoption workspace and candidate scanning | `src/commands/adopt.ts`, `src/context/adoption-scanner.ts` | `.context/modules/adoption.md` | adopt, adoption, existing project, 接管, 候选模块 |
| module-docs | candidate module document creation | `src/commands/add-module.ts` | `.context/modules/module-docs.md` | add-module, module doc, module template, 模块文档 |
| hooks-doctor | hook templates, hook reminder output, and diagnostics | `src/commands/hooks.ts`, `src/hooks`, `src/commands/doctor.ts`, `src/commands/install.ts` | `.context/modules/hooks-doctor.md` | hooks, doctor, reminder, maintain, 诊断 |
| tests | integration and built-CLI smoke coverage for CLI milestones | `tests`, `scripts/smoke-test.mjs` | `.context/modules/tests.md` | test, vitest, smoke, 自测, 集成测试, 行为测试 |

## Natural Language Route
| User Words | Module | Read First |
|---|---|---|
| 初始化、骨架、模板、.context、init | context | `.context/MAP.md`, `.context/modules/context.md`, `src/context/templates.ts` |
| 命令、参数、退出码、version、install | cli | `.context/modules/cli.md`, `src/cli.ts` |
| 校验、漂移、TODO、missing file、verify | verify | `.context/modules/verify.md`, `src/commands/verify.ts` |
| AGENTS、CLAUDE、宿主入口、host | host | `.context/modules/host.md`, `src/host/entrypoint-template.ts` |
| route、alias、模块定位、推荐读取文件 | route | `.context/modules/route.md`, `src/commands/route.ts` |
| brief、AI brief、开工包、AI 开工包、启动包 | brief | `.context/modules/brief.md`, `src/commands/brief.ts`, `.context/STATUS.md` |
| checkpoint、status、续接、上下文压缩、当前主线 | handoff | `.context/modules/handoff.md`, `src/commands/checkpoint.ts`, `src/commands/status.ts` |
| cp、copy、move、delete、restore、行块、搬运、备份 | cp | `.context/modules/cp.md`, `src/commands/cp.ts`, `src/fs/line-block.ts` |
| finish、收尾、closeout、context review | finish | `.context/modules/finish.md`, `src/commands/finish.ts` |
| obsidian、图谱、关系图谱、可视化、export、vault | obsidian-adapter | `.context/modules/obsidian-adapter.md`, `src/commands/obsidian.ts` |
| log、idea、工作日志、灵感、ideas inbox | memory-lite | `.context/modules/memory-lite.md`, `src/commands/log.ts`, `src/commands/idea.ts` |
| adopt、接管已有项目、候选模块、ADOPTION | adoption | `.context/modules/adoption.md`, `src/commands/adopt.ts` |
| add-module、新模块文档、module template | module-docs | `.context/modules/module-docs.md`, `src/commands/add-module.ts` |
| hooks、doctor、reminder、maintain、诊断 | hooks-doctor | `.context/modules/hooks-doctor.md`, `src/commands/hooks.ts`, `src/commands/doctor.ts` |
| 测试、红绿、M1 验收、fixture | tests | `.context/modules/tests.md`, `tests/integration/m1.test.ts` |

## Module Relationships
- `cli` dispatches to command modules and owns process exit behavior.
- `context` provides templates and project signal scanning used by `init`.
- `verify` reads `.context` files created by `context` and validates deterministic structure.
- `host` generates entrypoint text used by `install`.
- `route` reads the shared module index and recommends context files; it must not propose nonexistent modules.
- `brief` packages route result, `STATUS.md`, selected module docs, verification reminders, and optional Obsidian links into a task-local AI brief.
- `handoff` reads and writes `STATUS.md` from explicit user/AI fields.
- `cp` uses shared fs helpers to preserve line blocks and create backups for destructive line edits.
- `finish` reads changed file hints through the shared module index and produces a read-only closeout report.
- `obsidian-adapter` exports `.context` modules into `_cmap/<project>/` notes with Properties and body wikilinks for Obsidian Graph.
- `memory-lite` appends explicit logs and ideas without changing canonical map files.
- `adoption` creates `ADOPTION.md` with deterministic candidate signals but leaves MAP as untrusted placeholders.
- `module-docs` creates candidate module docs without editing MAP.
- `hooks-doctor` writes project-local hook templates, prints reminders, and diagnoses install state.
- `tests` exercise public CLI behavior through temporary projects, not just internal functions.

## Data Flow
User command -> `src/cli.ts` -> command handler -> filesystem reads/writes under cwd -> text or JSON report. For `init`, package scripts are scanned only as deterministic signals for `VERIFY.md`; project semantics stay in AI/user-written markdown. `brief` writes task-local output under `.context/out/`; `obsidian export` writes view-layer notes under `_cmap/<project>/`.

## State / Storage
- Project memory: `.context/`
- Task-local generated outputs: `.context/out/`
- Candidate fact inbox for future adapters: `.context/inbox/`
- Obsidian view export: `_cmap/<project>/`
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
- Obsidian `_cmap` output is a view layer; do not treat it as the canonical fact source.

## Verification Summary
Run `pnpm test`, `pnpm typecheck`, and `pnpm build` before claiming implementation status. For CLI behavior, prefer integration tests that spawn `tsx src/cli.ts` in temporary project directories. New brief/Obsidian behavior is covered by `tests/integration/m6-brief-obsidian.test.ts`.

## Handoff Notes
Current implementation covers v0.1 CLI commands plus the first AI brief and Obsidian view-layer workflow. Next work should dogfood `cmap brief`, inspect `_cmap/CMAP_coding` in Obsidian, then add coverage checks before attempting GSD/reconcile adapters.
