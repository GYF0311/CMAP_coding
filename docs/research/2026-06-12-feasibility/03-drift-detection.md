# 文档漂移探测(Doc-Code Drift Detection)可行性调研

> 调研日期:2026-06-12  
> 调研员:Claude Code (claude-sonnet-4-6)  
> 目标:为 cmap 的"文档漂移探测"机制提供技术评估

---

## 概述

"文档漂移"(doc-code drift)指代码结构发生变化后,对应的产品视角文档/模块描述未及时更新而产生的信息偏差。对于 cmap 而言,具体场景是:某模块的 import/符号/调用图结构发生显著变更,但其 `.context/modules/<module>.md` 卡片未同步更新——下一个 AI 会话如果基于过期的模块卡片作出决策,将产生误导。

本报告调研4个方向:现有实现盘点、AST/依赖图 diff 方法、触发点对比、失败教训,最终给出对 cmap 的可行性判断和最小可行版本建议。

---

## 第一节:现有实现盘点

### 1.1 Swimm — 最成熟的 doc-code 同步产品

**算法核心**:语言无关的多信号直方图方法(language-agnostic multi-signal histogram)。针对每次代码变更,收集以下信号并加权合并:

- 行标记和行号偏移
- token 引用变化
- watched smart paths(用户自定义的关注路径)
- 变更的规模/幅度
- 完整 git 历史(要求非 shallow clone)

**四步决策流程(顺序执行)**:

1. **代码只移动了位置吗?** 若只移动未修改 → 自动更新指针,静默 patch,无告警
2. **变更是否微小?** (变量重命名、参数值调整、非功能性删除) → 自动静默 patch
3. **smart token 或 watched path 是否变化?** → 置信度不足则触发 review 任务
4. **代码是否已删除?** → 文档无法记录不存在的代码 → 必然触发告警

**CI 集成**:以 GitHub App 形式在每个 PR 上运行检查,可选配置为未处理 doc 问题时阻塞 PR merge。运行速度快,不拖慢 CI 流水线。

**误报控制策略**:信号加权而非简单阈值;轻微变更静默 patch → 开发者只在真正显著的结构性变更时收到告警。

**现状(2026)**:仍在运营,融资 $33.3M,约 61 名员工。

---

### 1.2 Mintlify Workflows — LLM 驱动的文档代理

**触发方式**:

- `push` 到指定分支(main 或可配置)
- Cron 计划任务(如每周五上午自动扫描)

**检测机制**:触发后,代理克隆相关代码库到临时沙箱,读取最近合并 PR 的 diff,识别用户可见的变更(新增 endpoint、参数变化、响应结构、新功能),判断哪些文档页面需要更新。**完全依赖 LLM 推理(Claude Opus 4.5/4.6),无独立的 AST 解析层**。

**输出**:开一个包含文档修改建议的 PR,供人工 review 后合并。可配置 `automerge: true` 直接推送。

**设计哲学**:"起草自动化,审批不自动化"(The drafting is automated; the approval is not)。

**局限**:无显式的 staleness 评分算法;漂移检测完全依赖 LLM 读代码 diff 推理,不存在可解释的规则层。

---

### 1.3 Fiberplane Drift — 开源 AST 锚定方案

**核心机制**:将 Markdown 文档绑定到具体代码符号,使用 lockfile 存储三元组:

```
src/auth/provider.ts   #AuthConfig   sig = "1a2b3c4d5e6f7890"
└── 文件路径 ─────┘   └─ 符号名 ┘   └────── AST 指纹 ──────┘
```

**AST 指纹算法**:用 tree-sitter 解析代码,对 AST 指纹进行哈希计算时**只包含节点类型(node kinds)和 token 文本,排除空白符和位置信息**。结果:代码格式化、空白调整、注释修改不触发 false positive。

**符号级粒度**:可锚定到单个声明的 AST 子树(如 `#AuthConfig`),只有该声明发生变化才触发 staleness,而非整个文件的任何改动。

**支持语言**:TypeScript、Python、Rust、Go、Zig、Java;其余语言降级为原始内容哈希。

**CI 输出示例**:

```
docs/auth.md
  STALE   src/auth/provider.ts#AuthConfig (changed after doc)
          changed by mike in e4f8a2c (Mar 15)
  STALE   src/core/old-module.ts (file not found)
  ok      src/auth/login.ts
```

**关键优势**:符号级锚定大幅降低 false positive;格式化无关的哈希避免无意义告警。

---

### 1.4 DeepWiki — 按需生成,无持续同步

