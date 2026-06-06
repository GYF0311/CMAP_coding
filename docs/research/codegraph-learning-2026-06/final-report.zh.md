# CodeGraph 中文学习报告

Date: 2026-06-04
Workspace: `/Users/gaoyifan/Desktop/CMAP_coding`
Audience: 非技术背景读者

## 一句话结论

CodeGraph 是一个“源码取证引擎”：它提前把代码库整理成一张本地图，让 AI agent 少翻文件、少猜路径，更快回答“谁调用谁、改这里会影响谁、这个功能入口在哪里”。

但它不是 CMAP 的替代品。CodeGraph 解决“怎么更快理解源码结构”；CMAP 解决“怎么让 AI 边工作边维护项目模块说明”：这个模块做什么、和哪些模块有关、改动后要怎么验证。这样下一个 AI 不用先读几百行代码，也能快速知道模块大意。

## 它像什么

如果一个代码库是一栋大楼：

- 普通 agent 是一间间开门找路。
- CodeGraph 是提前做好楼层图、门牌表、电线水管图。
- CMAP 是项目档案室，记录每个房间当前是做什么的、和哪些房间连着、维修后要怎么检查；这些记录通常就是 AI 边改代码边更新的模块说明。

所以 CodeGraph 很适合帮 agent 快速找路，但不能自动决定“这栋楼的正式说明书要怎么改”。

## CMAP 到底负责什么

CMAP 的 `.context` 不是普通日志，也不是自动生成的源码图。它更像一份给 AI 接力用的“模块说明书”。

它要回答的问题是：

- 这个模块负责什么？
- 它不负责什么？
- 它和哪些模块有关系？
- 改这个模块通常要看哪些文件？
- 改完应该跑什么验证？
- 当前任务交接到哪里了？

这份说明可以由 AI 辅助写，而且现实上经常就是 AI 边改代码边更新。重点不是“AI 写的就可信”，而是：它必须写在固定位置、结构清楚、能被 diff、能被 verify、能被人或后续 agent 纠正。

## 它解决的问题

AI agent 做代码任务时，最耗成本的部分常常不是写代码，而是找代码：

- 先 `grep` 搜很多关键词。
- 再打开许多文件。
- 再猜哪个函数、类、页面、接口才相关。
- 大项目里这些步骤会消耗大量 token 和时间。

CodeGraph 的做法是：先在本机给项目建立一个索引。之后 agent 不从零翻文件，而是先问索引。

## 它有什么功能

| 功能 | 白话解释 |
|---|---|
| 建立源码索引 | 把项目里的文件、函数、类、方法、调用关系整理进本地数据库 |
| 搜 symbol | 找某个函数、类、组件、方法在哪里 |
| 查 callers | 看“谁调用了这个函数” |
| 查 callees | 看“这个函数又调用了谁” |
| impact analysis | 估算“改这里可能影响哪些代码” |
| context | 根据任务描述，给 agent 一小包最相关的代码上下文 |
| trace | 看两个代码点之间的调用路径 |
| affected tests | 根据改动文件推测应该跑哪些测试 |
| status / freshness | 告诉用户索引是否新鲜，有没有落后于真实文件 |
| MCP tools | 让 Claude Code、Codex、Cursor 等 agent 直接调用这些能力 |

## 它会产生什么产物

最核心的产物是项目里的 `.codegraph/` 目录。

里面最重要的是：

- `.codegraph/codegraph.db`

这是一个本地 SQLite 数据库。可以把它理解成一张“代码地图数据库”。

数据库里主要有：

- `files`：项目里有哪些源码文件，以及它们是否变过。
- `nodes`：代码里的“点”，比如文件、函数、类、方法、变量。
- `edges`：代码里的“关系”，比如 A 调用了 B，文件 X 导入了文件 Y。
- `unresolved_refs`：暂时没解析清楚的引用，表示“我看见了这个名字，但还不确定它指向谁”。
- FTS 搜索索引：用于快速按名字搜索代码元素。

对用户来说，产物还包括：

- 命令行报告，比如 `status`、`query`、`impact` 的输出。
- 给 AI agent 的 Markdown/JSON 上下文包。
- MCP 工具返回的结构化答案，比如相关代码片段、调用路径、stale warning。

## 它的技术栈

用很简单的话说，CodeGraph 是一个本地 TypeScript/Node 工具。

| 技术 | 它负责什么 |
|---|---|
| TypeScript / Node.js | 主程序和 CLI |
| commander | 做命令行命令，比如 `codegraph index` |
| tree-sitter / WASM grammar | 解析不同语言的源码结构 |
| SQLite | 本地保存代码图谱 |
| FTS5 | 在 SQLite 里做快速全文搜索 |
| chokidar | 监听文件变化，自动更新索引 |
| MCP | 给 AI agent 暴露工具接口 |
| ignore / git ls-files | 决定哪些文件该被索引，避开 `node_modules`、`dist` 等噪音 |

