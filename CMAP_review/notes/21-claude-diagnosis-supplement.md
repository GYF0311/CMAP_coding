# 诊断补丁 v2（基于用户新输入 + 外部 gptpro 报告）

**触发**: 用户提供三条新评估维度 + 外部 gptpro 报告 `/Users/macbookpro/Desktop/gptpro最后给的优化建议(1).md`
**作用**: 与 `20-claude-diagnosis.md` 配合，作为 GPT Round 2 的额外弹药；最终报告必须整合本文。

---

## 1. 新评估维度 N-0: "是否已满足最初需求"

**用户原话**：
> 任何大模型接入这个项目时，能清晰了解项目、按提示快速在 Content 里找到指向的代码模块、优化更新、同步更新 content 地图 —— 基本满足就够了，不必究极进化。

**外部 gptpro 评估（独立第三视角，已是 87/100）**：
- 减少 AI 盲扫全仓：85
- 新会话快速接上主线：88
- 模块边界稳定可读：88
- AI 可维护但不污染 canonical：90
- 人能审阅地图：86
- 闭环命令链：88
- 可维护 CLI 产品：82
- **加权 87/100**

**Claude 主线判断（独立验证，对照需求）**：

| 需求项 | 当前状态 | 证据 | 评分 |
|---|---|---|---|
| 任何大模型读完入口能"了解项目" | AGENTS.md + CLAUDE.md 5 步引导（先 MAP → CHECKPOINT/STATUS → route），MAP.md 表格清晰列 13 模块 | `.context/MAP.md:24-40` 模块表 | **90** |
| 按提示"快速找到代码模块" | `cmap route "<task>"` 实测 0.8s，benchmark Top-1/Top-3 = 100% | bench/tasks.jsonl + 我亲测 | **95** |
| AI 可"优化更新"代码 | route + brief + pack 给定上下文边界；checkpoint 续接；finish 收尾 | 命令链已完整 | **88** |
| AI 可"同步更新 content 地图" | `cmap update --agent`（MapPatch）+ relate ingest（候选）+ evidence append；canonical/generated 分层 | src/commands/update.ts、relate.ts | **90** |
| 人审阅地图 | module-map-status.html（手写中文产品页）+ cmap view export → \_cmap-view/index.html（动态 dashboard）+ docs/cmap-product-overview.html | 三份审阅入口 | **85** |

**Claude 综合评估：88/100，与外部 gptpro 的 87/100 几乎重合**。

**结论**：v0.2 "Trust Boundary + Human Review Layer" 路线已基本兑现。**项目已经满足最初需求**。后续不必引入大架构改造（如自动 import graph、route v2、pack v2、RAG/embedding——外部 gptpro 也明确反对）。

**真正的剩余工作只是"收口 + 打磨"，不是"进化"**。

---

## 2. 新维度 N-1: review 视图实际形态

用户问"目前这个项目的 Review 视图是什么样子的？给人看吗？"。

主线核实清单（**这三份不要混淆**）:

| 视图 | 文件路径 | 来源 | 给谁看 | 语言 | 规模 |
|---|---|---|---|---|---|
| 手写产品页 | `module-map-status.html`（项目根） | 不是 cmap 生成的，手写或一次性脚本产出（`rg module-map-status src/` 完全无引用） | 潜在用户/开发者，**展示项目长啥样** | **中文** (`<html lang="zh-CN">`, "模块地图状态") | 1448 行 / 45KB |
| 产品介绍页 | `docs/cmap-product-overview.html` | 同上手写 | 用户/演示 | 应中文（40KB 待抽样） | 41KB |
| 动态 review dashboard | `_cmap-view/index.html`（默认）或自定路径 | `cmap view export` 命令生成，来自 `src/view/render.ts` | **cmap 用户审阅自己项目的 .context 状态**（搜索/filter/copy/module details/freshness/candidates） | **英文** (hardcoded "Modules/Evidence/Candidates/Warnings/Review filters/Purpose/Active Goal") | 取决于项目 |

**视图给谁看**：
- 前两份给"外部观看者"看项目本身长啥样（中文，对人友好）
- 第三份给"cmap 用户"看他们自己接入 cmap 后的项目地图状态（英文）

