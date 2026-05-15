# CMAP 项目更新流程

> 更新时间：2026-05-14
> 范围：梳理 `CMAP_coding` 从 v0.1 原型到 v0.2 Trust Boundary + Human Review Layer，再到 2026-05-14 review POC 合并的主要更新过程。
> 说明：`research/` 与 `CMAP_review/` 是本地研究/评审工作区，不再作为 GitHub 正式内容上传；本文件是从这些本地材料和 Git commit 历史中提炼出来的正式项目更新记录。

## 0. 一句话总览

`cmap` 的主线不是做一个新的 AI coding 全家桶，而是逐步收敛成：

```text
repo-local 项目记忆地图 + 确定性维护 CLI + 人类审阅层
```

核心边界一直在收窄：

- AI 负责理解项目、提出语义候选、写候选说明。
- CLI 负责初始化骨架、路由、校验、搬运、生成 evidence、写 inbox、做 audit。
- `.context/` 是 canonical 项目事实源。
- `research/`、`CMAP_review/`、外部模型回答、POC 日志都只是研究/候选材料。
- 真正要进入 GitHub 的，是源码、`.context`、README、docs 这类可维护成果。

## 1. 资料范围与可信度

本次复盘参考了 85 个本地 Markdown 文件，以及 Git commit 历史。资料分层如下：

| 来源 | 用途 | 可信度 |
|---|---|---|
| Git commit history | 判断真实实现顺序和线上状态 | 最高，以 commit 为准 |
| `.context/` 当前文件 | 判断当前 canonical 项目事实 | 高，但需要随实现同步 |
| `research/*.md` | 外部模型、Deep Research、路线草稿和对比研究 | 中，作为决策输入，不直接当事实 |
| `CMAP_review/REPORT.md` | 2026-05-14 外部评审总报告 | 中高，已被后续 PR 部分验证 |
| `CMAP_review/notes/*.md` | Claude/GPT/gptpro 诊断过程 | 中，包含有效发现，也包含被主线修正的误判 |
| `CMAP_review/poc-logs/*.md` | POC 改动和验证记录 | 高，已对应到可 cherry-pick 的小补丁 |
| `CMAP_review/CMAP_coding/` | 评审时 clone 出来的项目快照 | 只作历史快照，不进正式仓库 |

因此，本文件采用的原则是：

```text
commit 证明“做过什么”；
docs/research 解释“为什么这么做”；
CMAP_review 解释“哪些问题被外部评审挑出来并试修过”。
```

## 2. 更新时间线总表

| 时间 | 阶段 | 关键输入 | 代表 commit | 结果 |
|---|---|---|---|---|
| 2026-05-10 | v0.1 原型与 CLI 骨架 | `cmap_v0.1_PRD_and_execution_manual.md` | `1e89623`, `a92d4b4`, `ef6838b` | 完成 init/verify/install、cp/finish/log/idea、adopt/hooks/doctor 等基础命令 |
| 2026-05-10 | dogfood 与可见入口 | `.context/` 自身使用反馈 | `4c154b9` | 增加模块地图可视化，发现隐藏 `.context` 是产品 discoverability 问题 |
| 2026-05-11 | 外部工作流比较 | `research/cmap-gsd-comparison-report.md` | `de970a5` 前后 | 明确 `cmap = project map`，GSD/superpowers/gstack 是外部流程层 |
| 2026-05-12 | Obsidian + AI brief 工作流 | `research/cmap core + Obsidian 视图 + AI brief 工作流方案.md` | `de970a5`, `628705c` | 建立 route/brief/obsidian/reconcile/verify 的续接闭环 |
| 2026-05-12 | v0.2 自动维护雏形 | `docs/superpowers/plans/*` | `a635d87` 到 `26d5836` | 增加 MapPatch、evidence、hooks assist、route context pack、benchmark、CI gate |
| 2026-05-13 | Trust Boundary 路线重置 | `research/cmap-v0.2-trust-boundary-human-review-layer.md`, `research/cmap·打通方案.md` | `090a0c2`, `5a5d1a8`, `9eb74d6` | 暂停 import graph/route v2/pack v2，转向 human review、generated/canonical 分层、freshness、candidate workflow |
| 2026-05-14 | 外部 review 与 POC 收口 | `CMAP_review/REPORT.md`, `CMAP_review/notes/*`, `CMAP_review/poc-logs/*` | `707f8ae` | 合并 5 个小修复：依赖清理、路径安全、报错 UX、HTML redaction、structured candidates 可见 |
| 2026-05-14 | 资料边界整理 | 本次整理 | 当前提交 | `research/` 与 `CMAP_review/` 改为本地工作区，正式更新流程沉淀到 `docs/` |

