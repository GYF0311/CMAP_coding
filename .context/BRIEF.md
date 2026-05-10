---
cmap_version: 0.1
context_type: brief
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T09:44:43.433Z
confidence: ai-drafted
---
# Project Brief

## One-liner
cmap 是给人和 AI 共用的 repo-local 项目小地图与公共记忆层，用 TypeScript CLI 维护 `.context/` 骨架、路由、校验、续接和收尾。

## Target Users
- AI coding 小白：需要项目地图帮自己理解项目结构。
- AI coding power user：需要跨宿主、跨会话保持项目连续性。
- 已有项目维护者：需要用 `adopt` 建立接管工作台，再由 AI 补全可信地图。

## Core Use Cases
- `cmap init --auto` 为新项目创建 `.context` 骨架。
- `cmap route "<task>"` 根据已有地图推荐先读哪些模块文档。
- `cmap checkpoint` 保存当前主线，帮助上下文压缩或新会话续接。
- `cmap verify` 做确定性结构检查，发现地图漂移和模板残留。
- `cmap install --host both` 生成短入口，让 Codex/Claude 先读项目地图。

## MVP Scope
v0.1 先完成本地 TypeScript CLI：init、adopt、install、route、status、checkpoint、verify、finish、add-module、cp、log add、idea add、hooks reminder/maintain skeleton。

## Non-goals
- 不做 AI coding 全家桶。
- 不内置 RAG、vector DB、MCP server、云端账户或 telemetry。
- 不让 CLI 自动生成项目语义、模块职责、业务决策或可信设计结论。
- 不让 hook 自动写正式项目记忆。
- 不替代 git、CI、测试框架或 issue tracker。

## Product Constraints
- CLI 只做确定性文件动作、结构检查、模板生成、关键词路由和格式校验。
- 项目语义由 AI 或用户写入 `.context`，并可被审阅。
- `.context` 使用 Markdown + frontmatter，默认可进 git。
- 日志、灵感、pending 不是 canonical facts。
- 删除和搬运必须可恢复；涉及删除优先走备份或系统 Trash 语义。

## Current Stage
M1/M2 已开始实现：TS CLI、Vitest、`version`、`init --auto`、`verify`、`install --host both`、`route`、`status`、`checkpoint`。下一阶段是 M3：`cp`、`finish`、`log add`、`idea add`。

## Notes for AI
先读 `MAP.md` 和 `STATUS.md`，再按任务用模块文档缩小读取范围。不要为了赶进度把 v0.2 能力塞进 v0.1，也不要让 CLI 代替 AI 编造项目事实。
