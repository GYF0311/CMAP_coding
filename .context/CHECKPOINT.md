---
context_type: checkpoint
status: active
updated_at: '2026-06-04T14:29:46.437Z'
source: manual
---
# Current Checkpoint

## Current Task
删除重复源码事实层，把 CMAP 收回为轻量中文项目记忆

## Current Hypothesis
CMAP 不应该和 CodeGraph 竞争 import、调用关系、符号、影响分析这些源码事实。CodeGraph 负责源码事实；CMAP 负责耐用的人类可读记忆：中文模块解释、交接、当前状态、重要决策、被否掉的方案、临时想法、更新日志和验证记录。

## Changed Files
- `.context/MAP.md`
- `.context/STATUS.md`
- `.context/CHECKPOINT.md`
- `.context/modules/*.md`
- `src/cli.ts`
- `src/commands/brief.ts`
- `src/commands/benchmark.ts`
- `src/view/*`
- `src/skill/templates.ts`

## Verified
- 2026-06-07：`pnpm typecheck` 通过。
- 2026-06-07：`pnpm test tests/integration/m19-view-export.test.ts tests/integration/m6-brief-obsidian.test.ts tests/integration/m12-route-benchmark-context.test.ts tests/integration/m15-ci-benchmark.test.ts tests/integration/m28-skill-bootstrap.test.ts tests/integration/m1.test.ts` 通过 6 个文件 / 36 个测试。
- 2026-06-07：`pnpm build` 通过。
- 2026-06-07：`pnpm dev view export --ui-lang zh-CN --out _cmap-view` 成功，并已在 Codex 内部浏览器通过 `http://127.0.0.1:5174/` 打开。
- 2026-06-07：`pnpm dev view export --ui-lang zh-CN --check --out _cmap-view` 通过。
- 2026-06-07：`pnpm dev verify --changed` 退出码 0，有 70 条 changed-file mapping warning，主要来自删除旧源码事实层文件和规划文档。
- 2026-06-07：`git diff --check` 通过。

## Failed / Pending
- 模块详情里的旧模块文档正文仍有英文历史内容；首页概览和模块卡片已优先显示中文。后续可以按模块逐步中文化 `.context/modules/*.md` 正文。

## Next Step
后续沿用这个分层：CodeGraph 找源码证据；CMAP 记录 AI 维护的模块解释和项目记忆，让后续 agent 不从零开始。如果代码变化影响了耐用的模块目的、依赖、数据流或验证路径，就用中文正文更新 CMAP。

## Do Not Redo
不要重新建设 CMAP 自己的源码图谱、import graph、source benchmark 或 UA 风格知识图谱 dashboard，除非后续有新的明确计划覆盖当前方向。
