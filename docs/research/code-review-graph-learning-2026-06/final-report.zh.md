# Code Review Graph 中文学习报告

Date: 2026-06-04
Workspace: `/Users/gaoyifan/Desktop/CMAP_coding`
Audience: 非技术背景读者

## 一句话结论

Code Review Graph 是一个“代码审查影响评估员”。

它先把代码库做成本地图谱，然后在你改代码或准备 PR 时，告诉 AI 和人：

- 这次改了哪些文件和函数？
- 这些改动可能影响谁？
- 哪些地方更值得重点 review？
- 有没有测试缺口？
- AI 最少需要读哪些代码？

它和 CodeGraph 相似，都做源码图谱；但 CodeGraph 更像“城市地图”，Code Review Graph 更像“施工前影响评估报告”。

## 它像什么

如果代码库是一座城市：

- CodeGraph 是城市地图：帮你找路，知道哪个函数在哪里，谁连接谁。
- Code Review Graph 是施工影响评估员：你要改一条路，它告诉你会影响哪些街区、哪些管线、哪些测试和检查要看。
- CMAP 是项目交接档案：记录哪些模块解释、项目状态、验证方式已经被人审过，可以给未来 AI 接着用。

所以 Code Review Graph 适合回答：“这次改动该看哪里？”  
CMAP 更适合回答：“这个项目应该怎样被未来 agent 理解和交接？”

## 它解决的问题

AI 做代码审查时常见两个问题：

1. 读太多无关代码  
   大仓库里，AI 可能为了 review 一个小改动，反复搜索、打开很多文件，浪费 token。

2. 看不清影响范围  
   改了一个函数，不一定只影响这个文件。它可能被很多地方调用，也可能影响测试、流程、依赖关系。

Code Review Graph 的方案是：先建立本地源码图谱，审查时从 diff 出发，只拿和这次改动最相关的一小圈证据。

## 它有什么功能

| 功能 | 白话解释 |
|---|---|
| build / update / watch | 建立和更新本地源码图谱 |
| detect-changes | 分析当前改动，给出风险和审查重点 |
| review-delta | 审查最近一次改动 |
| review-pr | 审查一整个 PR 或分支差异 |
| blast radius | 看一个改动可能波及哪些代码 |
| minimal context | 给 AI 一份最小审查材料，不塞全仓 |
| test gaps | 提示可能缺少测试覆盖的地方 |
| token savings panel | 估算相比直接读文件节省了多少上下文 |
| callers / callees | 查谁调用了它、它调用了谁 |
| imports / importers | 查文件或模块之间的导入关系 |
| architecture overview | 生成架构概览和耦合提示 |
| visualization | 输出可交互图谱或导出 GraphML/SVG/Obsidian |
| VS Code extension | 在编辑器里看图谱、影响面、调用关系和审查结果 |

## 它会产生什么产物

最核心产物：

- `.code-review-graph/graph.db`

这是本地 SQLite 数据库，可以理解成“源码关系数据库”。

里面主要保存：

- `nodes`：代码里的点，比如文件、类、函数、测试、类型。
- `edges`：代码里的关系，比如调用、导入、继承、测试覆盖。
- `metadata`：图谱状态和版本信息。
- FTS 搜索索引：快速搜索函数名、路径、签名。

其他产物包括：

- review context：给 AI 的最小审查包。
- impact radius：改动影响面报告。
- risk panel：风险提示。
- test gaps：测试缺口提示。
- token savings panel：上下文节省估算。
- 可视化图：HTML/D3、GraphML、SVG。
- Obsidian / Cypher / wiki 导出。
- MCP config、hooks、skills、slash commands。
- VS Code 里的图谱树和审查视图。

## 它内部怎么工作

审查流程可以这样理解：

```text
git diff / PR diff
  -> 找到改了哪些文件
  -> 找到每个文件改了哪些行
  -> 映射到改了哪些函数/类/测试
  -> 沿着调用、导入、继承、测试关系找影响半径
  -> 生成风险和测试缺口
  -> 给 AI 一个最小 review context
```

它不是把整个仓库塞给 AI，而是先问：

> 这次改动最相关的代码是哪一小块？

然后只把那部分交给 AI。

## 技术栈

| 技术 | 它负责什么 |
|---|---|
| Python 3.10+ | 主程序 |
| Tree-sitter | 解析多种编程语言的源码结构 |
| SQLite | 本地保存源码图谱 |
| FTS5 | 在 SQLite 里做全文搜索 |
| NetworkX | 部分图分析和缓存 |
| FastMCP / MCP | 给 AI 工具暴露图谱能力 |
| watchdog | 监听文件变化，支持 watch mode |
| Jedi | 可选，用来补强 Python 引用解析 |
| sentence-transformers / Gemini / OpenAI-compatible embeddings | 可选，用于语义搜索 |
| D3.js | 生成交互式可视化图谱 |
| VS Code extension | 编辑器里的图谱和审查体验 |

## 它真正强在哪里

### 1. 它把 review 做成一条清楚流程

不是只说“这里有源码图”，而是直接回答：

- 这次改了什么？
- 谁会受影响？
- 哪些测试相关？
- 哪些地方更危险？
- AI 应该读哪几段？

### 2. 它的 impact radius 很适合审查

Impact radius 可以理解为“影响半径”。

比如你改了 `login()`，它会顺着图谱查：

