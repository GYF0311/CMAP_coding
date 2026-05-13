# cmap v0.1 PRD + 执行手册

**文档版本**：v0.1-draft  
**生成日期**：2026-05-10  
**定位**：产品 PRD + 技术规格 + AI/开发执行手册  
**CLI 技术栈倾向**：TypeScript / Node.js  
**核心产品语句**：cmap 是给人和 AI 共用的项目小地图与项目公共记忆层。

---

## 0. 一页结论

cmap 不是 AI coding 全家桶，也不是某个模型的私有记忆系统。它要做的是：

> 在项目仓库里维护一组人和 AI 都能读的 `.context/` 文件，记录项目目标、模块地图、模块关系、当前主线、关键决策、验证方式、工作日志和非主线灵感；再用 TypeScript CLI 做确定性初始化、路由、续接、校验、搬运和收尾。

### v0.1 核心原则

**cmap CLI 不生成项目语义。**

- CLI 可以创建骨架、提取确定性信号、检查路径、检查结构、搬运行块、输出提醒、生成模板。
- CLI 不应该自动判断项目模块职责、业务语义、模块依赖关系、设计决策。
- AI 负责阅读代码、理解项目、填写 `MAP.md` / `modules/*.md` / `STATUS.md` / `DECISIONS.md` / `logs/` / `ideas/`。
- Hook 只提醒 AI 做维护动作，不直接修改可信项目记忆。
- 项目记忆的正式内容应该由 AI 写入，并可由用户审阅。
- `.context/` 是项目公共记忆，不替代 Claude Code / Codex 自带 memory。

### v0.1 核心闭环

```text
用户/AI 开始项目或接入已有项目
  ↓
cmap init / cmap adopt
  ↓
CLI 创建 .context 骨架与确定性信号；AI 阅读项目并填写项目地图
  ↓
AGENTS.md / CLAUDE.md 短入口引导 AI 先读地图
  ↓
日常任务用 cmap route 推荐先读的模块文档
  ↓
编码过程中按需更新模块文档、日志、灵感、决策
  ↓
上下文快满或任务结束时 cmap checkpoint / cmap finish
  ↓
cmap verify 检查地图是否仍可信
```

### v0.1 必须证明的事情

1. AI 新会话是否能更快知道“项目现在在做什么”。
2. AI 是否能更准地定位“这次应该改哪个模块”。
3. AI 是否能理解模块之间的影响关系，而不是乱扫全仓库。
4. `.context` 是否能被持续维护，而不是几天后漂移失效。
5. 小白用户是否能通过地图看懂自己的项目。

### v0.1 明确包含的五个能力

1. `route`：根据已有地图的 aliases / 模块名 / 路径 / 关键词，推荐 AI 先读哪些文件。
2. `checkpoint`：接收 AI 生成的语义摘要，校验并写入当前主线。
3. `adopt`：创建已有项目的接管骨架与候选信号，等待 AI 阅读后补全。
4. `logs / ideas`：提供文件结构与最小 append 命令，区分工作过程记忆和非主线灵感。
5. `hooks maintain`：v0.1 experimental，默认关闭，只提醒维护，不写正式项目记忆。

---

# Part A — PRD

## 1. 背景

AI coding 已经可以快速生成 demo，但在真实项目里容易出现这些问题：

- 用户描述“多人对话页面消息发不出去”，AI 不知道它对应 `chat`、`conversation`、`message`、`notification` 还是别的模块。
- 项目从 0 到 1 增长后，用户和 AI 都逐渐看不清模块边界和影响关系。
- 上下文满了、compact 之后、新会话重开之后，AI 不知道当前主线。
- AI 能读代码，但代码不一定告诉它“为什么当时这么设计”。
- 项目文档容易漂移，AI 如果读了过期文档，反而会被误导。
- 小白用户没有工程地图，完全依赖 AI 口头解释，长期会失控。

Claude Code 和 Codex 都已经有自己的 memory / instruction / skill / hook 机制，但这些机制是宿主自己的上下文层。cmap 的机会在于做 **repo-local、host-neutral、human-readable、verifiable 的项目公共记忆**。

## 2. 产品定位

### 2.1 一句话定位

**cmap 是给 AI coding 的项目小地图。**

它在项目旁边维护 `.context/`，让人和 AI 都能快速知道：

- 项目要做什么。
- 当前主线是什么。
- 有哪些模块。
- 模块之间如何连接。
- 用户说“多人对话”时应该去哪个模块。
- 这次改动会影响谁。
- 为什么之前做了某个决策。
- 改完应该怎么验证。
- 哪些日志和灵感值得保留，但不应该污染主地图。

### 2.2 产品类别

cmap 更接近：

```text
AI coding project map + project memory layer + deterministic maintenance CLI
```

不应该被定义为：

```text
AI coding 全家桶
完整工程团队 workflow
RAG / vector memory server
Claude-only plugin
Codex-only plugin
文档生成器
代码索引器
```

### 2.3 和宿主记忆的关系

```text
Claude / Codex memory = 宿主私有记忆，记录偏好、习惯、局部 learnings
cmap .context       = 项目公共记忆，记录项目事实、模块地图、当前主线
AGENTS/CLAUDE      = 宿主入口，短指令，指向 .context
cmap CLI           = 确定性工具，负责骨架、模板、校验、关键词路由、写入 AI 提供的摘要、行块搬运
```

### 2.4 核心边界：CLI 不生成项目语义

`cmap` 的产品边界是：**AI 负责理解，CLI 负责确定性动作。**

| 能力 | AI 负责 | CLI 负责 |
|---|---|---|
| `init` | 填写项目目标、模块设想、验证策略 | 创建模板和目录 |
| `adopt` | 阅读项目、确认模块边界、填写正式地图 | 扫描 package / scripts / 候选目录，创建接管工作台 |
| `route` | 判断真实影响范围和代码修改方案 | 基于已有 aliases / 模块名 / 路径 / 关键词推荐读取文件 |
| `checkpoint` | 总结当前目标、进展、风险、下一步 | 校验格式并写入 `STATUS.md`，可追加到 `logs/current.md` |
| `hooks` | 决定是否更新正式记忆 | 输出提醒、列出 changed files 和可能受影响 context |

禁止把以下能力写成 v0.1 行为：

- CLI 自动理解项目。
- CLI 自动生成完整项目地图。
- CLI 自动判断模块职责、业务语义、模块依赖关系或设计决策。
- Hook 自动更新 `MAP.md` / `STATUS.md` / `modules/*.md` / `DECISIONS.md`。
- Hook 自动把 transcript 总结写进 logs，或把灵感写进 ideas。

### 2.5 与参考项目的关系

- 吸收 web-design 的“显式规范文件先行”。
- 吸收 gstack 的 context-save/restore、document-release 思想，但不吸收完整 review/qa/ship pipeline。
- 吸收 superpowers 的 verification-before-completion、行为规格测试思想，但不强制 TDD/brainstorming。
- 吸收 everything-claude-code 的 selective install、hook profile、skill compliance 思想，但不吸收 agents/skills/hooks 全家桶。

## 3. 用户画像

### 3.1 核心用户 1：AI coding 小白

特征：

