# cmap 可行性定论(coordinator 综合,2026-06-12)

> 基于 01-competitors.md / 02-evidence.md / 03-drift-detection.md,三份报告核心引用均已抽查验真
> (ETH Zurich arXiv:2602.11988、SMU arXiv:2601.20404、Fiberplane Drift、mutable.ai 停运事实)。
> 一处事实错误已校正:mutable.ai 已于 2024-12 被 Google 收购停运。

## 一、实现逻辑是否有价值 → 有,但价值形态要修正

1. **定位空白是真的**:16 个竞品里没有同时做"产品语义模块卡片 + route + checkpoint + review 渲染"的。
   最近邻 Cline Memory Bank 无模块粒度无路由;DeepWiki 是全量自动 wiki 且无 drift detection。
2. **收益主形态是"效率"不是"成功率"**:实证显示 AGENTS.md 类文件让 agent 执行时间 -28.6%、
   token -16.6%,但成功率最多 +4%(人工书写),LLM 自动生成的反而 -0.5%~-3% 且 +20% 成本。
   → cmap 的卖点应是"让 agent 少走弯路、上下文更省",不要承诺"做得更对"。
3. **致命红线**:LLM 批量自动生成文档已被实证证伪;过期文档比无文档更危险(agent 绝对信任文档)。
   → cmap 必须是"AI 起草 + 收敛精炼 + 漂移探测",绝不做 auto-wiki(mutable.ai 之死是反面教材)。

## 二、目标能否达成 → 能,有三个前置条件

1. **内容纪律**:只写代码推断不出来的东西(产品意图/价值/边界/验证方式),非冗余。
   冗余内容是 ETH 实验里成功率下降的直接原因。
2. **漂移探测落地**:技术可行性高。Phase 1(git log + frontmatter `last_verified_commit`,2-3 天)
   → Phase 2(import/export 快照 diff,复用 CodeGraph,1-2 周)。
   先例:arXiv:2602.20478 生产环境验证 session-start 注入告警是 spec staleness 的最有效解法;
   Fiberplane Drift 验证了符号级 AST 指纹可把误报压到可接受。
3. **触发点 AI-first**:session-start / cmap brief 时注入"卡片可能过期"提示,PR CI 做第二道防线;
   pre-commit 对 AI 工作流无效。cmap 的消费者是 AI 会话,天然绕开了 doc-sync 产品
   最大的历史死因——人类维护动机问题。

## 三、模块卡片粒度 → 按产品能力边界,不按文件边界

- 无受控实验,但唯一深度案例(Codified Context,108k 行,74 sessions save-bug 为零)按
  "访问频率 + 知识复用边界"分层;社区实践绝大多数仓库只维护 1-2 个 context file。
- 推论:几个文件只是维护性拆分、对外是一个产品能力时,只写一张主控卡片。
- **吃自己的狗粮**:cmap 自身 24 个模块明显过碎(route/brief/pack/graph 是一个"任务上下文供给"
  能力;evidence/inbox/freshness/update-agent 是一个"候选治理"能力)。应作为粒度原则的第一个试验场。

## 四、Roadmap 修订建议

1. `cmap drift check`(Phase 1,git log 版)— 最高优先级,这是产品的差异化核心。
2. 模块卡片产品化改写 + 按能力边界合并 cmap 自身模块地图(24 → ~8-10)。
3. Phase 2 结构快照 diff(接 CodeGraph import/export 事实)。
4. Review HTML 三联对照(代码 diff + 卡片 diff + 结构变化),服务 PM 抽查。
5. 明确不做:auto-wiki 全量生成、行级文档绑定、人审强制关卡。