## 3. 阶段一：v0.1 原型与边界定型

### 目标

第一阶段要解决的不是“让 CLI 自动理解项目”，而是给 AI coding 项目一个可续接的小地图：

```text
.context/MAP.md
.context/STATUS.md
.context/CHECKPOINT.md
.context/DECISIONS.md
.context/VERIFY.md
.context/modules/*.md
```

### 主要实现

这一阶段的 commit 集中在 2026-05-10：

- `1e89623 feat: implement cmap M1 and M2 commands`
- `a92d4b4 feat: add cp finish log and idea commands`
- `ef6838b feat: add adopt module hooks and doctor`
- `19f2c27 docs: add v0.1 README`
- `76cffbd test: add built cli smoke checks`
- `aaf95cf feat: harden verify drift checks`
- `d92d104 feat: verify commands and pending drift`

落下来的能力：

- `init`：初始化 `.context` 骨架。
- `verify`：检查结构、路径、占位符和基础漂移。
- `install`：生成 AGENTS/CLAUDE 入口提示。
- `route`：从任务词路由到相关模块。
- `checkpoint/status`：保存当前工作状态。
- `cp`：安全搬运行块，降低文档重写风险。
- `finish`：收尾时提示哪些上下文要更新。
- `log/idea`：轻量记录工作日志和想法，但不自动变 canonical facts。
- `adopt/add-module/hooks/doctor`：把已有项目接入 `.context`，并提供诊断入口。

### 产品判断

这个阶段最重要的产品结论是：

```text
AI 写语义，CLI 做确定性、安全、可回滚的维护动作。
```

这也是后面所有 v0.2/v0.3 决策的底层边界。

## 4. 阶段二：真实 dogfood 暴露可发现性问题

### 关键变化

2026-05-10 到 2026-05-11，项目开始用 `cmap` 管自己。这个 dogfood 暴露出一个很现实的问题：

```text
.context 是好事实源，但普通用户在 Finder / Obsidian / GitHub 首页很难发现它。
```

对应 commit：

- `c4936ce chore: ignore obsidian workspace`
- `4c154b9 docs: add module map visualization`

### 结果

项目开始补可见入口和展示层：

- `PROJECT_MAP.md` / README 这类显性入口。
- `docs/cmap-product-overview.html` 这类产品说明页。
- 模块地图 HTML 可视化。
- 后续演化为 `cmap view export` 的 human review dashboard。

这个阶段的启发是：`cmap` 不只是给 AI 读，也要让人能快速理解项目地图。

## 5. 阶段三：外部工作流比较，明确 cmap 不做全家桶

### 关键材料

本地研究稿：

- `research/cmap-gsd-comparison-report.md`
- `research/cmap-gsd-feishu-doc-source.md`
- `research/cmap-gsd-feishu-advanced-append.md`
- `research/cmap-ai-coding-suite-strategy-report.md`

这些材料把 `cmap` 与 GSD、gstack、superpowers、web-design 等工具放在同一张图里比较。

### 结论

稳定下来的职责分层是：

| 工具/层 | 职责 |
|---|---|
| `cmap` | repo-local canonical project map、模块边界、状态、验证 |
| GSD | phase/spec/plan/execute 这类执行流程 |
| superpowers | TDD、debugging、verification、planning 等工程纪律 |
| gstack | review/QA/角色化检查 |
| Obsidian | 阅读、搜索、图谱视图，不是 canonical write-back |