- 想用 AI 从 0 到 1 做项目。
- 不熟悉模块拆分、架构、测试、长期维护。
- 需要 AI 帮自己把项目结构讲清楚。
- 容易被 AI 每次不同说法带偏。

需求：

- 项目一开始就有地图。
- AI 每次做事前能说清楚影响范围。
- 自己能打开 `.context/MAP.md` 看懂项目。

### 3.2 核心用户 2：AI coding power user

特征：

- 长期使用 Claude Code、Codex、Cursor、OpenCode 等工具。
- 经常新开会话、切模型、切宿主。
- 项目会持续数周到数月。
- 痛点是 continuity、上下文压缩、模块漂移。

需求：

- 快速恢复当前任务。
- 控制 token 成本。
- 让不同宿主共享一套项目事实。
- 避免 AI 重复踩坑。

### 3.3 核心用户 3：已有项目维护者

特征：

- 项目已经存在，可能没有完善文档。
- AI 经常不知道从哪里下手。
- 代码模块多，README 不能覆盖真实结构。

需求：

- 一键接入：`cmap adopt`。
- 创建接管骨架和候选信号，由 AI 阅读项目后填写初始地图。
- 后续边开发边补全。

## 4. 核心问题

v0.1 聚焦解决 7 个问题：

1. **项目初始化**：新项目从第一天就有项目目标和模块地图。
2. **已有项目接入**：已有代码可以创建接管工作台，AI 阅读后补全初始地图。
3. **模块定位**：用户自然语言任务能路由到相关模块。
4. **上下文续接**：上下文快满、compact、新会话后能接上主线。
5. **项目记忆沉淀**：工作日志、陷阱、灵感、非主线想法有地方放。
6. **文档漂移治理**：代码变化后能发现 `.context` 可能过期。
7. **确定性维护**：验证和搬运不靠模型自由发挥。

## 5. 产品目标

### 5.1 用户目标

- 小白能通过 `.context` 看懂项目结构。
- AI 能根据 `.context` 快速定位模块。
- 项目做大后不丢主线。
- 新会话 5 分钟内知道当前任务、相关模块、风险和验证命令。
- 项目日志和灵感能沉淀，但不污染正式地图。

### 5.2 工程目标

- CLI 使用 TypeScript 实现。
- v0.1 无需云端、无 telemetry、无 RAG、无 MCP server。
- `.context` 纯 Markdown + frontmatter，可 git 管理。
- `verify` 不修改文件，只输出报告。
- `cp` 行块搬运可恢复、路径安全。
- `install --host both` 能生成 AGENTS.md / CLAUDE.md 双入口。
- hooks 默认关闭，提供 reminder/maintain 两个可选 profile。

### 5.3 成功指标

最小实验中 treatment 相比 baseline：

- 定位时间下降 ≥ 25%。
- token 消耗下降 ≥ 20%。
- 误改无关模块次数下降 ≥ 30%。
- 测试通过率不低于 baseline。
- 人工评分平均提升 ≥ 0.5。
- `.context` 维护成本每任务 ≤ 5 分钟或 ≤ 总任务时间 10%。

## 6. 非目标

v0.1 不做：

- AI coding 全家桶。
- 角色团队。
- 强制 TDD / brainstorming / review / ship 完整流程。
- browser automation。
- 内置 vector DB / RAG server。
- 自动从 transcript 写入 trusted project facts。
- 默认 hooks 强拦截。
- 云端 telemetry。
- 替代 git、CI、测试框架、issue tracker。
- 完整 monorepo 治理。
- 组织级权限/合规治理。

可以支持但不内置：

- review/qa/ship：用轻量 `verify` / `finish` 表达。
- subagent：可以为维护地图生成 pending update，但不默认多 agent 编排。
- hooks：只作为降低维护成本的可选增强。

## 7. 核心产品模型

### 7.1 项目公共记忆五层模型

```text
L1 Canonical Map     正式项目地图，最高可信
L2 Current State     当前主线，新会话必读
L3 Decisions         长期设计决策，按需读
L4 Work Logs         工作过程记忆，考古用
L5 Ideas & Pending   灵感、草稿、低可信建议
```

### 7.2 文件层级

```text
.context/
  BRIEF.md                 # 项目意图：做什么、给谁用、非目标
  MAP.md                   # 主地图：模块、入口、数据流、风险区、alias route
  STATUS.md                # 当前主线：正在做什么、下一步、阻塞、最近变化
  DECISIONS.md             # ADR-lite，为什么这样做
  VERIFY.md                # 验证命令、手工验证、flaky 说明

  modules/
    chat.md
    auth.md
    notification.md

  logs/
    _index.md
    current.md

  ideas/
    _inbox.md
    parking-lot.md
    rejected.md

  pending/
    2026-05-10-chat-sync.md

  traps/
    TRP-001.md

  refs/
    glossary.md
```

### 7.3 信任等级

| 文件 | 可信度 | 新会话是否默认读 | v0.1 写入边界 |
|---|---:|---:|---|
| `BRIEF.md` | 高 | 是 | AI / 用户填写；CLI 只建模板 |
| `MAP.md` | 最高 | 是 | AI / 用户填写；hook 不写 |
| `STATUS.md` | 高 | 是 | AI 总结，CLI checkpoint 校验并写入；hook 不写 |
| `DECISIONS.md` | 最高 | 否，按需 | AI / 用户填写；hook 不写 |
| `VERIFY.md` | 高 | 是 | AI / 用户填写；CLI verify 只读检查 |
| `modules/*.md` | 高 | 相关模块才读 | AI / 用户确认模块语义；CLI add-module 只建模板 |
| `logs/*.md` | 中低 | 否 | `cmap log add` 显式追加；hook 不从 transcript 自动总结 |
| `ideas/*.md` | 低 | 否 | `cmap idea add` 显式追加；不能当事实 |
| `pending/*.md` | 中 | 否 | 待确认建议；v0.1 不自动提升为正式事实 |
| `traps/*.md` | 高 | 相关 bug 才读 | AI / 用户确认后写入；自动化先提醒 |

## 8. 核心用户流程

### 8.1 新项目从 0 开始

```bash
mkdir my-app && cd my-app
npm create vite@latest . -- --template react-ts
cmap init --auto
cmap install --host both
cmap verify
```

AI 应做：

1. 询问少量关键问题，不超过 5 个。
2. 生成 `BRIEF.md`。
3. 生成初版 `MAP.md`。
4. 生成 `STATUS.md`，当前阶段为 `scaffolding` 或 `MVP planning`。
5. 生成 `VERIFY.md`，记录 `npm run dev/test/typecheck` 等。
6. 开始第一个功能前，输出模块影响范围卡。

### 8.2 已有项目接入

```bash
cmap adopt
cmap install --host both
cmap verify
```

`adopt` 行为：

- 创建 `.context/` 目录结构和基础模板。
- 扫描 package、scripts、候选目录等确定性信号。
- 生成 `.context/ADOPTION.md`，告诉 AI 下一步怎么阅读项目。
- 所有候选模块都标记为 `candidate` 或 `low confidence`。
- 不把候选目录直接当成正式项目事实。
- AI 阅读 README、package 文件和代表性源码后，填写 `MAP.md` 与 `modules/*.md`。

### 8.3 日常任务

用户：

```text
多人对话页面消息发不出去，帮我修一下。
```

AI 应执行：