**关键矛盾**：用户的核心使用场景（cmap 用户审阅自己项目）走的是**英文 dashboard**，但 cmap 自己的产品展示页走**中文**。这造成了"用户被自己的工具呈现成英文"的违和感——这就是用户说的"笨笨的"。

---

## 3. 新维度 N-2: 中英文文案策略

用户希望"默认中文 或 中英都有"。

**当前实际语言分布**:
- `module-map-status.html`：**中文 UI**（手写）
- `docs/cmap-product-overview.html`：待抽样
- `src/view/render.ts` 硬编码文案：**英文**（Modules/Evidence/Candidates/Warnings/Review filters/Purpose/Active Goal/Current Task/Next Step/Verified/Not available...）
- `.context/MAP.md` Module Map 表格：**英文 description** + **中英混合 aliases**
- `.context/STATUS.md`：中英混杂（中 36 行 / 英 27 行，中文偏多）
- `.context/CHECKPOINT.md`：中英混杂（中 55 行 / 英 46 行）
- `AGENTS.md` / `CLAUDE.md`：英文为主
- `README.md`：中英混合
- `cmap_v0.1_PRD_and_execution_manual.md`：中文为主

**建议（写入最终报告 + POC 候选）**:

### 方案 C-A：最小化（推荐 POC）—— src/view/render.ts 文案中文化
- 把 30+ 处 hardcoded 英文 UI 文案改为中文（"模块/证据/候选/告警/审阅筛选/目的/当前目标/..."）
- 改动 `src/view/render.ts` 一文件，可控
- view dashboard 立即跟 module-map-status.html 视觉一致
- 工作量：1–2h
- POC 验证：可入选

### 方案 C-B：i18n 化（中期）
- 抽 messages 词条字典 src/view/i18n/{zh,en}.ts
- env / CLI 参数切语言
- 工作量：4–6h
- POC：本次不做（i18n 框架引入太重，先做 C-A）

### 方案 C-C：地图入口双语化（长期，不在本次 POC 范围）
- AGENTS.md / CLAUDE.md 加中文段
- module 文档 frontmatter 加 lang 字段
- 不在本次范围

**Claude 推荐**: C-A 入 POC，C-B 写进路线图，C-C 留到 dogfood 后

---

## 4. 新维度 N-3: view export 设计的 UX bug

实测：`cmap view export --out /tmp/cmap-view-check` 失败，错误信息：
```
Path escapes project root: /tmp/cmap-view-check/index.html
```

**根因（已查源码）**：`src/fs/safe-path.ts:8` 强制 cwd-inside，安全设计。

**评价**：
- 安全设计本身正确（防止意外覆盖 /etc/passwd 等）
- **但错误信息不够友好** —— 用户看不出"为啥不能写 /tmp"。期望："输出路径必须在项目根目录内，例如 `_cmap-view/` 或 `.context/out/view.html`"

**建议**: src/fs/safe-path.ts 改错误信息，加用户友好提示。
**工作量**：15min。**POC**：✅ 入选（修文案 + 加单元测试，可演示）。

---

## 5. 外部 gptpro 报告吸收：P0.5 安全收口（Claude 完全漏诊）

gptpro 报告指出几个安全/一致性问题，**Claude 三视角全部漏诊**，是 GPT 比 Claude 敏锐的真实案例：

### gpt-P0.5-1：inbox promote evidence path 安全洞
- 现象：`src/commands/inbox.ts` `applyInboxCandidate()` 中 evidence 校验是 `fileExists(path.join(cwd, item))`
- 风险：structured candidate 的 evidence 字段如带 `../`，可绕出 repo root
- 修法：用 `resolveInsideRoot(cwd, item)`，并加 reject 测试
- **严重度**：HIGH（真实的 path-escape 风险）
- POC：✅ 入选

### gpt-P0.5-2：RelationPatch risk 字段未 enum 化
- 现象：`relation-patch.ts` `risk: z.string().optional()`
- 风险：view/filter/high-risk 语义被任意字符串污染
- 修法：`risk: z.enum(["routine", "medium", "high"]).optional()`
- 严重度：MED
- POC：✅ 入选（schema + 测试，可量化）

