# cmap Drift Detection 实现方案(v1)

> 起草:2026-06-12 · 状态:待评审
> 前置调研:`docs/research/2026-06-12-feasibility/`(00-verdict / 01-competitors / 02-evidence / 03-drift-detection)
> 一句话:给 cmap 增加"模块卡片漂移探测"能力——代码结构变了而产品卡片没更新时,
> 在 AI 会话开始/路由时注入复核提示。这是 cmap 相对所有竞品的差异化核心。

---

## 1. 背景与设计原则

### 1.1 要解决的问题
模块卡片(`.context/modules/*.md`)是产品视角的意图层文档,由 AI 在开发中维护。
实证表明"过期文档比无文档更危险"(agent 绝对信任文档,arXiv:2602.20478),
而靠 agent 自觉同步更新已被验证不可行。需要一个确定性机制把"卡片可能过期"
变成 AI 会话能看到的信号。

### 1.2 设计原则(来自调研定论,评审时请对照)
1. **AI-first 触发**:信号注入给 AI 会话(session-start / route / brief),不报警给人。
   人类动机问题是历史上所有 doc-sync 产品的死因,cmap 的消费者是 AI,天然绕开。
2. **提示,不阻塞**:drift 信号是"建议复核",不是 CI 红灯;漏报比误报更危险,
   但告警疲劳会让 AI 习惯性忽略,所以要语义过滤 + 评分阈值。
3. **不做语义分析的重活**:Phase 1 只用 git 历史;Phase 2 只用 import/export 结构快照;
   行为语义漂移(签名不变但语义变)是全行业静态方法的共同盲区,接受之,
   交给 Phase 3 可选的 LLM 判断层。
4. **复用现有基础设施**:hooks 管线、generated 层、frontmatter、policy 闸门都已存在,
   本方案不新建第二套机制。

---

## 2. 技术栈与依赖

| 项 | 选择 | 说明 |
|---|---|---|
| 语言/运行时 | TypeScript ESM, Node >= 20 | 与现有代码一致 |
| CLI 框架 | commander | 新增 `cmap drift` 子命令,挂入 `src/cli.ts` |
| frontmatter | gray-matter | 已有依赖,读写模块卡片 `last_verified_commit` |
| git 访问 | `child_process` 调系统 git(`git log`/`git rev-parse`) | **不引入** simple-git/isomorphic-git;项目现有风格是 spawn 系统命令,零新依赖 |
| 结构快照(Phase 2) | 方案 A:消费 CodeGraph 产物(`.codegraph/`);方案 B:内置 `es-module-lexer` | 见 §5.2 取舍 |
| 哈希(Phase 2) | Node 内置 `crypto`(sha256 截断)或 `xxhash-wasm` | 指纹只需抗碰撞不需密码学强度;若想零依赖用 crypto,追求速度用 xxhash(Fiberplane Drift 同款思路) |
| 测试 | Vitest 集成测试,spawn `tsx src/cli.ts` 于临时 git 仓库 | 沿用 m1-m25 测试模式;**注意测试夹具需要 `git init` + 真实 commit** |

不需要:tree-sitter(Phase 1/2 都不解析 AST)、数据库、daemon、模型 API。

---

## 3. 涉及的算法与机制(含小众项)

1. **Last-verified watermark(水位线)**:每张卡片 frontmatter 记 `last_verified_commit`,
   用 `git log <watermark>..HEAD -- <paths>` 判断"卡片验证后源码是否动过"。
   等价于 arXiv:2602.20478 生产验证的 session-start git parsing 方案。
2. **Normalized structural fingerprint(归一化结构指纹,Phase 2)**:对模块的
   {import 列表, exported symbols} 排序后序列化再哈希。只含结构信息,
   不含空白/注释/行号,所以格式化、注释、内部重构零误报。
   这是 Fiberplane Drift "node kinds + token text" 指纹思想的降维版——
   我们不锚定到符号级 AST 子树,只锚定到模块级 export/import 集合,实现成本低一个量级。
3. **加权漂移评分(Swimm 多信号直方图思想的简化)**:
   - 删除 exported symbol:+0.4(最高危,卡片可能引用了不存在的能力)
   - 新增 exported symbol:+0.3
   - import 边增删:+0.1/条
   - 仅 commit 计数(Phase 1 信号):+0.05/commit,封顶 0.2
   - 阈值 ≥ 0.3 → 在 route/brief 输出 drift 提示;< 0.3 只写 generated 层不提示。
   评分参数放 `policy.yml`,可调。
