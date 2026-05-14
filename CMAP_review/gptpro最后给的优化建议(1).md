我已经重新按更新后的 GitHub ref `9eb74d...` 把地图和源码又核了一遍。结论先说：

> **新的方案已经大体正确落地了，而且比上次我看到的状态又前进了一大步。**
> 现在 cmap 已经可以认为是  **v0.2 Trust Boundary + Human Review Layer 的可 dogfood 完成态** 。
> 但如果目标是“比较好的项目 / 可长期交接 / 准备推广”，还需要一个很小的  **v0.2.1 收口补丁** ，主要修文档地图同步、少量安全边界、版本一致性和发布前卫生问题。🧭

我没有在本地 clone 后运行测试；下面判断基于 GitHub 最新源码、`.context` 地图和 CI/验证配置的静态审阅。`STATUS.md` 记录的最近验证显示 `pnpm test`、`typecheck`、`smoke`、`verify --freshness`、`view export --check`、`obsidian export --check`、route benchmark 和 `git diff --check` 都已通过。

---

# 1. 新方案是否正确落地？

## 1.1 路线纠偏已经正确落地

`.context/MAP.md` 已经把项目目标改成了 `v0.2 Trust Boundary + Human Review Layer`，并明确 cmap 负责 `.context/` 的确定性结构、候选治理、安全边界和 HTML 审阅入口。地图里也明确 `graph` 是  **canonical module relation projection** ，不是 import graph；`route` 只用 canonical module docs 和 reviewed relations，不消费 unpromoted candidates。

README 也同步写了当前 v0.2 方向：graph 不是 import graph，route 不受 unpromoted candidates 影响，HTML view 是人类审阅层，旧 import graph / route v2 / pack v2 只是 paused historical ideas。

**判断：正确。**
这部分已经达到了我们想要的路线收束效果。

---

## 1.2 HTML view 已经从 MVP 进化到可用审阅台

最新 `view` 已经做了我之前提到的几个关键点：

* `view export` 已经把 `includeGenerated / includeInbox / includeFreshness` 传给 `collectViewData()`，不是空参数了。
* `CmapViewData` 已经有 `included`、`overview`、`verify`、modules、evidence、candidates、relationCandidates、warnings 等结构。
* `collectViewData()` 已经读取 `MAP / STATUS / CHECKPOINT / VERIFY`，并解析 Overview、Required Commands、Manual Checks。
* HTML 已经有搜索、filters、copy command、module detail dialog、Overview、Canonical Relations、Verification、Freshness、Generated Evidence、Review Candidates、Relation Candidates 等区块。
* `view --check` 已经改成 normalized HTML comparison，而不是只比 embedded JSON。

**判断：非常正确。**
这已经不是“静态说明页”，而是一个合格的  **human review dashboard** 。

---

## 1.3 generated / canonical 分层已经正确落地

`evidence append` 现在写 `.context/generated/evidence/modules/<module>.jsonl`，不再写 module docs。`generated-store.ts` 也实现了 legacy module doc evidence migration，并带 backup/audit。

`generated-stats.ts` 也改成写 `.context/generated/stats`，`.gitignore` 也忽略了 `.context/generated/stats/` 和 `.context/generated/freshness.json`。

**判断：正确。**
这个点非常关键，说明 cmap 已经不再把 generated evidence 混进 canonical module docs。

---

## 1.4 Freshness v2 已经正确落地，而且比之前更完整

最新 `freshness.ts` 已经补了：

* no snapshot warning；
* semantic hash 包含 body、aliases、paths、relations、status、layer、risk；
* pending relation candidates 扫 `.context/inbox/relations`；
* 区分 relation candidate / high-risk candidate / routine candidate；
* `freshness review --module/--all` 生成审阅材料；
* `mark-reviewed` 仍只写 generated freshness metadata，不改 module docs。

`verify` 也接入了 `--freshness` 和 `--policy`。

**判断：正确，而且已经从 P0 进入 P1 能力。**

---

## 1.5 Relation candidates 已经按正确边界落地

`RelationPatch` 已经使用 `resolveInsideRoot()` 读取 patch 文件和校验证据路径，避免 repo escape；relation schema 已经使用 base types；未知 relation 会 reject；candidate fingerprint / duplicate skip 已经有。