### gpt-P0.5-3：HTML view redaction 加强
- 现象：`src/view/render.ts` 的 redaction 覆盖 api_key/token/secret/password/Bearer
- 缺失：Authorization / x-api-key / -----BEGIN ... PRIVATE KEY----- / ACCESS_KEY / PRIVATE_KEY / CLIENT_SECRET
- 修法：扩 redaction 规则集
- 严重度：MED（HTML view 是可分享 artifact）
- POC：✅ 入选

### gpt-P0.5-4：版本号一致性 0.1 vs 0.2
- 现象：package.json `version: 0.1.0`，但 README / .context/MAP 都说 v0.2
- 修法：bump 0.2.0，统一 `.context/*` frontmatter `cmap_version: 0.2`
- 严重度：LOW（认知冲突，不是 bug）
- POC：✅ 入选

### gpt-P0.5-5：地图/README 已落后于源码
- 现象：MAP.md "Next roadmap is PR-B/PR-C/PR-D" 但已实现；README Commands 表少 `--write-brief/--write-pack`、`freshness review`、`verify --policy`、`codex handoff`、`doctor --release`
- 修法：开 PR-MAP-SYNC，文档同步
- 严重度：MED（dogfood 自己时矛盾）
- POC：✅ 入选（仅文档改）

---

## 6. 调整后的最终 idea 池（POC 入选名单）

按 ROI / 用户需求贴合度排序：

| ID | idea | 类型 | 工作量 | 严重度 | POC |
|---|---|---|---|---|---|
| **P-1** | 删 fast-glob 死代码 | clean | 1min | HIGH | ✅ |
| **P-2** | view dashboard 中文化（C-A 方案） | 用户体验 | 1–2h | HIGH（直击用户痛点） | ✅ |
| **P-3** | inbox promote evidence path 用 resolveInsideRoot | 安全 | 30min | HIGH（gpt 漏诊） | ✅ |
| **P-4** | routeTask 接收 modules 参数（消除重复加载） | 性能 | 30–45min | HIGH | ✅ |
| **P-5** | loadModuleIndex Promise.all 并发 | 性能 | 30min | MED | ✅ |
| **P-6** | view export safe-path 错误信息友好化 | UX | 15min | MED | ✅ |
| **P-7** | RelationPatch risk enum 化 | 数据校验 | 30min | MED | ✅ |
| **P-8** | HTML view redaction 扩规则 | 安全 | 30min | MED | ✅ |
| **P-9** | CmapCommandError 加 cause chain | 调试 UX | 1h | LOW | ✅ |
| **P-10** | 13 处 bare throw 替换 + eslint no-throw-literal | 一致性 | 1–2h | MED | ✅ |
| **P-11** | CLAUDE.md 引用 AGENTS.md（symlink/sync 脚本） | 防漂移 | 15min | LOW | ✅ |
| **P-12** | bump version 0.1 → 0.2 + .context frontmatter 同步 | 一致性 | 30min | LOW | ✅ |

**不入 POC（写进路线图）**:
- zod 输入边界统一（8–10h，太大，spec 形式入报告）
- release 自动化（6–8h，spec 形式）
- 测试 in-process API（16–20h，长期目标）
- i18n 框架引入（4–6h，先做 C-A 文案中文化）
- README/MAP 同步（gpt-P0.5-5 大量文档改动，建议项目自己开 PR 而不是我代笔）

---

## 7. 给 GPT Round 2 的红队问题（基于本补丁）

1. 既然 v0.2 已 87–88/100 满足需求，Claude 提的 12 条 POC **会不会过度工程化**？哪 3 条最不该做？
2. view dashboard 改中文（POC P-2），**会不会破坏国际用户**预期？是否真有国际用户？
3. inbox evidence path-escape（gpt-P0.5-1）—— 在 cmap 现实使用场景里，**真有外部输入能触发吗**？还是说所有 candidate 都是 AI/CLI 内部生成？
4. fast-glob 删除（P-1）—— 万一历史 PR 里有未合并的 fast-glob 集成计划呢？删之前要不要保留 deprecation comment？
5. 把"满足最初需求 = 收手"作为终止条件，**是否过早**？Claude 是不是为了不让用户继续做而找借口？
