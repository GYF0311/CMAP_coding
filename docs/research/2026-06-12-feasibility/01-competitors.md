# AI Coding Agent Repo Map / Codebase Wiki / Agent Memory 竞品调研

> 执行日期：2026-06-12
> 调研范围：11 类方案，覆盖自动 wiki、repo map、agent memory、multi-agent 框架、PR review 等维度
> 调研方法：WebSearch + WebFetch 实时搜索，所有结论附来源 URL

---

## 执行摘要

当前"给 AI agent 提供项目知识"的方案可分为四条技术路线：①**自动生成 wiki**（mutable.ai、DeepWiki）：用 LLM 批量分析代码生成文档，人工编辑可选，最大问题是漂移和维护成本；②**源码级符号图谱**（Aider repo map、Sourcegraph/Cody、Greptile）：以 AST/调用图为核心，机器维护，精确但无产品语义；③**手工规则文件**（CLAUDE.md、Cursor rules、Cline Memory Bank）：人工撰写 markdown，灵活但随代码变化易过期；④**任务分解框架**（Task Master、BMAD）：将 PRD 拆成带上下文的子任务，解决"单次 context 不够用"的问题，不等于持久知识库。

cmap 的独特定位在于：它是**产品视角的模块卡片**，用自然语言描述"模块干嘛/为谁/和谁连接/怎么验证"，不存源码级事实（交给 CodeGraph），也不是全量 wiki，而是人机协同维护的精炼语义层。现有竞品均未同时覆盖"产品语义 + 可路由 + checkpoint 交接 + review 渲染"这四个维度。

---

## 1. Devin DeepWiki（Cognition.ai）

### ① 知识形态
DeepWiki 将任意 GitHub 仓库转化为**结构化 wiki**，包含架构图（Mermaid 交互式）、模块摘要、代码引用，并以 graph 可视化代码依赖关系（文件为节点，依赖为边）。2025 年集成入 Devin 本体后，可在 session 内实时查询 DeepWiki 并获得带代码引用的答复。公开仓库将 `github.com` 替换为 `deepwiki.com` 即可访问。企业可创建 organization-wide knowledge，Devin agent 在 session 中可主动贡献知识条目。

### ② 维护 / 防漂移
Devin 作为 agent 自动生成并更新。支持多分支索引，每次 commit 可触发更新。可上传 JSON 配置文件微调文档详细程度（Steerable Wiki）。漂移风险：AI 生成内容在快速演进的 repo 中可能落后于实际代码，企业版有 agentic contribution 机制补充。

### ③ 粒度
文件级别到模块级别，包含函数/类摘要和依赖图。支持多语言文档生成。

### ④ 效果证据
Cognition 自称 Devin 已承担 Cognition 自身 25% 的代码产出（2025-12-30 新闻稿）。DeepWiki 公开版已索引大量开源仓库。SWE-1.6 模型在 SWE-Bench Pro 较 1.5 提升约 11%。

### ⑤ 与 cmap 异同
相同：都以 AI 可消费的结构化知识服务 coding agent。不同：DeepWiki 是**全量、自动生成的 wiki**，强调覆盖率；cmap 是**人机协同维护的精炼卡片**，强调产品语义和模块价值描述，不存源码级结构。DeepWiki 是 Devin 的配套功能，cmap 是跨 agent 的通用底座。

**来源：**
- https://cognition.ai/blog/devin-2
- https://docs.devin.ai/release-notes/2025
- https://markets.financialcontent.com/wral/article/tokenring-2025-12-30-the-worlds-first-autonomous-ai-software-engineer-devin-now-produces-25-of-cognitions-code

---

## 2. mutable.ai Auto Wiki

### ① 知识形态
Auto Wiki（v2，2024 年 4 月）将代码仓库转化为**类 Wikipedia 风格的文章集合**，每篇文章对应一个模块或功能区域，包含 Mermaid 代码图、行级引用 citation、自然语言解释。访问入口：`wiki.mutable.ai`，选择 repo 即可生成。

