---
cmap_version: 0.1
context_type: module
project: CMAP_coding
source_commit: unknown
updated_at: 2026-06-12T00:00:00+08:00
confidence: ai-drafted
module: route
paths:
  - src/commands/route.ts
  - src/core/module-index.ts
aliases:
  - route
  - aliases
  - routing
  - 路由
  - 模块定位
relations:
  depends_on:
    - module-docs
    - evidence
  used_by:
    - brief
    - obsidian-adapter
    - relation-candidates
relation_explanations:
  depends_on:
    module-docs:
      why: "route reads module frontmatter, paths, aliases, relations, and verification sections as its deterministic source."
      produces: "Likely modules, related context modules, read-first files, and suggested verification commands."
      impact: "Changes to module doc schema, relation fields, or verification headings may require updates in src/core/module-index.ts and src/commands/route.ts."
    evidence:
      why: "route writes generated route usage stats and low-confidence alias requests into non-canonical support stores."
      produces: "Generated route usage telemetry and candidate-only module.alias.request files under .context/inbox/candidates/."
      impact: "Changes to candidate-store or generated stats contracts may require route output, inbox, and benchmark tests to change."
  used_by:
    brief:
      why: "brief relies on route selection to decide which project map context to include for a task."
      produces: "Task brief sections scoped to direct and related modules."
      impact: "Route scoring or context expansion changes can alter brief inputs and expected integration assertions."
    obsidian-adapter:
      why: "Obsidian export reuses route and module-index behavior to keep map navigation consistent with CLI routing."
      produces: "Reviewable graph/navigation hints that match routed module relationships."
      impact: "Changing route relation semantics may require Obsidian export and stale-check expectations to be refreshed."
    relation-candidates:
      why: "route surfaces pending relation candidates as review warnings without using them as canonical routing facts."
      produces: "Non-canonical candidate warnings in route output when relation proposals exist."
      impact: "Changing relation candidate storage or dedupe rules may require route warning and benchmark tests to change."
---
# Module: route

## Purpose
route 是整个项目地图的"入口问询台":你用自然语言说一句要干什么,它告诉你应该先读哪几个模块卡片、哪些文件,以及改完后建议跑哪些验证命令。它让 AI 在上下文有限的情况下不必扫读全仓库。

## Value
- 给 AI(下一个会话):任务 → 模块的定位能力,是 brief/pack 的入口,决定了"按需阅读"是否成立。
- 给人(产品经理):验证模块命名和 aliases 是否符合人的语言习惯——route 命不中,说明地图的"产品词汇"和使用者脱节。
- 给整个产品:route 命中率是 cmap 有没有用的核心指标,由 benchmark 模块度量。

## Connections
- 读取:所有模块卡片的 frontmatter(paths/aliases/relations)是它唯一的事实来源——卡片质量直接决定路由质量。
- 供给:brief(开工包)、obsidian-adapter(导航一致性)、relation-candidates(候选提醒)。
- 不做:不调用模型、不做语义猜测、不消费未 promote 的候选;相关上下文只是阅读建议,不是直接命中。

## Boundaries
- 确定性匹配:alias/模块名/路径关键词打分;英文 alias 要词边界,中文 alias 可子串匹配。
- `--max-context` 只裁剪上下文包,不改变直接命中排序。
- 低置信时建议 `--write-alias-candidate` 写候选,绝不发明不存在的模块。

## Tests / Verification
- `pnpm test tests/integration/m2.test.ts`
- `pnpm test tests/integration/m10-route-context-pack.test.ts`
- `pnpm test tests/integration/m11-context-size-controls.test.ts`
- `pnpm test tests/integration/m14-graph-route.test.ts`
- `pnpm test tests/integration/m20-relation-candidates.test.ts`
- `pnpm dev route "checkpoint 更新当前主线"`

## When to Update This Doc
当 route 的产品角色变化(它回答什么问题、为谁服务)或验证方式变化时更新;打分细节、输出格式微调不需要更新本卡片,看代码。