它支持很多语言，不只 TypeScript。比如 JavaScript、Python、Go、Rust、Java、C#、PHP、Ruby、Swift、Kotlin、Dart 等。

## 它内部怎么工作

可以理解成 6 步：

```text
1. 扫描项目文件
2. 判断每个文件是什么语言
3. 用 parser 把源码拆成函数、类、方法等结构
4. 把这些结构存成 nodes
5. 把调用、导入、继承等关系存成 edges
6. agent 查询时，只取相关的一小圈关系和代码片段
```

它还有一层“新鲜度检查”：

```text
文件变了
  -> watcher 发现
  -> sync 更新索引
  -> 如果还没更新完，结果里提示 stale
  -> agent 知道要直接读那个具体文件
```

这个设计重要，因为旧索引给出的答案可能看起来很精确，但其实已经过期。

## 它真正强在哪里

1. 它把“找代码”变成了产品能力  
   不是让 agent 自己乱搜，而是给 agent 一套固定问题入口。

2. 它很适合大代码库  
   大项目里文件多，直接 grep/read 成本高。预索引后，agent 可以先查图。

3. 它本地运行  
   代码不用上传云端，数据存在本机 `.codegraph/`。

4. 它不只是搜索  
   它能回答关系问题：谁调用谁、改哪里影响哪里。

5. 它知道索引可能过期  
   这点很重要。它不是盲目相信自己的数据库，而是会显示 stale / pending / worktree mismatch 等提醒。

## 它的局限

1. 静态分析不等于真实运行  
   它看源码关系，但不一定能看懂运行时动态行为，比如反射、依赖注入、框架魔法。

2. impact 只是候选影响面  
   它能提示“可能影响这些地方”，但不能替代测试、类型检查和人工 review。

3. 多语言支持很重  
   支持越多语言，维护 parser 和框架规则越复杂。

4. 索引可能过期  
   它做了很多 freshness 保护，但仍需要 sync、watcher 或用户确认。

5. 它不负责写模块说明  
   它知道“谁调用谁”，但不知道“这个模块应该怎样向下一个 AI 解释”“改完后项目说明要怎么更新”。

## 对 CMAP 的启发

CMAP 应该学习 CodeGraph 的优点，但不能变成 CodeGraph 克隆。

| CodeGraph 强项 | CMAP 可以怎么学 |
|---|---|
| 本地 source index | 做一个窄版 TS/JS source index |
| symbol / callers / callees | 增加 `symbol find/callers/callees` |
| impact analysis | 增加 `impact file`，帮助判断改动影响面 |
| freshness warning | 每条 source evidence 都显示是否新鲜 |
| MCP/CLI 问题型入口 | 先 CLI 稳定，再考虑 MCP |
| context pack | 给 `brief` 增加可选 source evidence 区块 |

最重要的是：CMAP 的输出必须清楚区分层级：

```text
这是 generated evidence
不是 canonical truth
不能自动写进 .context

进入 .context 的内容也不是天然正确
它只是当前被接受的项目记忆
必须能被 diff、verify、review、rollback
```

## CMAP 不应该学什么

- 不要复制 CodeGraph 源码、schema 文案、MCP instructions。
- 不要照搬“trust CodeGraph, do not grep”的信任姿态。
- 不要一开始就做全语言、多框架、daemon、watcher、全局 installer。
- 不要让源码图自动改 `.context/MAP.md` 或模块文档。
- 不要把旧 import graph、route v2、pack v2 换个名字复活。

## 推荐学习路线

对 CMAP 来说，最合理的吸收路线是：

```text
P0:
  TS/JS source index
  source status
  symbol find
  impact file
  freshness warning

P1:
  callers / callees
  source-aware brief
  Review HTML source evidence panel

P2:
  MCP wrapper
  watcher / sync
  multi-language
  richer trace / explore
```

## 最终判断

CodeGraph 值得认真学，因为它把 AI coding 里很痛的一件事产品化了：让 agent 更快找到相关代码。

但 CMAP 的核心优势不是“比它更会解析源码”，而是“更适合作为 AI 接力用的模块说明层”：AI 边改代码边更新 `.context`，把模块职责、关系和验证方式留下来，让下一轮工作不用重新读完整源码。

最好的组合是：

```text
CodeGraph-style source intelligence
  负责找源码证据

CMAP context
  负责沉淀模块说明
  让 AI 知道模块做什么、跟谁有关、怎么验证
  同时保留 diff / verify / review / rollback 纪律
```

换句话说：CodeGraph 帮 agent 少迷路；CMAP 帮 agent 接着干活，不用每次都从 300 行代码里重新猜模块是干什么的。