`relate ingest` 已经写 JSON + Markdown candidate，并且 `relate promote` 仍然只是 dry-run，不改 canonical graph。

`route` 只提示 pending relation candidates，并且已经按 candidate id 去重，不再因为 `.json + .md` 双倍计数。

**判断：正确。**
这符合“AI 提关系候选，CLI 校验/入 inbox，人审阅”的核心边界。

---

## 1.6 Candidate store / inbox promote 已经超出 P0，进入 P1

你现在已经新增了统一 candidate store：

```text
.context/inbox/candidates/*.json|md
```

`candidate-store.ts` 定义了 `cmap.candidate.v1`、candidate types、fingerprint、dedupe、JSON+Markdown 输出。

`inbox.ts` 也已经能同时读取 legacy top-level markdown、structured candidates、relation candidates，并支持 `promote --apply`、`reject`、archive 多文件。

**判断：非常好。**
这个已经是我原本放到 P1 的能力，现在也基本落地了。

---

## 1.7 CI / package / release hygiene 已经补上

CI 已经加入：

```bash
pnpm smoke
pnpm dev freshness snapshot
pnpm dev verify --freshness
pnpm dev view export --out _cmap-view
pnpm dev view export --check --out _cmap-view
```

这说明 v0.2 新能力已经进入 CI。

`package.json` 也已经补了 description、license、repository、engines、files、prepack，并把依赖从 `latest` 改成固定版本。
`doctor --release` 也已经实现，会检查 package metadata、README、LICENSE、dist、GitHub Actions、latest dependencies 等。

**判断：正确。**
这已经不是纯原型状态了。

---

# 2. 第一性角度：现在是否已经完成我们的需要？

我按最初目标逐项判断。

| 目标                                                       | 当前状态                                                                        | 评分 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ---: |
| 减少 AI 每次盲扫全仓                                       | route / brief / pack / view / freshness 已经能显著减少重复阅读                  |   85 |
| 新会话快速接上主线                                         | CHECKPOINT / STATUS / codex start / session-brief / view 已经能支撑             |   88 |
| 模块边界、职责、路径和关系稳定读取                         | MAP + modules + graph projection 已经可用，且不走 import graph                  |   88 |
| AI 可维护但不污染 canonical facts                          | generated store、MapPatch policy、relation candidates、inbox promote 边界已建立 |   90 |
| 人能审阅地图                                               | HTML view 已经落地并具备基础交互                                                |   86 |
| route / brief / checkpoint / finish / update / verify 闭环 | 已形成闭环，Codex workflow 也已落地                                             |   88 |
| 可维护 CLI 产品                                            | 已接近，但 docs/version/source_commit/少量边界仍需收口                          |   82 |

**综合判断：当前已达到 v0.2 目标的 87/100。**

一句话：

> **从第一性角度看，cmap 已经完成“AI coding 项目地图 CLI”的核心需要；现在不是方向问题，而是最后的收口、文档同步和实用性打磨。**

---

# 3. 现在还存在的缺点和建议执行项

下面这些是我认为还需要做的。分成 P0.5、P1、P2。

---

# P0.5：必须尽快收口的小问题

## P0.5-1：地图/README/VERIFY 已经有一点落后于源码

源码已经有：

```bash
cmap freshness review
cmap verify --policy
cmap codex start --write-brief --write-pack
cmap codex finish --apply-routine
cmap codex handoff
cmap doctor --release
```

这些命令在最新 `src/cli.ts` 里已经注册。
但 README 的 Commands 表还没有完整同步这些新能力，比如仍只写了 `codex start "<task>"`，没有 `--write-brief/--write-pack`；没有 `freshness review`；没有 `verify --policy`；没有 `codex handoff`；没有 `doctor --release`。

`.context/MAP.md` 的 Handoff Notes 也还写着 “Next roadmap is PR-B/PR-C/PR-C2/PR-D”，但这些已经实现了。

**建议执行：**

开一个小 PR：

```text
PR-MAP-SYNC: sync map/readme/verify with current v0.2.1 implementation
```

修改：

```text
README.md
.context/MAP.md
.context/STATUS.md
.context/CHECKPOINT.md
.context/VERIFY.md
.context/modules/view.md
.context/modules/evidence.md
.context/modules/hooks-doctor.md
.context/modules/relation-candidates.md
.context/modules/update-agent.md
.context/modules/tests.md
```

