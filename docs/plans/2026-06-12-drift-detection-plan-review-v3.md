# Freshness/Drift Review Signals v3 复审

> 评审日期: 2026-06-12  
> 被评审文档: `docs/plans/2026-06-12-drift-detection-implementation-plan.md`  
> 评审基线: `e493725 docs: revise drift plan to v3 per second review (read-only boundaries)`  
> 结论: Go。v3 已经解决前两轮的主要架构问题,可以开工 Phase 0.5;本轮只建议在实现前补几条测试级护栏,避免落地时出现命名、policy parser 或 git rename 归属的细小滑坡。

## Findings

### P1: `drift.exclude` 的 policy 类型需要先定死

v3 把 `drift.enabled / threshold / write_signals / test_weight / exclude` 纳入 Phase 0.5 policy schema。这里唯一需要提前收口的是 `exclude`:当前 `policy.yml` parser 是轻量手写解析,只处理顶层 section 下的 `key: scalar`。如果 `exclude` 打算是 YAML list 或 glob array,实现会被迫顺手扩展 parser,测试面也会变大。

建议:

- Phase 0.5 要么暂时不放 `exclude`,只实现 boolean/number scalar。
- 要么把它显式定义成 scalar,例如 `exclude_globs: "dist/**,.context/generated/**"`,由 drift 模块自己 split/trim。
- 如果坚持 YAML list,那就把 "policy parser 支持 section-local list" 列成 Phase 0.5 明确工作项,并补正常 list、错误类型、未知 key 的测试。

相关证据:

- v3 §4 要求 `validateContextPolicy()` 识别 `drift.*` policy key。
- 当前 `src/context/policy.ts` 只处理 scalar 行,未知 section/key 以 warning surfaced。

### P1: rename/delete 归属要从旧 freshness owned paths 反查,不能只靠当前 module index

v3 已经把 R/D 信号提前到 Phase 1,方向正确。实现时要特别注意归属来源:rename/delete 的核心场景是 `.context/modules/<id>.md` 还没更新,所以当前 module index 可能仍指向旧 path,也可能已经被用户手动改到新 path。真正稳定的基线应该是上次 snapshot/mark-reviewed 里的 `freshness.modules[id].ownedFiles`。

建议 `drift check` 对 R/D 的归属顺序:

1. 先用 previous freshness `ownedFiles` 反查 old path。
2. 再用当前 module paths 反查 changed/new path。
3. 两者命中任一模块时都把 old/new path 放进 `drift review` read-first。

验收测试应覆盖:

- `src/old.ts` 已被 mark-reviewed,随后 `git mv src/old.ts src/new.ts`,模块卡片不改,`drift check --module <id>` 必须高分。
- 已 review 的 owned path 被 `git rm` 或工作区删除,不等 Phase 2,直接提示复核 module paths。

### P2: `sourceSignals` schema 需要存"为什么得分",不只存原始计数

v3 的数据模型示例包含 `commitsSinceReview / workingTreeChangedFiles / untrackedMappedFiles / structureScore`,但 §4 又要求三因子评分和 debug 字段。为了 Review HTML、`drift snapshot`、以及后续调参可解释,建议把 `drift check --json` 和 snapshot 存储统一成同一份结构。

建议最小字段:

```ts
sourceSignals: {
  computedAt: string;
  baseCommit?: string;
  headCommit?: string;
  driftScore: number;
  reasons: string[];
  changedFiles: Array<{
    path: string;
    oldPath?: string;
    status: "committed" | "modified" | "staged" | "untracked" | "renamed" | "deleted" | "test";
    score: number;
  }>;
  debug?: {
    routeExposureScore?: number;
    moduleRiskScore?: number;
    structureScore?: number;
  };
}
```

这样高分提示可以直接解释,低分数据也能被 dogfooding 复盘,不会只剩一个难追溯的总分。

### P2: "只读 drift block" 要限定为不写 freshness/sourceSignals

v3 说 route/brief/UserPromptSubmit 调用只读计算路径,不隐式弄脏 `.context/generated/freshness.json`。这个边界是对的,但实现和测试措辞要小心:当前 `cmap route` 本身会写 route usage stats,assist `UserPromptSubmit` 也会写 session event、session brief 和 route usage stats。这是既有产品行为,不应被 drift 的只读承诺误伤。

建议在实现和验收里使用更精确的说法:

- `drift check` 必须全工作区只读。
- route/brief/UserPromptSubmit 的 drift 计算不得写 `freshness.json`,不得落 `sourceSignals`。
- 如果要测试 route/hook 调用后工作区完全不变,需要先用 policy 关闭既有 `stats.update`,或者只断言 `freshness.json` 字节不变。

### P2: first-run / no-review 的 commit baseline 要明确

v3 新增 `lastReviewedCommit`,但没有细说模块从未 mark-reviewed 时如何计算 `git log watermark..HEAD`。如果没有 baseline,第一次开启 drift 可能把项目历史全部算成 drift;如果直接静默,又可能漏掉刚接入后的真实变更。

建议明确一条规则:

- `freshness snapshot` 只建立 baseline,不代表人工语义复核。
- 没有 `lastReviewedCommit` 时,`drift check` 不回溯全历史;只提示 "no semantic review commit baseline" 或只看 working tree。
- `drift mark-reviewed --evidence ...` 才写入 `lastReviewedCommit = HEAD`,之后 committed delta 才从该 commit 开始算。

这样和当前 "first freshness snapshot is baseline, mark-reviewed is explicit semantic review" 的 evidence 模块契约一致。

### P3: 文档里的 view 命令名用精确 CLI 形式

v3 §3 写 `view --include-freshness`,当前命令面是 `cmap view export --include-freshness --check --out ...`。这是小文案问题,但建议在验收测试描述里写精确命令,避免实现时误加一个并不存在的 shorthand。

## Positive Assessment

v3 已经达到可以开工的状态:

- drift 被正确收敛为 freshness 的 commit-aware signal,没有第二套状态。
- 读写边界已经摆正:`check` 只读,`snapshot/migrate/mark-reviewed` 才写。
- policy schema、v1 normalize、evidence 分层、R/D 信号、三因子评分都进了合适阶段。
- Phase 2 继续坚持 external source-facts provider,没有回到内置 parser 或读取 CodeGraph 内部 schema。
- 模块合并继续推迟,不会污染 drift dogfooding 数据。

## Phase 0.5 Addendum

我建议 Phase 0.5 开工时把验收补成这几条:

- `drift:` policy 正常 scalar 配置通过;`exclude` 的类型按本轮决定覆盖测试。
- 手写 v1 freshness 后,`verify --freshness`、`view export --include-freshness --check` 不改 `freshness.json` 字节。
- `drift check` 不改工作区;route/brief/UserPromptSubmit 只保证不写 freshness/sourceSignals。
- `drift mark-reviewed --evidence ...` 写 `lastReviewedCommit`,旧 `freshness mark-reviewed` 无 evidence 仍可用。
- git fixture 覆盖 committed、staged、unstaged、untracked、rename、delete,其中 R/D 从 previous owned paths 反查模块。
- `drift check --json` 与 `drift snapshot` 输出/存储同构,都包含 score reasons。

## Go / No-Go

Go。

我不建议再把 Phase 0.5 延长成完整设计重写。现在方案已经足够小:先把 schema、读取兼容、只读 check、显式写路径和 drift block 接好;上面的补充只是为了让第一刀更稳,不是新的架构分支。
