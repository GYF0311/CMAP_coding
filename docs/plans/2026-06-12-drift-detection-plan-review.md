# Drift Detection 方案评审

> 评审日期: 2026-06-12  
> 被评审文档: `docs/plans/2026-06-12-drift-detection-implementation-plan.md`  
> 结论: 方向成立,但应收敛为现有 `freshness` 体系的 commit-aware 升级,不要另起一套 drift 状态模型。

## 总体判断

这个方案的产品方向是对的:它补的是 CMAP 最危险的一环--模块卡片被 AI 当真,但代码已经变了。它也基本守住了项目边界:不做 MCP server、不做 daemon、不把源码图谱搬进 CMAP,Phase 1 零新依赖。

真正的问题不在"能不能做",而在"现在仓库里已经有一套很接近的 freshness 机制"。现有 `freshness snapshot / mark-reviewed / verify --freshness / view --include-freshness` 已经承担了"源码或生成证据晚于语义复核"的职责。若方案按 `last_verified_commit` + `cmap drift verify` 新开状态,会造成两个复核概念并存:

- `freshness mark-reviewed`: 更新 `.context/generated/freshness.json`,表示模块语义已复核。
- `drift verify`: 更新模块 frontmatter,表示模块卡片已复核。

这两个动作对用户和 AI 来说几乎同义,但存储位置、并发语义、视图入口、verify 入口不同。长远看会变成产品噪声。

推荐修正为:

> Drift detection 不作为独立产品层;作为 `freshness v2.1` 的 git-aware signal。CLI 可以给一个更好记的 `cmap drift` 别名,但底层状态、锁、Review HTML、verify 输出都复用 freshness。

## 主要问题

### 1. 不要把水位线写入模块 frontmatter

方案在 §4.1 建议每张模块卡片新增 `last_verified_commit`,并在 §8 把 frontmatter 与 JSON 作为开放问题。我的判断:选 JSON,而且优先复用 `.context/generated/freshness.json`。

原因:

- CMAP 当前明确把源码级事实交给 CodeGraph,模块卡片只保存耐用项目理解;`last_verified_commit` 是检查状态,不是模块解释本身。
- 现有 evidence 模块已经规定 freshness review markers 存在 generated 层,且不会改 canonical module docs。
- 现有 freshness 写入已经有 `.context/generated/freshness.json.lock` 和 atomic rename,并有并发测试覆盖;新 frontmatter 写入只靠 backup/re-read 会比现状弱。
- frontmatter 写入会让每次"我复核过了"都污染模块卡片 diff,反而降低模块语义 diff 的信噪比。

建议数据模型:

```json
{
  "version": 2,
  "modules": {
    "route": {
      "reviewState": "reviewed",
      "lastSemanticReviewedAt": "2026-06-12T...",
      "lastReviewedCommit": "full-40-char-sha",
      "reviewEvidence": "Reviewed route after drift review",
      "ownedFiles": {},
      "sourceSignals": {
        "commitsSinceReview": 3,
        "workingTreeChangedFiles": [],
        "structureScore": 0.4
      }
    }
  }
}
```

这样 `cmap drift mark-reviewed` 可以只是 `freshness mark-reviewed` 的更语义化包装,不会新建第二套真相。

### 2. Phase 1 只看 `git log watermark..HEAD` 会漏掉未提交变更

方案的 Phase 1 用 `git log <watermark>..HEAD -- <paths>` 判断漂移。这个适合"上次复核后已经 commit 的历史",但 CMAP 的核心使用场景是 AI 正在一轮会话里开发:很多时候代码还在 working tree,尚未 commit。此时下一次 `route` / `brief` / `UserPromptSubmit` 可能已经会读到旧卡片,但 `git log` 完全不会报。

建议 Phase 1 至少合并三类信号:

- committed: `git log <lastReviewedCommit>..HEAD -- <owned paths>`
- uncommitted: `git diff --name-only` + `git diff --name-only --cached`
- untracked but mapped: `git ls-files --others --exclude-standard`

评分上可以区分:

- committed source change: 中权重
- uncommitted source change: 中高权重,因为它更可能就是当前会话上下文
- test-only change: 低权重,不默认归零

### 3. SessionStart 不是最强注入点,UserPromptSubmit/route 才是