```bash
cmap route "多人对话页面消息发不出去"
```

输出读取建议，而不是代码修改方案：

```markdown
## Route Result

Task: 多人对话页面消息发不出去

Likely modules:
1. chat — matched aliases: 多人对话, 消息, conversation
2. notification — possible impact: unread count

Read first:
- .context/MAP.md
- .context/STATUS.md
- .context/modules/chat.md

Do not touch first:
- auth
- billing

Notes:
- If route confidence is low, inspect source code and update MAP.md aliases.
```

然后 AI 修改代码，最后：

```bash
cmap checkpoint --from-stdin
cmap finish
cmap verify --changed
```

### 8.4 上下文快满 / compact 前

AI 应执行：

```bash
cmap checkpoint --from-stdin
```

写入 `STATUS.md`：

- 当前目标。
- 已完成。
- 当前卡点。
- 下一步。
- 已改文件。
- 验证结果。
- 给新会话的一段简短提示。

### 8.5 任务结束收尾

```bash
cmap finish
```

`finish` 做：

1. 读取 git diff changed files。
2. 运行 `verify --changed`。
3. 检查是否有 pending update 未处理。
4. 生成/更新 `logs/current.md`。
5. 提醒是否需要更新 module docs / STATUS / DECISIONS / traps。
6. 不做 git commit，不替代 CI。

### 8.6 灵感记录

用户：

```text
以后是不是可以根据模块关系生成 Mermaid 图？先记一下。
```

AI/CLI：

```bash
cmap idea add "未来可以根据 MAP.md 生成 Mermaid 模块关系图"
```

写入：

```text
.context/ideas/_inbox.md
```

### 8.7 工作日志沉淀

任务结束时：

```bash
cmap log add "修复 chat 消息发送失败，定位到 optimistic retry 问题"
```

日志先写 `logs/current.md`。v0.1 不做 `log compact`，但在 roadmap 保留。

---

# Part B — 技术规格与执行手册

## 9. TypeScript CLI 技术架构

### 9.1 技术栈建议

```text
Runtime: Node.js >= 20
Language: TypeScript
Package manager: pnpm
CLI framework: commander 或 cac
Schema validation: zod
Markdown frontmatter: gray-matter
Glob: fast-glob
Filesystem: fs-extra 或原生 fs/promises
Process: execa 可选，用于验证命令探测；不要默认执行用户测试命令
YAML/TOML: yaml, smol-toml 或 @iarna/toml
Testing: vitest
Formatting: prettier
Bundling: tsup
```

避免 v0.1 引入：

- SQLite。
- Vector DB。
- MCP server。
- Playwright。
- 云端 LLM SDK。
- 常驻 daemon。

### 9.2 推荐目录结构

```text
src/
  cli.ts
  commands/
    init.ts
    adopt.ts
    install.ts
    route.ts
    status.ts
    checkpoint.ts
    verify.ts
    finish.ts
    add-module.ts
    cp.ts
    log.ts
    idea.ts
    doctor.ts
  context/
    schema.ts
    read-context.ts
    write-context.ts
    route-index.ts
    templates.ts
  fs/
    safe-path.ts
    line-block.ts
    backup.ts
  hooks/
    generate-claude-hooks.ts
    generate-codex-hooks.ts
  host/
    claude.ts
    codex.ts
    entrypoint-template.ts
  verify/
    checks.ts
    reporter.ts
  templates/
    context/
    skills/
    hooks/
tests/
  fixtures/
  unit/
  integration/
```

### 9.3 CLI 命令总览

| 命令 | 作用 | 语义负责 | 修改文件 | 可自动运行 | 状态 |
|---|---|---|---:|---:|---|
| `cmap init --auto` | 新项目初始化 `.context` 模板 | AI / 用户填写语义，CLI 建骨架 | 是 | 否 | v0.1 stable |
| `cmap adopt` | 已有项目创建接管骨架和候选信号 | AI 负责语义，CLI 负责骨架和确定性信号 | 是 | 否 | v0.1 stable |
| `cmap install --host claude|codex|both` | 生成宿主入口/skill，可选 hooks | CLI 负责模板，用户确认安装范围 | 是 | 否 | v0.1 stable |
| `cmap install --host both --hooks reminder` | 安装 reminder hooks | CLI 生成提醒 hook | 是 | 否 | v0.1 stable |
| `cmap install --host both --hooks maintain` | 安装 maintain hooks | Hook 只提醒，AI 判断语义 | 是 | 否 | v0.1 experimental |
| `cmap route "<task>"` | 根据已有地图推荐读取文件 | CLI 关键词/alias 匹配，AI 判断真实影响 | 否 | 是 | v0.1 stable |
| `cmap status` | 输出续接摘要 | CLI 读取已有 STATUS | 否 | 是 | v0.1 stable |
| `cmap checkpoint` | 保存当前主线 | AI 负责总结，CLI 负责格式和写入 | 是 | 否 | v0.1 stable |
| `cmap verify [--changed]` | 一致性检查 | CLI 确定性检查 | 否 | 是 | v0.1 stable |
| `cmap finish` | 任务收尾提醒、日志和 pending 检查 | AI 判断是否更新语义，CLI 输出清单 | 可选 | 否 | v0.1 stable |
| `cmap add-module <name>` | 新增模块文档模板 | AI 填写模块语义，CLI 建模板 | 是 | 否 | v0.1 stable |
| `cmap cp move/copy/delete/restore` | 行块无损搬运 | 用户 / AI 指定内容，CLI 执行确定性搬运 | 是 | 否 | v0.1 stable |
| `cmap log add` | 追加工作日志 | AI / 用户提供内容，CLI append | 是 | 否 | v0.1 stable |
| `cmap idea add` | 追加灵感 | AI / 用户提供内容，CLI append | 是 | 否 | v0.1 stable |
| `cmap doctor` | 安装、入口、hook 状态诊断 | CLI 检查确定性状态 | 否 | 是 | v0.1 stable |
| `cmap version` | 输出版本 | CLI | 否 | 是 | v0.1 stable |

## 10. `.context` schema 规格

### 10.1 统一 frontmatter

所有正式 `.context` 文件建议有 frontmatter：

```yaml
---
cmap_version: 0.1
context_type: map|status|decision|verify|module|log|idea|pending|trap
project: <project-name>
source_commit: <git-sha-or-unknown>
updated_at: <iso-8601>
confidence: high|medium|low|human-reviewed|ai-drafted|candidate
---
```

### 10.2 `BRIEF.md`

用途：项目意图。小白从 0 开始时最重要。

```markdown
---
context_type: brief
confidence: high
---
# Project Brief

## One-liner

## Target Users

## Core Use Cases

## MVP Scope

## Non-goals

## Product Constraints

## Current Stage

## Notes for AI
```

写作规则：

- 不写技术细节过多。
- 重点写“用户为什么要这个项目”。
- `Non-goals` 必填，避免 AI 自我膨胀。

### 10.3 `MAP.md`

用途：主地图。

```markdown
---
context_type: map
confidence: high
---
# Project Map

## Purpose

## Tech Stack & Runtime

## Entry Points

## Module Map
| Module | Purpose | Paths | Doc | Aliases |
|---|---|---|---|---|

## Natural Language Route
| User Words | Module | Read First |
|---|---|---|

## Module Relationships

## Data Flow

## State / Storage

## External Integrations

## Risk Areas

## Verification Summary

## Handoff Notes
```

