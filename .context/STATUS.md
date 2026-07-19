---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-07-19T17:35:00+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
让 CMAP 保持在它真正有价值的位置：AI 交接和模块解释层。agent 写代码时同步更新 `.context`，让后续 agent 能快速理解模块职责、相关模块、关键文件、当前交接状态和验证路径，而不是重新读大量源码。

Trust Boundary + Human Review Layer 继续作为 AI 写入上下文的安全纪律：生成证据、候选内容、已接受的模块解释必须分层；`.context` 更新要能看 diff、能验证、能审阅、能回退。当前路线是：CMAP 负责中文项目记忆和交接，CodeGraph 负责源码事实查询。

## Done Recently
Issue #4 已在 0.3.2 修复：`finish --compact` 对 changed modules、unmapped paths 和单项长度设定稳定上限，完整细节仍可通过普通 `cmap finish` 或 MapPatch artifact 获取；`cmap codex finish` 默认使用 compact renderer，并只推荐聚合的 `cmap codex guard --changed`，guard 默认汇总 changed/stale/freshness/inbox，`--verbose` 保留完整报告。普通 `cmap route` 现在是 telemetry read-only，只有显式 `--record-usage` 或 assist prompt hook 才记录 usage stats。成功的 Codex `PostToolUse` 继续落 session journal，但不再返回 `additionalContext`。生成的 AI host/skill 说明统一使用 `cmap finish --compact`。

`cmap install` 默认使用 `<!-- cmap:start -->` / `<!-- cmap:end -->` 标记块合并，保留 `AGENTS.md` / `CLAUDE.md` 中 CMAP 块外的原有规则。`--mode print` 只预览不写入，`--force` 是明确的全量覆盖逃生口，`--backup` 会把旧入口保存到 `.context/backups/install-*`。

`cmap skill export` 会把项目本地说明包写到 `.cmap/skills/cmap/`，并支持 `--check` 检测是否过期。`cmap bootstrap` 默认仍不会凭空创建 `.context`；新项目需要显式使用 `cmap bootstrap --init --host both --skill`，先创建骨架，再执行非破坏式入口安装、可选 skill 导出和 `.context/out/start-here.md` 生成。

CMAP 已从重复源码事实层的方向收回。import、谁调用谁、符号、影响分析等源码级事实交给 CodeGraph 或专门的代码智能工具；CMAP 保留更轻的耐用记忆层：中文模块解释、交接、决策、状态、更新日志和验证记录。

`AGENTS.md` and `CLAUDE.md` were dogfooded through non-destructive install, so the original project rules are preserved and the new cmap marker block includes Git Safety Rules.

The project commit policy now allows proactive commits after coherent, verified work slices. Agents must still inspect `git status --short`, stage only task-related files, avoid unrelated user changes, and report the commit hash.

Entrypoint docs were deduplicated after marker merge: root-level project direction remains outside the cmap block, while Start Here, Git Safety Rules, Tools, and command policy live inside the generated block.

Legacy warning directories were retired safely: empty `.context/pending` and superseded `.context/stats` no longer make `verify` warn; old route stats were preserved under generated stats legacy storage instead of being deleted.

Freshness/stale review was manually converged for current active modules and then marked with `cmap freshness mark-reviewed`; `verify --stale` and `verify --freshness` are clean.

Core module `relation_explanations` now explain why relations exist, what they produce, and what changes may impact across route, view, evidence, update-agent, and hooks-doctor.

Low-confidence `cmap route` output now suggests source inspection and can write a candidate-only `module.alias.request` via `--write-alias-candidate` without inventing a module.

Review HTML module details now include responsibilities, incoming relations, relation explanations, module-owned verification commands, and related candidates from existing `.context` data only.

Review HTML now supports a presentation-only Chinese UI shell via `view export --ui-lang zh-CN`, parses legacy Chinese module headings such as `职责` / `关键契约` / `读什么`, surfaces canonical context files, and renders module Details as structured Markdown sections instead of raw JSON. The project writing contract is now explicit: canonical `.context` section headings should stay English anchors, while this local project's body prose should be Chinese by default.

`cmap verify` now enforces that writing contract as a warning layer: it scans canonical `.context` files and module docs for non-English H1/H2 structural headings, reports exact file/title references, and emits a batch dry-run rewrite suggestion when many heading anchors need normalization.

Unified candidate-store producers now cover MapPatch/update, low-confidence route alias requests, reconcile, and Obsidian pull under `.context/inbox/candidates/*.json|md`; relation candidates remain under `.context/inbox/relations/*.json|md`; legacy top-level inbox reports remain readable.

