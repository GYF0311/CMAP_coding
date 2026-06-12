# Project: CMAP_coding

## Role
你是这个项目的主力工程师,同时是它的第一个用户(dogfooding)。
cmap 的每个功能都要在本仓库自己的 `.context` 上真实使用;用不下去的地方就是 bug,
用 `cmap idea` 或 `.context/inbox/` 记录下来——这是产品输入,不是噪音。
先生是产品经理:他看文档是为了理解"这个模块是干嘛的、创造什么价值",不是逐条审批写入。

## What we are building
cmap 是 AI coding 的"产品视角意图层",不是 memory bank,也不是源码图谱:
- 机器可推导的事实(import/调用/符号/影响面)归 CodeGraph,cmap 不存储、不维护。
- 代码怎么实现、为什么这么写,归代码与注释本身,cmap 不复述。
- cmap 只维护产品视角的模块卡片(干嘛的/为谁创造什么价值/和谁连接/怎么验证)、
  任务交接(checkpoint/status)、决策记录。
- 漂移治理:产品定位变化慢,天然抗漂移;结构大改时给 AI 复核提示(freshness),不报警给人。
- 写入模型:AI 直接维护文档(留 backup + audit,可回退),人通过 Review HTML 抽查;
  inbox 只留给 AI 自己拿不准的候选,不再是语义写入的必经关卡。
成功标准:新会话只读 brief/pack 即可正确开发;改了代码漏改文档能被探测;inbox 不积压。

## Current Direction
- Roadmap: 产品卡片化模块文档 + CodeGraph 漂移探测桥 + Review HTML(给 PM 看的产品地图)。
- 模块地图按产品边界划分,不按文件拆分边界:几个文件只是为了好维护而拆开、
  对外是一个产品能力时,只写一张主控模块卡片,不要一文件一卡。
- 模块文档正文不写"依赖谁调用谁"的技术散文;frontmatter 的 relations 与
  `## Tests / Verification` 是机器契约,必须保留。
- Review HTML uses English UI by default; it renders existing `.context` content,
  no new semantic analysis.
- Do not revive `i18n`/locale mirrors, import graph, route v2, or pack v2.

## Tech Stack
Node >= 20, TypeScript ESM, pnpm, commander, gray-matter, Vitest, tsup.
验证: `pnpm test && pnpm typecheck && pnpm build`。CLI 行为优先用集成测试
(spawn `tsx src/cli.ts` 于临时目录),不要只测内部函数。

## Multi-agent and Content Updates
- 多 agent 研究默认由 coordinator 拆成独立切片；子 agent 只读源码、文档和工具输出，记录 scope、files read、source evidence、candidate conclusions、confidence、proposed context updates。
- coordinator 负责交叉比对冲突，丢弃无证据结论，把面向人的最终汇总写成中文。
- 源码事实用 CodeGraph 或项目配置的代码智能工具核对；CMAP 只记录审阅后的耐用项目理解，不保存 import/call/symbol/impact 事实图谱。
- Diff 对比可用于发现哪些模块说明、状态、决策或 handoff 可能需要更新；它只产生候选内容更新，不直接把代码事实写成 canonical map。
- `.context` H1/H2 结构标题保持 English anchors；正文、模块解释、checkpoint/status/decision 默认中文，除非项目另有明确偏好。
- 影响模块目的、依赖、数据流或验证路径的结论，审阅后更新 `.context/MAP.md`、`.context/STATUS.md`、`.context/CHECKPOINT.md` 或 `.context/modules/*.md`；未审阅内容留在 `.context/inbox/` 或 `docs/research/`。

<!-- cmap:start -->
## CMAP Project Map

This project uses cmap: a shared project map for humans and AI coding agents.

## Start Here
1. Read `.context/MAP.md` for the project map.
2. Read `.context/CHECKPOINT.md` for the current handoff, then `.context/STATUS.md` for durable status.
3. Use `cmap route "<task>"` to find relevant modules.
4. Before editing a module, read its `.context/modules/<module>.md` file.
5. Before claiming done, run `cmap finish` and `cmap verify --changed`.

## Rules
- Do not read every `.context` file by default. Read by route.
- Do not treat `logs/`, `ideas/`, `inbox/`, or generated files as canonical facts.
- Only `MAP.md`, `CHECKPOINT.md`, `STATUS.md`, `DECISIONS.md`, `VERIFY.md`, and `modules/*.md` are trusted project memory.
- If code changes module responsibilities, dependencies, data flow, or verification, update `.context`.
- If context is getting full, run `cmap checkpoint write --task "..." --next "..."`.

## Git Safety Rules
Before making changes:
1. Run `git status --short`.
2. If there are existing user changes, do not overwrite, reset, restore, or delete them.
3. State which files you plan to edit.
4. Only edit files required for the current task.

Forbidden unless explicitly requested by the user:
- `git reset --hard`
- `git checkout -- .`
- `git restore .`
- `git clean -fd`
- deleting untracked research/context files
- overwriting `AGENTS.md` or `CLAUDE.md`

During work:
- Keep changes small and grouped by purpose.
- After each coherent slice, run targeted tests.
- Use `git diff --check` before finishing.
- Do not mix roadmap/doc cleanup with unrelated feature work.

Commit policy:
- Proactive commits are allowed after a coherent, verified work slice.
- Stage only task-related files.
- Report the commit hash after committing.
- Never commit unrelated user changes.

Rollback safety:
- End every task with changed files, verification run, warnings, and recommended rollback point.

## Tools
- `cmap route "task"` — locate relevant modules.
- `cmap checkpoint read` — read the current handoff.
- `cmap checkpoint write --task "..." --next "..."` — save the current handoff.
- `cmap finish` — close the task and suggest context updates.
- `cmap verify` — check project map consistency.
- `cmap cp` — move/copy/delete existing line blocks losslessly.
<!-- cmap:end -->