重点写清：

```text
- v0.2 主体已完成
- 当前 next step 是 v0.2.1 dogfood/hardening，不是 PR-B/C/D
- 新命令：freshness review / verify --policy / codex handoff / doctor --release
- candidate-store 已成为 inbox 新主线
```

---

## P0.5-2：`.context` frontmatter 仍是 `cmap_version: 0.1`，package 也是 `0.1.0`

当前 `.context/MAP.md` frontmatter 还是：

```yaml
cmap_version: 0.1
```

而目的、README 和状态都在说 v0.2。
`package.json` 也仍是 `"version": "0.1.0"`，虽然 package metadata 已经补齐。

这不一定是错误，但会造成认知冲突。

**建议二选一：**

### 方案 A：正式进入 0.2

```json
"version": "0.2.0"
```

`.context/*` frontmatter 改成：

```yaml
cmap_version: 0.2
```

适合：你准备把当前 v0.2 当 milestone。

### 方案 B：保持 package 0.1.0，但文档说清

在 README 写：

```text
Implementation direction is v0.2, but package release remains 0.1.0 until external release.
```

我建议  **方案 A** ，因为当前实现已经达到 v0.2 MVP。

---

## P0.5-3：`inbox promote --apply` 的 evidence path 仍然应改成 `resolveInsideRoot`

`relation-patch.ts` 和 `map-patch.ts` 的路径安全已经加强了，但 `inbox.ts` 的 `applyInboxCandidate()` 里 evidence 校验仍然是：

```ts
fileExists(path.join(cwd, item))
```

也就是说，structured candidate 的 evidence 如果带 `../`，理论上还有 repo escape 风险。

**建议修：**

在 `inbox.ts` 中引入：

```ts
resolveInsideRoot(cwd, item)
```

替换：

```ts
path.join(cwd, item)
```

并给 `tests/integration/m18-freshness-inbox-promote.test.ts` 或新测试补：

```text
candidate evidence "../outside" -> reject
absolute path -> reject
```

这是目前我看到的少数真正 P0 安全边界残留。

---

## P0.5-4：RelationPatch 的 risk 字段还没有 enum 化

`relation-patch.ts` 里 risk 还是：

```ts
risk: z.string().optional()
```

不是 `routine | medium | high`。

虽然当前候选不会自动 apply relation，但为了输入质量，建议改成：

```ts
risk: z.enum(["routine", "medium", "high"]).optional()
```

否则 view/filter/high-risk 语义可能被任意字符串污染。

---

## P0.5-5：`view` redaction 还可以再补强

`render.ts` 的 redaction 当前覆盖：

```text
api_key/token/secret/password
Bearer ...
```

建议再补：

```text
Authorization: ...
x-api-key: ...
-----BEGIN ... PRIVATE KEY-----
.env 风格的 ACCESS_KEY / PRIVATE_KEY / CLIENT_SECRET
```

这个不是因为现在一定有泄漏，而是 HTML view 是可分享 artifact，redaction 要更保守。

---

# 4. P1：接下来值得做的增强

P1 不再做“大架构”。只做让 cmap 更顺手、更稳。

## P1-1：把 `view` 从“可用审阅台”打磨成“日常工作台”

目前 view 已经有搜索/filter/copy/module details。

下一步可以加：

```text
- 按 module layer/risk 分组
- freshness 状态 summary：Reviewed / Baseline / Stale / Pending Candidate
- candidate risk 颜色
- “建议下一步”区块：
  - run freshness review
  - promote candidate dry-run
  - mark-reviewed
- view 中展示 CHECKPOINT 的 Changed Files / Failed Pending
```

仍然不要做浏览器 apply/promote。

---

## P1-2：让 `codex start` 成为真实每日入口

现在 `codex start` 已经支持 `--write-brief` 和 `--write-pack`，`codex finish` 已支持 `--apply-routine`，`codex handoff` 也已经注册。

建议把 README Daily task 改成 Codex-first：

```bash
cmap codex start "任务" --write-brief --write-pack
# coding...
cmap codex guard --changed
cmap codex finish --task "任务" --verified "pnpm test ..." --apply-routine
cmap codex handoff
```