`Natural Language Route` 是 v0.1 的关键字段。例如：

```markdown
| 多人对话、聊天、群聊、message、conversation | chat | modules/chat.md |
| 未读数、提醒、通知、notification | notification | modules/notification.md |
| 登录、账号、session、token | auth | modules/auth.md |
```

### 10.4 `STATUS.md`

用途：当前主线，新会话必读。目标 30-80 行。

```markdown
---
context_type: status
branch: main
source_commit: abc123
last_verified: 2026-05-10T17:30:00+08:00
---
# Status

## Active Goal

## Done Recently

## Left Off

## Next Steps

## Changed Files

## Risks

## Last Verified
```

强规则：

- 只记录当前主线，不塞历史全集。
- 上下文快满前必须更新。
- 如果 `source_commit` 落后当前 HEAD，`verify` warning。

### 10.5 `DECISIONS.md`

用途：ADR-lite。只写长期有效决策。

```markdown
# Decisions

## YYYY-MM-DD — <title>

**Context:** 当时遇到什么约束/问题。
**Decision:** 做了什么决定。
**Why:** 为什么选它，不选什么。
**Impact:** 影响哪些模块/后续约束。
**Revisit if:** 什么条件出现时应推翻。
```

### 10.6 `VERIFY.md`

用途：验证路线图。

```markdown
# Verification

## Required Commands
| Purpose | Command | Expected | When |
|---|---|---|---|

## Module-specific Checks
| Module | Command | Manual Check |
|---|---|---|

## Optional Commands

## Manual Verification

## Known Flaky Checks

## Environment Assumptions
```

### 10.7 `modules/<name>.md`

```markdown
---
context_type: module
module: chat
paths:
  - src/features/chat
aliases:
  - 多人对话
  - 聊天
  - 消息
  - conversation
  - message
confidence: human-reviewed | ai-drafted | candidate
---
# Module: chat

## Purpose

## Code Paths

## Responsibilities

## Depends On

## Used By

## Data Flow

## State / Storage

## Constraints

## Traps

## Tests / Verification

## When to Update This Doc
```

不写：

- 完整函数签名。
- 类方法列表。
- import 清单。
- 代码能直接读出的内部细节。

### 10.8 `logs/current.md`

```markdown
# Current Work Log

## YYYY-MM-DD — <task title>

**Goal:**
**Changed:**
**Tried:**
**Result:**
**Verification:**
**Memory Impact:**
**Next:**
```

### 10.9 `ideas/_inbox.md`

```markdown
# Idea Inbox

## 2026-05-10 — 根据 MAP 生成 Mermaid 模块图

**Idea:** 根据 MAP.md 和 modules/*.md 生成 Mermaid 模块关系图。
**Status:** raw
**Source:** user
**Why interesting:** 小白更容易理解模块关系。
**Why not now:** v0.1 先验证文字地图是否有效。
**Revisit if:** 用户反馈文字地图仍然难理解。
```

### 10.10 `pending/*.md`

用途：待确认的上下文更新建议，不是正式项目事实。v0.1 中 hook 只提醒，不自动把 pending 提升为正式记忆。

```markdown
# Pending Context Update: <topic>

## Trigger

## Changed Files

## Suggested Updates

### STATUS.md

### MAP.md

### modules/<name>.md

### DECISIONS.md

### traps/

## Confidence
low|medium|high

## Required Check

## Do Not Promote Until
```

## 11. 项目规模分级策略

### 11.1 scale profiles

| Scale | 项目状态 | 文件策略 | AI 读取策略 |
|---|---|---|---|
| S0 | 0-5 文件，demo | 可只用 `BRIEF.md + STATUS.md` | 不强制 modules |
| S1 | 5-10 文件，小项目 | `MAP.md + STATUS.md + VERIFY.md` | 读 MAP/STATUS |
| S2 | 10-30 模块，中型 | 增加 `modules/*.md` | 读相关 1-3 个 modules |
| S3 | 30-60 模块，大型 | 增加 alias route、logs index、domain grouping 建议 | 先 route，再读 domain/module |
| S4 | 60+ 模块/monorepo | 多 domain context，v0.2 支持 | 必须 domain-first，不读全局全集 |

### 11.2 scale 提示词模板

#### S0/S1 项目提示词

```text
这个项目还小。不要生成过多模块文档。请只维护 BRIEF.md、MAP.md、STATUS.md、VERIFY.md。
如果新增代码文件不改变模块边界，不需要更新 modules/。
```

#### S2 项目提示词

```text
这个项目已有明确模块。接到任务后，先用 cmap route 推荐 1-3 个相关模块文档，再读对应 modules/*.md。
不要全量读取所有模块文档。只有模块职责、依赖、数据流变化时才更新模块文档。
```

#### S3 项目提示词

```text
这个项目已经进入大项目阶段。不要凭关键词直接改代码。
先读 MAP.md 的 Natural Language Route 和 Module Relationships。
如果 route 推荐超过 3 个模块，先让 AI 阅读后输出影响范围卡，并请用户确认主模块。
如发现模块自然聚类，记录到 ideas/parking-lot.md，不要立即重组。
```

#### S4 项目提示词

```text
这个项目规模很大。禁止全仓库扫描式理解。
先定位 domain，再读 domain index，再读具体 module。
任务只允许选择一个 primary module 和最多两个 affected modules。
需要更大改动时，先生成 pending plan，不直接实施。
```

### 11.3 token budget 建议

| 文件 | 目标大小 |
|---|---:|
| `AGENTS.md` / `CLAUDE.md` | < 80 行 |
| `BRIEF.md` | < 80 行 |
| `MAP.md` | < 200 行 |
| `STATUS.md` | 30-80 行 |
| `modules/*.md` | 50-150 行 |
| `DECISIONS.md` | 20-40 条后归档 |
| `logs/current.md` | 最近 3-10 条 |
| `ideas/_inbox.md` | 超过 30 条后整理 |

## 12. route 设计

### 12.1 目标

`cmap route "任务描述"` 解决“AI 不知道该改哪里”的问题。

它不直接给代码修改方案，只输出推荐读取文件和低风险提醒。AI 必须阅读项目后判断真实影响范围。

输入：

```bash
cmap route "多人对话界面消息发不出去"
```

输出：

```markdown
## Route Result

Task: 多人对话界面消息发不出去

Likely modules:
1. chat — matched aliases: 多人对话, 消息, conversation
2. notification — possible impact: unread count

Read first:
- .context/MAP.md
- .context/STATUS.md
- .context/modules/chat.md

Do not touch first:
- payment
- report

Notes:
- If route confidence is low, inspect source code and update MAP.md aliases.
```

### 12.2 v0.1 行为边界

- 不使用 embedding / RAG。
- 不做复杂语义推理。
- 基于 `.context/MAP.md`、`modules/*.md` 中的 `aliases`、模块名、路径、关键词进行匹配。
- 输出推荐读取文件，而不是直接给出代码修改方案。
- 如果没有高置信匹配，应提示 AI 阅读项目并补充 `MAP.md` / module aliases。

### 12.3 简单 ranking 算法 v0.1