因此后续路线没有把 `cmap` 做成 workflow OS，而是做成更稳的 project memory substrate。

## 6. 阶段四：Obsidian 视图与 AI brief 工作流

### 关键材料

- `research/cmap core + Obsidian 视图 + AI brief 工作流方案.md`

这份方案把 `.context`、Obsidian 和 AI 开工包串起来：

```text
cmap route
  -> cmap checkpoint
  -> cmap brief
  -> AI 按 brief 开工
  -> cmap finish
  -> cmap obsidian export
```

### 对应 commit

- `de970a5 Add brief and Obsidian view workflow`
- `628705c Complete cmap workflow safety loop`
- `5594948 Add explicit checkpoint handoff workflow`
- `0129477 Add finish checkpoint handoff reminders`

### 落地能力

- `cmap brief`：把 route、checkpoint、module docs 打包给 AI。
- `cmap obsidian export`：把 `.context` 模块导出成 Obsidian 友好 Markdown。
- `cmap obsidian export --check`：检查 Obsidian view 是否 stale。
- `cmap reconcile --adapter gsd-v1|gsd-v2`：读取外部 workflow 产物，只生成候选，不直接改 canonical。
- `verify --coverage --changed-files`：检查改动文件是否有模块覆盖。
- `benchmark route`：用 fixtures 评估 route 命中率。

这个阶段的意义是：`cmap` 从“项目小地图”变成“开工前/收工后可持续使用的工作流接口”。

## 7. 阶段五：v0.2 自动维护与安全边界

### 关键计划

本地计划文档集中在：

- `CMAP_review/CMAP_coding/docs/superpowers/plans/2026-05-12-cmap-pro-deep-research-completion.md`
- `CMAP_review/CMAP_coding/docs/superpowers/plans/2026-05-12-cmap-v0-2-evidence-stale-inbox.md`
- `CMAP_review/CMAP_coding/docs/superpowers/plans/2026-05-12-cmap-v0-2-hooks-assist.md`
- `CMAP_review/CMAP_coding/docs/superpowers/plans/2026-05-12-cmap-v0-2-route-context-pack.md`
- `CMAP_review/CMAP_coding/docs/superpowers/plans/2026-05-12-cmap-v0-2-context-size-controls.md`
- `CMAP_review/CMAP_coding/docs/superpowers/plans/2026-05-12-cmap-v0-2-route-benchmark-fixtures.md`

### 对应 commit

- `ebbf1cc Add interactive product overview`
- `a635d87 feat: add agent mappatch update gate`
- `b1f078b feat: add evidence-driven map maintenance`
- `cb82dc0 feat: add observe and assist hook profiles`
- `3b18226 feat: add route context pack`
- `2c231e6 feat: add context size controls`
- `f3506c9 feat: add route benchmark context metrics`
- `dac8e51 feat: add inbox governance workflow`
- `db161a4 feat: add context policy and activity stats`
- `e2fed9b feat: add hook lifecycle render and test`
- `c9c5045 feat: add context graph projections`
- `c130aa0 feat: add ci reports and benchmark gates`
- `539506b feat: add budgeted context pack`
- `8ecf63e feat: generate assist session briefs and route stats`
- `26d5836 feat: add obsidian export drift check`

### 落地能力

这一阶段的核心是让 AI 可以“提出维护建议”，但不允许它直接污染 canonical facts。

新增/强化的能力包括：

- `finish --agent`：生成 MapPatch 请求材料。
- `update --agent`：处理 AI 写的 MapPatch。
- MapPatch v1/v2：把 AI proposal 分成 routine apply、inbox candidate、reject。
- `.context/generated/`：生成 evidence/stats，不直接写 module docs。
- `.context/inbox/`：承接语义候选、高风险候选、relation candidates。
- `inbox status/triage/promote/archive/reject`：候选治理。
- `freshness snapshot/diff/mark-reviewed/review`：区分 baseline 与人工审阅。
- `hooks observe/assist/strict`：记录生命周期事件、生成 session brief、阻止直接语义写入。
- `graph build/explain`：从 reviewed module docs 生成 canonical relation projection。
- CI dogfood：`verify --ci`、`verify --stale`、`verify --freshness`、`view export --check`、`benchmark route`。