**生成策略**:onboarding 时自动索引整个 repo(cluster-based planning 或显式页面列表),产出架构图、源码链接、代码库摘要。

**再生成策略**:定时计划而非按 commit 触发。活跃 repo 的 wiki 可能滞后 main 分支数小时到数天。支持 authenticated 用户按需重新生成。

**Staleness 检测**:无自动化机制追踪后续代码变更与 wiki 内容的偏差。**不具备 drift detection 能力**,属于生成即交付模式。

**对 cmap 的参考意义**:DeepWiki 证明了 AI 生成结构文档的可行性,但也说明"一次生成"模式在持续维护上是不够的。

---

### 1.5 pydoclint — Python 静态 docstring linter

**机制**:静态 AST 分析,逐函数对比签名节点与 docstring 节点。检测类别：

- DOC1xx:输入参数违规(缺少/多余/命名错误)
- DOC2xx:返回值违规
- DOC3xx:类 docstring/构造器问题
- DOC4xx:yield 违规
- DOC5xx:raise/assert 违规

**局限**:点时刻检测,不追踪漂移历史;是 staleness detector 而非 drift timeline tracker。

---

### 1.6 学术研究:session-start git parsing(最相关)

来自 arxiv:2602.20478(生产级 AI agent 基础设施,108K 行代码库):

**实现**:Python 脚本在 AI 会话启动时运行,解析 `git log --since=[last_spec_update]`,检查每个子系统的源文件是否在上次 spec 更新后被修改,若是则向会话上下文注入警告。

**告警格式示例**:

```
WARNING: Module X spec may be stale.
Source files changed in commits [abc, def] since last spec update.
```

**维护成本**:一个 108K 行代码库约每周 1-2 小时维护文档。

**关键发现**:Spec staleness 是他们整个 AI agent 基础设施的**首要失败模式**,session-start hook 是他们找到的最有效解法。

---

## 第二节:AST/依赖图 diff 语义判断方法

### 2.1 主流 AST diff 工具及准确率问题

常用工具:ChangeDistiller、GumTree、IJM、MTDiff、CLDiff。均基于 edit script(add/remove/update/move 节点操作)。

**准确率基准(来自 arxiv:2403.05939,835 个 bug-fixing commits + 11,000+ refactoring 实例)**:

| 工具 | 不准确映射率 |
|------|-------------|
| GumTree | 20-29% |
| MTDiff | 25-36% |
| IJM | 21-30% |

**失准根因**:语言无关工具会将语义不兼容的节点匹配在一起(如类型引用 vs 变量标识符,方法体 block vs 条件 block)。相同的 AST 节点类型可能代表不同的程序角色。

### 2.2 Refactoring-aware differencing(精度更高的方法)

**核心洞察**:RefactoringMiner 可检测 60 种重构类型(Extract Method、Rename Variable 等)。利用检测到的重构来引导 AST 节点匹配,显著提升准确率。CPATMINER"比 state-of-the-art AST 方法检测到多 2.1 倍的有意义模式"。

**语义显著性过滤规则**:

| 变更类型 | 对产品视角文档的意义 |
|---------|-------------------|
| Move(函数移位但未修改) | 低 — 更新指针即可 |
| Variable rename(局部作用域) | 低 |
| Method signature change | 高 — 总是触发 |
| New public API added/removed | 高 — 总是触发 |
| Module dependency change(新增/删除 import) | 高 — cmap 场景核心 |
| Internal implementation change(私有函数) | 低 — 对产品文档可忽略 |
| Formatting/comment changes | 零 |
| Test file changes | 零 |

### 2.3 Normalized AST fingerprinting(Fiberplane 方案)

哈希计算规则:只取 **node kinds + token text**,排除空白符、位置数据、注释。

效果:格式化、空白规范化、注释修改 → 零 false positive。这是目前最实用的防误报策略之一。

### 2.4 Semantic diff for documentation purposes

Reviewpad 的 "Explore Tree" 将代码变更分类为:Added symbols / Removed symbols / Changed symbols。将文件级变更映射回具体的函数/类/方法级别。

**对 cmap 的启示**:文档漂移检测的正确粒度单位是"哪些语义对象发生了变化",而不是"哪些行发生了变化"。

### 2.5 Program Dependence Graphs(PDGs)

PDG 捕获控制依赖和数据依赖。能检测跨非相邻代码的语义显著变更(如为某个参数添加 null check)。计算代价更高,但能捕获 AST-only 方法遗漏的重要变更。

### 2.6 Decorator-based per-function dependency tracking

