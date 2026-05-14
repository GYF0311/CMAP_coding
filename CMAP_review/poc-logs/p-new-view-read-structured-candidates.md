# POC P-NEW: view dashboard 读取 .context/inbox/candidates/*.json

**分支**: `poc/p-new-view-read-structured-candidates`
**改动量**: 1 个 import + 11 行调用 + 新增 helper 函数 53 行 + 集成测试 96 行
**风险**: 低（仅增量功能，不改既有行为）
**发现来源**: GPT round 1 独立漏诊（Claude 三视角全没看见）

## 缺口

GPT round 1 用 `nl -ba src/view/collect.ts | sed -n '132,191p'` 独立验证：

`collectInboxCandidates()` 只读 `.context/inbox/*.md` + `.context/inbox/relations/*.json`，**完全没读 `.context/inbox/candidates/*.json|md`**。

但项目实际使用：
- `src/core/candidate-store.ts:55-70` 已写 `.context/inbox/candidates/*.json|md`
- `src/commands/inbox.ts loadStructuredCandidates()` 正确读取它
- `tests/integration/m21-candidate-store.test.ts` 已覆盖写入 + promote 全流程

→ **新主线 candidate-store 写的东西在 review 视图里完全看不到**。

这违反了 v0.2 "Human Review Layer" 的初心：人审阅地图时需要看到所有 pending candidate。

## 改动

`src/view/collect.ts`：

1. import `parseCmapCandidate`
2. 在 `collectInboxCandidates()` 末尾调用新 helper
3. 新 helper `collectStructuredCandidates(cwd, alreadyCollected)`：
   - 扫 `.context/inbox/candidates/*.json` 排序
   - 用 `parseCmapCandidate` 解析（schema 校验）
   - 转 `InboxCandidateView` 格式
   - 沿用 `MAX_CANDIDATES=100` 总配额（与 legacy markdown candidates 共享）
   - 超额时回报 `Structured candidates omitted: <n>` warning
   - 若 type 含 "relation" 也加 RelationCandidateView

## 新测试 `tests/integration/m25-view-structured-candidates.test.ts`

| 用例 | 输入 | 期望 | 结果 |
|---|---|---|---|
| 基本：dashboard 出现 candidate | 写 `cand-A` 类型 `module.alias.add` | HTML 含 `cand-A` + summary 文本 | ✓ |
| 建议命令：reviewer 可直接复制 | 写 `cand-B` 类型 `evidence.merge` | HTML 含 `cmap inbox promote cand-B --dry-run` | ✓ |

## 验证

| 检查 | 结果 |
|---|---|
| typecheck | pass |
| m25 单独 | 2/2 pass (1.83s) |
| 全量测试 | 136/136 pass (134 existing + 2 new) |
| smoke | pass |

## 设计取舍

**为啥沿用 MAX_CANDIDATES=100 总额而不是新加 separate 限额**：
- 一致性：用户感知的"候选"是一个池子，不是分门别类
- 防止 candidates/ 满了挤压 legacy markdown 的展示（按字母序，legacy 先到，会被 100 卡住）—— 这是个边界 case，不算严重，但 warning 提示了 omitted 数

**为啥不重复 inbox.ts 的 loadStructuredCandidates 而是写新的 helper**：
- inbox.ts 的版本返回 `InboxCandidate`（command 层数据模型），view.ts 需要 `InboxCandidateView`（schema 层 + 含 suggestedCommands）
- 两者职责清晰隔离；强行复用会引入 InboxCandidate→View 的 mapping 函数，反而增加复杂度

## 建议

**强烈采纳**。这是真实的功能缺口（不是工程洁癖），修复后 HTML review dashboard 第一次能完整呈现 v0.2 candidate-store 主线的所有 pending 项。

## 后续（不在本 POC 范围）

- relation candidate 的 risk 字段：当前 view schema 没 `risk` 字段，render 硬编码 `data-high-risk="false"`（GPT round 1 漏诊 B）。若做 RelationPatch risk enum 化（原 P-7），必须同时改 view schema/collect/render，否则收益不完整 — 这是个 multi-file 改动，建议作为单独 PR。