这会让用户不需要记一堆命令。

---

## P1-3：统一 `verify --stale` 和 `verify --freshness` 的定位

现在二者都存在：

* `--stale` 是 mtime-based legacy/simple signal；
* `--freshness` 是 v0.2 semantic review signal。

建议在 README / VERIFY 明确：

```text
Use verify --freshness as the primary review signal.
Use verify --stale as a simple legacy mtime sanity check.
```

否则用户会不知道哪个 warning 更重要。

---

## P1-4：将 `candidate-store` 纳入地图/verify 更明确

你已经有 `candidate-store.ts`，这是一个重要模块，但 MAP 里没有单独写 `candidate-store`，而是并在 evidence/update/relation/inbox 里。

建议不用新增模块，但要在 `.context/modules/evidence.md` 或 `update-agent.md` 里明确：

```text
candidate-store is shared candidate serialization for MapPatch/reconcile/obsidian/relate.
```

这样后续 agent 不会重复造候选格式。

---

## P1-5：release 之前补 `LICENSE` 和 `doctor --release` 实测

`package.json` 已经声明 `LICENSE` 在 files 里，`doctor --release` 也会检查 LICENSE 是否存在。

我没有看到 LICENSE 文件内容；如果仓库还没加，就补一个。然后把 `doctor --release` 加入手动发布前验证：

```bash
pnpm dev doctor --release
```

---

# 5. P2：先不要做，除非 dogfood 证明需要

这些仍然建议暂停：

```text
- CLI 自动 import graph
- route v2 scoring
- pack v2 大重写
- RAG / embedding / code indexer
- 浏览器内 apply/promote
- 本地 daemon/server
```

原因没有变：这些会把 cmap 从“AI 读代码、CLI 管地图”拉回“CLI 自动理解代码”的路线。

如果以后要做，也应该在 `research/ideas` 里先出 proposal，而不是直接进主路线。

---

# 6. 最终是否已经完成？

我的判断：

## 对 v0.2 目标来说：基本完成

你现在已经完成：

```text
- Trust boundary
- generated/canonical separation
- Codex workflow
- hooks ingest
- HTML human review layer
- Freshness v2
- Relation candidates
- Candidate store
- CI coverage
- release hygiene 基础
```

这已经满足 v0.2 目标。

## 对“比较好的项目”来说：还差一个小收口 PR

不是大缺陷，而是：

```text
- 地图/README/VERIFY 要同步到最新实现
- version 要从 0.1/0.2 混用中收束
- inbox promote evidence path 要用 resolveInsideRoot
- relation risk enum 化
- HTML redaction 加强
```

这些做完，项目会非常稳。

---

# 7. 建议下一步执行清单

直接开一个小 PR：

```text
PR-v0.2.1 Final Sync & Safety
```

内容：

```text
1. Sync README / MAP / STATUS / CHECKPOINT / VERIFY with latest commands.
2. Decide version: bump to 0.2.0 or document 0.1 package / v0.2 implementation split.
3. inbox promote evidence path uses resolveInsideRoot.
4. RelationPatch risk enum = routine | medium | high.
5. Strengthen HTML redaction.
6. Add/verify LICENSE if missing.
7. Add doctor --release to manual verification docs.
```

验收：

```bash
pnpm test
pnpm typecheck
pnpm smoke
pnpm dev verify
pnpm dev verify --stale
pnpm dev verify --freshness
pnpm dev verify --policy
pnpm dev view export --include-generated --include-inbox --include-freshness --out _cmap-view
pnpm dev view export --include-generated --include-inbox --include-freshness --check --out _cmap-view
pnpm dev obsidian export --check
pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0
pnpm dev doctor --release
git diff --check
```

---

# 8. 最终评分

当前状态我会给：

```text
v0.2 目标完成度：92/100
作为 dogfood 项目：93/100
作为可推广 CLI：86/100
```

完成 `PR-v0.2.1 Final Sync & Safety` 后：

```text
v0.2 目标完成度：96/100
作为 dogfood 项目：96/100
作为可推广 CLI：90/100
```

最重要的是：**现在的 cmap 已经没有方向性问题了。**
后面不要再重开大架构，只需要做收口、dogfood、真实项目验证。