方案 §4.3 说 `SessionStart` 执行 drift check 并写入 `.context/out/session-brief.md` 与 `additionalContext`。源码上看,当前 `SessionStart` ingest 只输出通用提示;真正拿到用户任务、能 route 到模块、能写 session brief 的是 `UserPromptSubmit` assist path。

因此建议分层:

- `SessionStart`: 只给 project-level 摘要,例如 "3 modules have unreviewed freshness signals; route will show details." 不列全量模块,避免启动噪声。
- `UserPromptSubmit`: 根据 prompt route 到 direct modules,只注入命中模块和少量 related modules 的 drift/freshness 信号。
- `cmap route` / `cmap brief`: 作为确定性入口,输出同一份 drift block。

这样既符合 AI-first,又不会让每次启动都像 CI 报告。

### 4. Phase 2 的 CodeGraph 消费边界需要更硬

方案推荐 Phase 2 消费 `.codegraph/` 产物,这是方向正确的,因为 CMAP 不应自己变成源码事实层。但当前计划还不够硬:

- `.codegraph/` 现在是 sqlite/daemon 形态的内部产物,直接读库会把 CMAP 绑定到外部工具内部 schema。
- "方案 B: 内置 es-module-lexer fallback" 虽然轻,但仍是 CMAP 自己解析源码;这会重新打开"CMAP 是否维护源码事实"的口子。
- `es-module-lexer` 目前只是锁文件里的传递依赖,不是 cmap runtime dependency;直接 import 不能算零新依赖或稳定 API。

建议把 Phase 2 的事实来源改成显式 provider contract:

```ts
type SourceFactProvider = {
  name: "codegraph" | "external-json";
  readModuleFacts(cwd: string, moduleId: string): Promise<ModuleStructureFacts | undefined>;
};
```

第一版只支持稳定 JSON 输入,例如 `.context/generated/source-facts/codegraph.json`,由 CodeGraph 或外部命令生成。CMAP 只消费"已生成事实包",不读取 `.codegraph` 内部数据库,也不内置 JS/TS parser。没有 provider 时退回 Phase 1,不要 silent fallback 到自研解析。

### 5. 测试文件不要一刀切过滤

方案 §3.4 / §4.4 计划过滤 `tests/**` 和 `*.test.*` 来防误报。这个思路能降噪,但当前 `.context/modules/view.md` 等模块已经把集成测试列入 module paths;测试文件在 CMAP 里不是纯噪声,常常是"这个模块的公共行为契约"。

建议改成 test signal 降权,而不是全局排除:

- 只改测试: score `+0.05` 到 `+0.1`,通常写 generated 层,不直接 route 提示。
- 测试 + 源码同改: 测试作为增强证据,不重复加太多分。
- 测试模块本身: `tests` module 正常接收测试路径信号。
- 每个模块仍可通过 `paths.exclude` 或 drift policy 定制过滤。

这样不会因为"为了降误报"而漏掉行为契约变化。

### 6. `drift verify` 这个动词容易误导

项目里 `verify` 一直表示确定性检查,而 `mark-reviewed` 表示人/AI 完成语义复核。方案里的 `cmap drift verify <module>` 实际是"我已复核并接受",不是 verify。

建议命令名:

```bash
cmap drift check [--module <id>] [--json]
cmap drift review --module <id> [--out ...]
cmap drift mark-reviewed --module <id> --evidence "..."
```

兼容性上可以保留 `cmap drift verify` 作为隐藏 alias,但文档和提示不要主推它。

## 对开放问题的回答

### ① Phase 1 误报率可否接受?

可以接受,但前提是 Phase 1 不只用 commit count,而是接入现有 freshness 的 reviewState 和 owned file hash/mtime,并且 route 只提示命中模块。

单纯 commit count 的噪声会偏高;但作为 generated signal 写入、低分不提示、高分才进入 route/brief,风险可控。

### ② 水位线写 frontmatter 还是单独 JSON?

单独 JSON,并复用 `.context/generated/freshness.json`。如果要保持卡片自包含,最多在 frontmatter 保留一个人工语义字段,例如 `reviewed_at`,不要放 commit watermark。

### ③ Phase 2 结构事实来源选 CodeGraph 还是 es-module-lexer?

选 CodeGraph/外部事实包,不选内置 parser fallback。

更准确地说:CMAP 定义 provider contract,只消费 source facts;CodeGraph 是默认推荐 provider。`es-module-lexer` 可以作为未来独立 companion tool,但不要塞进 CMAP core。

