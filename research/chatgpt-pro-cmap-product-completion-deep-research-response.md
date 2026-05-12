# ChatGPT Pro Deep Research Response: cmap 产品完成度文审

Source conversation: https://chatgpt.com/c/6a02e5e1-88d8-83ea-a8d1-8bfcecb06f6d
Captured at: 2026-05-12T09:09:37.405Z
Capture method: Computer Use page selection copy (Chrome Cmd+A/Cmd+C)
Raw page copy: research/chatgpt-pro-cmap-product-completion-deep-research-response.computeruse-page-copy.txt
Note: ChatGPT 页面显示 Thought for 10m 59s 和网络来源 124；回复正文自述没有创建后台 Deep Research 任务，而是按“深度研究”标准即时联网完成。

---

根据 2026-05-12 的《cmap Pro 深度文审交接报告》与联网调研结果，我先说明一个限制：当前可用连接器里没有暴露可调用的 Deep Research 启动接口，所以我没有创建后台研究任务；下面这份是按“深度研究”标准即时完成的联网长报告。附件中对 cmap 的第一性目标、当前架构、P0 MapPatch 工作流、route/hook/verify 缺口和最终输出结构都有明确要求，本报告以这些内容为基线展开。

 

 


1. 执行摘要
结论：cmap 方向值得继续，但当前尚未达到目标态。综合达成度：66/100。

cmap 已经解决了 AI coding 连续性问题里最关键的一半：把长期事实、模块地图、状态、checkpoint、验证方式和候选输入放进 repo-local .context，并用 deterministic CLI 管住初始化、路由、brief、verify、finish、update、audit、backup、rollback。这个边界非常正确：AI 负责语义判断，CLI 负责确定性维护动作。附件中也明确把 cmap 定位为 “repo-local project memory map + deterministic maintenance CLI”，而不是完整 agent OS、RAG server、代码索引器或 Claude-only 插件。


但 cmap 还没有完全做到“让 AI coding 少读、少猜、少重复理解、可持续维护项目地图”。最大阻碍不是 .context 文件结构，而是三个自动化缺口：hooks 尚未把使用过程中的读文件、改文件、验证、收尾转化为持续证据；route 仍停留在 keyword/alias/path 级别，无法稳定理解 import graph/test ownership/code ownership；MapPatch P0 只允许 low-risk checkpoint 写入，不能有效防止 module facts 漂移。附件中也已经指出：hooks 仍不足、route 还偏轻、verify 还不够产品化、Obsidian 还不是成熟 typed graph view。


外部开源项目给出的方向很一致：GSD/GSD-2 强在 spec-driven phase runner、fresh context、verification loop；aider repo map 强在用 Tree-sitter 提取符号级 repo map；Repomix 强在 context packing、token counting、Tree-sitter compression 与 secret scanning；Serena 强在 LSP/符号级 retrieval/editing 和 memory；Claude Code hooks / everything-claude-code / gstack / superpowers 强在生命周期自动化、技能/规则/工作流纪律；Sourcegraph Cody / Continue 强在 codebase-aware retrieval 与 context governance。cmap 不应该变成这些工具的总和，而应该吸收它们的上下文选择、证据维护、hook 生命周期、验证闭环，继续保持“小而强”的项目地图 CLI。

最重要的落地判断：P1 不应该直接允许 AI 自动改 MAP.md / DECISIONS.md / module responsibilities；但应该允许 AI/CLI 自动写入 append-only、bounded、evidence-backed 的 generated sections。 例如：Recent Evidence、Access/Change Heat、Verification Evidence、changed_files -> modules、route stats、alias candidates、test ownership candidates。这能把维护成本从“人每次确认语义事实”降到“人定期处理少量高价值 inbox”。✨

2. 当前达成度评分
维度	评分	结论
少读	72/100	route + brief + module docs + checkpoint 已能减少盲扫，但 route 仍缺 graph/symbol/test ownership。
少猜	64/100	canonical facts 层设计对，但 module facts 漂移后仍会让 AI 猜。
少重复理解	70/100	STATUS/CHECKPOINT/DECISIONS/VERIFY/modules 对新会话有明显帮助。
可持续维护	54/100	MapPatch P0 太保守，只自动写 checkpoint；semantic inbox 可能堆积。
可推广 CLI 产品	63/100	命令面丰富，但 hooks、graph、CI、context packing 未产品化。
安全可信	78/100	canonical vs inbox/out/audit/backups 的分层正确，且高风险写入被拒绝。
route 准确性	55/100	alias/path/keyword 可解释但召回不足。
verify 闭环	67/100	已有结构验证和命令验证，但缺 stale gate、CI report、修复建议和趋势。
综合	66/100	已经是可 dogfood 的 v0.1，但不是成熟目标态。
最大阻碍：地图更新未被自然工作流“顺手完成”。
现在的 P0 是安全的，但还不够省心。附件中的 P0 工作流已经允许 finish --agent -> MapPatch -> update --agent -> apply-routine/write-inbox -> backup/audit/rollback，但自动 apply 只覆盖 checkpoint.write，而 MAP、DECISIONS、VERIFY、modules semantic facts、新模块、重命名、删除、code files、shell commands 都被拒绝。这个策略适合 v0.1，但不足以长期阻止地图漂移。