基于 decorator 的方案记录函数调用链和全局访问,构建 per-call 依赖图。效果:当函数 A 变更时,可通过调用图推断哪些依赖函数 B、C、D 的文档需要复查。实现**选择性 staleness 传播**而非广播式告警。

### 2.7 误报/漏报的核心风险总结

**高误报场景**:

- 文件级锚定(vs 符号级锚定):大文件任何行变化都触发所有绑定文档告警
- 纯格式化 commit(未排除 whitespace/comment)
- 测试文件变更被误识别为产品代码变更
- Refactoring-only commits(代码移动但逻辑不变)

**高漏报场景**:

- 行为语义变化发生在内部实现层,公共 API 签名未变
- 多个小 commit 的累积漂移(每次单独看都不显著)
- 隐式约定变更(错误码含义改变但函数签名不变)

---

## 第三节:触发点对比

### 3.1 四类触发点比较

| 触发点 | 代表产品 | 优点 | 缺点 |
|--------|---------|------|------|
| **Pre-commit hook** | pydoclint | 最快反馈,本地即时 | 可被 `--no-verify` 绕过;依赖本地工具安装;拖慢提交流程 |
| **PR/Push CI check** | Swimm, Fiberplane | 无法跳过;在合并边界执行;开发者已在 review 状态 | 反馈稍晚;需要 CI 配置权限 |
| **Cron 定期扫描** | Mintlify | 兜底扫描,捕捉漏网变更 | 实时性差;变更与告警间隔可能超过一周 |
| **Session-start hook** | arxiv:2602.20478 | 与 AI 工作流自然集成;直接注入上下文 | 依赖 git 历史准确性;对话频繁时重复告警 |

### 3.2 哪种触发点在实践中真正有效?

来自 arxiv:2602.20478(生产验证):

> Session-start git commit parsing 是他们找到的首要有效机制。AI agent 看到注入的警告后会主动复查对应的 spec 文件。

来自 Swimm 实践(PR merge 边界):

> PR 级别的检查是商业产品中最可靠的触发点。开发者在 PR review 阶段注意力最集中,此时处理文档 staleness 代价最低。

**Conventional Commits 辅助信号**:`feat:`/`refactor:`/`BREAKING CHANGE` 标记可作为弱语义信号,与 AST diff 联合使用降低误报。

### 3.3 对 cmap 场景的判断

cmap 的核心用户是**AI 会话**而非人类开发者。因此:

- **Session-start hook 是第一优先触发点**:在 AI 会话开始时检查自上次模块卡片更新以来的 git log,若有显著结构变更则注入告警提示。
- **PR/push CI 作为第二道防线**:在人类合并代码时同步检查模块卡片新鲜度,生成 review checklist。
- Pre-commit hook 对 cmap 场景价值有限(AI agent 写代码时不经过标准 pre-commit 流程)。

---

## 第四节:失败教训

### 4.1 CodeSee(2024 年收购/关停)

**时间线**:2024-02-22 宣布关停 → 2024-05-14 被 GitKraken 收购。

**产品定位**:代码可视化平台,代码和函数地图、代码健康评分、工作流自动化。非 doc-code drift 专项工具,而是代码库理解平台。

**失败原因分析**:

1. **平台产品困境**:代码可视化是需要全组织采用的平台类产品,但作为独立工具很难体现每个开发者的 ROI。
2. **工作流嵌入不足**:需要开发者主动访问独立产品,而非嵌入现有工作流(GitHub、IDE)。
3. **商业模式问题**:单点工具难以在企业级站稳脚跟;收购是救援性质的。

**对 cmap 的教训**:代码地图/可视化本身不是商业价值,必须绑定到开发者工作流结果(review、docs、onboarding)。

### 4.2 普遍失败模式(来自行业研究)

**摩擦阈值定律**:
> "如果修文档需要超过两分钟,就会被无限期推迟。"

任何给工作流增加摩擦的工具,采用率在数周内崩溃。

**AI 幻觉信任问题**:
AI 生成文档需要人工监督;完全自动化(无 review)的团队最终因文档不准确而失去对整个系统的信任。

**工具碎片化陷阱**:
多个文档平台并存("Frankenstein setup")的维护成本超过解决 doc-drift 问题本身的成本。

**Agile 文化阻力**:
在 Agile 语境下,文档被视为"浪费"。任何要求显式写文档的工具都在对抗文化惯性。

**过期文档比无文档更危险**:
> "过期的文档往往比没有文档更糟糕。"

这使得**漏报(false negative)**比误报更危险:未被检测到的漂移会让 AI agent 基于错误信息作决策。

