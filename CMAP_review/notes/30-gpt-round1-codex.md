# GPT Round 1 对抗 Review（codex:codex-rescue 通道）

**时间**: 2026-05-14 01:21 派发 → 01:27 完成（5.5 分钟）
**通道**: codex:codex-rescue agent（不是直接 codex exec，前者把 stdin 协议屏蔽掉）
**输入**: notes/20-claude-diagnosis.md + notes/21-claude-diagnosis-supplement.md + ~/Desktop/gptpro最后给的优化建议(1).md
**Token**: 31020 total

> 第一次尝试 `codex exec ... "$(cat prompt-file)"` 卡 stdin 1 小时未输出，被杀。改 codex:codex-rescue agent 通道后稳定。

---

## 1. GPT 对三份输入的关键摘要

**20-claude-diagnosis.md**
- Claude 路线判断 "Trust Boundary + Human Review Layer" 正确
- 性能侧主张：routeTask 复用 modules、loadModuleIndex 并发、tsup external、测试 timeout
- 工程侧主张：zod 输入边界、bare throw、path builder、AGENTS/CLAUDE 去重、lint/format、fast-glob 删除
- **GPT 反驳**："13 处 bare throw + eslint no-throw-literal" 误判 —— no-throw-literal 不解决 `throw new Error`，规则选错
- **GPT 反驳**：部分性能项偏紧张，当前 87/100 满足需求

**21-claude-diagnosis-supplement.md**
- 承认 v0.2 已满足需求；剩余是收口而非进化
- 提 view dashboard 中文化 POC
- 吸收 gptpro P0.5：inbox path / risk enum / redaction / 版本 / 文档同步
- **GPT 漏诊补充**：view --include-inbox 没读 `.context/inbox/candidates/*.json|md`，只读顶层 `.context/inbox/*.md` 和 `.context/inbox/relations/*.json`（src/view/collect.ts:142-179）—— **这跟"candidate-store 已成主线"的判断冲突**
- **GPT 漏诊补充**：Relation risk enum 只修输入不足以修 view —— relation candidate schema/view 没 risk 字段，render 硬编码 `data-high-risk="false"`（src/view/schema.ts:86-97, src/view/render.ts:192）

**gptpro 报告**
- 评分：v0.2 dogfood 完成态，缺 v0.2.1 小收口
- P0.5：文档同步 / 版本一致 / inbox path / risk enum / redaction
- 反对 import graph / route v2 / pack v2 / RAG / daemon
- **GPT 修正 gptpro**：LICENSE 文件实际存在，gptpro 担心过时

---

## 2. 12 条 POC 逐条裁决

| 编号 | 名称 | 裁决 | 一句话理由 |
|---|---|---|---|
| **P-1** | 删 fast-glob 死代码 | **必做** | 依赖仅在 package.json/lock；源码无 import；低风险高 ROI |
| **P-2** | view dashboard 中文化 | **不该做** | 不应一刀切；最小伤害是 `--lang zh-CN\|en` 或双语词典 |
| **P-3** | inbox promote evidence 用 resolveInsideRoot | **必做** | 真实外部输入链路可触发；当前 `path.join(cwd, item)` 漏校验 |
| P-4 | routeTask 接收 modules 参数 | 可选 | 真问题但非用户需求阻塞；可与 P-5 合并 |
| P-5 | loadModuleIndex Promise.all 并发 | 可选 | 真问题但模块量有限、收益未实测 |
| P-6 | view export safe-path 错误信息友好化 | 可选 | UX 文案，不是 P0 |
| P-7 | RelationPatch risk enum 化 | 可选 | **单做不够**：view 不展示/过滤 relation risk；要做就连 view schema/collect/render 一起 |
| **P-8** | HTML view redaction 扩规则 | **必做** | view 是可分享 artifact；当前只遮 api_key/token/secret/password/Bearer |
| P-9 | CmapCommandError 加 cause chain | 可选 | 调试体验改善，不影响 v0.2 闭环 |
| P-10 | 13 处 bare throw + eslint | **不该做** | 范围过宽；no-throw-literal 不对症 |
| P-11 | CLAUDE.md symlink AGENTS.md | **不该做** | 1301 字节重复不是实际风险；symlink 可能引入 Windows/npm 兼容问题 |
| P-12 | bump 0.1 → 0.2 + frontmatter | 可选 | 发布时做；暂不发布只需文档说明 |

---

## 3. GPT 独立发现（Claude/gptpro 都没点透）

### 漏诊 A: view dashboard 看不到 structured candidates（**新主线缺口**）