3. 第一性目标复盘
cmap 的第一性目标不是“生成更多文档”，而是解决 AI coding 的连续性损耗：新会话、上下文压缩、项目变大、模块漂移后，AI 会重复阅读、重复猜测、重新建立项目模型。附件把目标拆成六点：减少盲扫、降低接续成本、稳定读取模块边界/职责/路径/关系、允许 AI 维护但不能污染长期事实、提供 Obsidian/HTML 阅读层、让 route / brief / checkpoint / finish / update / verify 成闭环。


从第一性原理看，AI coding 的上下文成本来自四类浪费：

定位成本：AI 不知道该先读哪些文件。

解释成本：AI 读到代码但不知道模块职责、边界和历史决策。

续接成本：AI 不知道上次做了什么、下一步是什么、什么已验证。

漂移成本：项目改了，但公共记忆没有改，后续 AI 读到旧地图。

cmap 当前已经覆盖了前 3 类的大部分：.context 作为 canonical source、modules/*.md 作为模块地图、CHECKPOINT.md 作为续接状态、VERIFY.md 作为验证入口、route/brief 作为开工包。附件里也说明，当前已有 19 个模块文档，覆盖 cli、context、verify、host、route、brief、benchmark、handoff、finish、update-agent、obsidian-adapter、reconcile-adapter 等。


但第 4 类“漂移成本”仍未真正解决。只要模块职责、路径归属、关系、验证方式、外部 adapter 状态发生变化，而 AI 或人没有把它们提升进可信层，地图就会老化。所以 cmap 的下一阶段核心不是增加更多手写文档，而是增加 evidence-backed generated facts。

4. 当前架构审查
4.1 .context canonical source：正确，应保留
当前架构把 .context/MAP.md、STATUS.md、CHECKPOINT.md、DECISIONS.md、VERIFY.md、modules/*.md 作为可信事实层，把 inbox/out/audit/backups/logs/ideas 作为非可信、候选、过程层。这个分层是 cmap 最重要的设计资产。


建议继续坚持：

canonical facts:
  .context/MAP.md
  .context/STATUS.md
  .context/CHECKPOINT.md
  .context/DECISIONS.md
  .context/VERIFY.md
  .context/modules/*.md

generated deterministic data:
  .context/index/*.json
  .context/graph/*.json
  .context/stats/*.json
  .context/logs/*.jsonl

candidate / non-trusted:
  .context/inbox/*
  .context/out/*
  .context/audit/*
  .context/backups/*
关键改进：不要把所有自动产物都写进 Markdown。
Markdown 适合人和 AI 读，JSON/JSONL 适合 CLI 做 graph、route、stats、staleness、coverage。P1 应新增 .context/index、.context/graph、.context/stats，让 module docs 只保留摘要和可读证据。

4.2 Obsidian _cmap：正确，但只能是 view
附件明确 _cmap 是 .context 的 Obsidian-friendly 镜像，不是事实源，pull 也只是 dry-run candidate，不直接写 canonical。这个边界正确。


建议：不要让 _cmap 承担 typed graph 分析。Obsidian 负责阅读和人工浏览，typed graph 应由 cmap graph build/explain 产生。否则 _cmap 会从 view layer 变成第二事实源，后续会造成同步噩梦。

4.3 MapPatch：方向对，但 P0 太保守
P0 的安全策略是合理的：只允许低风险 checkpoint 自动写入，高风险 semantic facts 进入 inbox，并提供 backup/audit/rollback。


但如果 P1 仍然只允许 checkpoint.write，维护成本会重新落回人身上。建议把写入分成四级：

L0 observe:
  只写 logs/out，不写 inbox/canonical

L1 routine:
  自动写 CHECKPOINT、verification evidence、route stats、heat stats

L2 bounded canonical:
  只写 canonical Markdown 中的 generated append-only section
  例如 Recent Evidence / Observed Paths / Verification History

L3 semantic canonical:
  responsibilities / decisions / constraints / relationships
  永远不自动写，必须 inbox + promote
4.4 当前命令面：丰富，但需要重新分层
当前命令面已经覆盖 init/adopt/install/route/brief/status/checkpoint/verify/finish/update/obsidian/benchmark/reconcile/add-module/cp/log/idea/doctor。


问题不是命令少，而是命令的产品分层不够清晰。建议未来文档和 CLI help 分成 5 组：

Start:
  init, adopt, install, doctor

Navigate:
  route, brief, graph, pack

Maintain:
  finish, update, checkpoint, inbox, evidence

Verify:
  verify, benchmark, ci

View/Adapters:
  obsidian, reconcile, export
5. 功能缺口清单
优先级	缺口	为什么重要	落地建议
P0.5	hooks 仍只是 reminder/doctor	工作流不自动触发，地图维护不会自然发生	新增 `cmap hooks install --mode observe
P0.5	inbox 无治理	高风险候选会堆积成垃圾堆	新增 cmap inbox status/triage/promote/archive
P1	无 session event journal	无法知道 AI 读了哪些、改了哪些、验证了哪些	写 .context/logs/session-events.jsonl
P1	无 route stats / heat	route 无法自我改进	写 .context/stats/route-usage.json、file-heat.json
P1	无 bounded generated sections	module facts 仍需人手动维护	在 module docs 中新增 ## Generated Evidence
P1	route 缺 graph	同义任务、隐含任务、大项目路径归属弱	cmap graph build + route --graph
P1	verify 缺 stale gate	旧地图仍可被继续使用	cmap verify --stale --changed
P2	context packing 缺预算控制	brief 可能过短或过长	cmap pack "<task>" --budget 12000
P2	test ownership map 缺失	AI 不知道该跑哪些测试	从 imports、naming、co-change 推断
P2	CI 报告缺失	团队推广难	cmap verify --ci --format markdown/json
P3	typed graph explain 缺失	Obsidian 只能看，不能解释边	`cmap graph explain <module
P3	route benchmark 指标不足	无法证明“少读、少猜”	增加 hit@k、token saved、time saved、false route
6. 开源项目调研与借鉴表
Project	Relevant capability	What to borrow	What not to borrow	Integration path
GSD / get-shit-done	spec-driven workflow、fresh subagent context、structured artifacts、verification loop；其 README 明确把 PROJECT.md/REQUIREMENTS.md/ROADMAP.md/STATE.md/CONTEXT.md 作为跨会话共享记忆，并强调 context rot 和 verification。	phase artifacts、atomic task、verification-first、context rot 防御	不要复制完整 phase runner；cmap 不应变成 agent workflow OS	cmap reconcile --adapter gsd-v1 保持外部候选输入；借鉴 artifact schema
GSD-2	DB-authoritative runtime state、auto mode、fresh context per task、token optimization、cost tracking、crash recovery。	DB/state authoritative 思想、dispatch context packing、token profile	不要引入完整 agent harness、worker leases、多 provider execution	P2 可学习 .gsd state 与 reports，但 cmap 只做 map substrate
gstack	role-based skills、persistent browser、GBrain memory、parallel sprint discipline；README 里强调 sprint process、GBrain persistent knowledge、MCP 注册。	role/skill discipline、retro/learn、browser QA 证据输入	不要内建 persistent browser，不要把 QA skill pack 塞进 cmap	做 reconcile --adapter gstack，接收 retro/QA/review 输出为 candidates
superpowers	TDD、systematic debugging、brainstorming、plan execution、code review discipline；Anthropic 插件页称其提供 TDD、系统调试、Socratic brainstorming、review checkpoints。	“workflow skill before action”的纪律，尤其 verification-before-completion	不要复制技能库；cmap 不应规定所有开发方法	作为 hooks/brief 的推荐外部 workflow；收尾时吸收 verification evidence
everything-claude-code	agents、commands、skills、rules、hooks、MCP configs；README 重点包括 memory persistence、continuous learning、verification loops、parallelization。	hooks 模板、memory persistence、continuous learning、规则模块化	不要引入大量 agent/rule pack，避免 token bloat	拉取 hooks 目录研究；cmap 生成更小、更安全的 hook set
aider repo map	自动生成 concise repo map：文件列表 + 关键 classes/functions/signatures；Tree-sitter 提取 definitions/references 并按重要性生成 map。	symbol outline、重要性排序、token-budget repo map	不要把 repo map 作为唯一事实源；它是 code-derived context，不是 project memory	P2 实现 cmap graph symbols / cmap pack --symbols
Repomix	把整个代码库打包为 AI-friendly XML/Markdown/JSON/plain；支持 token counting、Tree-sitter compression、gitignore、secret scanning。	context packing 格式、token budget、secret scanning、compression	不要默认把全仓塞进上下文，这会违背“少读”	P2 增加 cmap pack，只打包 routed graph neighborhood
Serena	MCP/LSP 语义检索与编辑，symbol-level navigation、references、diagnostics、memory system；其 README 强调 LSP、符号级 retrieval/editing、long-lived memory。	LSP-backed symbol graph、memory files、read-only mode、安全配置	不要把编辑工具内建到 cmap；cmap 不做 coding agent	P3 可做 Serena adapter，或让 cmap route 输出 Serena queries
Continue	codebase awareness 使用 indexing + embeddings/similarity search；旧 @Codebase 文档说明结合 embeddings 和 keyword search，embed model 用于索引与相似度搜索。	optional embeddings、hybrid search、IDE context awareness	不要默认依赖 embedding/API；会增加配置和成本	P3 加 cmap search --semantic optional adapter
Sourcegraph Cody	context 来源包括 keyword search、Sourcegraph Search、Code Graph；强调 context 对生成准确性的影响。	多源 context retrieval、context filters、code graph	不要做企业级全仓搜索平台	P3 借鉴 context source policy 和 include/exclude filters
OpenHands	软件 Agent SDK、CLI、resume conversation、agent/controller/state loop；README 显示 SDK、CLI、MIT core、resume。	state/controller/event loop 概念、resume UX	不要构建完整 agent runtime	只学习 state/event schema，cmap 保持 CLI substrate
RepoAgent	LLM-powered repository documentation generation，目标是帮助开发者快速理解 repo 和生成文档。	doc generation pipeline、file-level summaries	不要让 AI 自动重写 canonical docs	作为 adopt/module-docs candidate 的外部输入
Claude Code hooks	官方 hooks 支持 SessionStart、PreToolUse、PostToolUse、Stop、SessionEnd、MCP tool hooks、command/http/prompt/agent hooks；SessionStart 可注入上下文，PreToolUse 可阻断工具调用。	生命周期自动化、安全拦截、context injection	不要默认执行危险 shell，不要让 hook 直接改 semantic facts	P1 立刻实现 Claude hooks，Codex/OpenCode 用 adapter 降级
GitHub Copilot hooks	Copilot coding agent hooks 支持在 agent start/end、prompt/tool 前后执行 shell commands。	跨宿主 hook 抽象	不要只绑定 Claude Code	`cmap hooks render --host claude
7. hooks 设计方案
Claude Code 官方 hooks 已经覆盖 SessionStart、PreToolUse、PostToolUse、Stop、SessionEnd 等生命周期点，并支持 command/http/MCP/prompt/agent hook；其中 SessionStart stdout 可注入上下文，PreToolUse 可阻断工具调用。

cmap 的 hooks 设计应遵守一条总原则：

hooks 可以自动观察、记录、打包、生成候选、写 routine/generated evidence；
hooks 不可以直接修改 high-risk canonical semantic facts。
7.1 hook 权限矩阵
Hook	默认模式	可写位置	不可写位置	作用
SessionStart	assist	.context/out/session-brief.md	semantic canonical	输出 status/checkpoint/pending inbox/verify reminder
UserPromptSubmit	assist	.context/out/route-current.md	semantic canonical	根据用户 prompt 自动 route/brief 注入上下文
PreToolUse	strict guard	logs only	禁止直接写 MAP/DECISIONS/modules semantic sections	拦截危险 .context 直写、危险 shell
PostToolUse	observe	.context/logs/session-events.jsonl, .context/stats/*.json	semantic canonical	记录 Read/Edit/Write/Bash/verify evidence
Stop / Finish	assist/strict	.context/out/*, .context/inbox/*, routine canonical	high-risk semantic canonical	生成 MapPatch request，dry-run，routine apply
Git pre-commit	strict	audit/logs	无审计的 canonical edit	运行 verify/stale guard，阻止危险提交
Git post-commit	observe	stats/evidence	semantic canonical	记录 commit、changed modules、verification
CI hook	strict	CI artifacts, .context/out/ci-report.md	repo canonical	verify --ci、route benchmark、stale threshold
7.2 推荐命令面
cmap hooks install --host claude --mode observe
cmap hooks install --host claude --mode assist
cmap hooks install --host claude --mode strict

cmap hooks render --host claude --mode assist --out .claude/settings.json
cmap hooks doctor
cmap hooks test --event SessionStart
三种模式：

observe:
  只写 logs/stats，不注入 context，不阻断。

assist:
  注入 brief，生成 out/inbox，允许 routine apply。

strict:
  阻断危险 direct writes；Stop 时若有 changed files 但无 finish/update/verify，则提醒或阻断。
7.3 具体 hook 行为
SessionStart

cmap status --brief
cmap checkpoint read --format hook
cmap inbox status --threshold 5
cmap verify --stale --summary
输出给 AI：

Read this before coding:
- Current project status
- Active checkpoint
- Pending inbox count
- Stale map warnings
- Recommended next command: cmap brief "<task>"
UserPromptSubmit

新增这个 hook 很关键，因为 SessionStart 不一定知道用户本轮要做什么：

cmap brief "$USER_PROMPT" --out .context/out/session-brief.md --format hook
输出应包含：

route result
top modules
relevant canonical files
verify reminder
pending inbox warning
PreToolUse

拦截规则：

Block:
  Write/Edit .context/MAP.md
  Write/Edit .context/DECISIONS.md
  Write/Edit .context/VERIFY.md
  Write/Edit .context/modules/*.md outside generated sections
  Bash rm -rf .context
  Bash commands modifying .context without cmap update/cp

Allow:
  cmap update ...
  cmap checkpoint ...
  cmap evidence ...
  writes to .context/out
  writes to .context/logs
  writes to .context/inbox via cmap CLI
PostToolUse

记录事件，不做语义判断：

{
  "ts": "2026-05-12T...",
  "session_id": "...",
  "event": "PostToolUse",
  "tool": "Edit",
  "file": "src/commands/route.ts",
  "module_guess": ["route"],
  "source": "hook",
  "risk": "observe"
}
Stop / Finish

cmap finish --agent --changed-from-hook --verified-from-hook --out .context/out/update-request-*.md
cmap update --agent --from .context/out/update-request-*.md --apply-routine --write-inbox
严格模式下，如果有 changed files 但没有 verification evidence，可返回 hook feedback：

Changes detected but no verification evidence found.
Run: cmap finish --agent --verified "<commands>"
8. AI 自主维护策略
8.1 P1 自动写入政策
P1 应该允许以下自动写入：

操作	是否允许自动写	目标位置	条件
checkpoint.write	✅	CHECKPOINT.md	延续 P0，confidence >= 0.75，有 task/next/evidence
checkpoint.close	✅	CHECKPOINT.md	有 finish + verification evidence
verification.record	✅	VERIFY.md generated section 或 .context/stats/verify-history.jsonl	命令真实运行、有 exit code
evidence.append	✅	modules/*.md 的 Generated Recent Evidence	append-only、带文件/命令/commit、最多 N 条
access_count / heat	✅	.context/stats/file-heat.json	deterministic from hooks
changed_files -> modules	✅	.context/stats/module-activity.json	deterministic route/graph
route usage stats	✅	.context/stats/route-usage.json	deterministic
alias candidates	✅ candidate only	.context/inbox/alias-candidates/*.md	不自动进入 module aliases
test ownership candidates	✅ candidate only	.context/inbox/test-ownership/*.md	不自动进 canonical
new module candidate	✅ candidate only	.context/inbox/modules/*.md	不自动创建 canonical module
semantic responsibilities update	❌	inbox only	必须人工 promote
decisions update	❌	inbox only	必须人工 promote
delete/rename module	❌	inbox only	必须人工 promote
8.2 P2 自动写入政策
P2 可以更进一步，但仍不应自动改核心语义：

操作	P2 建议
自动 append Observed Paths	允许，必须来源于 graph/import/package/test ownership
自动 append Observed Tests	允许，必须来自测试文件命名、imports、实际运行命令
自动更新 module aliases	不直接写 canonical；如果同一 alias candidate 出现 ≥3 次且人工接受过相似 alias，可进入 “suggested aliases generated section”
自动 create module doc	可以创建 .context/inbox/modules/<name>.md；不能直接进入 .context/modules
自动 promote inbox	不建议完全自动；可做 “safe promote” 仅限 verification commands、path ownership generated section
自动更新 MAP.md	只允许 generated index/table，不允许改 project narrative
自动更新 DECISIONS.md	不允许；只能生成 decision candidate
8.3 数据模型建议
新增 MapPatch v2：

{
  "version": "2",
  "source": {
    "kind": "hook|finish|reconcile|manual",
    "session_id": "string",
    "commit": "optional"
  },
  "ops": [
    {
      "op": "evidence.append",
      "risk": "bounded",
      "target": ".context/modules/route.md#Generated Recent Evidence",
      "confidence": 0.86,
      "evidence": [
        {"file": "src/commands/route.ts", "kind": "changed"},
        {"command": "pnpm test", "result": "pass"}
      ],
      "fields": {
        "summary": "route command updated and verified",
        "changed_files": ["src/commands/route.ts"]
      }
    }
  ]
}
新增 policy：

auto_apply:
  checkpoint.write: true
  checkpoint.close: true
  verification.record: true
  evidence.append: true
  stats.update: true
  alias.promote: false
  module.semantic.update: false
  decision.append: false
9. route / graph / context packing 方案
9.1 是否引入语义搜索或代码图？
结论：要引入代码图，但不要一开始引入 embeddings。

aider 的 repo map 证明：对 AI coding 来说，符号级 repo map 非常有效，因为它把“整个 repo”压缩成关键文件、关键 class/function/signature，而不是让模型盲读。aider 文档明确说明其 repo map 包含全仓文件和关键符号定义，并用 Tree-sitter 提取 definitions/references。

Serena 证明了另一个方向：LSP-backed symbol retrieval 可以让 agent 在大代码库里按 symbol/reference/diagnostics 导航，而不是读整文件或 grep。

Repomix 则证明 context packing 需要格式、token count、ignore、安全扫描和 compression。

所以 cmap 的最小路线是：

v0.2: deterministic path/module graph
v0.3: hook-driven heat/activity graph
v0.4: import/test/package/symbol graph
v0.5: optional semantic adapter
9.2 最小 graph 实现
新增：

cmap graph build
cmap graph explain "<task>"
cmap route "<task>" --graph
cmap pack "<task>" --budget 12000 --format markdown
文件结构：

.context/graph/
  modules.json
  files.json
  edges.json
  tests.json
  imports.json
  package.json
  symbols.json      # v0.4 optional
  graph.meta.json

.context/stats/
  route-usage.json
  file-heat.json
  module-activity.json
  verify-history.jsonl
modules.json：

{
  "route": {
    "doc": ".context/modules/route.md",
    "paths": ["src/commands/route.ts", "src/core/module-index.ts"],
    "aliases": ["routing", "module routing", "task route"],
    "confidence": 0.91
  }
}
edges.json：

[
  {
    "from": "brief",
    "to": "route",
    "type": "uses",
    "source": "import_graph",
    "confidence": 0.88,
    "evidence": ["src/commands/brief.ts imports src/commands/route.ts"]
  }
]
9.3 route scoring
当前 route 是 aliases/keyword/path based。P1 后改为多信号加权：

score(module, task) =
  0.30 alias/name match
+ 0.20 path match
+ 0.15 graph neighbor relevance
+ 0.10 recent heat
+ 0.10 changed-files ownership
+ 0.10 test ownership
+ 0.05 semantic optional score
输出要可解释：

Top route: route
Why:
- alias match: "route"
- path match: src/commands/route.ts
- graph neighbor: brief -> route
- recent activity: route touched in last 3 sessions
Read first:
1. .context/modules/route.md
2. src/commands/route.ts
3. tests/integration/...route...
9.4 context packing
新增 cmap pack，定位介于 brief 和 Repomix 之间：

cmap pack "improve route accuracy" \
  --budget 12000 \
  --format markdown \
  --out .context/out/context-pack.md
预算分配：

10% project status/checkpoint
15% top module docs
20% relevant source snippets/symbol outlines
15% graph neighbors
10% related tests
10% decisions/constraints
10% verification commands
5% pending inbox warnings
5% instructions / anti-hallucination
不要默认全仓打包。Repomix 的完整 pack 适合外部 review，但 cmap 的目标是“少读”，所以应只 pack routed graph neighborhood。

10. 风险与反模式
风险/反模式	表现	规避
canonical pollution	AI 把错误职责/关系写进 MAP/modules，后续 AI 被误导	semantic facts 永远 inbox + promote
inbox landfill	候选事实越来越多没人看	inbox threshold、triage、auto archive stale candidates
generated spam	每次 hook 都往 module doc append 垃圾	generated section 限长、去重、合并、按 commit/session 汇总
_cmap 变事实源	Obsidian 改动和 .context 互相覆盖	_cmap 只能 export/pull candidate
route 过度语义化	embedding 错误召回但不可解释	graph first、embedding optional、输出 why
context overpacking	每次 brief 都塞太多，反而增加阅读	token budget + top-k + evidence reason
hooks 过度阻断	AI 开发被频繁打断	observe -> assist -> strict 渐进
shell hook 安全风险	hooks 执行危险命令	默认只 command whitelist，禁止 arbitrary shell
MCP/tool poisoning	外部 memory 或 MCP 输入污染 canonical	external adapter 只进 inbox
verify theater	只记录“pass”，不记录命令、环境、exit code	verification evidence 必须有 command、exit、timestamp、commit
metrics vanity	只统计 route hit，不衡量少读	增加 tokens saved、files read before edit、time-to-first-edit
11. 详细 roadmap
v0.1 当前状态
目标
形成 repo-local project memory map + deterministic CLI。当前已基本达成。

已有命令
init/adopt/install/route/brief/status/checkpoint/verify/finish/update/obsidian/benchmark/reconcile/add-module/cp/log/idea/doctor。


已有结构
.context canonical source、inbox/out/audit/backups/logs/ideas、_cmap view layer。


已有验证
pnpm test/typecheck/build/dev verify/smoke/git diff --check 最近均 pass。


风险
P0 只自动写 checkpoint，不能阻止 module facts 漂移。

验收
能 dogfood；能让新会话通过 brief 快速接上；能防止高风险自动污染 canonical。

v0.2 必须补齐：inbox 治理 + evidence/stats 基础层
目标
把“地图维护”从人工记忆变成 evidence-driven routine。

新增命令

cmap inbox status
cmap inbox triage
cmap inbox promote <id>
cmap inbox archive <id>
cmap evidence append --module <name> --file <path> --summary "..."
cmap verify --stale
cmap verify --changed --stale
新增文件结构

.context/index/
  modules.generated.json
  files.generated.json

.context/stats/
  route-usage.json
  file-heat.json
  module-activity.json
  verify-history.jsonl

.context/policy.yml
需要改的模块

update-agent
verify
route
brief
module-docs
hooks-doctor
tests
测试

- evidence append 去重
- generated section 限长
- inbox threshold
- stale verify fail/warn
- rollback generated writes
验收标准

- 连续 20 次 finish 后 inbox 不失控
- route stats 能记录 task -> selected modules
- verify 能提示 stale modules
- generated evidence 可 rollback
风险

- generated evidence 太吵
- 用户不理解 canonical vs generated
v0.3 hooks + autonomous maintenance
目标
让 hooks 自动记录读/改/验证/收尾，并触发 routine MapPatch。

新增命令

cmap hooks install --host claude --mode observe|assist|strict
cmap hooks render --host claude --mode assist
cmap hooks test --event SessionStart
cmap hooks doctor
cmap finish --from-hooks
cmap update --agent --apply-generated
新增结构

.context/hooks/
  claude.settings.generated.json
  scripts/
    session-start.sh
    user-prompt-submit.sh
    pre-tool-use.sh
    post-tool-use.sh
    stop.sh

.context/logs/
  session-events.jsonl
需要改的模块

hooks-doctor
finish
update-agent
verify
route
brief
测试

- PreToolUse blocks direct semantic canonical write
- PostToolUse records read/edit/write
- Stop generates update request
- strict mode blocks finish without verify evidence
- assist mode does not block normal coding
验收标准

- 一次真实 AI coding session 后，自动生成:
  - session-events.jsonl
  - update-request
  - routine checkpoint/verification evidence
  - semantic inbox candidates
- 不允许 hook 直接改 MAP/DECISIONS/module semantic sections
风险

- hooks 跨宿主兼容困难
- Claude hooks 可用，但 Codex/OpenCode/Cursor 行为不完全一致
v0.4 graph / route accuracy / CI
目标
route 从 alias/path 升级到 graph-aware，并把 verify 接入 CI。

新增命令

cmap graph build
cmap graph explain "<task>"
cmap graph explain-module <module>
cmap route "<task>" --graph
cmap pack "<task>" --budget 12000
cmap verify --ci --format markdown
cmap benchmark route --metrics hit@k,files-read,tokens
新增结构

.context/graph/
  modules.json
  files.json
  imports.json
  tests.json
  edges.json
  symbols.json
  graph.meta.json

.context/out/
  context-pack.md
  ci-report.md
需要改的模块

route
brief
benchmark
verify
context
module-index
测试

- import graph build for TS/JS
- test ownership from naming/imports
- graph explain deterministic
- pack respects token budget
- CI report stable snapshots
验收标准

- route benchmark hit@3 ≥ 85% on dogfood tasks
- brief 平均推荐读取文件数下降 ≥ 30%
- CI 能发现 stale map / pending inbox threshold
风险

- graph 复杂度膨胀
- language support 太早泛化
建议：v0.4 先只支持 TypeScript/JavaScript，其他语言走 path/module fallback。

v0.5 mature product
目标
成为可推广的 AI coding project map CLI，而不是项目内脚本。

新增命令

cmap doctor --product
cmap init --profile small|medium|large
cmap install --host claude|codex|opencode|copilot --hooks assist
cmap pack "<task>" --format xml|markdown|json
cmap adapters list
cmap adapters install gsd|repomix|serena
cmap report --html
新增结构

.context/config.yml
.context/adapters/
.context/reports/
docs/
  getting-started.md
  hooks.md
  safety-policy.md
  graph.md
需要改的模块

cli
doctor
host
hooks
graph
pack
verify
showcase
测试

- fixture repos: small TS CLI, web app, monorepo
- install/uninstall host hooks
- migration tests from v0.1 -> v0.5
- snapshot reports
验收标准

- 新项目 5 分钟内完成 init/install/first brief
- 老项目 adopt 后 1 小时内生成可用 candidate map
- 每周 20 次 AI coding 维护成本 < 15 分钟
- semantic inbox 可控，pending high-risk 不超过阈值
风险

- 产品野心膨胀成 AI coding OS
- adapter 太多导致核心模糊
12. 立即可执行的下一步
接下来 48 小时
加 .context/policy.yml

auto_apply:
  checkpoint.write: true
  checkpoint.close: true
  verification.record: true
  evidence.append: true
  stats.update: true
  semantic.update: false
  decision.append: false
实现 cmap inbox status

输出：

pending_count
high_risk_count
oldest_candidate_age
by_type: semantic/module/alias/verify/path
recommended_action
实现 generated evidence section

每个 module doc 增加：

## Generated Recent Evidence

> Managed by cmap. Do not edit manually.

- 2026-05-12: route touched by src/commands/route.ts; verified by pnpm test.
限制：

max 20 entries
dedupe by file + command + commit
old entries compact into summary
扩展 MapPatch op

新增：

evidence.append
verification.record
stats.update
checkpoint.close
alias.candidate
test_ownership.candidate
hooks observe mode

先只做 PostToolUse 日志，不阻断：

Read -> file access
Edit/Write -> changed file
Bash -> command + exit code
verify --stale

规则：

module doc older than last changed owned file -> warn
pending inbox high-risk > threshold -> warn/fail in strict
changed files not covered by modules -> warn
dogfood benchmark

新增 20 条任务 JSONL：

{"task":"improve route accuracy","expected_modules":["route","benchmark"]}
{"task":"make update agent safer","expected_modules":["update-agent","verify"]}
接下来 7 天
Day 1-2: inbox/status + policy.yml + MapPatch v2 ops
Day 3: generated evidence append + rollback tests
Day 4: hooks observe/assist for Claude
Day 5: verify --stale + CI report skeleton
Day 6: graph build v0: module paths + changed-file ownership
Day 7: route benchmark + report: before/after files-read and hit@k
13. 是否建议继续当前方向？
建议继续，而且应坚持当前核心定位：小而强的 repo-local project memory map CLI。

不要把 cmap 做成 GSD-2、OpenHands、Continue、Serena、Repomix 的合集。那些项目已经分别在 agent orchestration、IDE/LSP retrieval、full context packing、workflow skill、code assistant 上做得很深。cmap 的独特位置应该是：

cmap = 项目长期事实 + 模块地图 + 证据驱动维护 + 可解释 route/context packing + 安全 canonical policy
更直白地说：cmap 应该成为 AI coding 工具之间共享的项目地图底座。
GSD 可以把 phase artifacts 喂给 cmap；gstack/superpowers 可以把 review/QA/retro 证据喂给 cmap；Repomix 可以被 cmap 调用做 selected pack；Serena/Sourcegraph/Continue 可以作为 semantic/code context adapter；Claude/Copilot/OpenCode hooks 可以作为维护入口。但 cmap 自己不应该承担完整编码、浏览器 QA、模型调度、agent 多 worker、IDE 编辑器等职责。

最终判断：

当前目标未完全达成；
当前方向正确；
当前 P0 安全但维护不足；
下一阶段必须做 hooks + generated evidence + graph-aware route + stale verify；
只要 v0.2-v0.4 落地，cmap 有机会成为真正可用、可推广的 AI coding 项目地图 CLI。✅
