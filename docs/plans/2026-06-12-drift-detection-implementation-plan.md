# Freshness/Drift Review Signals 实现方案(v2)

> 起草:2026-06-12 · v2 修订:2026-06-12,吸收评审稿全部意见 · 状态:可开工
> 评审稿:`docs/plans/2026-06-12-drift-detection-plan-review.md`(意见全部采纳,无保留分歧)
> 前置调研:`docs/research/2026-06-12-feasibility/`

## 0. 一句话(按评审稿修正后的定位)

把现有 freshness 机制升级为 **commit-aware 的模块卡片复核信号**:源码、候选事实或结构事实
晚于语义复核时,在 route/brief/UserPromptSubmit 中提醒 AI 先复核卡片;
复核状态只写 generated metadata,**不污染 canonical module docs**。
`cmap drift` 是 CLI 入口别名,底层状态、锁、Review HTML、verify 输出全部复用 freshness——
**不新建第二套真相**。

## 1. v1 → v2 的关键修正(评审采纳记录)

| # | v1 设计 | v2 修正 | 理由 |
|---|---|---|---|
| 1 | frontmatter 写 `last_verified_commit` | 取消;watermark 进 `.context/generated/freshness.json` v2 | 检查状态不是模块解释;复用现有 lock + atomic rename + 并发测试;不污染卡片 diff 信噪比 |
| 2 | 只看 `git log watermark..HEAD` | 合并三类信号:committed + uncommitted(`git diff --name-only` 含 `--cached`)+ untracked mapped(`git ls-files --others --exclude-standard`) | AI 会话的核心场景是代码还在 working tree 未提交 |
| 3 | SessionStart 为主注入点 | 分层:SessionStart 只给 project 级一句摘要;UserPromptSubmit/route/brief 对命中模块注入详细 drift block | SessionStart 拿不到任务无法 route;避免启动噪声 |
| 4 | Phase 2 可 fallback 内置 es-module-lexer | 取消内置 parser;只消费外部 source-facts JSON(provider contract),无 provider 退回 Phase 1 | 守住"cmap 不维护源码事实"边界;不读 `.codegraph` 内部 sqlite schema |
| 5 | 测试文件一刀切过滤 | 改为降权(+0.05~0.1,默认只写 generated 不提示);tests 模块正常接收信号 | 测试常是模块的公共行为契约,view 等模块已把测试列入 paths |
| 6 | 命令 `cmap drift verify` | 改 `cmap drift mark-reviewed`(verify 在本项目语义=确定性检查);`drift verify` 留隐藏 alias | 术语一致性 |
| 7 | 模块合并(25→8-10)与 Phase 1 同期 | 推迟:先跑 5-10 个真实任务收集命中/分数/是否真需改卡片的数据,再按数据合并 | 同期做会污染 dogfooding 结论 |
| 8 | 固定阈值 0.3 | 升级为 drift budget 多因子评分(见 §4) | "重要的是下一个 AI 会不会读到并被误导",不是所有变动等权 |

## 2. 技术栈(不变项从简)

TypeScript ESM / Node >= 20 / commander / gray-matter / Vitest(临时 git 仓库集成测试)。
git 操作 spawn 系统 git。Phase 0.5/1 **零新依赖**;Phase 2 也零依赖(只读 JSON)。
不做:MCP server、daemon、模型 API 调用、内置源码 parser、tree-sitter。

## 3. 数据模型:freshness.json v2(generated 层,带 lock)

```json
{
  "version": 2,
  "modules": {
    "route": {
      "reviewState": "reviewed",
      "lastSemanticReviewedAt": "2026-06-12T10:00:00+08:00",
      "lastReviewedCommit": "<full-40-char-sha>",
      "reviewEvidence": "Reviewed route after drift review",
      "ownedFiles": {},
      "sourceSignals": {
        "commitsSinceReview": 3,
        "workingTreeChangedFiles": [],
        "untrackedMappedFiles": [],
        "structureScore": 0.4
      }
    }
  }
}
```

- 写入走现有 `freshness.json.lock` + atomic rename 通道,沿用并发测试。
- v1 → v2 迁移:读到 v1 结构时升级写回,旧命令(`freshness snapshot/mark-reviewed`、
  `verify --freshness`、`view --include-freshness`)行为不破(Phase 0.5 验收项)。
- 卡片 frontmatter 最多保留人工语义字段 `reviewed_at`(可选),不放 commit watermark。

## 4. 评分:drift budget(替代固定阈值)