### 4.3 Swimm 存活的原因

Swimm 在众多竞品中存活下来,关键因素:

1. **PR 工作流原生集成**:零摩擦发现,开发者不需要额外动作
2. **静默 auto-patch**:小变更自动处理,不产生告警疲劳
3. **只在真正显著的变更时告警**:语义过滤而非行级触发
4. **语言无关**:广泛适用性

**残余批评**:初始配置复杂;大型企业高级功能不足;需要 non-shallow git clone。

### 4.4 核心失败模式总结

所有失败产品共同的根本问题:**解决了文档创建问题,但未解决文档维护的人类动机问题**。

表现最好的工具共同特征:
- 在工作流边界(PR merge gate)强制执行
- 提供低成本的修复路径(auto-patch 或 one-click update)

---

## 第五节:对 cmap 的可行性判断

### 5.1 技术难点

**难点 1:语义显著性边界定义**

cmap 维护的是"产品视角"模块卡片。哪些代码变更对产品视角是显著的?这个边界很难用规则完整表达:

- 公共 API 签名变化:显然显著
- Import graph 变化(模块新增/删除依赖):对 cmap 核心场景显著
- 内部实现重构:对产品视角通常不显著
- 数据结构字段变化:取决于是否对外暴露

**难点 2:累积漂移检测**

单次 commit 看起来微小,但多次累积后产生显著语义偏差。点时刻 diff 容易漏掉累积效应。需要额外维护"上次文档更新时的结构快照"作为基线进行比较。

**难点 3:快照存储与比较开销**

维护每个模块的结构快照(import list/exported symbols/dependency edges)需要存储历史快照。对大型项目,每次 session-start 全量比较的开销需要控制。

**难点 4:AI 会话的告警疲劳**

若告警过于频繁,AI agent 会习惯性忽略;若告警过于稀少,漂移会累积。需要类似 Swimm 的信号加权机制来平衡。

**难点 5:与现有 `.context` 结构集成**

cmap 的模块卡片是 Markdown 文件。需要在卡片中或单独的 lockfile 中存储"上次验证时的结构指纹",才能支持后续比较。

---

### 5.2 误报/漏报风险

**误报风险(False Positive)**:

| 风险场景 | 缓解策略 |
|---------|---------|
| 纯格式化/注释 commit 触发告警 | 使用 normalized AST 指纹(排除空白和注释) |
| 内部重构(未改公共接口)触发告警 | 只追踪 exported symbols 和 import graph |
| 测试文件变更触发模块告警 | 过滤 `*.test.*`、`__tests__/` 路径 |
| Rename refactoring 误判为删除+新增 | 引入 RefactoringMiner 类的重构检测层 |

**漏报风险(False Negative)**:

| 风险场景 | 缓解策略 |
|---------|---------|
| 行为语义变化但签名不变 | 无法用静态分析完全覆盖;依赖 LLM 语义判断作补充 |
| 多次小 commit 累积漂移 | 与卡片上次更新时间比较,而非只看最近一次 commit |
| 隐式约定变更(错误码语义) | 目前无法自动检测;只能靠告警促使人工复查 |

**总体判断**:对于 cmap 的场景(import/符号/依赖图),误报风险可通过符号级锚定和 normalized fingerprinting 控制到可接受水平。漏报风险中最危险的(行为语义变化)无法用纯静态方法覆盖,但这是整个行业的共同局限。

---

### 5.3 最小可行版本(MVP)建议

**目标**:在 cmap 的 session-start 流程中,注入"模块卡片可能过期"的告警,代价最低、误报最少。

#### Phase 1:基于 git log 的轻量版(2-3天实现)

**原理**:记录每个模块卡片的"上次验证 commit hash",在 session-start 时检查对应源文件是否在此之后有 commit。

**实现步骤**:

1. 在每个 `.context/modules/<module>.md` 的 frontmatter 中增加字段:

```yaml
---
last_verified_commit: "abc1234"
source_paths:
  - src/auth/
  - src/core/provider.ts
---
```

2. `cmap` 新增命令 `cmap drift check`,执行:

```bash
git log --oneline <last_verified_commit>..HEAD -- <source_paths>
```

若有输出则标记为 potentially stale。

3. Session-start 时输出:

```
[cmap] Potentially stale module cards:
  - auth-module (3 commits since last verification)
  - core-provider (last verified 14 days ago)
Run `cmap drift review auth-module` to inspect changes.
```

4. `cmap verify` 后自动更新 `last_verified_commit`。