### ④ 模块地图 25 -> 8-10 要不要同期做?

不要同期做。当前实际是 25 个 module docs,不是 24 个。模块合并会影响 route benchmark、relation graph、view、module docs、VERIFY,本身就是一个产品结构迁移。和 Phase 1 同期做会污染 dogfooding 结论:你不知道告警变少是算法好,还是模块边界变粗。

建议顺序:

1. 先做 freshness/drift commit-aware MVP。
2. 用本仓库 5-10 个真实任务记录每次命中模块、提示分数、AI 是否真的需要改卡片。
3. 根据数据合并模块,而不是凭感觉先合并。

## 建议的新分期

### Phase 0.5: 收敛术语与现有 freshness

- 把计划改名为 "Freshness/Drift Review Signals"。
- 明确 `drift` 是 freshness 的一种 source-code signal。
- 取消 frontmatter `last_verified_commit`。
- 设计 `.context/generated/freshness.json` v2 migration。

验收:

- 旧 `freshness snapshot/mark-reviewed/verify --freshness/view --include-freshness` 流程不破。
- 新 `cmap drift check` 能读取同一份 freshness index。

### Phase 1: commit-aware freshness MVP

- `cmap drift check`: 合并 committed/uncommitted/untracked mapped files。
- `cmap drift review --module`: 输出 read-first、git commits、changed files、建议命令。
- `cmap drift mark-reviewed`: 更新 freshness v2 的 review metadata 和 commit watermark。
- `verify --freshness`: 增加 commit-aware warnings,不新增 `verify --drift` 也可以。
- `route/brief/UserPromptSubmit`: 只对 routed modules 注入简短 drift block。

验收:

- 临时 git 仓库集成测试覆盖真实 commit。
- 未提交源码变更也能触发提示。
- 并发 mark-reviewed 继续通过 lock 测试。
- Review HTML 能显示 stale/pending 状态,不需要新分析。

### Phase 2: external source-facts provider

- 定义 `source-facts` JSON schema。
- 支持读取 `.context/generated/source-facts/codegraph.json`。
- 只在 provider 存在时计算 import/export structural score。
- 没有 provider 时不报错,退回 Phase 1。

验收:

- 不读取 `.codegraph` sqlite 内部 schema。
- 不引入 parser 依赖。
- source facts 在 Review HTML 中标为 support layer,不是 canonical truth。

### Phase 3: prompt-level semantic filter

- 不调 API。
- 在 drift review material 中加入 "AI 判断这个变化是否影响模块目的/边界/验证" 的 checklist。
- 如果 AI 判定无需更新,`mark-reviewed` evidence 必须写理由,例如 "Only internal refactor; module purpose and verification unchanged."

验收:

- 连续真实任务中,无须更新卡片的 drift 提示比例低于 50%。
- false-positive reason 可被后续调参使用。

## 新颖想法: drift budget

可以给每个模块一个轻量 "drift budget",不是只看有没有 stale:

```text
driftScore = sourceChangeScore
           + structureScore
           + pendingCandidateScore
           + routeExposureScore
           + moduleRiskScore
```

其中:

- `routeExposureScore`: 复用现有 route usage stats。经常被 route 命中的模块,漂移提示更重要;没人读的模块先写 generated 层即可。
- `moduleRiskScore`: 如果 module frontmatter 将来有 risk/layer,高风险模块降阈值。
- `pendingCandidateScore`: 有 high-risk inbox 或 relation candidate 的模块,更容易提示。
- `sourceChangeScore`: git/freshness 基础信号。

这比固定阈值 `0.3` 更贴合 CMAP 的产品定位:不是所有代码变动都重要,重要的是"下一个 AI 很可能会读这个模块卡片并被误导"。

## 推荐给原方案的最小改写

把原方案核心句从:

> 给 cmap 增加"模块卡片漂移探测"能力。

改成:

> 把现有 freshness 机制升级为 commit-aware 的模块卡片复核信号:源码、候选事实或结构事实晚于语义复核时,在 route/brief/UserPromptSubmit 中提醒 AI 先复核卡片;复核状态只写 generated metadata,不污染 canonical module docs。

这一版更贴近 CMAP 当前边界,也更容易在 2-3 天内做出可靠 dogfood。
