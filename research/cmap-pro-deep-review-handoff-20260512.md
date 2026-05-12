# cmap Pro 深度文审交接报告

生成时间：2026-05-12 14:45 CST  
项目路径：`/Users/gaoyifan/Desktop/CMAP_coding`  
当前提交：`a635d874373a53d893ecd5340b05afd480e8632e`  
目标模式：ChatGPT Pro · 进阶 / 深度调研

---

## 0. 给 ChatGPT Pro 的任务说明

你需要从第一性原理和开源项目调研两个角度，对 `cmap` 当前设计与实现做一次严格文审，并输出一份可落地的下一阶段方案。

请不要只给泛泛建议。请完成以下任务：

1. 判断 `cmap` 当前是否已经接近目标态：
   - 是否已经能显著减少 AI coding 时的无效阅读和重复理解？
   - 是否能让新会话/上下文压缩后的 AI 快速接上项目主线？
   - 是否已经足够成为一个可维护、可推广的 CLI 产品？
   - 如果还没有，缺口是什么，优先级如何？

2. 调研公开可见的相关开源项目，至少覆盖这些方向：
   - repo map / codebase map / context graph / AI memory map
   - AI coding workflow / spec-driven development / phase runner
   - hooks / lifecycle automation / context injection
   - checkpoint / session restore / handoff
   - repo pack / context compression / prompt assembly
   - verification / CI / review loop

3. 对比 `cmap` 与可借鉴项目：
   - `GSD / GSD-2`
   - `gstack`
   - `superpowers`
   - `everything-claude-code`
   - `aider` 的 repo map 思路
   - `OpenHands` / `Continue` / `repo-agent` / `Repomix` / 其他你认为相关的开源项目

4. 给出最终落地路线：
   - P0 已完成哪些，是否需要补强。
   - P1/P2/P3 应该分别做什么。
   - 哪些功能应该进入 `cmap`，哪些应该保持为外部 adapter。
   - 哪些开源项目值得本地拉取源码学习或 copy 思路。
   - hooks 应该如何设计，才能帮助 AI 自主维护地图，但不污染 canonical facts。

5. 输出一份可执行方案：
   - 功能清单
   - 命令设计
   - 文件结构
   - 数据模型
   - 验证策略
   - 迁移策略
   - 关键风险
   - 最小实验
   - 是否建议继续当前方向

最终目标是帮助我们把 `cmap` 完成成一个真正可用的 AI coding 项目地图 CLI，而不是又一个需要人工长期维护的文档系统。

---

## 1. 项目的第一性目标

`cmap` 想解决的不是“再写一套文档”，而是 AI coding 里最核心的连续性问题：

```text
AI 能写代码，但每次新会话、上下文压缩、项目变大、模块漂移后，
它都会重新阅读、重新猜测、重新建立项目模型。
```

`cmap` 的目标是把项目的长期事实、模块地图、当前主线、验证方式、外部候选输入和可视化阅读层沉淀到 repo-local 的公共记忆中，让人和 AI 都能读。

核心目标：

1. 减少 AI 每次任务前盲扫全仓。
2. 降低新会话接续成本。
3. 让项目模块边界、职责、路径和关系可被 AI 稳定读取。
4. 让 AI 能维护地图，但不能任意污染长期事实。
5. 让用户在 Obsidian 或 HTML 视图中看懂项目结构。
6. 让 `route / brief / checkpoint / finish / update / verify` 形成闭环。

---

## 2. 当前产品定位

当前定位：

```text
cmap = repo-local project memory map + deterministic maintenance CLI
```

它不是：

```text
AI coding 全家桶
完整 agent workflow OS
RAG server
代码索引器
Claude-only / Codex-only plugin
自动架构师
自动文档生成器
```

当前边界：

```text
AI 负责语义判断和项目理解。
CLI 负责确定性动作：骨架、扫描、路由、校验、搬运、备份、审计、候选落盘。
```

这个边界是我们目前反复修正后的核心设计。请重点审查：