`cmap finish` now reminds users to refresh generated graph, Review HTML, and Obsidian layers when canonical `.context` files changed. Source-only changes do not show this reminder.

`cmap freshness mark-reviewed` now prints that it only updates `.context/generated/freshness.json`, not canonical module docs. Freshness snapshot and mark-reviewed writes now use `.context/generated/freshness.json.lock` plus atomic temp-file rename to avoid concurrent last-write-wins and partial JSON corruption.

## Left Off
重复源码事实层已删除并委托给 CodeGraph；UA/Graphify 相关项目产物已移入回收站；Review HTML 已重新导出并在 Codex 内部浏览器打开。首页概览和模块卡片现在优先显示中文正文，模块详情里的旧模块文档还需要后续逐步中文化。

## Next Steps
1. 后续按模块逐步中文化 `.context/modules/*.md` 正文。
2. 继续学习 UA 的 diff/change detection 思路，但不要恢复 UA dashboard 或 CMAP 自建源码图谱。
3. 代码变更影响耐用模块目的、依赖、数据流或验证路径时，用中文更新 CMAP。

## Changed Files
- Issue #4 / 0.3.2：`src/commands/finish.ts`, `src/commands/codex.ts`, `src/commands/route.ts`, `src/commands/hooks.ts`, `src/cli.ts`, host/skill templates, CLI integration tests, README, package metadata, and routed CMAP module docs.
- Entrypoint/onboarding: `AGENTS.md`, `CLAUDE.md`, `README.md`, `src/commands/install.ts`, `src/commands/skill.ts`, `src/commands/bootstrap.ts`, `src/host/*`, `src/skill/*`, install/skill tests.
- Bootstrap/version slice: `package.json`, `src/cli.ts`, `src/commands/bootstrap.ts`, `tests/integration/m1.test.ts`, `tests/integration/m28-skill-bootstrap.test.ts`, `README.md`, `.context/MAP.md`, `.context/VERIFY.md`, and related module docs.
- Cleanup/review docs: `.context/CHECKPOINT.md`, `.context/STATUS.md`, `.context/modules/*.md`, `.context/graph/*.json`.
- Route/candidate store: `src/commands/route.ts`, `src/core/candidate-store.ts`, `src/commands/inbox.ts`, route/candidate tests.
- Review HTML: `src/view/*`, `tests/integration/m19-view-export.test.ts`, `tests/integration/m25-view-structured-candidates.test.ts`.
- Review HTML localized UI / context rendering: `src/view/*`, `src/commands/view.ts`, `src/cli.ts`, `tests/integration/m19-view-export.test.ts`, and docs/templates that teach English headings with project-language body prose.
- Verify heading policy: `src/commands/verify.ts`, `tests/integration/verify-l0.test.ts`, and docs/context describing non-English `.context` heading warnings.
- Unified producers: `src/commands/reconcile.ts`, `src/commands/obsidian.ts`, `tests/integration/m6-brief-obsidian.test.ts`.
- 源码事实层回退/委托：删除 CMAP 自建 source graph、source/symbol/impact 命令、source-aware brief/view 支持和源码事实层测试/fixture。保留 CodeGraph 作为源码事实层，保留 CMAP 作为项目记忆层。

## Risks
`_cmap-view`, `_cmap`, `.context/generated/*`, `.context/out/*`, `.cmap/skills/*` 和 `.codegraph/*` 都是生成物或忽略的本地产物，不是可信项目记忆。候选请求在被审阅前都不是 canonical。`module.alias.request` 的 `target: unresolved` 是刻意设计，需要人工或后续 agent 看过源码后再转成明确模块。Freshness lock 只是简单文件锁，过期锁会明确失败，不会自动删除。`--ui-lang zh-CN` 只本地化 Review HTML 标签，不恢复 `.context/i18n`、locale config 或翻译镜像。

## Last Verified
2026-07-19：`pnpm test` 32 个文件 / 179 个测试通过；`pnpm typecheck`、`pnpm build`、`pnpm smoke` 通过。临时仓库 107 个 dirty paths 下，compact finish 为 24 行 / 473 bytes，Codex finish 为 28 行 / 571 bytes；普通 route 前后 tracked stats SHA 不变；成功 PostToolUse 输出 55 bytes 且无 `additionalContext`；聚合 guard 摘要为 8 行 / 225 bytes。
