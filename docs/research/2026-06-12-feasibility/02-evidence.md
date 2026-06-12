# 调研报告：Context Files / Repo 文档对 AI Coding Agent 的影响

---

## 元数据

- **调研日期**：2026-06-12
- **调研员**：AI research agent (Claude Sonnet 4.6)
- **主要搜索词**：
  - "context files coding agents harmful ETH Zurich"
  - "AGENTS.md CLAUDE.md effectiveness empirical study"
  - "SWE-bench repo map ablation documentation agent"
  - "aider repomap PageRank effectiveness"
  - "codified context infrastructure AI agent"
  - "AI agent self-updating documentation maintenance"
  - site:arxiv.org "AGENTS.md" OR "CLAUDE.md" coding agent 2025 2026
- **覆盖时间范围**：2024–2026

---

## 方向一：Context Files 对 Coding Agent 成功率的影响——ETH Zurich 研究原始出处

### 核心论文

**论文**：*Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?*
**作者**：Thibaud Gloaguen, Niels Mündler, Mark Müller, Veselin Raychev, Martin Vechev
**机构**：ETH Zurich（瑞士联邦理工学院）
**arXiv**：[2602.11988](https://arxiv.org/html/2602.11988v1)（2026 年 2 月发布）

### 实验设置

研究者评估了四个 coding agent（Claude Code Sonnet-4.5、Codex GPT-5.2、Codex GPT-5.1 mini、Qwen Code Qwen3-30b-coder）在两个 benchmark 上的表现：

- **SWE-bench Lite**：300 个任务，来自 11 个流行 Python 库（模型可能已部分记忆）
- **AGENTbench**（自建）：138 个任务，来自 12 个冷门库（这些库本身已有开发者书写的 context files，刻意避免训练集污染）

三种实验条件：① 无 context file；② LLM 生成的 context file；③ 人工书写的 context file（仅 AGENTbench）

### 定量结论

| 条件 | 任务成功率变化 | 推理成本变化 |
|------|------------|----------|
| LLM 生成的 context file | **-3% 至 -0.5%**（相比无 context file） | **+20–23%** |
| 人工书写的 context file | **+4%**（平均，相比无 context file） | **+19%** |
| 两种 context file 均使 agent 多执行 2.45–3.92 步 | — | — |

### 结论边界（重要）

- 负面效应主要来自 **LLM 自动生成**的 context file，而非人工写的
- 人工写的仅有微弱正向效果（+4%），且成本仍提升约 19%
- 实验范围仅限 Python 仓库；任务指标仅为"是否解决"，不含代码质量
- 研究者建议：只写人工无法从现有代码/文档中推断出来的内容（如特殊构建命令、非标准工具链）

> **证据强度：强实证**（同行评审前的 arXiv 预印本，但实验设计严谨，使用了自建 benchmark 规避污染，四个 agent 交叉验证）

---

## 方向二：SWE-bench / 其他 Benchmark 上 Repo Map、Wiki、文档增强的消融实验

### 2.1 Aider Repo Map（PageRank 符号图）

Aider 的 repo map 将整个代码库解析为符号定义-引用有向图，用 personalized PageRank 对节点排序，按 token budget（默认 1k）选出最相关的符号签名，随每次对话发送给 LLM。当前对话中提到的标识符获得 10× 权重提升，已加入 chat 的文件获得 50× 提升。

**官方文档**：[aider.chat/docs/repomap.html](https://aider.chat/docs/repomap.html)

**关键局限**：Aider 官方文档和 GitHub 上**没有发布独立的消融研究**，没有"有 repo map vs 无 repo map"的定量对比数据。其有效性主要来自架构理由（防止 naive 全量 dump 导致注意力退化和成本爆炸）和社区使用反馈，而非受控实验。

> **证据强度：弱实证**（工程设计合理，缺乏受控消融数据）

### 2.2 SWE-bench 上文档增强的证据

从 arXiv 检索到的 SWE-bench 相关论文（SWE-bench Pro、SWE-bench++、SWE-EVO 等）均未发现**专门针对 AGENTS.md / repo map / wiki 增强的消融实验**。现有 SWE-bench 变体主要关注任务覆盖面扩展、多语言支持和 benchmark 污染问题，未将文档质量作为独立变量。

**部分相关发现**（来自 context engineering 研究）：*Context Engineering for Multi-Agent LLM Code Assistants*（arXiv:2508.08322）指出，在 context 中提供 **in-context 代码和 API 文档**可显著提升性能，而盲目检索相似代码示例反而有时降低性能——这与 ETH Zurich 的结论方向一致：内容是否"非冗余、可操作"比是否存在文档更关键。

> **证据强度：弱实证**（间接支持，非 SWE-bench 直接消融）

---

## 方向三：大厂/社区关于 CLAUDE.md、AGENTS.md 有效性的实证

### 3.1 效率维度：Singapore Management University 等多机构研究

**论文**：*On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents*
**作者**：Lulla、Mohsenimofidi、Galster 等（新加坡管理大学、海德堡大学、班贝格大学、伦敦国王学院）
**arXiv**：[2601.20404](https://arxiv.org/html/2601.20404v1)（2026 年 1 月）

使用 OpenAI Codex（gpt-5.2-codex）在 10 个仓库、124 个 PR 上比较有/无 AGENTS.md：
- 中位执行时间：98.57 秒 → 70.34 秒（**-28.64%**）
- 输出 token 消耗降低 **16.58%**

**关键区别**：本研究测量的是**效率（执行时间、token 消耗）**，而非任务成功率。与 ETH Zurich 测量成功率的研究不矛盾：context file 可能让 agent 跑得更快、用更少 token，但不一定让它把任务做对。

> **证据强度：强实证**（受控实验，docker 隔离环境）

### 3.2 采用现状：GitHub 生态规模

- *Agentic Much? Adoption of Coding Agents on GitHub*（arXiv:2601.18341）：截至 2026 年初，AGENTS.md 已被超过 **60,000 个 GitHub 仓库**采用
- *Context Engineering for AI Agents in Open-Source Software*（arXiv:2510.21413）：对 10,000 个仓库采样，仅 **5%** 已采用 AI context file，TypeScript 项目采用率最高

### 3.3 社区经验：CLAUDE.md 经验研究

**论文**：*On the Use of Agentic Coding Manifests: An Empirical Study of Claude Code*（arXiv:2509.14744，Kasetsart 大学等）分析了开发者如何构建 CLAUDE.md 文件。配套的 *Configuring Agentic AI Coding Tools*（arXiv:2602.14690）分析 2,853 个 GitHub 仓库，发现：
- Context file 是最主流的配置机制，常常是仓库中**唯一的 AI 配置**
- 大多数仓库仅维护 **1–2 个** context file，而非分层体系
- 85.5% 的 Skills 不包含可执行资源，开发者普遍依赖静态 Markdown
- CLAUDE.md 常指向 AGENTS.md，形成轻量层级结构

*Agent READMEs*（arXiv:2511.12884，分析 2,303 个 context file）发现内容最常见类别：Testing（75%）、Implementation Details（70%）、Architecture（68%）；安全和性能要求仅 14.5%。文档结构以项目级单一 H1 为主，H2 约 6–7 个，**不涉及模块级细分**。

> **证据强度：强实证（描述性）**，弱实证（因果关系）

---

## 方向四：文档粒度问题——模块级 vs 文件边界，有无指导/证据

### 4.1 现有论文的观察

目前检索到的实证研究（包括 ETH Zurich、Singapore Management University、Kasetsart University）**均未在受控实验中比较"按产品能力边界划分模块文档"vs"按文件边界划分"**。这一粒度问题目前缺乏直接实证。

### 4.2 最接近的实证：Codified Context 三层架构案例

**论文**：*Codified Context: Infrastructure for AI Agents in a Complex Codebase*（arXiv:2602.20478）
**作者**：Aristidis Vasilopoulos（独立研究者）
**规模**：108,000 行 C# 分布式系统，70 天 283 个开发 session

作者设计了三层架构：
- **Tier 1（热记忆）**：~660 行全局宪法，始终加载（命名规则、构建命令、协调协议）
- **Tier 2（领域专家）**：19 个专项 agent spec，总计 ~9,300 行，>50% 为领域知识（非行为规则）
- **Tier 3（冷记忆）**：34 个子系统规格文档（~16,250 行），按需用 MCP 检索

**粒度原则（作者归纳）**：
- 全局宪法回答"必须始终遵守的规则"
- Tier 3 回答"子系统 X 具体如何工作"
- 分层依据是**访问频率和知识复用边界**，而非文件边界
- 持久化系统规格在 74 个独立 session 中保持一致性，save 相关 bug 为零

**关键教训**："文档过期导致静默失败"——agent 会绝对信任文档，所以过期规格比没有规格更危险。

> **证据强度：弱实证**（单个项目深度案例，无对照组，但有详细量化数据）

### 4.3 社区和工具侧的间接证据

*Configuring Agentic AI Coding Tools* 发现实际中大多数仓库仅维护 1–2 个 context file，反映出**模块级文档在实践中尚未规模化**，原因可能包括维护成本高和收益不明确。

**初步判断**（基于现有证据）：
- 模块级文档的价值高度依赖"该知识是否无法从代码本身推断"
- 按**能力/子系统边界**（如持久化层、网络协议层）划分优于按文件边界，因为它与 agent 的任务分解粒度对齐
- 但目前缺乏受控实验支撑，这个判断属于推断

> **证据强度：轶事 + 工程推断**

---

## 方向五："AI 自己维护文档"的成功与失败案例

### 5.1 成功案例：DocAgent（Facebook Research）

**论文**：*DocAgent: A Multi-Agent System for Automated Code Documentation Generation*（arXiv:2504.08725，ACL 2025 Demo Track）

Meta/Facebook Research 发布的多 agent 系统，使用依赖图拓扑排序实现增量文档生成：
- Completeness：0.934–0.953（vs. 聊天基线 0.724–0.815）
- Truthfulness（内部引用正确率）：95.74%（vs. ChatGPT 61.10%）
- Helpfulness（5 分制）：3.88（vs. 基线 2.95）

**成功的关键**：通过静态分析构建依赖图，按拓扑顺序处理，确保先有依赖项文档再写上层文档，避免幻觉。

**失败模式**：超大代码库仍会超出 LLM context 限制；动态行为（运行时多态、元编程）无法被静态分析捕获；仍可能产生幻觉（只是比基线少）。

> **证据强度：强实证**（受控实验，多指标评估，ACL 同行评审）

### 5.2 AI 维护 context file 的失败模式（ETH Zurich）

ETH Zurich 研究中最关键的发现之一：**LLM 生成的 context file 在 5/8 测试设置中降低了成功率**。原因是 LLM 生成的内容与仓库现有文档高度冗余，增加了 agent 的无效认知负荷，并引导 agent 做了更多不必要的探索（文件遍历、测试运行），而非更快找到相关文件。

**推论**：AI 自动生成并自我维护的文档存在"冗余陷阱"——如果模型无法判断哪些内容是非冗余的，自动维护反而引入噪音。

> **证据强度：强实证**

### 5.3 AI 维护文档的成本与规律

*Codified Context* 案例中，AI 辅助维护的文档系统总计 26,200 行，知识/代码比 24.2%。维护成本：
- 每个受影响 session：**5 分钟**更新
- 每两周**30–45 分钟**审查
- 总计约 **1–2 小时/周**

该研究强调：**过期规格导致的静默失败比完全没有文档更危险**，因为 agent 会绝对相信文档内容。

> **证据强度：弱实证**（单案例）

### 5.4 行业层面的 AI Agent 失败率

*Towards a Science of AI Agent Reliability*（arXiv:2602.16666）和行业报告显示：约 42% 的企业在 2024–2025 年放弃了大部分 AI 项目；Carnegie Mellon 的 TheAgentCompany benchmark 显示最佳 agent 在模拟软件公司任务中自主完成率仅约 **24%**。这是 general agent failure，但提示了文档对 agent 成功率影响评估的重要性。

> **证据强度：弱实证**（不同场景，仅作背景参照）

---

## 综合结论

| 问题 | 现有证据方向 | 置信度 |
|------|------------|--------|
| LLM 自动生成的 context file 有害 | 一致负向（ETH Zurich 实验） | 高 |
| 人工精写的 context file 有益 | 微弱正向（+4% 成功率，-28% 执行时间） | 中 |
| Context file 内容应"非冗余、可操作" | 多项研究一致 | 高 |
| Repo map（符号图）优于无 map | 工程逻辑合理，缺消融实验 | 低（证据不足） |
| 按能力边界划分优于按文件边界 | 案例支持，无受控实验 | 低（证据不足） |
| AI 自动维护文档可行但有局限 | DocAgent 成功（生成），自维护 context file 失败（维护） | 中 |

**最高优先级建议**（基于强实证）：
1. 不要用 LLM 批量生成 context file 后直接使用
2. 人工写的 context file 只写"代码本身无法推断的内容"（特殊工具链、非标准流程）
3. Context file 过期比没有 context file 更危险，需要维护机制

---

## 主要来源

- ETH Zurich 研究（核心）：https://arxiv.org/html/2602.11988v1
- 效率研究（SMU 等）：https://arxiv.org/html/2601.20404v1
- CLAUDE.md 经验研究：https://arxiv.org/pdf/2509.14744
- Context file 配置全景：https://arxiv.org/html/2602.14690v4
- Agent READMEs 分析：https://arxiv.org/html/2511.12884v1
- Context Engineering in OSS：https://arxiv.org/html/2510.21413v4
- Codified Context 案例：https://arxiv.org/html/2602.20478v1
- DocAgent（Facebook）：https://arxiv.org/html/2504.08725v1
- Aider Repo Map 文档：https://aider.chat/docs/repomap.html
- InfoQ 新闻综述：https://www.infoq.com/news/2026/03/agents-context-file-value-review/