- 这个边界是否合理？
- 会不会导致人工维护负担仍然过重？
- 是否应该进一步让 AI 自动维护？
- 如果让 AI 自动维护，哪些更新可以自动 apply，哪些必须进入 candidate inbox？

---

## 3. 当前架构

### 3.1 Canonical source

```text
.context/
  MAP.md
  STATUS.md
  CHECKPOINT.md
  DECISIONS.md
  VERIFY.md
  modules/*.md
  inbox/
  out/
  audit/
  backups/
  logs/
  ideas/
```

可信事实层：

```text
.context/MAP.md
.context/STATUS.md
.context/CHECKPOINT.md
.context/DECISIONS.md
.context/VERIFY.md
.context/modules/*.md
```

非可信 / 候选 / 过程层：

```text
.context/inbox/
.context/out/
.context/audit/
.context/backups/
.context/logs/
.context/ideas/
```

### 3.2 Obsidian view

```text
_cmap/CMAP_coding/
  00_INDEX.md
  MAP.md
  STATUS.md
  VERIFY.md
  DECISIONS.md
  modules/*.md
```

`_cmap` 是 `.context` 的 Obsidian-friendly 镜像，不是事实源。它通过 `cmap obsidian export` 生成，方便阅读、关系图谱、人工浏览。

### 3.3 当前模块

当前 `.context/modules` 共有 19 个模块文档：

| Module | 当前作用 |
|---|---|
| `cli` | command registration, option parsing, exit-code boundary |
| `context` | `.context` templates and deterministic project signal scanning |
| `verify` | deterministic L0 structure checks and report formatting |
| `host` | AGENTS/CLAUDE short entrypoint generation |
| `route` | keyword and alias based module routing |
| `brief` | AI coding startup brief from route/checkpoint/module docs |
| `benchmark` | route benchmark over JSONL task fixtures |
| `handoff` | current status printing and explicit checkpoint handoff updates |
| `cp` | safe line-block copy/move/delete/restore with backups |
| `finish` | QA-lite context closeout report |
| `update-agent` | MapPatch intake, routine apply policy, backup/audit, inbox routing |
| `obsidian-adapter` | Obsidian-friendly markdown export and module note links |
| `reconcile-adapter` | dry-run candidate facts from external workflow artifacts |
| `showcase` | interactive product overview and external-review handoff artifact |
| `memory-lite` | explicit work log and idea append commands |
| `adoption` | existing-project adoption workspace and candidate scanning |
| `module-docs` | candidate module document creation |
| `hooks-doctor` | hook templates, hook reminder output, diagnostics |
| `tests` | integration and built-CLI smoke coverage |

---

## 4. 当前已经实现的能力

### 4.1 初始化与入口

- `cmap init --auto`
- `cmap adopt`
- `cmap install --host claude|codex|both`
- `AGENTS.md / CLAUDE.md` 短入口

当前思路：

- init 只创建 skeleton，不推断项目语义。
- adopt 只创建候选接管信号，不直接升格为可信项目事实。
- AGENTS/CLAUDE 只负责提示 AI 读 `.context`，不复制完整 PRD。

### 4.2 路由与开工包

- `cmap route "<task>"`
- `cmap brief "<task>" --out .context/out/brief.md`
- route benchmark：`cmap benchmark route --file bench/tasks.jsonl`

当前思路：

- route 根据已有 module aliases、paths、module name 做低成本定位。
- brief 把 route result、checkpoint/status、module docs、verify reminder 打包成 AI coding brief。
- route 不是语义搜索，也不是代码修改方案；它只告诉 AI 先读什么。

### 4.3 续接与状态

- `cmap status`
- `cmap checkpoint read`
- `cmap checkpoint write --task ... --next ...`
- `cmap checkpoint close|clear`

当前思路：

- `CHECKPOINT.md` 是当前工作续接状态。
- `STATUS.md` 是更持久的项目主线。
- CLI 不自动从对话 transcript 总结语义。

### 4.4 收尾与自动维护入口

- `cmap finish`
- `cmap finish --agent --task ... --verified ...`
- `cmap update --agent --from <file>`
- `cmap update --agent --from <file> --apply-routine`
- `cmap update --agent --from <file> --write-inbox`
- `cmap update rollback <backupId>`