打分来源：

- alias 命中：+5。
- module name 命中：+4。
- path keyword 命中：+3。
- `MAP.md` 的 Natural Language Route 命中：+2。
- git changed files 相关：+1。

低置信规则：

- 没有 alias / module name 命中时，不输出主模块断言。
- 只输出“Read first”和“请补充 aliases / MAP”的提醒。
- 不根据任务文本编造不存在的模块。

### 12.4 Route Card 模板

```markdown
## Route Result

Task: <user task>

Likely modules:
1. <module> — matched aliases: <aliases>
2. <module> — possible impact: <reason>

Read first:
- .context/MAP.md
- .context/STATUS.md
- .context/modules/<module>.md

Do not touch first:
- <modules>

Notes:
- If route confidence is low, inspect source code and update MAP.md aliases.
```

## 13. verify 设计

### 13.1 分层检查

#### L0 确定性检查，v0.1 必做

- `.context` 必需文件存在。
- frontmatter 合法。
- 必需 heading 存在。
- `MAP.md` module 表引用的 module doc 存在。
- module doc 中 `paths` 存在。
- `VERIFY.md` 命令能从 package.json / Makefile / pyproject 等推断到。
- `STATUS.md source_commit` 是否落后当前 HEAD。
- `STATUS.md` 缺少关键字段。
- `TODO(ai-fill)` 残留。
- `AGENTS.md / CLAUDE.md` 是否同源。
- pending 文件是否超过阈值未处理。

#### L1 结构性检查，v0.1 可做

- A 依赖 B，但 B 没记录 Used By A。
- changed files 所属模块文档 updated_at 早于代码变更。
- 新增目录疑似新模块但未加入 MAP。
- 删除路径后 module doc 仍引用。
- logs/current 过长。
- ideas/_inbox 过长。

#### L2 AI 辅助检查，v0.2

- 代码语义和模块职责是否冲突。
- diff 是否暗示数据流变化。
- 决策是否需要新增。
- trap 是否值得沉淀。

L2 只生成 pending，不自动写正式文件。

### 13.2 verify 输出

```text
✓ Structure: all required files exist
✓ Modules: 8 modules indexed, 8 docs found
⚠ STATUS: source_commit is 4 commits behind HEAD
⚠ Module docs: src/features/chat changed after modules/chat.md updated_at
⚠ Pending: 2 pending updates older than 3 days
✗ MAP: module billing points to missing path src/features/billing

Errors: 1, Warnings: 3
```

退出码：

- 0：无 error。
- 1：有 error。
- 2：CLI 使用错误。

### 13.3 JSON 输出

```bash
cmap verify --format json
```

用于 hooks/IDE。

## 14. checkpoint 设计

### 14.1 命令

```bash
cmap checkpoint --from-stdin
cmap checkpoint --goal "修复多人对话消息发送失败" \
  --done "已定位 optimistic retry 问题" \
  --next "补测试并验证 notification 未读数" \
  --files "src/features/chat/send-message.ts,src/features/chat/message-store.ts"
```

`checkpoint` 解决“上下文压缩 / 新会话接不上”的问题。

关键原则：

- 语义总结由 AI 生成。
- CLI 只负责格式校验、写入或生成模板。
- 不从 transcript 自动学习，不自动总结完整会话。
- `checkpoint` 不是 git commit，不替代 git log，不自动提交代码。
- 写入目标是 `.context/STATUS.md`，可选追加摘要到 `.context/logs/current.md`。

### 14.2 AI checkpoint prompt

```text
请把当前会话压缩成 cmap checkpoint。只记录可帮助新会话接手的事实，不要写无关聊天。

必须包含：
1. Active Goal
2. Done Recently
3. Left Off
4. Next Steps
5. Changed Files
6. Risks
7. Last Verified

不要写：
- 长篇过程细节
- 未确认猜测
- 用户个人偏好
- 已经放弃的方案，除非它会避免重复踩坑
```

### 14.3 STATUS 更新策略

- checkpoint 覆盖 `STATUS.md` 的当前主线部分。
- 旧内容如仍有价值，转入 `logs/current.md`。
- 不自动写 DECISIONS。
- 如果发现重要决策，生成 pending decision。
- 缺少关键字段时 warning，不把空字段伪装成已完成。

## 15. finish / context review / QA-lite

### 15.1 为什么不是完整 review/qa/ship

cmap 的任务不是发布项目，而是确保项目记忆不断。

因此 v0.1 的三件事：

```text
context review  = 检查上下文和模块边界是否同步，由 finish 提醒
verify         = 根据 VERIFY.md 给出验证路线和结构检查
finish         = 收尾：checkpoint + log + pending + verify
```

### 15.2 `cmap finish` 输出

```markdown
# Finish Report

## Changed Modules
- chat
- notification

## Context Updates Needed
- STATUS.md: yes
- modules/chat.md: maybe, retry flow changed
- DECISIONS.md: no
- traps/: maybe, optimistic message stuck bug

## Pending Updates
- .context/pending/2026-05-10-chat-retry.md

## Verification
- npm run typecheck: not recorded
- npm test -- chat: not recorded
```

### 15.3 finish prompt

```text
请作为 cmap finish assistant 检查本轮任务是否完成项目记忆收尾。

只判断以下内容：
- 当前主线是否更新到 STATUS.md
- changed files 是否对应 MAP/modules 中的模块
- 如果模块职责/依赖/数据流变化，是否更新 module doc
- 如果做出长期设计取舍，是否需要 DECISIONS.md
- 如果发现稳定坑点，是否需要 traps/
- 是否需要写工作日志
- 是否还有 pending update 未处理
- VERIFY.md 中对应命令是否已运行或明确未运行

不要做：
- 不做完整代码 review
- 不做安全审计
- 不做发布
- 不替代 CI
```

## 16. hooks 策略

### 16.1 原则

- 默认不安装 hooks。
- hooks 用来降低地图维护成本，不用来强制控制 AI。
- hooks 不直接写正式 `MAP.md / STATUS.md / DECISIONS.md / modules/*.md`。
- hooks 不从 transcript 自动总结到 `logs/`，也不自动把灵感写进 `ideas/`。
- hooks maintain 只提醒 AI，不替 AI 修改项目记忆。
- hook 所有自动行为都要可关闭、可诊断。

安装示例：

```bash
cmap install --host both --hooks reminder
cmap install --host both --hooks maintain
```

### 16.2 profiles

| profile | 用途 | 自动写正式记忆 | v0.1 状态 |
|---|---|---:|---|
| `none` | 无 hooks | 否 | 默认 |
| `reminder` | SessionStart/Stop 提醒 | 否 | stable |
| `maintain` | changed files / 受影响 context / verify 提醒 | 否 | experimental，默认关闭 |

### 16.3 Claude reminder hook 示例

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "cmap hooks session-start --profile reminder"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cmap hooks stop --profile reminder"
          }
        ]
      }
    ]
  }
}
```

### 16.4 Codex reminder hook 示例

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "cmap hooks session-start --profile reminder",
            "statusMessage": "Loading cmap project map reminder"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cmap hooks stop --profile reminder",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### 16.5 maintain hook 行为

v0.1 `maintain` 是 experimental。Stop hook 行为：

```text
1. 检测 changed files。
2. 输出可能受影响的 context 文件。
3. 运行或提醒运行 cmap verify --changed。
4. 提醒 AI 判断是否需要更新 STATUS / MAP / modules / logs / ideas / traps。
```

输出示例：

```markdown
## cmap maintain reminder