### 产品边界

这个阶段形成了后续最重要的信任边界：

```text
generated evidence 可以作为支持材料；
inbox candidates 可以作为待审阅建议；
只有 reviewed .context docs 才是 canonical facts。
```

## 8. 阶段六：Trust Boundary + Human Review Layer 路线重置

### 关键材料

- `research/cmap-v0.2-trust-boundary-human-review-layer.md`
- `research/cmap·打通方案.md`
- `research/P1v0.3.md`
- `research/cmap-pro-deep-review-handoff-20260512.md`
- `research/chatgpt-pro-cmap-product-completion-deep-research-response.md`
- `research/deep-research-report.md`

### 对应 commit

- `090a0c2 Implement v0.2 trust boundary review layer`
- `5a5d1a8 Harden v0.2 review layer`
- `9eb74d6 Extend v0.3 candidate review workflows`

### 路线变化

原来的 `cmap·打通方案` 还包含 import graph、route v2、pack v2 等想法。到 `cmap-v0.2-trust-boundary-human-review-layer.md` 后，路线被明确重置：

```text
暂停 import graph / route v2 / pack v2。
优先做 human review dashboard、generated/canonical 分层、freshness、candidate workflow。
```

### 实现重点

- `view export` 从静态页面升级为可审阅 dashboard。
- `view --check` 改成 normalized HTML comparison。
- `RelationPatch` 保持 candidate-only。
- `route` 不消费 unpromoted relation candidates。
- `verify --policy`、`doctor --release` 进入发布前安全检查。
- `candidate-store` 统一结构化候选格式。

这一阶段说明：`cmap` 已经不再追“更懂代码”，而是在追“候选治理、审阅、边界清楚”。

## 9. 阶段七：CMAP_review 外部评审与 POC 收口

### 关键材料

- `CMAP_review/REPORT.md`
- `CMAP_review/gptpro最后给的优化建议(1).md`
- `CMAP_review/notes/10-claude-arch.md`
- `CMAP_review/notes/11-claude-perf.md`
- `CMAP_review/notes/12-claude-config.md`
- `CMAP_review/notes/20-claude-diagnosis.md`
- `CMAP_review/notes/21-claude-diagnosis-supplement.md`
- `CMAP_review/notes/30-gpt-round1-codex.md`
- `CMAP_review/poc-logs/*.md`

### 评审结论

`CMAP_review/REPORT.md` 的核心结论是：

```text
cmap v0.2 已经基本满足最初目标，评分约 87-88/100。
后续不应做大架构扩张，而应做收口和打磨。
```

### 最终采纳的 5 个 POC

| POC | 内容 | 对应合并 |
|---|---|---|
| P-1 | 删除未使用依赖 `fast-glob` | `707f8ae Review CMAP candidate fixes` |
| P-3 | `inbox promote` evidence 改用 `resolveInsideRoot` 防 path escape | `707f8ae` |
| P-6 | `safe-path` 路径逃逸报错更友好 | `707f8ae` |
| P-8 | HTML view redaction 覆盖 auth header、cloud SDK key、PEM private key | `707f8ae` |
| P-NEW | HTML view 读取 `.context/inbox/candidates/*.json` structured candidates | `707f8ae` |

### 未采纳或延后

- view dashboard 中文硬替换 / i18n：暂停；当前 Review HTML 回归英文 UI，未来翻译需另开独立 workflow。
- routeTask 复用 module index、loadModuleIndex 并发：真问题，但收益不急。
- RelationPatch risk enum：应该做，但要和 view schema/render 一起设计。
- CmapCommandError cause chain：调试体验项，低优先级。
- CLAUDE.md symlink AGENTS.md：不做，跨平台兼容风险大于收益。
- 大型 import graph / RAG / daemon：明确不做。