```
driftScore = sourceChangeScore      # git 三类信号:committed 中权重 / uncommitted 中高 / test-only +0.05~0.1
           + structureScore         # Phase 2,来自 source-facts provider(删 export 0.4 / 增 export 0.3 / import 边 0.1)
           + pendingCandidateScore  # 该模块有 high-risk inbox / relation candidate 时加分
           + routeExposureScore     # 复用 route-usage stats:常被 route 命中的模块,误导面大,提示优先
           + moduleRiskScore        # 预留:frontmatter 将来有 risk/layer 时,高风险模块降阈值
```

- 低分:只写 generated 层(sourceSignals),不提示。
- 高分:进入 route/brief/UserPromptSubmit 的 drift block。
- 参数与阈值放 `policy.yml` `drift:` 段,exclude 支持每模块 `paths.exclude` 定制。

## 5. 命令面

```
cmap drift check [--module <id>] [--json]      # 计算并落 sourceSignals,列出超阈值模块
cmap drift review --module <id> [--out ...]    # 复核材料包:read-first、commits、changed files、建议命令
cmap drift mark-reviewed --module <id> --evidence "..."   # 更新 freshness v2 review metadata + watermark
```

- `mark-reviewed` 本质是 `freshness mark-reviewed` 的语义化包装,同一份状态。
- `--evidence` 必填;若 AI 判定无需改卡片,理由写入 evidence(如
  "Only internal refactor; module purpose and verification unchanged"),供后续调参(Phase 3)。
- `cmap drift verify` 保留为隐藏 alias,文档不主推。
- `verify --freshness` 增加 commit-aware warnings(warning 级,CI 不红),不新增 `verify --drift`。

## 6. 注入点分层

| 入口 | 内容 |
|---|---|
| SessionStart hook(Claude/Codex 模板已有) | 一句 project 级摘要:"3 modules have unreviewed freshness signals; route will show details." |
| UserPromptSubmit hook(assist path) | route 到 direct modules,只注入命中模块 + 少量 related 的 drift block |
| `cmap route` / `cmap brief` | 确定性入口,输出同一份 drift block(开工包是最重要注入点) |
| Review HTML(`cmap view`) | stale/pending badge,渲染现有 freshness 数据,不做新分析(守 view 红线) |
| Skill pack / 宿主入口模板 | 增补工作流:"route 提示 drift 时先 `cmap drift review`,复核后 `mark-reviewed`" |

## 7. 分期与验收

### Phase 0.5 — 收敛术语与 freshness(先行小切片)
- freshness.json v2 schema + 迁移;`cmap drift check` 读同一份 index;计划/文档改名
  "Freshness/Drift Review Signals"。
- 验收:旧 freshness 全流程不破;新旧命令读写同一状态。

### Phase 1 — commit-aware freshness MVP(预估 3-4 天)
- 三类 git 信号合并;`drift check/review/mark-reviewed`;`verify --freshness` commit-aware
  warnings;route/brief/UserPromptSubmit 注入;Review HTML badge。
- 验收:临时 git 仓库集成测试(`tests/integration/m26-drift.test.ts`)覆盖真实 commit;
  **未提交变更也能触发提示**;并发 mark-reviewed 过 lock 测试;
  dogfooding——改 `src/commands/route.ts` 不更新卡片,下一会话 brief/route 出现提示,
  mark-reviewed 后消失。

### Phase 2 — external source-facts provider(预估 1 周)
- provider contract:

```ts
type SourceFactProvider = {
  name: "codegraph" | "external-json";
  readModuleFacts(cwd: string, moduleId: string): Promise<ModuleStructureFacts | undefined>;
};
```

- 第一版只读稳定 JSON 输入 `.context/generated/source-facts/codegraph.json`
  (由 CodeGraph 或外部命令生成);计算 structureScore;无 provider 时安静退回 Phase 1。
- 验收:不读 `.codegraph` sqlite 内部 schema;零 parser 依赖;
  source facts 在 Review HTML 中标为 support layer。

### Phase 3 — prompt-level semantic filter(不调 API)
- drift review 材料带 checklist:"该变化是否影响模块目的/边界/验证?";
  判定无需更新时 evidence 必须写理由。
- 验收:连续真实任务中,无须更新卡片的提示比例 < 50%;false-positive 理由可用于调参。

### 模块地图合并(明确推迟)
Phase 1 落地后,用本仓库 5-10 个真实任务记录(命中模块、分数、是否真需改卡片),
按数据合并 25 个模块,不凭感觉。route benchmark / relation graph / view / VERIFY
随迁移一并更新,作为独立切片。

## 8. 风险(残余)
- 行为语义漂移(签名不变语义变)静态方法不可覆盖——接受,Phase 3 checklist 兜底。
- `git log -- <paths>` 对 rename 盲区——接受 Phase 1 漏报,Phase 2 结构比对覆盖。
- drift budget 多因子初版参数靠拍——用 Phase 3 的 evidence 数据迭代,参数全部在 policy.yml 可调。