**优点**:零 AST 解析依赖,实现简单,误报集中在"有 commit 但不重要"的情况。

**缺点**:无语义过滤,格式化 commit 也会触发告警。

---

#### Phase 2:import/export 快照 diff(1-2周实现)

在 Phase 1 基础上增加结构快照比较,**只关注 cmap 本身已追踪的信息**:

1. `cmap` 在每次 `cmap finish` 时,将模块的 import list 和 exported symbols 保存为 `.context/snapshots/<module>.json`。

2. 下次 session-start 时重新扫描并比较:
   - 新增 import:可能需要更新模块依赖描述
   - 删除 import:可能需要更新模块职责描述
   - 新增 exported symbol:可能需要添加到模块 API 文档
   - 删除 exported symbol:高优先告警

3. 评分逻辑(参考 drift-vscode):
   - 每个新增/删除的 exported symbol:+0.3 分
   - 每个 import graph 变化:+0.1 分
   - 得分 ≥ 0.3 触发告警

4. 告警注入 AI 会话上下文:

```
[cmap-drift] Module card may be stale: auth-module
  Changes since last verification:
  - Exported symbol removed: verifyToken
  - New import added: src/jwt/validator
  Recommend: run `cmap drift review auth-module` before editing this module.
```

**优点**:基于 cmap 已有数据,语义信号更精准;无需外部 AST 工具。

**缺点**:需要存储快照文件;初次运行需要建立 baseline。

---

#### Phase 3:LLM 语义判断层(可选增强)

将 Phase 2 检测到的结构 diff 输入 LLM,让其判断"这些变化是否对产品视角文档有意义",过滤纯重构变更。参考 Mintlify 的"LLM 读 diff 决定哪些文档页面需要更新"模式。

**注意**:Phase 3 成本较高且依赖 LLM 质量,建议 Phase 1+2 验证价值后再考虑。

---

### 5.4 总体可行性结论

| 评估维度 | 评级 | 说明 |
|---------|------|------|
| 技术可行性 | **高** | Phase 1 基于 git log,Phase 2 基于已有快照;无需外部依赖 |
| 误报风险 | **中** | Phase 1 误报较多;Phase 2 通过结构 diff 可显著降低 |
| 漏报风险 | **中** | 行为语义变化无法静态检测;但对 cmap 场景(产品视角,非行级精度)可接受 |
| 实现成本 | **低-中** | Phase 1:2-3 天;Phase 2:1-2 周;不依赖外部 AST 工具 |
| 与 cmap 现有架构的兼容性 | **高** | 利用现有 `.context` 结构,扩展 frontmatter + 快照文件 |
| 人类动机问题 | **已规避** | cmap 的主要消费者是 AI 会话,不是人类;session-start 注入绕过了人类动机问题 |

**最终判断:可行,且 cmap 的 AI-first 定位实际上规避了 doc-sync 产品最大的历史失败原因(人类动机问题)。建议优先实现 Phase 1,在真实项目中验证告警质量,再决定是否推进 Phase 2。**

---

## 参考资料

| 来源 | URL |
|------|-----|
| Swimm 文档同步机制说明 | https://swimm.io/learn/code-documentation/automated-documentation-with-doc-sync |
| Swimm 技术博客:Document Sync Algorithm | https://swimm.io/blog/swimms-doc-sync-algorithm |
| Mintlify Workflows 文档 | https://mintlify.com/docs/platform/workflows |
| Fiberplane Drift 博客 | https://fiberplane.com/blog/drift-documentation-linter/ |
| Fiberplane Drift GitHub | https://github.com/fiberplane/drift |
| DeepWiki 官网 | https://deepwiki.com |
| pydoclint GitHub | https://github.com/jsh9/pydoclint |
| CodeSee 关停公告 | https://www.codesee.io (已关停) |
| GitKraken 收购 CodeSee | https://www.gitkraken.com/blog/gitkraken-acquires-codesee |
| arxiv:2602.20478 — AI Agent 基础设施 session-start hook | https://arxiv.org/abs/2602.20478 |
| arxiv:2403.05939 — AST Differencing 准确率基准 | https://arxiv.org/abs/2403.05939 |
| Reviewpad SemanticDiff | https://reviewpad.com/blog/semantic-diff |
| Stack Overflow Blog: AI-assisted documentation | https://stackoverflow.blog/2024/ai-assisted-documentation |
| RefactoringMiner GitHub | https://github.com/tsantalis/RefactoringMiner |
| drift-vscode (pallaprolus) | https://github.com/pallaprolus/drift-vscode |