## 10. 阶段八：资料边界整理

### 这次调整

本次把 `research/` 与 `CMAP_review/` 从 GitHub 正式内容里移除，但保留本地资料。

具体做法：

```text
git rm --cached -r CMAP_review research
```

并在 `.gitignore` 中加入：

```gitignore
research/
CMAP_review/
```

### 为什么这样做

这两个目录的性质不同于正式项目文档：

| 目录 | 性质 | 是否进 GitHub |
|---|---|---|
| `research/` | 外部模型回答、路线草稿、研究过程稿 | 不进 |
| `CMAP_review/` | 外部评审工作区、POC 日志、内嵌 clone | 不进 |
| `docs/` | 从研究中沉淀出的正式文档 | 进 |
| `.context/` | canonical 项目事实源 | 进 |
| `README.md` / PRD | 项目入口与产品规格 | 进 |

这样做的好处是：

- GitHub 保持干净，不暴露冗长中间稿。
- 本地保留所有研究证据，后续可以继续追溯。
- 正式结论通过 `docs/` 和 `.context/` 承接。

## 11. 功能演进图

```text
v0.1 基础地图层
  init / install / verify / route / checkpoint / status / finish / cp / log / idea

v0.1 dogfood 可见层
  PROJECT_MAP / module map visualization / product overview

v0.2 工作流连接层
  brief / obsidian export / obsidian check / reconcile / changed-file coverage / benchmark

v0.2 trust boundary 层
  MapPatch / update-agent / generated evidence / generated stats / inbox / audit / backup

v0.2 human review 层
  view export / view check / freshness / relation candidates / structured candidates

v0.3 方向
  candidate review workflow / release hygiene / 更多真实项目 dogfood
```

这张图说明：`cmap` 的能力不是横向扩张成一个大平台，而是围绕 `.context` 事实源逐层加安全边界、审阅能力和工作流接口。

## 12. 后续更新流程建议

以后每次做较大的产品/实现更新，建议按这个顺序走：

```text
1. research/ 或本地草稿
   - 接收外部模型、deep research、对比报告、POC 记录。
   - 不直接上传 GitHub。

2. 形成明确路线
   - 判断是实现问题、产品边界问题、文档同步问题，还是评审问题。
   - 明确哪些是 canonical facts，哪些只是 candidate。

3. 小 PR 实现
   - 每个 PR 聚焦一组低耦合改动。
   - 同步源码、测试、.context。
   - 不把原始研究包直接塞进 PR。

4. 验证
   - 至少跑相关测试、typecheck、diff check。
   - 对 cmap 自身还要跑 `pnpm dev verify --changed`。

5. 合并后沉淀
   - 如果研究材料有长期价值，压缩成 `docs/*.md`。
   - 如果改变项目事实，更新 `.context/MAP.md`、模块文档、STATUS/CHECKPOINT/VERIFY。
   - 原始 `research/` 和 `CMAP_review/` 继续留本地。
```

## 13. 现在项目的稳定状态

截至 2026-05-14，`cmap` 已经完成的稳定主线是：

```text
v0.1: repo-local project map CLI
v0.2: trust boundary + generated/canonical/inbox 分层 + human review dashboard
v0.3 方向: usability/release hygiene/candidate review workflow
```

不应回到的大方向：

- CLI 自动 import graph。
- 自动 route v2 复杂代码理解。
- 大型 RAG / embedding / daemon。
- 浏览器内直接 apply/promote。
- 让外部 workflow 直接覆盖 `.context`。

应继续推进的小方向：

- RelationPatch risk enum + view schema 同步。
- Review HTML 继续增强英文项目理解页；i18n / `view --lang zh-CN` 暂停，不作为当前路线。
- release hygiene：CHANGELOG、CONTRIBUTING、release automation。
- 更多真实项目 dogfood，而不是继续堆抽象能力。