4. **路径归属复用**:变更文件 → 模块的映射直接用现有 `mapChangedFilesToModules`
   (`src/core/module-index.ts:106`),不重新发明。测试文件(`tests/**`、`*.test.*`)
   和生成目录(`dist/`、`.context/generated/`)在归属前过滤,消除一类经典误报。
5. **告警去疲劳**:同一模块的 drift 提示在 `last_verified_commit` 不变期间只在
   route/brief 中出现,不在每条 UserPromptSubmit 重复;提示文案带一键修复路径
   (`cmap drift verify <module>`),符合"修复成本低于两分钟"的存活产品共性。

---

## 4. Phase 1 — git log 水位线版(预估 2-3 天)

### 4.1 数据模型
模块卡片 frontmatter 新增可选字段:

```yaml
last_verified_commit: "abc1234"   # cmap drift verify 时写入,初始由 migrate 命令补齐
```

- `paths` 字段已存在,作为 `git log -- <paths>` 的范围。
- 字段缺失 = 该卡片未纳入 drift 跟踪,verify 报 info 级提醒(渐进迁移,不破坏现有项目)。

### 4.2 新命令(`src/commands/drift.ts`)

```
cmap drift check [--json]        # 全部卡片:水位线之后各自 paths 有多少 commit,输出 stale 列表
cmap drift check --module <id>   # 单模块
cmap drift verify <id> [--all]   # 复核完成后把水位线推到 HEAD(写 frontmatter,留 backup)
cmap drift migrate               # 初始化:全部卡片 last_verified_commit = HEAD
```

输出样例(text 模式):

```
[cmap-drift] Potentially stale module cards:
  - route   3 commits since abc1234 (last verified 2026-06-01)
  - view    7 commits since 9f02e11 (last verified 2026-05-20)
Run `cmap drift verify <module>` after reviewing the card.
```

### 4.3 注入点(全部是已有管线的接线,不新建机制)
1. **route**:`cmap route` 命中的模块若 stale,route 卡片追加一行
   `drift: card may be stale (3 commits behind), review before trusting`。
2. **brief/pack**:开工包里带同样的提示块(AI 开工时必读,这是最重要的注入点)。
3. **hooks**:`cmap hooks ingest --event SessionStart`(Claude/Codex 双宿主模板已存在,
   `src/hooks/templates.ts:27,72`)在 assist 模式下执行 drift check,
   结果写进 `.context/out/session-brief.md` 与 hook 的 additionalContext 输出。
4. **verify**:`cmap verify --drift` 列出 stale 卡片(warning 级,不算 error,CI 不红)。

### 4.4 policy 闸门
`policy.yml` 新增:

```yaml
drift:
  enabled: true
  threshold: 0.3
  exclude: ["tests/**", "**/*.test.*", "dist/**"]
```

`drift verify` 写 frontmatter 属于低风险 metadata 更新,走现有 backup/audit 通道
(`src/fs/backup.ts`),与 update-agent 对 checkpoint 的处理同级——
不触碰"语义内容不可自动写"的红线,因为水位线不是语义事实。

### 4.5 测试(新增 `tests/integration/m26-drift.test.ts`)
- 临时目录 `git init` → `cmap init` → migrate → 改源码文件 commit → `drift check` 报 stale。
- 改 `tests/**` 文件 → 不报(过滤生效)。
- `drift verify` 后再 check → 干净;frontmatter 写入有 backup。
- route/brief 输出含 drift 提示行;`--json` 结构稳定。

---

## 5. Phase 2 — 结构快照 diff(预估 1-2 周,Phase 1 验证有用后再做)

### 5.1 数据模型
`cmap drift verify` 时为每模块落一份结构快照(generated 层,非 canonical):

```
.context/generated/snapshots/<module>.json
{ "module": "route", "commit": "abc1234",
  "imports": ["commander", "src/core/module-index"],
  "exports": ["routeCommand", "RouteReport"],
  "fingerprint": "sha256:9c1f..." }
```