Changed files detected:
- src/features/chat/send-message.ts
- src/features/chat/message-store.ts

Likely affected context:
- .context/modules/chat.md
- .context/STATUS.md
- .context/logs/current.md

Please check:
1. Did module responsibility change?
2. Did module dependency change?
3. Did data flow change?
4. Was a new trap discovered?
5. Should STATUS.md be updated?
6. Should a work log be added?

Suggested commands:
- cmap route "current task"
- cmap checkpoint --from-stdin
- cmap verify --changed
```

### 16.6 严格禁止

- hook 自动写 `MAP.md`
- hook 自动写 `STATUS.md`
- hook 自动写 `modules/*.md`
- hook 自动写 `DECISIONS.md`
- hook 自动把 transcript 总结写进 logs
- hook 自动把灵感写进 ideas
- hook 自动把 pending 提升为正式项目事实

## 17. AGENTS.md / CLAUDE.md 双宿主入口

### 17.1 入口原则

- 入口要短。
- 不要塞完整规则。
- 只告诉 AI 去哪里读。
- AGENTS.md / CLAUDE.md 同源生成。
- `CLAUDE.md` 可以 import `AGENTS.md`，但为了跨平台可读，v0.1 也可以直接生成同内容。

### 17.2 模板

```markdown
# Project: <name>

This project uses cmap: a shared project map for humans and AI coding agents.

## Start Here
1. Read `.context/MAP.md` for the project map.
2. Read `.context/STATUS.md` for the current main thread.
3. Use `cmap route "<task>"` to find relevant modules.
4. Before editing a module, read its `.context/modules/<module>.md` file.
5. Before claiming done, run `cmap finish` and `cmap verify --changed`.

## Rules
- Do not read every `.context` file by default. Read by route.
- Do not treat `logs/`, `ideas/`, or `pending/` as canonical facts.
- Only `MAP.md`, `STATUS.md`, `DECISIONS.md`, `VERIFY.md`, and `modules/*.md` are trusted project memory.
- If code changes module responsibilities, dependencies, data flow, or verification, update `.context`.
- If context is getting full, run `cmap checkpoint`.

## Tools
- `cmap route "task"` — locate relevant modules.
- `cmap checkpoint` — save the current main thread.
- `cmap finish` — close the task and suggest context updates.
- `cmap verify` — check project map consistency.
- `cmap cp` — move/copy/delete existing line blocks losslessly.
```

## 18. cmap Skill 设计

### 18.1 Skill 触发条件

应该触发：

- 用户明确说“用 cmap”。
- 项目已经有 `.context/`。
- 用户说“项目越来越乱”“AI 经常忘”“接着上次做”。
- 用户在长期项目中要求新增功能/修 bug。
- 上下文快满，需要 checkpoint。

不应触发：

- 单文件脚本。
- 一次性 demo。
- 用户只是问概念问题。
- 项目没有 `.context` 且用户没同意使用。

### 18.2 Codex/Claude 通用 SKILL.md 草案

```markdown
---
name: cmap
description: |
  Project map and public project memory for AI coding. Use when the project has .context/, when the user says "use cmap", "用 cmap", "continue the project", "接着做", or when the AI needs to locate modules, preserve context before compaction, or update project memory. Do not use for one-off scripts unless the user opts in.
---
# cmap — Project Map for AI Coding

cmap keeps a small project map beside the code so humans and AI can share the same understanding.

## Standard workflow
1. If `.context/` exists, read `.context/MAP.md` and `.context/STATUS.md` first.
2. Run `cmap route "<task>"` to identify relevant modules.
3. Read only the relevant module docs.
4. Code normally.
5. If module responsibilities, dependencies, data flow, traps, or verification changed, update `.context`.
6. If the session is long or context is getting full, run `cmap checkpoint`.
7. Before completion, run `cmap finish` and `cmap verify --changed`.

## Memory trust rules
- Canonical: BRIEF, MAP, STATUS, DECISIONS, VERIFY, modules.
- Non-canonical: logs, ideas, pending.
- Pending updates are suggestions, not facts.

## Use cmap cp only for moving existing content
Use `cmap cp` for line-block lossless move/copy/delete. Do not use it for writing new code.
```

## 19. adopt 设计

`adopt` 用于“接管已有项目，建立初始项目地图的工作台”。它必须是 **AI-assisted adoption**，不是 **CLI-generated project map**。

关键原则：

- CLI 不理解已有项目。
- CLI 只创建接管工作台。
- AI 阅读项目后填写地图。
- CLI 最后运行 `verify` 检查结构。

命令：

```bash
cmap adopt
```

### 19.1 v0.1 行为

- 创建 `.context/` 目录结构。
- 创建 `BRIEF.md / MAP.md / STATUS.md / DECISIONS.md / VERIFY.md` 骨架。
- 创建 `modules/ / logs/ / ideas/ / pending/ / traps/` 目录。
- 扫描确定性信号。
- 生成 `.context/ADOPTION.md`，告诉 AI 下一步怎么阅读项目。
- 所有候选模块都标记为 `candidate` 或 `low confidence`。
- 不把候选目录直接当成正式项目事实。

### 19.2 扫描输入

- package.json / pnpm-lock / yarn.lock / pyproject / go.mod / Cargo.toml。
- scripts。
- src/features / src/modules / app / pages 等候选目录。
- existing AGENTS.md / CLAUDE.md。
- README。

### 19.3 生成原则

自动生成内容必须标记：

```yaml
source: auto-adopt
confidence: candidate
needs_review: true
```

候选模块可以进入 `.context/ADOPTION.md`，但不能直接写成 `MAP.md` 的正式事实。AI 必须阅读项目并确认模块边界后，才补全 `MAP.md` 和 `modules/*.md`。

### 19.4 `ADOPTION.md` 示例

```markdown
# Adoption Guide

This project is being adopted into cmap.

## Deterministic Signals

Detected stack:
- TypeScript
- React
- Vite

Detected scripts:
- npm run dev
- npm run build
- npm run test

Candidate module directories:
- src/features/chat
- src/features/auth
- src/features/settings

## Important

These are only candidates.
Do not treat them as trusted project facts.

AI must:
1. Read README and package files.
2. Inspect representative source files.
3. Confirm module boundaries.
4. Fill MAP.md.
5. Create or complete modules/*.md.
6. Update STATUS.md.
7. Update VERIFY.md.
8. Run cmap verify.
```

## 20. log / idea / memory 沉淀

v0.1 同时提供文件结构和最小 append 命令：

```text
.context/
  logs/
    current.md
    _index.md
  ideas/
    _inbox.md
    parking-lot.md
    rejected.md
  pending/
```

```bash
cmap log add "修复 chat 消息发送失败，定位到 optimistic retry 问题"
cmap idea add "未来可以根据 MAP.md 生成 Mermaid 模块关系图"
```

### 20.1 工作日志原则

工作日志记录“发生过什么”，不是正式项目事实。

必须记录：

- 长 debug 过程。
- 重复踩坑。
- 失败但值得避免重复的尝试。
- 任务结束摘要。

不需要记录：

- 每个小改动。
- 普通格式调整。
- 对话流水账。

### 20.2 ideas 原则

ideas 记录非主线灵感，不污染 `MAP.md`。

状态流：

```text
raw → parked → active → promoted
raw → rejected
```

v0.1 只做 `idea add`。复杂 `idea promote / park / reject` 命令放 v0.2。

只有当 idea 进入主线并经 AI / 用户确认，才可能影响：

- `BRIEF.md`。
- `MAP.md`。
- `DECISIONS.md`。
- roadmap。

### 20.3 pending 原则

`pending/` 用于待确认的上下文更新建议，不是正式项目事实。v0.1 不做 `memory promote`，也不允许 hook 自动把 pending 提升为正式项目事实。

### 20.4 v0.1 不做

- 不做复杂 `idea promote / park / reject` 命令，这些放 v0.2。
- 不做 `log compact`，但在 roadmap 里保留。
- 不把 ideas 写入 `MAP.md`。
- 不从 transcript 自动生成 logs。

## 21. cp 规格

### 21.1 命令

```bash
cmap cp move <from-file>[:<line-range>] <to-file>:<position>
cmap cp copy <from-file>[:<line-range>] <to-file>:<position>
cmap cp delete <file>:<line-range>
cmap cp restore <backup-id>
```

### 21.2 安全规则

- 所有路径必须在 cwd/git root 内。
- 拒绝越界 symlink。
- move/delete 前必须备份。
- 备份保留默认 7 天。
- 支持 `--dry-run`。
- 保留目标文件换行风格。
- BOM、CRLF、无尾换行要有测试。

### 21.3 适用场景

适用：

- 模块拆分。
- 文档重组。
- 决策归档。
- trap 抽取。

不适用：

- 写新代码。
- 修 bug。
- 改内部逻辑。
- 重新表达文档。

## 22. 安全设计

### 22.1 文件系统安全

- `path-safe.ts` 统一做路径解析。
- cwd root 默认 git root。
- 拒绝 `..` 跳出 root。
- 拒绝绝对路径越界。
- 拒绝 symlink 指向 root 外。
- 不默认写 home，除非 `install` 明确需要。

### 22.2 secrets

`verify` 对 `.context` 做轻量 secret pattern warning：

- API key。
- token。
- private key header。
- password-like lines。

只 warning，不打印 secret 原文。

### 22.3 telemetry

v0.1：

- 无 telemetry。
- 无云端。
- 无账户。
- 无自动上传。

### 22.4 trusted facts

正式项目事实只能来自：

- 用户确认。
- 已存在代码。
- 已通过 checkpoint 的明确当前状态。
- 已 promote 的 pending。

不能直接把 transcript、AI 猜测、外部网页写进正式地图。

## 23. 测试计划

### 23.1 v0.1 验收标准：route

- 给定 aliases，能正确匹配模块。
- 匹配低置信时，不编造答案。
- 输出推荐读取文件。

### 23.2 v0.1 验收标准：checkpoint

- AI 输入结构化 markdown 后，能更新 `STATUS.md`。
- 缺少关键字段时 warning。
- 不自动从 transcript 总结。

### 23.3 v0.1 验收标准：adopt

- 能在已有 TS 项目中创建 adoption 工作台。
- 候选模块全部标记 `candidate` / `low confidence`。
- 不生成未经 AI 确认的正式模块语义。

### 23.4 v0.1 验收标准：logs / ideas

- 能创建默认文件结构。
- `log add` 能 append 到 `logs/current.md`。
- `idea add` 能 append 到 `ideas/_inbox.md`。
- ideas 不进入 `MAP.md`。

### 23.5 v0.1 验收标准：hooks maintain

- 默认不安装。
- reminder hook 不修改文件。
- maintain hook 只输出提醒，不修改正式项目记忆。
- doctor 能识别 hook 是否安装。

### 23.6 v0.1 验收标准：verify

- 能发现 `TODO(ai-fill)`。
- 能发现 `MAP.md` 引用模块文档不存在。
- 能发现 module paths 不存在。
- 能发现 `AGENTS.md / CLAUDE.md` 入口不一致。
- 能发现 `STATUS.md` 缺关键字段。

### 23.7 单元测试

- path-safe 越界。
- cp line-range。
- markdown frontmatter。
- schema validation。
- route ranking。
- verify checks。

### 23.8 集成测试 fixtures

```text
empty-project
small-ts-project
small-python-project
existing-react-project
existing-backend-project
project-with-drift
project-with-pending
project-with-crlf
```

### 23.9 行为测试

测试 AI 是否真的：

- 先读 MAP/STATUS。
- 用 route 推荐读取模块。
- 不全量读 logs/ideas。
- 改模块前读 module doc。
- 任务结束运行 finish/verify。
- 上下文快满时 checkpoint。

### 23.10 续接实验

Baseline：README + 源码。  
Treatment：README + `.context` + AGENTS/CLAUDE + cmap CLI。

指标：

- 定位时间。
- token 消耗。
- 误改率。
- 测试通过率。
- 人工介入次数。
- 模块影响卡质量。

## 24. Roadmap

### v0.1

- `init`。
- `adopt`。
- `route`。
- `checkpoint`。
- `status`。
- `verify`。
- `finish`。
- `cp`。
- `add-module`。
- `log add`。
- `idea add`。
- `install` dual host。
- hooks reminder stable。
- hooks maintain experimental。

### v0.2：Trust Boundary + Human Review Layer

v0.2 的判断标准从“让 CLI 更会分析代码”改为“让 AI 的理解可审阅、可验证、可回滚，并且不污染 canonical facts”。

- PR-A Roadmap Reset：暂停旧 import graph / route v2 / pack v2 路线，把 graph 明确定义为 canonical module relations projection。
- PR-B `cmap view export` MVP：生成只读 HTML 项目地图审阅台，展示 canonical modules、relations、verify、checkpoint，并在缺 generated/freshness/relation 数据时降级为 `Not available`。
- PR-C Trust-Boundary Hygiene + Lifecycle Ingest + Codex Workflow：收敛 pending/inbox、stats/generated、evidence/generated；Claude hook ingest supported，Codex hook ingest experimental，Codex start/finish/guard 是正式主路径。
- PR-C2 Freshness v2：以 `.context/generated/freshness.json` 和 generated evidence 作为新鲜度数据源，区分 `baseline` 与 `reviewed`。
- PR-D AI Relation Candidate Workflow：AI 读代码提出 relation/alias/path candidates；CLI 校验、审计、写 inbox；route 只提示 pending candidates，不消费 unpromoted candidates。

v0.2 不做：

- CLI import graph / test ownership graph。
- route v2 复杂 scoring。
- pack v2 priority assembly。
- 浏览器内 apply/promote。
- 自动把候选关系写入 canonical graph。

### v0.3

- 根据 v0.2 dogfood 结果决定是否扩展 monorepo、split-index、pack handoff 或 CI 发布体验。
- 只有在 HTML review 与 relation candidate 工作流稳定后，才重新评估轻量代码索引是否值得进入 research/proposal。
- optional ecosystem integrations。

长期不做或不作为核心：

- AI coding 全家桶。
- 角色团队。
- 浏览器自动化。
- 内置 RAG/vector DB。
- 自动从 transcript 写正式项目事实。
- 默认 hooks 强拦截。
- 替代 git/CI/test framework/issue tracker。

## 25. 里程碑执行顺序

### M1：CLI 骨架 + `.context` 模板

完成标准：

- `cmap init --auto` 可生成完整结构。
- `cmap verify` 可检查必需文件。
- `cmap install --host both` 可生成入口。

### M2：route + checkpoint

完成标准：

- `cmap route` 能根据 alias 找模块。
- `cmap checkpoint` 能更新 STATUS。
- 新会话能用 STATUS 接上。

### M3：cp + finish

完成标准：

- `cp` 支持 move/copy/delete/restore。
- `finish` 能生成收尾报告和日志。

### M4：adopt 已有项目

完成标准：

- TS/React 和 Python 项目能创建接管骨架。
- 生成 `ADOPTION.md`，候选模块全部标记 candidate / low confidence。
- 不生成未经 AI 确认的正式模块语义。

### M5：hooks optional

完成标准：

- Claude reminder/maintain 可用。
- Codex reminder/maintain 可用。
- `doctor` 能检测 hooks 状态。

### M6：dogfood eval

完成标准：

- cmap repo 自己使用 cmap。
- 至少 6 个任务做 baseline/treatment。
- 输出实验证据。

## 26. 风险与反证条件

| 风险 | 反证信号 | 处理 |
|---|---|---|
| AI 不读 `.context` | route/entry 无效 | reminder hook、缩短入口、行为测试 |
| AI 读了不用 | 仍误改模块 | route 先输出读取建议，AI 再给影响范围 |
| 文档漂移 | verify 噪音高/漏报 | hash、pending、finish 强化 |
| 维护成本太高 | 每任务维护 >10% 时间 | 减少必填字段、maintain reminder |
| logs/ideas 污染主线 | AI 引用 raw idea 当事实 | trust levels、入口红线 |
| hooks 带来安装复杂 | 用户关掉 hooks | 默认 none，hooks 可选 |
| 产品膨胀 | 用户期待全流程团队 | 明确 non-goals |

## 27. 实现注意事项

### 27.1 不要过度模板化

模板是起点，不是项目事实。自动生成时尽量短，留给 AI 和用户逐步补。

### 27.2 不要把 README 当唯一入口

AGENTS/CLAUDE 是宿主入口，`.context/MAP.md` 是项目地图入口，README 是人类安装入口。

### 27.3 不要默认读长日志

新会话默认读：

```text
MAP.md
STATUS.md
VERIFY.md
相关 modules/*.md
```

按需才读：

```text
DECISIONS.md
logs/
ideas/
pending/
traps/
```

### 27.4 不要自动 promote

v0.1 自动化只提醒，不写正式项目事实。v0.2 如果引入 pending 生成，也必须保持“pending 不是事实”，正式项目事实需要主 agent 或用户确认。

### 27.5 PRD 也是执行手册

开发时从 M1 开始，不要先做 v0.2：

```text
先让地图能创建、能读、能续接、能校验。
再让地图更聪明。
```

---

# 附录 A — 常用提示词库

## A1. 项目启动提示词

```text
我们用 cmap 开发这个项目。请先帮我把项目目标和第一版项目地图落到 .context/。不要急着写全部功能，先完成：BRIEF.md、MAP.md、STATUS.md、VERIFY.md。然后给我一个 3-5 步 MVP 开发顺序。
```

## A2. 已有项目接入提示词

```text
这个项目已经存在，请用 cmap adopt 创建接管工作台和 ADOPTION.md。然后由 AI 阅读 README、package 文件和代表性源码，补全 MAP.md 与 modules/*.md。候选目录只能标 candidate / low confidence，不要把猜测写成事实。
```

## A3. 日常任务提示词

```text
请用 cmap route 先输出推荐读取文件。读完 MAP/STATUS/相关 modules 后，再告诉我 primary module、affected modules、风险和验证命令。不要全量读 logs/ideas。
```

## A4. 上下文快满提示词

```text
当前上下文快满。请运行 cmap checkpoint，把当前主线、已完成、卡点、下一步、改过的文件和验证状态写入 STATUS.md。不要写长篇聊天总结，只保留新会话接手必需的信息。
```

## A5. 文档漂移处理提示词

```text
请根据本轮 git diff 检查 .context 是否可能漂移。不要直接修改正式 MAP/DECISIONS/modules，先生成 pending update。只在确认模块职责、依赖、数据流或验证方式变化时建议更新正式文件。
```

## A6. 灵感记录提示词

```text
这个想法先不要进入主线。请记录到 .context/ideas/_inbox.md，标记 status=raw，写清楚 why interesting、why not now、revisit if。
```

## A7. finish 提示词

```text
请执行 cmap finish：检查本轮任务是否更新 STATUS、是否需要更新相关 module doc、是否需要新增 DECISIONS/traps/logs/ideas，最后运行 cmap verify --changed。不要替代 CI，不要做完整发布。
```

---

# 附录 B — v0.1 package.json 建议

```json
{
  "name": "cmap",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "cmap": "dist/cli.js"
  },
  "scripts": {
    "build": "tsup src/cli.ts --format esm --dts",
    "test": "vitest run",
    "dev": "tsx src/cli.ts",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "latest",
    "zod": "latest",
    "gray-matter": "latest",
    "fast-glob": "latest",
    "execa": "latest",
    "yaml": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "tsx": "latest",
    "tsup": "latest",
    "vitest": "latest",
    "@types/node": "latest"
  }
}
```

---

# 附录 C — 首批开发任务拆分

## Task 1：项目骨架

- 初始化 TS CLI。
- commander 路由。
- `cmap version`。
- Vitest。

## Task 2：模板与 init

- templates/context。
- `init --auto`。
- 基础扫描 package.json。

## Task 3：schema + verify L0

- frontmatter 解析。
- heading 检查。
- 必需文件检查。
- paths 检查。

## Task 4：install host

- AGENTS/CLAUDE 同源生成。
- host adapters。
- doctor 检查。

## Task 5：route

- alias 表解析。
- scoring。
- text/json 输出。

## Task 6：checkpoint/status

- STATUS 写入。
- status summary。

## Task 7：cp

- line range。
- move/copy/delete。
- backup/restore。
- path safety。

## Task 8：finish/log/idea

- finish report。
- log add。
- idea add。

## Task 9：adopt

- existing project scanner。
- adoption workspace。
- candidate signals。
- ADOPTION.md。

## Task 10：hooks optional

- reminder。
- maintain reminder。
- Claude/Codex configs。

---

# 附录 D — 最终 README 首屏草案

```markdown
# cmap

给 AI coding 的项目小地图。

cmap 在你的项目里维护一组 `.context/` 文件，记录项目目标、模块关系、当前主线、历史决策、验证方式、工作日志和灵感池。人能看，AI 也能看。

当你从 0 到 1 做项目、上下文被压缩、新会话重新接手、或者项目模块越来越多时，AI 可以先读这张地图，快速知道：

- 现在在做什么
- 该改哪个模块
- 会影响哪些地方
- 哪些决策不能忘
- 改完怎么验证

cmap 不是 AI coding 全家桶。它只做一件事：让项目持续可理解。
```
