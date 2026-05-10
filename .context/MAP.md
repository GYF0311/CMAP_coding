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

## Module Map
| Module | Purpose | Paths | Doc | Aliases |
|---|---|---|---|---|
| cli | command registration, option parsing, exit-code boundary | `src/cli.ts`, `src/commands` | `.context/modules/cli.md` | cli, command, 命令, version, init, install |
| context | `.context` templates and deterministic project signal scanning | `src/context` | `.context/modules/context.md` | context, template, skeleton, .context, 模板, 骨架 |
| verify | deterministic L0 structure checks and report formatting | `src/commands/verify.ts` | `.context/modules/verify.md` | verify, check, drift, 校验, 检查, placeholder |
| host | AGENTS/CLAUDE short entrypoint generation | `src/host`, `src/commands/install.ts` | `.context/modules/host.md` | install, AGENTS, CLAUDE, host, 入口 |
| route | keyword and alias based module routing | `src/commands/route.ts` | `.context/modules/route.md` | route, aliases, routing, 路由, 模块定位 |
| handoff | current status printing and explicit checkpoint updates | `src/commands/status.ts`, `src/commands/checkpoint.ts` | `.context/modules/handoff.md` | status, checkpoint, handoff, 续接, 主线, 上下文 |
| tests | integration behavior coverage for CLI milestones | `tests` | `.context/modules/tests.md` | test, vitest, 集成测试, 行为测试 |

## Natural Language Route
| User Words | Module | Read First |
|---|---|---|
| 初始化、骨架、模板、.context、init | context | `.context/MAP.md`, `.context/modules/context.md`, `src/context/templates.ts` |
| 命令、参数、退出码、version、install | cli | `.context/modules/cli.md`, `src/cli.ts` |
| 校验、漂移、TODO、missing file、verify | verify | `.context/modules/verify.md`, `src/commands/verify.ts` |
| AGENTS、CLAUDE、宿主入口、host | host | `.context/modules/host.md`, `src/host/entrypoint-template.ts` |
| route、alias、模块定位、推荐读取文件 | route | `.context/modules/route.md`, `src/commands/route.ts` |
| checkpoint、status、续接、上下文压缩、当前主线 | handoff | `.context/modules/handoff.md`, `src/commands/checkpoint.ts`, `src/commands/status.ts` |
| 测试、红绿、M1 验收、fixture | tests | `.context/modules/tests.md`, `tests/integration/m1.test.ts` |

## Module Relationships
- `cli` dispatches to command modules and owns process exit behavior.
- `context` provides templates and project signal scanning used by `init`.
- `verify` reads `.context` files created by `context` and validates deterministic structure.
- `host` generates entrypoint text used by `install`.
- `route` reads module docs and recommends context files; it must not propose nonexistent modules.
- `handoff` reads and writes `STATUS.md` from explicit user/AI fields.
- `tests` exercise public CLI behavior through temporary projects, not just internal functions.

## Data Flow
User command -> `src/cli.ts` -> command handler -> filesystem reads/writes under cwd -> text or JSON report. For `init`, package scripts are scanned only as deterministic signals for `VERIFY.md`; project semantics stay in AI/user-written markdown.

## State / Storage
- Project memory: `.context/`
- Host entrypoints: `AGENTS.md`, `CLAUDE.md`
- Build output: `dist/`
- Dependency lock: `pnpm-lock.yaml`

## External Integrations
None in v0.1. The CLI is local-only and has no telemetry, no cloud account, no model API, and no daemon.

## Risk Areas
- Accidentally letting CLI generate trusted project semantics.
- Over-expanding templates until `.context` becomes noisy.
- `verify` producing too many warnings and making users ignore it.
- Future `cp`/delete behavior must preserve data and avoid irreversible deletion.
- Host hooks must remind only; they must not write canonical memory.

## Verification Summary
Run `pnpm test`, `pnpm typecheck`, and `pnpm build` before claiming implementation status. For CLI behavior, prefer integration tests that spawn `tsx src/cli.ts` in temporary project directories.

## Handoff Notes
Current implementation covers M1 and M2. Next work should add M3 commands with tests first: `cp` line-block operations, `finish` report, `log add`, and `idea add`.