这是最新实现的 P0 AI-maintained map workflow。

当前设计：

```text
finish --agent
  -> 生成 .context/out/update-request-*.md
  -> AI 填 MapPatch JSON
  -> update --agent dry-run 分类
  -> apply-routine 只写低风险 CHECKPOINT.md
  -> 高风险语义变更进 .context/inbox
  -> 产生 backup / audit
  -> 可 rollback
```

P0 允许自动 apply：

```text
checkpoint.write
  - low risk
  - confidence >= 0.75
  - fields.task 存在
  - fields.next 存在
  - file evidence 不缺失
```

P0 不允许自动 apply：

```text
MAP.md semantic changes
DECISIONS.md
VERIFY.md
modules/*.md responsibilities / relationships / constraints
new module / rename module / delete module
code files
arbitrary shell commands
deletion
```

请审查：

- 这个 policy 是否太保守？
- 是否足以解决“人不维护地图，地图就漂移”的问题？
- P1 应该允许哪些低风险自动写入？

### 4.5 验证与漂移检查

- `cmap verify`
- `cmap verify --coverage --changed-files ...`
- module relation checks
- required file/headings checks
- pending threshold
- verify command checks

当前验证命令：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm dev verify
pnpm smoke
git diff --check
```

最近验证状态：

```text
pnpm test: pass
pnpm typecheck: pass
pnpm build: pass
pnpm dev verify: pass
pnpm smoke: pass
git diff --check: pass
```

### 4.6 Obsidian 视图

- `cmap obsidian export --out _cmap/CMAP_coding`
- `cmap obsidian open <module>`
- `cmap obsidian pull --from _cmap/CMAP_coding`

当前边界：

```text
.context = canonical source
_cmap    = Obsidian view layer
pull     = dry-run candidate, not direct canonical write
```

### 4.7 外部 workflow candidate adapter

- `cmap reconcile --adapter gsd-v1 --from .planning`
- `cmap reconcile --adapter gsd-v2 --from .gsd`

当前边界：

```text
GSD / gstack / superpowers / external workflow output
  -> candidate input
  -> dry-run report / .context/inbox
  -> 不直接改 canonical facts