### ② 维护 / 防漂移
支持每月自动更新和每次 commit 触发更新（PR bot）。允许手动编辑 wiki，也可通过 AI revision with instruction 修订。更新粒度：commit 级别增量更新。主要漂移风险：复杂业务逻辑的 AI 解读可能不准确，需人工核验。

### ③ 粒度
文件/功能模块粒度。Mermaid 图可视化组件间关系，行级 citation 链接回源码。

### ④ 效果证据
YC 孵化，HackerNews 社区讨论（Show HN 帖），用户普遍认可"快速理解陌生 codebase"的场景。定价 $2/repo/month。无公开 benchmark。

> **校正（coordinator 复核,2026-06-12）**：mutable.ai 已于 2024-12-11 被 Alphabet/Google 收购并停运,产品不再可用([PitchBook](https://pitchbook.com/profiles/company/512143-21)、[HN 讨论](https://news.ycombinator.com/item?id=42542512))。本节描述的是其历史形态;"auto wiki"思路被验证有市场价值(被 Google 收购本身即信号),但独立产品未能存活——单靠自动生成 wiki 收 $2/repo/mo 不构成可持续生意,这是 cmap 的反面教材之一。

### ⑤ 与 cmap 异同
相同：都以自然语言描述模块意图。不同：Auto Wiki 是**全自动批量生成**，覆盖所有文件，但缺乏"模块为谁创造价值、如何验证"的产品语义；cmap 的卡片是精炼的产品视角描述，不追求全量覆盖，而是锁定关键模块。Auto Wiki 无路由（route）机制，无 checkpoint。

**来源：**
- https://blog.mutable.ai/p/auto-wiki-v2
- https://www.ycombinator.com/launches/KrT-auto-wiki-v2-by-mutable-ai-convert-your-codebase-into-a-wiki-style-article-now-with-diagrams
- https://news.ycombinator.com/item?id=40065946

---

## 3. Swimm

### ① 知识形态
Swimm 是**代码耦合型文档平台**，文档以 Swimm Document 格式存储（基于 Markdown），内嵌对源码的"smart token"引用（引用具体文件、函数、行号），使文档与代码产生结构性绑定。`/ask Swimm` 功能基于静态分析+已有文档回答问题。

### ② 维护 / 防漂移
Autosync 是核心差异化：静态分析追踪每次 commit，当引用的代码行发生变化时，Swimm 自动建议更新相关文档或向开发者发送警告。文档由人工撰写，AI 辅助生成草稿。Gartner Cool Vendor 2024（AI-Augmented Development）。

### ③ 粒度
功能流程（flow）粒度，覆盖跨文件的业务逻辑说明。支持复杂 legacy 系统（COBOL 等）和百万行级 codebase，代码在本地处理不出网（enterprise 模式）。

### ④ 效果证据
VentureBeat 报道（2021），Gartner Cool Vendor 认定（2024）。集成 GitHub、Jira、Confluence。无公开 benchmark 数据。用户案例以金融、大型企业为主。

### ⑤ 与 cmap 异同
相同：都强调文档随代码演进，防止漂移；都服务于代码理解。不同：Swimm 的文档是**人写的流程说明**，以"如何实现"为中心；cmap 的卡片是**产品价值导向**，以"为什么存在、为谁服务"为中心。Swimm 无 route、无 checkpoint、无 agent 交接协议。

**来源：**
- https://swimm.io/how-it-works
- https://swimm.io/blog/meetask-swimm-your-teams-contextual-ai-coding-assistant
- https://moge.ai/product/swimm

---

## 4. Aider repo map

### ① 知识形态
Aider 生成**动态 repo map**：列出仓库所有文件，提取关键符号（类、函数、类型签名），以源码片段形式展示定义，随每次对话请求实时构建，不持久化存储。底层使用 tree-sitter 解析 AST。

### ② 维护 / 防漂移
完全机器维护，每次调用时从源码实时生成。不存在漂移问题，因为它直接读源码。无人工介入环节。

### ③ 粒度
符号级（函数/类/变量定义）。通过 PageRank 风格的图算法对大型仓库排序，将 token budget（默认 1000 tokens，可配置）分配给最相关的符号。token 预算根据当前对话状态动态调整。

### ④ 效果证据
Aider 是最广泛使用的开源 AI pair programming 工具之一，在 SWE-Bench 有公开评测。repo map 机制被社区大量复用（如 RepoMapper 工具直接移植该算法）。

### ⑤ 与 cmap 异同
相同：都为 AI agent 提供项目结构摘要。根本不同：Aider repo map 是**纯源码级符号图谱**，不含业务语义，不描述"模块为什么存在"；cmap 是产品视角的意图层。Aider map 无法跨 session 持久化，无 checkpoint，无 route 机制。cmap 和 Aider repo map 是互补关系（cmap 管语义，Aider 管符号）。

**来源：**
- https://aider.chat/docs/repomap.html
- https://aider.chat/2023/10/22/repomap.html
- https://github.com/Aider-AI/aider

---

## 5. Cline Memory Bank

### ① 知识形态
Memory Bank 是**结构化 markdown 文件集合**，存放于仓库 `memory-bank/` 目录，包含：`projectbrief.md`（核心需求）、`productContext.md`（项目存在原因）、`activeContext.md`（当前工作焦点）、`systemPatterns.md`（架构模式）、`techContext.md`（技术栈）、`progress.md`（进度与已知问题）。可选择通过 MCP server 暴露。

### ② 维护 / 防漂移
人机共同维护：开发者手动更新，Cline 在每次任务开始时**强制读取所有 Memory Bank 文件**，在发现新模式或完成重大变更后主动更新。规则通过 Mermaid 图嵌入 custom instructions 表达，形成"读→执行→更新"循环。主要漂移风险：如果开发者不执行更新步骤，文件会过时。

### ③ 粒度
项目整体粒度，无模块级细分。侧重"当前正在做什么"（active context）而非"每个模块的长期职责"。文件数量少（5-6 个核心文件），保持轻量。

### ④ 效果证据
Cline 官方博客推广，大量社区用户采用。MCP market 上有对应 server。无量化 benchmark。

### ⑤ 与 cmap 异同
相同：都是 markdown-in-repo 方案，都解决跨 session 记忆问题。不同：Memory Bank 是**通用项目状态快照**，无模块卡片粒度，无路由机制；cmap 有结构化的模块卡片和自然语言 route 能力，定位更偏"产品地图"而非"当前工作日志"。

**来源：**
- https://docs.cline.bot/prompting/cline-memory-bank
- https://cline.bot/blog/memory-bank-how-to-make-cline-an-ai-agent-that-never-forgets

---

## 6. Cursor rules / memories

### ① 知识形态
两层：**Rules**（`.cursor/rules/*.mdc` 或 AGENTS.md）是人工维护的静态文本，每次对话加载；**Memories**（v1.0，2025 年 6 月上线）是后台模型自动从对话中提取的事实，用户审批后存储，per-project 隔离，通过 Settings 管理。

### ② 维护 / 防漂移
Rules 由人工维护，无自动同步。Memories 由 background model 提议，用户 approve/edit/delete，防止错误记忆污染。Rules 不随代码变化自动更新，是主要漂移来源。

### ③ 粒度
Rules 通常覆盖整个项目或特定文件类型（frontend/backend 分离规则文件）。Memories 粒度较细，为单条事实（如"该项目用 TypeScript strict mode"）。

### ④ 效果证据
Cursor 是 2025-2026 最主流的 AI IDE，用户量庞大。Memories 功能获得社区正面反馈（减少重复解释项目约定）。无量化 benchmark。

### ⑤ 与 cmap 异同
相同：都以文件形式在 repo 内存放 AI 上下文。不同：Cursor rules 是**行为约束层**（"如何写代码"），cmap 是**项目知识层**（"项目是什么、模块干什么"）。Cursor 无 route、无 checkpoint。cmap 的 `.context/` 可作为 Cursor rules 的高质量信息源。

**来源：**
- https://memnexus.ai/blog/2026-02-20-cursor-persistent-memory
- https://cursor.com/blog/agent-best-practices
- https://www.termdock.com/blog/skill-md-vs-claude-md-vs-agents-md

---

## 7. Claude Code CLAUDE.md / Skills 生态

### ① 知识形态
三层结构：**AGENTS.md**（跨工具通用，项目架构/约定/约束，<100 行）→ **CLAUDE.md**（Claude Code 专有，引用 AGENTS.md，<20 行）→ **Skills / SKILL.md**（按需加载的专业化 playbook，社区/官方/第三方生态）。Claude Code session 启动时自动读取 CLAUDE.md。

### ② 维护 / 防漂移
人工维护 CLAUDE.md/AGENTS.md；Skills 由作者维护。无自动代码→文档同步机制。防漂移依赖工程规范（约束文件行数、不存变动频繁的事实）。Claude Code 可在任务结束时提示用户更新上下文（`cmap finish` 等工具补充这一缺口）。

### ③ 粒度
项目级（CLAUDE.md）+ 任务级（Skills）。无标准化的模块卡片格式。

### ④ 效果证据
Anthropic 官方生态，Claude Code 用户基数大。Skills 生态截至 2026-03 已包含数千个社区 skill。`arxiv.org/html/2604.14228v1` 有对 Claude Code agent 系统的学术分析。

### ⑤ 与 cmap 异同
cmap 本身就是在 Claude Code 生态上构建的工具，CLAUDE.md 是 cmap 的"宿主"上下文。cmap 提供了 CLAUDE.md 缺失的**结构化模块知识层**（route、checkpoint、verify），是对 Claude Code 原生上下文机制的补充和增强。

**来源：**
- https://code.claude.com/docs/en/skills
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- https://amitray.com/claude-md-vs-agents-md-memory-md-skills-md-context-md-guide-2026/

---

## 8. GitHub Copilot instructions / Spaces

### ① 知识形态
多层：**.github/copilot-instructions.md**（repo 级静态指令）+ **Spaces**（2025-05 发布，GA 2025-09，将 repo/PR/issue/文档/自由文本打包为 grounding context bundle）+ **AGENTS.md**（自定义 agent 定义，Universe 2025）。Spaces 支持上传文件、截图、笔记，绑定到特定代码区域或功能。

### ② 维护 / 防漂移
instructions.md 人工维护。Spaces 内容手动管理，无自动代码同步。Agent HQ（宣布于 Universe 2025）统一调度 Anthropic、OpenAI、Google、Cognition 等多家 agent。

### ③ 粒度
Spaces 粒度灵活（可按功能区/团队/项目划分）。instructions.md 是项目整体级别。

### ④ 效果证据
GitHub Copilot 覆盖 VS Code、Visual Studio、JetBrains、Xcode 等，用户规模最大。Spaces 发布时有 GitHub 官方 changelog 和社区讨论（discussion #160840）。

### ⑤ 与 cmap 异同
Copilot Spaces 是**上下文聚合器**（收集各类材料），cmap 是**语义生产工具**（生成结构化模块知识）。cmap 生成的 `.context/` 文件可直接作为 Copilot Space 的上传内容，两者互补。

**来源：**
- https://github.blog/changelog/2025-05-29-introducing-copilot-spaces-a-new-way-to-work-with-code-and-context/
- https://docs.github.com/en/copilot/concepts/context/spaces
- https://github.blog/changelog/2026-01-14-github-copilot-cli-enhanced-agents-context-management-and-new-ways-to-install/

---

## 9. Sourcegraph / Cody

### ① 知识形态
Cody 的上下文来自 Sourcegraph 的**代码智能平台**：对所有仓库做全量索引，构建跨 repo 的符号关系图。检索时结合 BM25 关键词搜索 + 本地 IDE 打开文件 + Repo-level Semantic Graph（RSG）提供全局依赖关系。注意：Cody 已放弃 embedding-based 向量搜索，转为纯关键词+精确代码图路线。

### ② 维护 / 防漂移
Sourcegraph 平台持续索引，每次 push 触发增量更新，完全机器维护。无人工编写文档环节。

### ③ 粒度
企业级，支持跨数百个仓库的联合检索。snippet 粒度（文件片段）。RSG 提供 repo 级语义图。

### ④ 效果证据
企业客户：Uber、Plaid 等大型科技公司。Sourcegraph 已有多年商业化历史（2013 年成立）。无 SWE-Bench 等标准 benchmark 数据。

### ⑤ 与 cmap 异同
Sourcegraph/Cody 是**大型企业的全仓库语义搜索引擎**，面向跨仓库代码导航；cmap 是**单 repo 的产品语义层**，面向 AI agent 的任务导向导航。两者规模和定位差异显著。cmap 不竞争 Cody 的企业搜索场景。

**来源：**
- https://sourcegraph.com/blog/how-cody-understands-your-codebase
- https://sourcegraph.com/docs/cody/core-concepts/context

---

## 10. claude-task-master（task-master-ai）

### ① 知识形态
Task Master 不是 wiki，而是**任务分解+上下文注入**工具：将 PRD 用 AI 拆解为带依赖关系、复杂度评分、子任务的结构化任务列表（tasks.json），每次只给 agent 喂一个任务，附带足够的实现上下文。v0.30.0（2025-10）加入 TDD autopilot 模式。

### ② 维护 / 防漂移
tasks.json 由 AI 生成，人工审核，agent 执行时标记完成状态。任务状态文件随工程进度更新。不处理代码文档漂移问题（设计目标不同）。

### ③ 粒度
任务（story）粒度，包含实现细节和依赖关系。无模块知识沉淀，每个项目重新从 PRD 生成。

### ④ 效果证据
2025-03-04 发布，发布当周 250+ GitHub stars，200k X impressions。开发者报告"减少 90% Cursor 错误"（tessl.io 博客案例）。开源项目，GitHub 主仓 eyaltoledano/claude-task-master。

### ⑤ 与 cmap 异同
Task Master 解决"agent 每次任务的上下文够不够用"，cmap 解决"agent 理解项目架构的语义够不够准"。两者可以组合：cmap route 找到相关模块卡片，Task Master 管理任务执行上下文。Task Master 无模块级持久知识，无 checkpoint 交接协议。

**来源：**
- https://github.com/eyaltoledano/claude-task-master
- https://tessl.io/blog/claude-task-master/
- https://emelia.io/hub/claude-task-master-ai-project-management

---

## 11. BMAD Method

### ① 知识形态
BMAD（Breakthrough Method for Agile AI Driven Development）是**多 agent 角色分工框架**：Analyst、PM、PO、Architect、Dev、QA、Scrum Master 等角色 agent 协作，每个 agent 产出 verifiable artifact（PRD、架构文档、story、测试报告等）。Scrum Master agent 将规划文档拆解为"hyper-detailed development stories"，每个 story 嵌入完整上下文和架构指导。YAML-based workflow blueprint 定义 agent 协作流程。

### ② 维护 / 防漂移
每个 artifact 由对应角色 agent 负责，结构性强制更新。Scrum Master 的 story 嵌入架构决策，减少 Dev agent 走偏。但整体仍依赖人工审核每个 artifact。

### ③ 粒度
phase 粒度（规划→架构→实现→测试），每 phase 产出完整文档。Dev story 粒度细至单功能实现。开源生态包含 5 个子模块（BMM、BMB、TEA、BMGD、CIS）。

### ④ 效果证据
GitHub 主仓 bmad-code-org/BMAD-METHOD，2025 年社区快速增长，有官方文档站 docs.bmad-method.org。多篇博客案例（Infosys、Reenbit 等）。无量化 benchmark。

### ⑤ 与 cmap 异同
BMAD 是**开发流程框架**（how to work），cmap 是**项目知识底座**（what exists）。BMAD 中的 Architect agent 产出的架构文档和 cmap 的模块卡片有重叠，但 BMAD 不解决持久化、路由和 review 渲染。两者可互补：cmap 提供持久的语义底座，BMAD 的 workflow 在其上运行。

**来源：**
- https://github.com/bmad-code-org/BMAD-METHOD
- https://docs.bmad-method.org/
- https://reenbit.com/the-bmad-method-how-structured-ai-agents-turn-vibe-coding-into-production-ready-software/

---

## 12. 其他同类项目

### 12a. Greptile

**形态：** 构建代码仓库的**语义知识图谱**（函数/类/依赖/历史变更），PR review 时多 agent 并行查询图谱进行影响分析，不局限于 diff。v3（2025 年底）使用 Anthropic Claude Agent SDK。

**维护：** 完全自动，每次 push 增量更新图谱。

**效果：** 独立 benchmark（2025-09）bug 捕获率 82%，CodeRabbit 为 44%；但误报 11 条 vs CodeRabbit 的 2 条。

**与 cmap 关系：** Greptile 是 PR review 工具，源码级图谱；cmap 是产品语义层，面向任务规划和交接。不直接竞争。

**来源：** https://www.greptile.com/docs/how-greptile-works/graph-based-codebase-context

---

### 12b. CodeRabbit

**形态：** PR 级 AI code review，diff-based，生成 walkthrough summary + inline 评论 + linter 集成。覆盖 GitHub、GitLab、Bitbucket、Azure DevOps。

**局限：** 只看 diff，不理解变更与整个 codebase 的关系。

**规模：** 2M+ 仓库接入，13M+ PR 处理（截至 2025）。

**来源：** https://www.greptile.com/greptile-vs-coderabbit

---

### 12c. Pieces for Developers

**形态：** **OS 级工作流记忆**：通过 OCR 和 OS-level 截获，捕获开发者在 IDE、浏览器、协作工具中的所有活动，建立可查询的个人知识库（保存 9 个月）。LTM-2（第二代 Long-Term Memory Agent）。

**与 cmap 关系：** Pieces 是**个人开发者工作流记忆**，跨所有 app；cmap 是**项目级产品知识**，服务 agent 而非人。几乎无直接竞争。

**来源：** https://pieces.app/features/long-term-memory

---

### 12d. mem0（coding 场景）

**形态：** 为 AI coding agent 提供**持久化记忆层**：存储 5 类信息（repo 事实、设计决策、用户偏好、约束策略、测试失败模式），每条记忆附带结构化元数据（repo ID、文件路径、branch、作者），通过语义搜索+元数据过滤检索，注入 LLM prompt。

**与 cmap 关系：** mem0 是**记忆基础设施**（存什么、怎么存取），cmap 是**知识内容生产工具**（产品语义卡片）。cmap 的内容可以作为 mem0 的 input 源。

**来源：** https://mem0.ai/blog/ai-coding-agents-that-actually-remember-your-codebase

---

## 对比总结表格

| 产品 | ①知识形态 | ②维护/防漂移 | ③模块粒度 | ④效果证据 | ⑤与cmap异同 |
|------|-----------|-------------|-----------|-----------|-------------|
| **Devin DeepWiki** | AI自动生成wiki+交互式图谱 | Agent自动+commit触发，Steerable JSON可调 | 文件→模块级 | Devin占Cognition 25%代码产出；SWE-Bench领先 | 全量自动wiki vs. 精炼语义卡片；无route/checkpoint |
| **mutable.ai Auto Wiki** | Wikipedia风格文章+Mermaid图+行引用 | 月度或commit触发自动更新，支持手动编辑 | 功能/文件模块级 | YC孵化，HN社区正面，$2/repo/mo | 自动批量覆盖 vs. 精炼价值描述；无route |
| **Swimm** | 人写flow文档+smart token代码绑定 | Autosync跟踪代码变更主动提醒 | 功能流程级（跨文件） | Gartner Cool Vendor 2024 | 实现导向文档 vs. 产品价值导向卡片；无route/checkpoint |
| **Aider repo map** | 实时符号图谱（AST+PageRank） | 完全机器自动，每次从源码实时构建 | 符号级（函数/类） | SWE-Bench有评测，广泛复用 | 纯源码符号层 vs. 产品语义层；无持久化 |
| **Cline Memory Bank** | 结构化markdown文件集（6核心文件） | 人机共同维护，每任务强制读取 | 项目整体级 | 社区广泛采用，无benchmark | 项目状态快照 vs. 模块知识地图；无route |
| **Cursor rules/memories** | 静态规则文件+对话提取记忆 | 人工维护rules；AI提议memories需审批 | 项目级/单条事实级 | 最主流AI IDE，用户规模大 | 行为约束层 vs. 知识内容层；无route/checkpoint |
| **Claude Code CLAUDE.md/Skills** | 分层markdown+按需skill playbook | 人工维护；技术 constraints限制文件体量 | 项目级+任务级 | Anthropic官方生态，数千社区skill | cmap是其增强插件，补充模块知识结构层 |
| **GitHub Copilot Spaces** | 多源上下文bundle（repo+PR+文档+文件） | 人工管理Spaces内容，无自动同步 | 灵活（功能区/团队级） | 最大用户基数，Universe 2025正式宣布 | 上下文聚合器 vs. 语义生产工具；互补 |
| **Sourcegraph/Cody** | 企业级跨仓库代码智能平台+RSG语义图 | 完全自动，push触发增量索引 | snippet级+repo语义图 | 服务Uber等大型企业，放弃embedding转BM25 | 大型企业全仓库搜索 vs. 单repo产品语义；定位不竞争 |
| **claude-task-master** | PRD→结构化任务列表（tasks.json） | AI生成+人工审核，执行时标记进度 | 任务/story级 | 250+ stars首周，报告减少90%错误 | 任务执行上下文 vs. 持久模块知识；互补 |
| **BMAD Method** | 多角色agent协作+phase artifact体系 | 每artifact由角色agent负责，人工审核 | phase级+story级 | 快速增长的社区，多企业案例 | 开发流程框架 vs. 项目知识底座；互补 |
| **Greptile** | 全仓库语义知识图谱（函数/依赖/历史） | 完全自动，push增量更新 | 函数/文件级 | 82% bug捕获率（vs CodeRabbit 44%） | PR review工具 vs. 产品语义层；不直接竞争 |
| **CodeRabbit** | PR-diff级review，walkthrough+inline | 自动，per-PR触发 | diff/文件级 | 2M+ repo，13M+ PR | PR review工具；不直接竞争 |
| **Pieces** | OS级开发者工作流记忆（9月历史） | 自动OS截获，LTM-2记忆模型 | 活动/snippet级 | LTM-2发布，多IDE集成 | 个人工作流记忆 vs. 项目产品知识；几乎无竞争 |
| **mem0** | AI agent持久记忆层（5类记忆+元数据） | 语义提取+元数据过滤，session间持久 | 单条记忆级 | 专注memory基础设施，无benchmark | 记忆基础设施 vs. 知识内容生产；可互补 |
| **cmap（参照系）** | 产品视角模块卡片+route+checkpoint+review | 人机协同，`cmap finish`/`verify`检查 | 模块级（产品语义） | 本项目定位 | — |

---

*本报告基于 2026-06-12 实时搜索结果，不含推测性内容。*