- 谁调用 `login()`？
- 哪些文件依赖它？
- 哪些测试覆盖它？
- 哪些流程可能经过它？

这比单纯搜索 `login` 更接近审查时真正想知道的问题。

### 3. 它有 minimal context first 思路

它不是一开始给 AI 巨量文件，而是先给一张小路线卡：

```text
这几个文件变了
这些函数受影响
这些测试可能相关
这几个地方风险更高
```

AI 如果不够，再继续展开。

### 4. 它会显示 token savings

它会估算：如果直接读改动文件或全仓，需要多少 token；现在通过图谱只返回审查包，大概省了多少。

但这个数字要谨慎看。它是估算，不是绝对事实。

### 5. 它有保守影响分析

本地研究里看到一个重要特征：它倾向于“宁可多报，不要漏报”。

这适合审查。因为漏掉一个受影响文件比多看几个文件更危险。

## 需要注意的局限

### 1. Token saving 不是所有场景都成立

全仓问答时，图谱通常很省 token，因为它避免读整个仓库。

但小 diff 审查时，结构化图谱响应可能比直接读一两个小文件还大。

所以不能简单说“它总是省 token”。更准确是：

> 它在大仓库理解和复杂改动审查上更容易省；小改动未必省。

### 2. Risk score 不是 bug 概率

风险分数是启发式规则：

- 调用者多不多？
- 参与关键流程吗？
- 有没有测试？
- 名字里有没有 security/auth/token 等敏感词？

这能帮排序，但不能当作客观真相。

### 3. Test gap 不是“真的没测试”

它看到图里没有 `TESTED_BY` 关系，就可能提示测试缺口。

但也可能是 parser 没解析到测试关系。因此它应该叫“测试缺口证据”，不是最终裁决。

### 4. 图谱必须保持新鲜

如果代码变了但图谱没更新，审查结果可能不准。

`update --brief` 会先更新再分析；`detect-changes --brief` 更像直接读现有图，需要注意是否 stale。

### 5. 它的能力面很宽

它有 daemon、watch、memory、wiki、refactor、embeddings、communities、flows、VS Code extension 等很多能力。

这些能力强，但也会增加复杂度。对 CMAP 来说，不能一口气全学。

## 和 CodeGraph 的区别

| 维度 | CodeGraph | Code Review Graph |
|---|---|---|
| 核心气质 | 通用源码地图 | 代码审查助手 |
| 主要问题 | agent 怎么更快找代码 | 这次改动影响谁、该看哪里 |
| 典型入口 | context / trace / explore / callers / impact | detect-changes / review-delta / review-pr |
| 重点输出 | 源码上下文、路径、调用关系 | review context、风险、测试缺口、token savings |
| 比喻 | 城市地图 | 施工影响评估员 |

## 对 CMAP 的启发

CMAP 可以学它的“审查证据报告”形态。

推荐吸收：

```text
SourceImpactReport:
  changed files
  diff ranges
  changed symbols
  impacted files / symbols
  likely tests
  risk factors
  context savings
  freshness
  confidence
  truncated
```

白话说：CMAP 可以生成一张“这次改动影响分析小报告”，放进 brief 或 Review HTML。

但它必须是：

```text
generated source evidence
不是 canonical project truth
```

也就是：它可以帮助未来 agent 少读源码，但不能自动改 `.context/MAP.md` 或模块说明。

## CMAP 应该学什么

- diff-to-symbol：从改动行找到被改的函数/类。
- impact radius：沿代码关系找影响面。
- minimal context：先给小审查包，不塞全仓。
- likely tests：提示相关测试。
- confidence/provenance：每条证据要能回查来源。
- context-saving benchmark：用数据判断有没有真的省。
- truncation / freshness：告诉用户结果是否截断、索引是否新鲜。

## CMAP 不应该直接学什么

- memory loop：把 AI 问答写成 Markdown 再入库，容易把生成回答伪装成已审知识。
- auto wiki：自动生成架构文档，容易变成第二套事实源。
- 默认 daemon/watch/global hooks：后台持续变化，用户不容易知道证据是不是 fresh。
- 大 MCP/skills 工具体系：会压过 CMAP 的 route/checkpoint/module-doc 入口。
- refactor apply：这是源码写入工具，不应混进 CMAP 的项目记忆层。
- risk score canonicalization：风险分数不能变成正式项目事实。
- 全语言 parser / embeddings / community detection / flow tracing 作为 MVP：太宽。

## 推荐吸收路线

```text
P0:
  impact file
  changed files -> changed symbols
  freshness / truncated 标记
  likely tests
  Review HTML source evidence panel

P1:
  context savings benchmark
  callers / callees / imports / importers
  source-aware brief

P2:
  diff impact
  MCP wrapper
  optional watch/sync
  richer flow/risk analysis
```

## 最终判断

Code Review Graph 值得学，因为它把“审查一次改动时，AI 到底该看哪些代码”这个问题讲得很具体。

但 CMAP 不应该变成 Code Review Graph。CMAP 当前更应该做的是：

```text
Code Review Graph-style impact evidence
  负责告诉 agent 这次改动可能影响哪里

CMAP handoff/module explanation layer
  负责把经过审阅的模块解释、项目状态和验证方式留给未来 agent
```

一句话收束：

> Code Review Graph 帮 AI 少看无关代码；CMAP 决定哪些理解可以成为下一次交接的正式上下文。
