# Freshness/Drift Review Signals v2 复审

> 评审日期: 2026-06-12  
> 被评审文档: `docs/plans/2026-06-12-drift-detection-implementation-plan.md`  
> 结论: v2 已经吸收 v1 的核心问题,可以进入设计落地;但还需要补 6 个实现级约束,否则容易破坏现有 freshness/verify 的只读边界或引入低噪声承诺无法兑现的问题。

## Findings

### P1: 不要在读取路径里自动写回 freshness v2 migration

新版 §3 写到 "读到 v1 结构时升级写回",这个表述需要改。当前 `verify` 模块的契约是只读检查;`verify --freshness` 通过 `freshnessWarnings()` 读取 freshness index,不应因为发现 v1 schema 就修改 `.context/generated/freshness.json`。`view --include-freshness` 同理是渲染现有数据,不应隐式迁移。

建议:

- `readFreshnessIndex()` 只做 in-memory normalize,把 v1 当 v2-compatible structure 返回,不落盘。
- 只有写命令可以迁移落盘:`freshness snapshot`、`freshness mark-reviewed`、`drift mark-reviewed`,以及显式 `freshness migrate` 或 `drift migrate`。
- 验收测试加一条:先手写 v1 `freshness.json`,跑 `verify --freshness` 和 `view export --include-freshness --check`,文件内容不得改变。

### P1: `drift check` 的写入语义需要拆开

新版 §5 定义 `cmap drift check` 为"计算并落 sourceSignals"。这会让一个名字像检查的命令变成写命令,并且 route/brief/UserPromptSubmit 若复用它,可能每次开工都更新 `.context/generated/freshness.json`。当前项目允许 route 写 route-usage stats,但 drift signal 比 route stats 更接近复核状态,写频率和并发面都更敏感。

建议:

```bash
cmap drift check [--module <id>] [--json]       # 默认只读,输出当前计算结果
cmap drift snapshot [--module <id>]             # 显式写 sourceSignals
cmap drift check --write-signals                # 可选 alias,但文档不主推
```

route/brief/UserPromptSubmit 应调用只读计算路径,只在现有 hook 已经写 session brief/stats 的场景下,再评估是否需要把低分 signal 落盘。否则 "低分只写 generated 层" 会在用户体验上变成隐性频繁脏工作区。

### P1: `policy.yml drift:` 需要纳入 schema,否则 `verify --policy` 会产生新 warning

新版 §4 说参数与阈值放 `policy.yml` 的 `drift:` 段。当前 policy loader 只识别 `auto_apply / candidate_only / blocked / thresholds / inbox / generated_evidence`;新增顶层 `drift:` 会被 `verify --policy` 报 `unknown policy section drift`。

建议 Phase 0.5 明确包含:

- `ContextPolicy` 新增 `drift` 配置类型。
- `defaultContextPolicy` 和 `renderDefaultPolicy()` 输出默认 drift 配置。
- `validateContextPolicy()` 识别 `drift.enabled / threshold / write_signals / test_weight / exclude` 等键。
- `tests/integration/m22-freshness-policy.test.ts` 或新 m26 覆盖 drift policy 正常、未知 key warning、错误类型 error。

### P2: `--evidence 必填` 与旧 freshness 兼容要分层说明

新版 §5 要求 `drift mark-reviewed --evidence` 必填,但 §3 又承诺旧 `freshness mark-reviewed` 行为不破。当前 `freshness mark-reviewed` 的 CLI 是可选 `--evidence`;如果为了 drift 改成全局必填,会破坏既有命令契约。

建议:

- `drift mark-reviewed` 要求 `--evidence` 必填。
- `freshness mark-reviewed` 保持兼容,但没有 evidence 时输出 warning,建议补充理由。
- 底层 `markModuleReviewed()` 仍接受 optional evidence;强约束放在 drift command handler。

### P2: rename 盲区不能交给 Phase 2 "天然覆盖"

新版 §8 仍保留 "git log -- <paths> 对 rename 盲区,Phase 2 结构比对覆盖"。这句话过强。Phase 2 如果只读 `.context/generated/source-facts/codegraph.json` 并按现有 module paths 找事实,当文件被 rename 且模块 paths 未更新时,provider 未必知道旧 owned path 与新文件属于同一模块。结构比对只能覆盖"同一模块事实被成功归属"后的差异,不能天然解决归属丢失。

建议 Phase 1 就补一个低成本 rename/deletion signal:

- 对 last-reviewed 后的 `git diff --name-status` / `git log --name-status` 解析 `R`, `D`。
- 如果 owned path 被删除或 rename,直接给高分提示:"owned path changed; review module paths before trusting this card"。
- `drift review` 的 read-first 中列出旧 path、新 path、模块卡片。

### P2: drift budget 初版需要固定最小可解释模型

新版 §4 的 drift budget 方向好,但一次引入 5 个因子会让 m26 测试和 dogfooding 难以解释。特别是 `routeExposureScore` 会把历史高频模块推高,可能让新模块在前几次开发中提示不足。

建议 Phase 1 固定为三因子:

```text
driftScore = sourceChangeScore + pendingCandidateScore + testSignalScore
```

`routeExposureScore` 和 `moduleRiskScore` 先只记录为 debug 字段,不参与 threshold。等 5-10 个真实任务数据出来后再打开。这样能保证第一版提示原因足够透明。

## Positive Assessment

v2 的主要方向已经对齐 CMAP 当前产品边界:

- 把 drift 收敛为 freshness 的 source-code signal,避免第二套真相。
- 状态放 generated metadata,不污染 canonical module docs。
- 不读 `.codegraph` sqlite,不内置 parser,Phase 2 只消费外部 source-facts JSON。
- 注入点从 SessionStart 下沉到 UserPromptSubmit/route/brief,更贴合任务上下文。
- 模块合并推迟,避免污染算法 dogfooding 结论。

这版可以开工,但建议先把 Phase 0.5 改成"schema/读写边界切片",不要直接进入完整 Phase 1。

## Recommended Phase 0.5 Rewrite

把 Phase 0.5 改成:

1. 设计 `FreshnessIndexV1 | FreshnessIndexV2` 的读取兼容层;读路径不写回。
2. 增加显式 migration/write path,只在 snapshot/mark-reviewed/migrate 中落盘。
3. 增加 drift policy schema 和默认配置。
4. 增加 `drift check` 只读计算模型;先不要落 sourceSignals。
5. 为 route/brief/UserPromptSubmit 只接入只读 drift block。

验收:

- `verify --freshness` 对 v1/v2 都只读。
- `verify --policy` 对 `drift:` 不报 unknown section。
- `drift check` 不修改工作区。
- `drift mark-reviewed --evidence ...` 更新同一份 freshness index。
- `freshness mark-reviewed` 旧用法不破。

## Go / No-Go

Go,但带条件:

- 先修正文档中的 "读到 v1 升级写回" 和 "`drift check` 落 sourceSignals" 两处措辞。
- 把 policy schema 和只读/写入路径拆分列入 Phase 0.5 验收。
- Phase 1 的评分先收窄,等 dogfooding 数据再打开 route exposure / module risk。

这样实现出来的第一版会小一些,但更符合 CMAP 的核心承诺:本地、确定性、低噪声、support layer 与 canonical memory 分离。
