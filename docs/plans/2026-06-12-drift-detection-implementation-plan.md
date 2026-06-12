# Freshness/Drift Review Signals 实现方案(v3)

> 起草:2026-06-12 · v2:吸收一审全部意见 · v3:吸收复审 6 条实现级约束 · 状态:Go(带条件已落实)
> 评审稿:`docs/plans/2026-06-12-drift-detection-plan-review.md`(一审)、
> `docs/plans/2026-06-12-drift-detection-plan-review-v2.md`(复审,意见全部采纳)
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
- **v1 → v2 迁移(复审 P1):读取路径绝不写回。** `readFreshnessIndex()` 只做 in-memory
  normalize,把 v1 当 v2-compatible 结构返回;落盘迁移只发生在写命令
  (`freshness snapshot`、`freshness mark-reviewed`、`drift mark-reviewed`、显式 `drift migrate`)。
  `verify --freshness` 与 `view --include-freshness` 保持只读,验收测试:手写 v1
  `freshness.json` → 跑这两条命令 → 文件字节不变。
- 卡片 frontmatter 最多保留人工语义字段 `reviewed_at`(可选),不放 commit watermark。

## 4. 评分:drift budget(替代固定阈值)

**Phase 1 固定为可解释三因子(复审 P2):**

```
driftScore = sourceChangeScore      # git 三类信号:committed 中权重 / uncommitted 中高
           + pendingCandidateScore  # 该模块有 high-risk inbox / relation candidate 时加分
           + testSignalScore        # test-only 变更 +0.05~0.1,默认不单独触发提示
```

- `routeExposureScore` / `moduleRiskScore` / `structureScore`(Phase 2)第一版只作为
  **debug 字段记录,不参与阈值**;等 5-10 个真实任务的 dogfooding 数据出来后再打开。
  避免历史高频模块挤掉新模块,且保证每条提示的原因可解释。
- **rename/deletion 高分信号(复审 P2,Phase 1 就做,不等 Phase 2)**:解析
  `git diff --name-status` / `git log --name-status` 的 `R`/`D`;owned path 被删除或
  rename 时直接高分提示 "owned path changed; review module paths before trusting this card",
  `drift review` 的 read-first 列出旧 path、新 path、模块卡片。Phase 2 的结构比对只能覆盖
  "事实成功归属"后的差异,不能解决归属丢失,所以这个信号必须在 git 层做。
- 低分:仅内存计算结果可见(`--json`),不自动落盘(见 §5 读写拆分)。
- 高分:进入 route/brief/UserPromptSubmit 的 drift block。
- **policy schema(复审 P1,Phase 0.5 必含)**:`ContextPolicy` 新增 `drift` 类型;
  `defaultContextPolicy` / `renderDefaultPolicy()` 输出默认配置;`validateContextPolicy()`
  识别 `drift.enabled / threshold / write_signals / test_weight / exclude`,避免
  `verify --policy` 报 unknown section。测试覆盖:正常配置、未知 key warning、错误类型 error。

## 5. 命令面

```
cmap drift check [--module <id>] [--json]      # 默认只读:内存计算并输出,不修改工作区
cmap drift snapshot [--module <id>]            # 显式写 sourceSignals 到 freshness v2
cmap drift check --write-signals               # snapshot 的 alias,文档不主推
cmap drift review --module <id> [--out ...]    # 复核材料包:read-first、commits、changed files、建议命令
cmap drift mark-reviewed --module <id> --evidence "..."   # 更新 freshness v2 review metadata + watermark
cmap drift migrate                             # 显式 v1→v2 落盘迁移
```

- **读写拆分(复审 P1)**:`check` 是纯检查命令,与项目里 `verify` 的只读语义对齐;
  route/brief/UserPromptSubmit 调用只读计算路径,不因开工动作隐式弄脏
  `.context/generated/freshness.json`。signal 落盘只发生在显式 `snapshot` 或
  本就有写行为的 hook 场景(assist 模式已写 session brief/stats 的路径),后者 Phase 1 先不做。
- `mark-reviewed` 本质是 `freshness mark-reviewed` 的语义化包装,同一份状态。
- **`--evidence` 分层(复审 P2)**:`drift mark-reviewed` 必填;旧 `freshness mark-reviewed`
  保持 optional 不破契约,缺 evidence 时输出建议性 warning;底层 `markModuleReviewed()`
  仍接受 optional evidence,强约束只在 drift command handler。
  AI 判定无需改卡片时理由写入 evidence(如 "Only internal refactor; module purpose and
  verification unchanged"),供 Phase 3 调参。
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

### Phase 0.5 — schema 与读写边界切片(复审重写版)
1. `FreshnessIndexV1 | FreshnessIndexV2` 读取兼容层,读路径不写回。
2. 显式 migration/write path:只在 snapshot/mark-reviewed/migrate 中落盘。
3. drift policy schema + 默认配置(`ContextPolicy`/`renderDefaultPolicy`/`validateContextPolicy`)。
4. `drift check` 只读计算模型,先不落 sourceSignals。
5. route/brief/UserPromptSubmit 只接入只读 drift block。

验收:
- `verify --freshness` 对 v1/v2 都只读(文件字节不变测试)。
- `verify --policy` 对 `drift:` 不报 unknown section。
- `drift check` 不修改工作区。
- `drift mark-reviewed --evidence ...` 更新同一份 freshness index。
- 旧 `freshness mark-reviewed`(无 evidence)用法不破。

### Phase 1 — commit-aware freshness MVP(预估 3-4 天)
- 三类 git 信号合并 + rename/delete(R/D)高分信号;三因子评分;
  `drift snapshot`(显式写);`verify --freshness` commit-aware warnings;
  route/brief/UserPromptSubmit 注入;Review HTML badge。
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
- rename/delete 归属丢失——**Phase 1 用 `--name-status` 的 R/D 高分信号覆盖**(见 §4),
  不再依赖 Phase 2 "天然覆盖"。
- 三因子初版参数靠拍——用 Phase 3 的 evidence 数据迭代,参数全部在 policy.yml 可调;
  routeExposure/moduleRisk/structure 因子以 debug 字段先行积累数据。
