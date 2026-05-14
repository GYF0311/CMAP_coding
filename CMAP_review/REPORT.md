# CMAP_coding 架构优化分析与 POC 试跑报告

**日期**: 2026-05-14
**对象**: `GYF0311/CMAP_coding` (v0.1.0 / TypeScript CLI)
**评审者**: Claude（三视角 Explore agent + 主线核实）+ GPT（codex:codex-rescue round 1）
**外部参考**: `~/Desktop/gptpro最后给的优化建议(1).md`（用户之前请 GPT 跑过的独立审阅）
**工作目录**: `~/Desktop/CMAP_review/`
**总耗时**: 约 1 小时 40 分钟

---

## 0. 一页结论

### 0.1 项目画像

CMAP 是给 AI coding 工作流（Claude Code / Codex）的"项目记忆图谱"CLI：在仓库内维护 `.context/` 目录（MAP / STATUS / CHECKPOINT / DECISIONS / VERIFY + modules/* + logs/ + ideas/ + graph/ + refs/），提供 28 个命令（route / brief / pack / checkpoint / finish / verify / hooks / graph / benchmark / inbox / freshness / policy / relate / reconcile / codex / install / adopt / obsidian / view / evidence / cp 等）。

技术栈：Node ≥20、TS 6、commander 14、zod 4、gray-matter 4、tsup ESM、vitest 4、pnpm 10.32.1。仓库 708KB / TS 477KB / 24 集成测试。

### 0.2 是否满足最初需求？已满足

**用户原始需求**：任何大模型接入项目时，能清晰了解项目、按提示快速找到指向的代码模块、优化更新、同步更新 content 地图。

| 需求维度 | Claude 评分 | gptpro 独立评分 |
|---|---:|---:|
| AI 读完入口能"了解项目" | 90 | — |
| 按提示快速找到模块 | 95 | — |
| AI 可优化更新代码 | 88 | — |
| AI 可同步更新 content 地图 | 90 | — |
| 人审阅地图 | 85 | — |
| **加权综合** | **88** | **87** |

**结论**：v0.2 "Trust Boundary + Human Review Layer" 路线**已基本兑现**。后续不必引入大架构改造。剩余工作是**收口 + 打磨**，不是"进化"。

### 0.3 已通过 POC 验证的 5 条改进（按 ROI 排序）

| ID | 一句话 | 改动 | 验证 |
|---|---|---|---|
| **P-3** | inbox promote evidence 用 resolveInsideRoot 防 path-escape | 1 import + 5 行 + 3 测试 | 137/137 pass |
| **P-NEW** | view dashboard 读取 `.context/inbox/candidates/*.json`（GPT 独立漏诊） | 1 import + 11 行 + 53 行 helper + 2 测试 | 136/136 pass |
| **P-8** | HTML redaction 扩规则（云 SDK env-var / PEM 私钥块） | 9 行 + 7 单元测试 | 141/141 pass |
| **P-6** | safe-path 错误信息友好化 | 6 行 / 0 新测试（复用 m3） | 134/134 pass |
| **P-1** | 删除死代码依赖 fast-glob | 1 命令（pnpm rm） | 134/134 pass |

所有 POC 在独立 `poc/*` 分支，已 commit，可逐个 cherry-pick 或合并。**不影响 main**。

---

## 1. 环境基线

| 检查 | 结果 |
|---|---|
| `git clone https://github.com/GYF0311/CMAP_coding.git` | ✅ HTTPS 公开 |
| `pnpm install` | ✅ 16s（pnpm 10.32.1） |
| `pnpm typecheck` | ✅ pass |
| `pnpm test` | ✅ 134/134 wall 61s |
| `pnpm build` | ✅ tsup ESM → `dist/cli.js` 287 KB |
| `pnpm smoke` | ✅ 13 命令路径全过 |
| `pnpm dev benchmark route --min-top1 80 --min-top3 80` | ✅ Top-1 / Top-3 / Context 全 100% |

**基线零问题**。

---

## 2. 链路 / 性能视角

实测数据：

| 命令 | 实测中位耗时 |
|---|---:|
| `node dist/cli.js version` | 100ms |
| `node dist/cli.js --help` | 103ms |
| `pnpm dev --help`（tsx） | 630ms |
| `pnpm dev benchmark route ...` | 810ms |
| `pnpm dev verify --ci --format markdown` | 825ms |
| `pnpm dev verify --stale` | 666ms |
| `pnpm dev view export --out _cmap-view` | 678ms |

### 链路诊断（按 ROI 排序）

| ID | 问题 | 严重度 | 改动量 | 处置 |
|---|---|---|---|---|
| L-HIGH-1 | brief/pack 重复 loadModuleIndex（routeTask 内部 + 外部双调用） | HIGH | 30–45min | **延后**：真问题但当前不阻塞，未做 POC |
| L-HIGH-2 | ESM bundle 287KB + gray-matter 重复 occurrence | HIGH | 30–60min | **延后**：本 POC 验证删 fast-glob 对 bundle 大小**零影响**（已 tree-shake），真要瘦身要做 tsup --external |
| L-HIGH-3 | 测试 wall 61s + tsx fork-per-test 架构 | HIGH | 16–20h | **路线图**：分 unit/integration 层是长期重构 |
| L-MED-1 | module-index 顺序 for-await readFile | MED | 30min | **延后** |
| L-MED-2 | view HTML 导出顺序读 evidence/inbox | MED | 1.5h | **延后** |
| L-MED-3 | .context IO 无进程级缓存 | MED | 45min | **延后** |

**修正**：架构 Explore agent 曾报"m22 test timeout"，主线复测 m22 6/6 全过 8.16s —— **agent 幻觉**，已剔除。

### CI 链路实测亮点

`.github/workflows/cmap.yml` **11 步**里 7 步是 dogfooding（`verify --ci` / `verify --stale` / `freshness snapshot` / `verify --freshness` / `view export` / `view export --check` / `benchmark route`），benchmark 设 80% 硬阈值作为 PR gate。**这是产品级工程实践**，cmap 自己的 route 准确率退步就 fail PR。dogfooding 7 步总耗时约 5 秒，**不是 CI 瓶颈**（真正瓶颈是 `pnpm test` 61s）。

---

## 3. 架构 / 代码质量视角

| ID | 问题 | 严重度 | 处置 |
|---|---|---|---|
| A-HIGH-1 | zod 仅在输出层；CLI args / frontmatter / hook stdin 未校验 | HIGH | **路线图 spec**：8–10h 基建项，v0.2 稳定性投资 |
| A-HIGH-2 | 错误处理 13 处 bare throw vs 51 处 CmapCommandError（类型化率 80%） | MED | **延后**：80% 已规范；剩余 13 处在 fs/core 边界被 commands 包裹捕获，**不是 HIGH** |
| A-MED-1 | cli.ts 576 行 28 命令手工注册 | MED | **不必动**：v0.1-v0.3 范围合理；按 GPT 建议命令数 <40 时维持现状 |
| A-MED-2 | 175 处 ad-hoc `path.join/resolve`，无 path builder | MED | **延后**：4–6h 纯重构 |
| A-MED-3 | CLAUDE.md == AGENTS.md byte-identical（1301B） | LOW | **不必动**：GPT 评估 symlink 引入 Windows/npm 兼容问题，最小伤害是文档说明而非 symlink |
| A-LOW-1 | CmapCommandError 无 cause chain | LOW | **延后**：1–2h，调试 UX |

### Claude 三视角 review 漏诊（GPT 独立发现，已 POC 修复）

**[POC P-NEW] view dashboard 看不到 structured candidates**：
- `src/view/collect.ts:142-179` 的 `collectInboxCandidates()` 只读 `.context/inbox/*.md` + `.context/inbox/relations/*.json`
- 没读 `.context/inbox/candidates/*.json|md`
- 但 candidate-store 写在那（src/core/candidate-store.ts:55-70），m21 测试覆盖了写入 + promote
- → **新主线 candidate 在 review 视图里完全看不到**，违反 v0.2 "Human Review Layer" 初心
- **已修**：见 POC P-NEW

---

## 4. 配置 / 可运维视角

| ID | 问题 | 严重度 | 处置 |
|---|---|---|---|
| C-HIGH-1 | 无 lint / format / pre-commit hook | HIGH | **路线图**：4–6h 工程纪律基建 |
| **C-HIGH-2** | **fast-glob 死代码（package.json:32 但 src/ tests/ scripts/ 完全无 import）** | HIGH | **已修 POC P-1** |
| C-HIGH-3 | 无 release 自动化 / 无 CHANGELOG / git tag 空 | HIGH | **路线图 spec**：6–8h，准备 npm publish 时做 |
| C-MED-1 | CI 单 OS（ubuntu）单 Node（v22），engines >=20 但不测 v20 | MED | **延后**：2–3h 矩阵改动 |
| C-MED-2 | vitest 无 coverage / isolate / threads / globals 配置 | MED | **延后**：2–3h |
| C-MED-3 | prepack 过重（build + test + typecheck + smoke 30–60s） | MED | **延后**：1h |
| C-LOW-1 | tsconfig 缺 noUncheckedIndexedAccess / exactOptionalPropertyTypes；`ignoreDeprecations: "6.0"` 压 TS 6.0 警告 | LOW | **延后** |
| C-LOW-2 | engines.node >=20（GPT round 1 INSUFFICIENT EVIDENCE，未独立确认 EOL 时间线） | LOW | **延后** |
| C-LOW-3 | hook stdin 无超时（src/hooks/events.ts readHookPayload） | LOW | **延后**：1h |

### 配置亮点（不动）

- **CI dogfooding 7 步**：把 cmap 自己当 CI gate 是高质量工程实践
- **smoke 测试覆盖 13 命令路径**：scripts/smoke-test.mjs 创建临时项目跑全流程
- **依赖固定版本**：commander 14.0.3 / zod 4.4.3 / TS 6.0.3（agent 称"激进"，实际是有 packageManager 锁定 pnpm 10.32.1 + lockfile，可控）
- **.gitignore 充分**：node_modules / dist / coverage / .DS_Store / .context/out|stats|backups|audit / .obsidian / _cmap*

---

## 5. 用户三个新评估维度

### 5.1 review 视图实际形态

用户问"目前这个项目的 Review 视图是什么样子的？"。**实际是三件事**：

| 视图 | 文件 | 来源 | 给谁看 | 语言 | 规模 |
|---|---|---|---|---|---|
| 手写产品页 | `module-map-status.html` | 手写或一次性脚本（src/ 无引用） | 潜在用户/演示 | **中文** `<html lang="zh-CN">` "模块地图状态" | 1448 行 |
| 产品介绍页 | `docs/cmap-product-overview.html` | 同上手写 | 用户/演示 | 应中文 | 41KB |
| **动态 review dashboard** | `_cmap-view/index.html`（默认） | `cmap view export` 命令 → `src/view/render.ts` | cmap 用户审阅自己项目的 .context 状态 | **英文** hardcoded ("Modules/Evidence/Candidates/Warnings/Review filters/Purpose/Active Goal") | 取决于项目 |

**关键矛盾**：用户日常使用走第三个（**英文**），但产品展示走第一二个（**中文**）。"被自己的工具呈现成英文"违和感。

### 5.2 中英文策略

**当前实际语言分布**：
- `module-map-status.html`: 中文 UI（手写）
- `src/view/render.ts` hardcoded UI 文案: **英文**
- `.context/MAP.md` Module Map 表格: 英文 description + 中英混合 aliases
- `.context/STATUS.md` / `.context/CHECKPOINT.md`: 中英混杂（中文偏多）
- `AGENTS.md` / `CLAUDE.md`: 英文为主（且 byte-identical）
- `README.md`: 中英混合
- `cmap_v0.1_PRD_and_execution_manual.md`: 中文为主

**GPT round 1 推荐**：不应硬替换为中文（破坏国际 CLI 用户预期）。**应做最小 i18n / `--lang zh-CN` 选项**。

**Claude 建议**（写进路线图，不入本次 POC）：
- 短期方案 C-A：抽 `src/view/i18n/{zh,en}.ts` messages 字典，默认 en，`--lang zh` 切中文（4–6h）
- 中期方案 C-B：errors / CLI help / `.context/*` 模板也走 i18n（10–15h）

### 5.3 view export UX bug（POC P-6 已修）

实测 `cmap view export --out /tmp/cmap-bad-path` 失败，旧错误信息：
```
Path escapes project root: /tmp/cmap-bad-path/index.html
```

新错误信息（POC P-6 已落实）：
```
Path escapes project root: /tmp/cmap-bad-path/index.html. Output paths must stay inside the project — use a relative path (e.g. _cmap-view/ or .context/out/view.html) or an absolute path inside /Users/macbookpro/Desktop/CMAP_review/CMAP_coding.
```

---

## 6. GPT 对抗 Review 纪要

### 6.1 第一次尝试：失败

直接调 `codex exec ... "$(cat prompt-file)"` 卡死 1 小时未输出 —— codex 误判 stdin 协议。**已被杀**。

### 6.2 第二次尝试：成功（5.5 分钟）

走 `codex:codex-rescue` agent 通道（plan 中"两个都用"的 round 2 通道前移）。完整原文见 `notes/30-gpt-round1-codex.md`。

**GPT 比 Claude 更敏锐的 3 点**：
1. **新发现**：view dashboard 漏读 structured candidates（已 POC P-NEW 修复）
2. **修正**：`eslint no-throw-literal` 对 `throw new Error` 不对症 —— Claude 选错规则
3. **裁决 12 条 POC 候选**：保留 5 条、否决 3 条（中文硬替换 / 全量 throw 重构 / CLAUDE.md symlink）、推迟 4 条

**没出 Blocker**，按 plan 升轮条件不满足，**跳过 Round 2 gpt-redteam**，直接进 POC。

### 6.3 外部 gptpro 报告吸收

`~/Desktop/gptpro最后给的优化建议(1).md` 与本次 GPT round 1 **独立**但**结论高度一致**：
- 两者都给 87–88/100 满足分
- 两者都明确反对继续做大架构（import graph / route v2 / pack v2 / RAG / daemon）
- gptpro 提的 5 条 P0.5 全部出现在 GPT round 1 的"必做"清单（inbox path / risk enum / redaction / version / 文档同步）
- gptpro 担心 LICENSE 缺失被 GPT round 1 修正 —— 实际仓库已有 LICENSE 文件

---

## 7. POC 试跑详细结果

5 条 POC 全部 commit 在独立分支，可独立 cherry-pick。

| POC | 分支 | 文件改动 | 测试改动 | 全量测试 | 详细 log |
|---|---|---|---|---|---|
| **P-1** | `poc/p1-rm-fast-glob` | `package.json` / `pnpm-lock.yaml` | 0 新增 | 134/134 | `poc-logs/p1-rm-fast-glob.md` |
| **P-6** | `poc/p6-safe-path-friendly-error` | `src/fs/safe-path.ts` (+4 -2) | 复用 m3 | 134/134 | `poc-logs/p6-safe-path-friendly-error.md` |
| **P-3** | `poc/p3-inbox-evidence-safe-path` | `src/commands/inbox.ts` (+4 -1) | 新 m24 (+87) | 137/137 | `poc-logs/p3-inbox-evidence-safe-path.md` |
| **P-8** | `poc/p8-html-redaction-strengthen` | `src/view/render.ts` (+8 -3) | 新 unit (+77) | 141/141 | `poc-logs/p8-html-redaction.md` |
| **P-NEW** | `poc/p-new-view-read-structured-candidates` | `src/view/collect.ts` (+66 -1) | 新 m25 (+96) | 136/136 | `poc-logs/p-new-view-read-structured-candidates.md` |

### 7.1 ROI 实测修正（POC 暴露的真实数据）

**P-1 收益修正**：预期 bundle -10–15 KB，**实测 bundle 完全不变（287.26 KB → 287.26 KB）**，因 tsup 早就 tree-shake 掉了。真实收益在 `node_modules` 减少 1 个 top-level dep + install 时间。

**性能优化项预测 vs 实测**：本次 POC 没做 routeTask 重复 IO / module-index 并发等性能项，因为：
1. 用户原始需求已 87–88/100 满足
2. 现实使用场景下 route/brief/pack 都在 0.8–1.2s 内，**不是用户阻塞点**
3. GPT round 1 也建议延后

### 7.2 测试增益总览

POC 累计**新增 12 个测试用例**（m24: 3 + m25: 2 + redact: 7），覆盖三个关键安全/正确性边界：
- inbox evidence path-escape（`../` / 绝对路径 / 内部路径）
- view dashboard 结构化 candidate 呈现
- HTML redaction 7 种 secret 模式（含云 SDK / PEM 块 + 不误伤识别）

---

## 8. 建议落地路线图

按工作量从小到大、ROI 从高到低排序。

### Tier 1：立即合并（已 POC，5 个分支）

| 顺序 | POC | 工作量 | 备注 |
|---|---|---|---|
| 1 | P-1 删 fast-glob | 1min | 改动量最小、零风险 |
| 2 | P-6 safe-path 错误信息 | 6 行 | 零风险 UX 改进 |
| 3 | P-3 inbox path resolveInsideRoot | 5 行 + 3 测试 | **真实安全漏洞修复**，应优先 |
| 4 | P-8 HTML redaction 扩规则 | 9 行 + 7 测试 | 安全卫生提升 |
| 5 | P-NEW view 读 candidates | 66 行 + 2 测试 | 修复 v0.2 review layer 关键缺口 |

可合 1 个汇总 PR 或 5 个独立 PR，看用户偏好。Claude 推荐 **5 个独立 PR**（每个改动语义独立、独立回滚成本低）。

### Tier 2：v0.2.1 收口 PR（外部 gptpro 已建议，本次未做 POC）

| 项 | 工作量 | 来源 |
|---|---|---|
| RelationPatch risk 字段 enum 化（含 view schema 同步） | 1–2h | gptpro P0.5-4 + GPT round 1 漏诊 B |
| 文档同步：README / MAP / STATUS / VERIFY 对齐当前 v0.2 实现 | 2–3h | gptpro P0.5-1 |
| 版本号一致性：package.json 0.1.0 → 0.2.0 + `.context/*` frontmatter `cmap_version: 0.2` | 30min | gptpro P0.5-2 |
| `cmap doctor --release` 加入手动发布前验证（README + CONTRIBUTING） | 1h | gptpro P1-5 |

**总工作量约 5–7h**。建议项目自己开 PR 处理，不在本次 POC 范围内（涉及大量文档改动，应由项目作者把控语义）。

### Tier 3：路线图（不必做 POC，按需触发）

| 项 | 工作量 | 触发条件 |
|---|---|---|
| eslint + prettier + pre-commit | 4–6h | 准备引入新协作者 / npm publish |
| release 自动化（changesets 或 semantic-release） | 6–8h | 准备 npm 首发 |
| view dashboard i18n（`--lang zh-CN`） | 4–6h | 用户实际抱怨英文 UI 体验 |
| zod 输入边界统一 | 8–10h | v0.2.x 引入新外部输入源时 |
| 测试 in-process API（unit/integration 分层） | 16–20h | 团队规模扩大 / CI 时间成本拉爆 |
| CI 跨平台矩阵（macOS/Windows + Node 22/24） | 2–3h | 用户反馈跨平台 bug |
| Vitest coverage 配置 + 80% 阈值 | 2–3h | 引入 PR coverage gate 时 |
| AGENTS.md / CLAUDE.md 内容分化（不是 symlink） | 2–3h | 团队明确人/AI 工作流差异时 |

### Tier 4：明确不做（GPT + Claude + gptpro 三方共识）

- CLI 自动 import graph
- route v2 scoring
- pack v2 大重写
- RAG / embedding / code indexer
- 浏览器内 apply/promote
- 本地 daemon/server
- 中文硬替换（应做 i18n）

**理由**：这些会把 cmap 从"AI 读代码、CLI 管地图"拉回"CLI 自动理解代码"路线，跟 v0.1 PRD 第 0 节"cmap CLI 不生成项目语义"原则相悖。

---

## 9. 关键判断与风险

### 9.1 项目"已满足最初需求"的强证据

1. **Claude 主线评估**：88/100（独立 5 维度评分）
2. **GPT round 1 评估**：v0.2 已 87/100 满足；建议收手
3. **外部 gptpro 评估**：87/100 加权综合分
4. **三方独立给分都在 87–88**（取样不同、视角不同、立场不同），收敛到同一区间是强证据
5. **dogfood 实测**：cmap 自己跑 cmap 命令 100% benchmark 命中（route Top-1/Top-3/Context 都 100%）

### 9.2 仍存在的真实安全/正确性问题（必修，已 POC）

1. **inbox path-escape** (P-3) — trust boundary 缺口，**真实可触发**
2. **view 漏读 structured candidates** (P-NEW) — review layer 功能缺口
3. **HTML redaction 覆盖不足** (P-8) — 可分享 artifact 的安全卫生

### 9.3 风险与未验证项

- **Node 20 EOL 时间线**：配置 Explore agent 声称 2026-04 EOL，但 GPT round 1 明确 INSUFFICIENT EVIDENCE，本报告**未独立从 nodejs.org 验证**。建议项目作者发布前自查。
- **历史 PR 是否有 fast-glob 集成计划**：GPT INSUFFICIENT EVIDENCE，本地 clone 看到的是 baseline commit 起 fast-glob 就在但从未被 import。**建议作者在 git 历史里确认**没有 abandoned branch 依赖它。
- **架构 Explore agent m22 timeout claim 已证伪**：主线复测 6/6 pass 8.16s，**幻觉项已剔除**。

### 9.4 流程层面学到的东西（dogfooding 元结论）

1. **Explore subagent 会幻觉**（m22 timeout 案例），用户自己的"主线 grep/cat 二次核实"纪律救了报告
2. **codex exec 直接调用容易卡 stdin**（卡 1 小时浪费），走 `codex:codex-rescue` skill 通道更稳
3. **GPT 在独立查代码维度比 Claude 三视角更敏锐**（view 漏读 candidates），多模型对抗 review 真的有价值
4. **外部 gptpro 独立报告 + 本次 review 高度一致**，反向证明 87/88 这个数字是稳的

---

## 10. 附录

### 10.1 文件清单

```
~/Desktop/CMAP_review/
├── REPORT.md                              ← 本文件
├── CMAP_coding/                           ← 克隆的仓库
│   ├── ...（main 分支无改动）
│   └── 5 个 poc/* 分支含独立改动
├── notes/
│   ├── 00-baseline.log                    ← 基线 typecheck/test/build/smoke 输出
│   ├── 10-claude-arch.md                  ← Claude 架构 Explore agent 报告（25KB）
│   ├── 11-claude-perf.md                  ← Claude 性能 Explore agent 报告
│   ├── 12-claude-config.md                ← Claude 配置 Explore agent 报告（修正版）
│   ├── 20-claude-diagnosis.md             ← Claude 主线整合诊断（GPT 弹药）
│   ├── 21-claude-diagnosis-supplement.md  ← 补丁：用户三个新维度 + gptpro 整合
│   └── 30-gpt-round1-codex.md             ← GPT 对抗 review 完整原文
└── poc-logs/
    ├── p1-rm-fast-glob.md
    ├── p6-safe-path-friendly-error.md
    ├── p3-inbox-evidence-safe-path.md
    ├── p8-html-redaction.md
    └── p-new-view-read-structured-candidates.md
```

### 10.2 关键 git 命令（验收用）

```bash
cd ~/Desktop/CMAP_review/CMAP_coding

# 看所有 POC 分支
git branch | grep poc/

# 看任一 POC 改动
git checkout poc/p3-inbox-evidence-safe-path
git diff main..HEAD

# 切回 main（POC 已隔离）
git checkout main

# 单独 cherry-pick 想合的 POC
git cherry-pick <commit-sha>
```

### 10.3 POC commit 列表

```
poc/p1-rm-fast-glob:                          f652da6  POC P-1: remove unused fast-glob dependency
poc/p6-safe-path-friendly-error:              a3dc1d3  POC P-6: friendly error message for path-escape rejection
poc/p3-inbox-evidence-safe-path:              065e1d2  POC P-3: validate inbox evidence paths with resolveInsideRoot
poc/p8-html-redaction-strengthen:             e1d30fa  POC P-8: extend HTML view redaction rules
poc/p-new-view-read-structured-candidates:    faed115  POC P-NEW: surface structured candidates in HTML review dashboard
```

### 10.4 验证基线命令

任何 POC 分支上跑：
```bash
pnpm typecheck && pnpm test && pnpm build && pnpm smoke
```
全部应该过。

---

## 11. 一句话总结

> CMAP v0.2 已经满足"给 AI coding 用的项目记忆图谱 CLI"的核心需求，**不需要大改造**。建议合并 5 个已 POC 的小补丁（fast-glob 清理 / safe-path UX / 三项安全或功能修复），然后做一个 v0.2.1 收口 PR（文档 + 版本同步 + relation risk enum），项目即可作为正式 dogfood 工具长期使用。**进化方向不在工程优化，而在更多真实项目的实际使用反馈。**