```

### 4.8 本地展示

- `docs/cmap-product-overview.html`

这是一个交互式产品介绍页，用于向外部模型或人解释 cmap 的模块、工作流、dogfood 可行性、Obsidian view、验证证据。

---

## 5. 当前缺口与我们自己的怀疑

### 5.1 最大问题：是否仍然需要人工维护？

我们最担心的问题：

```text
如果每次地图更新都要人确认，用户一忙就不会确认。
如果用户不确认，地图不会更新。
地图不更新，AI 下次读到的就是旧事实。
```

目前 P0 用 MapPatch 解决了一部分：

- AI 可以生成结构化更新。
- CLI 可以自动写 low-risk checkpoint。
- 高风险进入 inbox，不会丢失。

但还没彻底解决：

- inbox 是否会堆积？
- 模块事实是否仍然需要人手动 promote？
- AI 是否可以在未来自动 append `Recent Evidence`？
- `finish`/`verify` 是否应该强提醒 pending inbox？
- hooks 是否应该自动运行 `finish --agent` 或 `update --agent --dry-run`？

### 5.2 hooks 仍然不足

当前 `hooks-doctor` 主要是：

- hook templates
- reminders
- diagnostics

但尚未形成成熟 hooks workflow：

- SessionStart 是否自动输出 route/brief？
- Stop hook 是否自动生成 MapPatch request？
- PostToolUse 是否记录 read/changed files？
- PreToolUse 是否拦截危险 `.context` 写入？
- hooks 是否能与 Codex/Claude Code/Cursor/OpenCode 等宿主兼容？
- hooks 默认应该提醒，还是允许项目配置自动维护？

请重点调研 hooks 设计。

### 5.3 route 还偏轻

当前 route 是 aliases/keyword/path based，不是语义索引。

优点：

- 可解释
- 快
- 不需要模型 API
- 不会 hallucinate

缺点：

- 对同义词/隐含任务理解弱
- 对大项目模块聚类能力有限
- 需要 module aliases 维护
- 不能理解 call graph / import graph / test ownership

请判断是否应该加入：

- import graph
- package exports graph
- test ownership map
- path heat / access_count
- changed-file clustering
- lightweight embedding 可选模式
- LSP / Tree-sitter / AST integration

### 5.4 verify 还不够产品化

当前 verify 可以检查结构，但还不能：

- 自动提出修复 patch
- 追踪长期漂移趋势
- 用 CI 评论报告
- 阻止 stale map 被继续使用
- 统计 AI brief 对 coding 成功率的影响

### 5.5 Obsidian 只是 view，不是成熟图谱分析

当前 `_cmap` 可在 Obsidian 中阅读模块和关系，但 typed graph analysis 仍由 `cmap` CLI 负责。

未完成：

- typed relation view
- graph explain
- edge confidence/source
- module centrality
- orphan module review
- code path coverage visualization

### 5.6 外部开源项目借鉴还不够

我们已经参考过：

- GSD / GSD-2
- gstack
- superpowers
- everything-claude-code
- web-design

但还没有系统调研更广的公开项目，例如：

- aider repo map
- OpenHands
- Continue
- repo-agent
- Repomix
- Claude Code hooks ecosystem
- Serena / MCP memory tools
- sourcegraph/cody 类 code context
- 其他 agent memory / repo map / context packing 项目

请你主动搜索并比较。

---

## 6. 当前命令面

```bash
cmap version
cmap init --auto
cmap adopt
cmap install --host claude|codex|both
cmap install --host both --hooks reminder
cmap route "<task>"
cmap brief "<task>" --out .context/out/brief.md
cmap status
cmap checkpoint read
cmap checkpoint write --task "..." --next "..."
cmap checkpoint close
cmap checkpoint clear
cmap verify
cmap verify --coverage --changed
cmap finish
cmap finish --changed "src/..."
cmap finish --agent --task "..." --verified "..."
cmap update --agent --from <json-or-md>
cmap update --agent --from <json-or-md> --apply-routine
cmap update --agent --from <json-or-md> --write-inbox
cmap update rollback <backupId>
cmap obsidian export --out _cmap/CMAP_coding
cmap obsidian open <module>
cmap obsidian pull --from _cmap/CMAP_coding
cmap benchmark route --file bench/tasks.jsonl
cmap reconcile --adapter gsd-v1 --from .planning
cmap reconcile --adapter gsd-v2 --from .gsd
cmap add-module <name>
cmap cp copy|move|delete|restore
cmap log add "..."
cmap idea add "..."
cmap doctor
```

---

## 7. 当前实现文件

关键代码：

```text
src/cli.ts
src/commands/init.ts
src/commands/route.ts
src/commands/brief.ts
src/commands/checkpoint.ts
src/commands/finish.ts
src/commands/update.ts
src/core/map-patch.ts
src/core/module-index.ts
src/commands/verify.ts
src/commands/obsidian.ts
src/commands/reconcile.ts
src/commands/benchmark.ts
src/commands/hooks.ts
src/commands/doctor.ts
src/fs/backup.ts
src/fs/safe-path.ts
```

关键测试：

```text
tests/integration/m1.test.ts
tests/integration/m2.test.ts
tests/integration/m3.test.ts
tests/integration/m4m5.test.ts
tests/integration/m6-brief-obsidian.test.ts
tests/integration/m7-update-agent.test.ts
tests/integration/verify-l0.test.ts
tests/integration/cli-errors.test.ts
```

---

## 8. 当前设计里的核心矛盾

### 矛盾 A：AI 自主维护 vs canonical facts 安全

如果允许 AI 直接写 `.context/modules/*.md` 和 `MAP.md`：

- 优点：维护成本低，地图能持续演化。
- 风险：错误语义被固化，后续 AI 被错误地图误导。

如果不允许 AI 自动写：

- 优点：canonical facts 更可信。
- 风险：地图更新需要人工确认，容易漂移。

当前 P0 折中：

```text
routine state 自动写
semantic facts 进 inbox
```

请判断这个折中是否足够，以及 P1/P2 应怎样推进。

### 矛盾 B：简单 CLI vs 市面开源能力

我们希望 `cmap` 最终达到大部分公开开源项目中相关能力的综合水准，但又不想把它做成 AI coding 全家桶。

需要判断：

- `cmap` 应该继续小而强吗？
- 还是应该扩成完整 AI coding workflow？
- 哪些能力必须内建？
- 哪些能力只做 adapter？

### 矛盾 C：减少阅读 vs 增加维护文档

`cmap` 的目标是减少 AI 阅读理解成本，但如果需要大量维护 `.context`，它可能变成新的负担。

请评估：

- 当前设计是否真的减少了总成本？
- 对一个每周 20 次 AI coding 交互的项目，维护成本大概是多少？
- 需要哪些自动化才能把维护成本压到可接受范围？

---

## 9. 请重点回答的问题

请严格回答以下问题，每个问题要有结论、理由和落地建议。

### Q1. 目标是否已经达成？

从第一性角度判断：

```text
cmap 是否已经能够让 AI 在真实项目中少读、少猜、少重复理解？
```

请给出：

- 已达成的部分
- 未达成的部分
- 达成度评分：0-100
- 最大阻碍

### Q2. 当前产品是否容易维护？

请评估：

- `.context` 文件是否会过多？
- module docs 是否容易漂移？
- inbox 是否会成为垃圾堆？
- `_cmap` 镜像是否增加复杂度？
- MapPatch 是否增加了理解成本？

### Q3. hooks 应该怎么做？

请给出 hooks 方案，区分：

- SessionStart
- PreToolUse
- PostToolUse
- Stop / Finish
- Git commit hook
- CI hook

并说明哪些 hooks：

- 只提醒
- 只生成 dry-run
- 可以写 `.context/out`
- 可以写 `.context/inbox`
- 可以写 canonical `.context`

### Q4. AI 自主维护地图应该如何继续推进？

请提出 P1/P2 的自动写入政策。

例如是否允许：

- 自动 append `Recent Evidence` 到 module doc
- 自动更新 access_count / heat
- 自动记录 changed_files -> modules
- 自动补 alias candidates
- 自动记录 verification evidence
- 自动关闭 checkpoint
- 自动 promote inbox

### Q5. 是否应该引入语义搜索或代码图？

当前 route 很轻。请判断是否需要：

- AST / Tree-sitter
- import graph
- test graph
- package graph
- embeddings
- LSP
- repo map algorithm

如果要引入，给出最小实现。

### Q6. 开源项目有哪些值得借鉴？

请主动联网调研，并输出表格：

| Project | Relevant capability | What to borrow | What not to borrow | Integration path |
|---|---|---|---|---|

请特别关注：

- repo map / context packing
- hooks
- session handoff
- verification loop
- spec-driven workflows
- agent memory

### Q7. 现在是否应该拉取新的开源项目到本地研究？

请列出：

- 值得拉取的 repo
- 为什么值得
- 预计能借鉴哪些文件/模块
- 是否适合 copy 思路到 `cmap`
- 是否会偏离 `cmap` 核心定位

### Q8. 给出最终 roadmap

请输出：

```text
v0.1 当前状态
v0.2 必须补齐
v0.3 hooks + autonomous maintenance
v0.4 graph / route accuracy / CI
v0.5 mature product
```

每个版本请写：

- 目标
- 命令
- 文件结构
- 需要改哪些模块
- 测试
- 验收标准
- 风险

---

## 10. 希望你最终输出的结构

请输出一份中文报告，结构如下：

1. 执行摘要
2. 当前达成度评分
3. 第一性目标复盘
4. 当前架构审查
5. 功能缺口清单
6. 开源项目调研与借鉴表
7. hooks 设计方案
8. AI 自主维护策略
9. route / graph / context packing 方案
10. 风险与反模式
11. 详细 roadmap
12. 立即可执行的下一步
13. 是否建议继续当前方向

请务必保持“能落地”，不要只做产品愿景。