**命令**: `nl -ba src/view/collect.ts | sed -n '132,191p'`
**结果**: `collectInboxCandidates()` 只读 `.context/inbox/*.md` + `.context/inbox/relations/*.json`，**没读 `.context/inbox/candidates/*.json|md`**
**反方证据**: candidate-store 已写 `.context/inbox/candidates/*.json|md`（src/core/candidate-store.ts:55-70）；测试 m21-candidate-store.test.ts 覆盖写入 + promote
**结论**: 如果要打磨 view，**这条优先级应高于纯中文化**

### 漏诊 B: RelationPatch risk enum 单做不够

**命令**: `nl -ba src/view/schema.ts | sed -n '74,99p'` 和 `nl -ba src/view/render.ts | sed -n '188,193p'`
**结果**: relationCandidates schema 没 risk 字段；渲染硬编码 `data-high-risk="false"`
**反方证据**: relation candidate 写入时有 risk（src/core/relation-patch.ts:59-72）
**结论**: P-7 若做必须连 view 一起修

---

## 4. 红队 5 问回答

### Q1: 12 条 POC 会不会过度工程化？最不该做的 3 条？
**会**。最不该做：P-2 / P-10 / P-11。Claude 把"诊断候选池"误压成"执行清单"，没按 87/100 终止条件砍范围。

### Q2: view dashboard 中文化破坏国际用户预期？
**中文硬替换会**；**中文可选或双语不会**。当前 `<html lang="en">` + 英文文案 + README 英文 Commands —— 应做最小 i18n（`--lang zh-CN`），不应仅中文。

### Q3: inbox evidence path-escape 现实里真有外部输入吗？
**有**。调用链独立验证：
1. `cmap update --agent --from <file>` 读外部 AI MapPatch
2. `--write-inbox` 写 structured candidate
3. candidate.evidence 原样进 candidate-store
4. `cmap inbox promote <id> --apply` 走 applyInboxCandidate
5. **evidence 校验 fileExists(path.join(cwd, item)) 不是 resolveInsideRoot**

`../outside` 在 repo 外存在时校验通过；不会写 repo 外，但会把 repo 外路径当可信 evidence 进 generated evidence —— **违反 trust boundary**。

### Q4: fast-glob 删除前要不要 deprecation comment？
**不需要**（PR 描述写清即可）。package.json 是 JSON 不能注释。INSUFFICIENT EVIDENCE on historical PR plans，但当前 clone 没有 fast-glob 集成证据。

### Q5: "满足最初需求 = 收手" 终止条件是否过早？
- 作为"大架构停止条件"：**不早**。Claude + gptpro 双双 87–88/100 满足。
- 作为"安全/发布收口停止条件"：**过早**。仍有真实收口问题（path escape / redaction / 文档版本一致性）。
- 结论：**应收手于架构扩张，不停止修安全和一致性**。

---

## 5. GPT 最终结构化结论

### 必做清单
- **P-3**: inbox promote evidence path 改 resolveInsideRoot
- **P-8**: HTML view redaction 扩规则
- **P-1**: 删除 unused fast-glob
- **补充必做（GPT 新增）**: view --include-inbox 支持 `.context/inbox/candidates/*.json|md`

### 不建议本轮做
- P-2 中文硬替换、P-10 全量 throw + eslint、P-11 symlink
- P-9 cause chain、P-4/P-5 性能优化、P-12 强 bump

### Top 3 推荐优先级
1. **P-3 evidence path escape**：安全边界真实缺口
2. **view 读 structured candidates**：否则 human review layer 看不到新主线 candidate store
3. **P-8 redaction**：可分享 HTML 安全卫生

### "只剩 1 天工时"收口建议
> 只做安全和审阅闭环：先修 `inbox promote --apply` evidence 用 `resolveInsideRoot`，补 path escape 测试；再让 `view --include-inbox` 读取 `.context/inbox/candidates/*.json|md`，并把 relation candidate risk 带进 schema/filter；最后扩 HTML redaction。`fast-glob` 可顺手删。不要做中文硬替换、symlink、全量 eslint 或性能重构。

---

## Claude 主线决议（基于 GPT round 1）

- **Round 2 跳过**：Round 1 无 Blocker、idea 池已稳定，按 plan 升轮条件不满足
- **POC 入选最终名单**（5 条）：
  1. P-3 inbox path resolveInsideRoot（安全）
  2. **P-NEW view 读 candidates**（GPT 独立发现的功能缺陷）
  3. P-8 HTML redaction 扩规则（安全）
  4. P-1 删 fast-glob（清理）
  5. P-6 safe-path 错误信息友好化（UX，小快灵）— Claude 加这条因为成本极低 + 演示性强

- **不做**：P-2 / P-10 / P-11（GPT 否决）+ P-12（发布时再做）
- **路线图项（不做 POC）**：P-4/P-5 性能、P-9 cause chain、P-7 relation risk（要做就连 view 一起 too big）