### 5.2 结构事实来源(评审重点,二选一)
- **方案 A(推荐)**:消费 CodeGraph 的产物。cmap 已声明"源码事实归 CodeGraph"
  (MAP.md Data Flow),`.codegraph/` 存在时直接读它的 import/symbol 导出,
  cmap 零解析代码。缺点:对 CodeGraph 的输出格式产生耦合,且无 CodeGraph 的项目退化为 Phase 1。
- **方案 B(备选)**:内置 `es-module-lexer`(~10KB wasm,esbuild 同款,只解析
  ESM import/export,不是完整 AST)。优点:零外部依赖、任何 TS/JS 项目可用;
  缺点:只覆盖 JS/TS 生态,与"cmap 不做源码分析"的边界有张力。
- 建议:接口抽象成 `StructureFactProvider`,A 为默认实现、B 为 fallback,边界争议留给评审。

### 5.3 评分与提示
按 §3.3 的加权评分;提示文案带具体结构变化:

```
[cmap-drift] route: card may be stale (score 0.5)
  - exported symbol removed: legacyRouteFlag
  - new import: src/core/context-graph
```

---

## 6. Phase 3(可选,远期)— LLM 语义判断层
把 Phase 2 的结构 diff 交给会话内的 AI 判断"这个变化是否影响产品卡片",
过滤纯重构。不调用模型 API(cmap 保持 local-only 无模型调用),
而是把判断任务写进注入提示,由宿主会话的模型顺手完成。Phase 1+2 验证后再议。

## 7. Hooks / 插件 / MCP / Skill 适配清单

| 集成面 | 动作 | 状态 |
|---|---|---|
| Claude Code hooks | SessionStart(assist 模式)执行 drift check 并注入 additionalContext | 管线已有,接线即可 |
| Codex hooks | 同上,`.codex/hooks.json` 渲染模板同步加 | 管线已有 |
| Skill pack(`.cmap/skills/cmap/`) | SKILL.md 增补 drift 工作流:"编辑模块前看 drift 提示;复核后 `cmap drift verify`" | 模板小改 |
| 宿主入口(AGENTS/CLAUDE.md cmap block) | Start Here 第 5 步后加:"route 提示 drift 时,先复核卡片再编辑" | host 模板小改 |
| Review HTML(`cmap view`) | stale 卡片加 badge(渲染现有 drift 数据,不做新分析,符合 view 红线) | Phase 1 末尾顺带 |
| MCP | **不需要**。cmap 是 CLI + hook 注入,无常驻服务;做 MCP server 违反 local-only/no-daemon 约定 | 明确不做 |
| CodeGraph | Phase 2 方案 A 的事实来源;Phase 1 零依赖 | 见 §5.2 |

## 8. 风险与开放问题(请评审人重点看)
1. **Phase 1 误报偏多**(任何 commit 都算信号,包括纯格式化)。缓解:exclude 过滤 +
   评分封顶 + 提示语气是"建议复核"不是"已过期"。是否可接受,还是必须等 Phase 2?
2. **水位线写 frontmatter 是否污染卡片语义区**?当前判断:不污染(纯 metadata,
   与 updated_at 同性质),但它会让卡片 diff 变频繁。备选:水位线挪到
   `.context/generated/drift-watermarks.json`(代价:卡片不再自包含)。
3. **`git log -- <paths>` 对 rename 的盲区**(`--follow` 只支持单文件)。
   接受 Phase 1 漏报 rename;Phase 2 指纹比对天然覆盖。
4. **多 agent 并发**:两个会话同时 `drift verify` 同一卡片,frontmatter 写冲突。
   缓解:写前 re-read + backup;与现有 cp/update-agent 的并发假设一致(乐观,不加锁)。
5. **粒度联动**:drift 的价值依赖模块地图按能力边界划分(24 个碎模块会放大告警量)。
   建议模块合并(24 → ~8-10)与 Phase 1 同期做,作为 dogfooding 验证场。

## 9. 验收标准
- 本仓库 dogfooding:故意改 `src/commands/route.ts` 不更新卡片,下一会话的
  brief/route 输出出现 drift 提示;`drift verify route` 后提示消失。
- `pnpm test && pnpm typecheck && pnpm build` 全绿;新增 m26 集成测试覆盖 §4.5 场景。
- 误报感受:连续 5 个真实开发任务中,drift 提示被 AI 判定为"无需改卡片"的比例 < 50%。
