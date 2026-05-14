# CMAP_coding 整合诊断（Claude 主线，三视角合并 + 核实）

**日期**: 2026-05-14
**输入**: notes/10-claude-arch.md / 11-claude-perf.md / 12-claude-config.md
**目的**: 给 GPT 双轨 review 的弹药；按 链路/架构/配置 三栏 + High/Med/Low 排序
**核实策略**: 所有 file:line 与数量级 claim 都经 rg / wc / 实测命令二次核对，**幻觉项已剔除**

---

## 0. 项目画像（一句话）

**CMAP** 是给 AI coding 工作流的"项目记忆图谱"CLI（v0.1.0）：维护 .context/ 目录（MAP/STATUS/CHECKPOINT/DECISIONS/VERIFY/modules/.../logs/.../ideas/.../graph/.../refs/...），提供 route/brief/pack/checkpoint/finish/verify/hooks/graph/benchmark/inbox/freshness/policy/relate/reconcile/codex/install/adopt/obsidian/view/evidence/cp 等 ~28 个命令。技术栈：Node ≥20、TS 6.0、commander 14、zod 4、gray-matter 4、tsup ESM、vitest 4，pnpm 10.32.1。

**亮点（先讲）**：
- CI 是产品级 dogfooding（.github/workflows/cmap.yml 11 步里 7 步跑自己 cmap 命令，route benchmark 硬阈值 80%）
- smoke 测试覆盖 13 个命令路径，断言齐全
- v0.2 路线 "Trust Boundary + Human Review Layer" 设计清晰（README + PRD）
- 错误处理已有 CmapCommandError 类型，绝大多数 throw 已规范（51/64 = 80% 已类型化）

---

## 1. 链路 / 性能（按 High → Low）

### L-HIGH-1: brief/pack 重复 loadModuleIndex（设计冗余）

**证据（已核实）**:
- `src/commands/brief.ts:17-18` Promise.all 同时调 routeTask + loadModuleIndex
- `src/commands/pack.ts:29-30` 同样模式
- `src/commands/route.ts:71` routeTask 内部 `await loadModuleIndex(cwd)`
- 结论：brief 加载 modules 2 次、pack 加载 2 次（顺序 IO 不重叠）

**建议**: routeTask 增加 `modules?: ContextModule[]` 可选参；callsite 预加载传入。
**预估**: 30–45min；brief/pack 链路 -25–30%。
**POC 验证**: 可控、可量化 → ✅ 入选 POC

### L-HIGH-2: ESM bundle 287KB + gray-matter 重复出现（启动开销）

**证据（已核实）**:
- `dist/cli.js` 294KB（重新 build 后实测）
- 包内 `matter[0-9]` 字符串 28 处（agent 说 7 处偏低，但"重复"本质正确）
- 冷启动实测 `time node dist/cli.js version` 中位 100ms
- tsup 配置 `--format esm --dts`，**无 `--external`**，所有依赖 bundle 进去

**建议**: tsup 加 `--external commander,gray-matter,zod` peer 化；尝试 `--minify` 看 size 改善。
**预估**: 30–60min；bundle -15–20%、冷启动 -15–20%（待 POC 复测）。
**POC 验证**: ✅ 入选

### L-HIGH-3: 测试 wall clock 61s + tsx fork-per-test 架构

**证据（已核实）**:
- vitest 134 tests wall 61s, accumulated CPU 414s（已并行）
- `tests/helpers.ts:19-25` 每个测试 `execFile(tsxBin, [cliPath, ...args])` 起独立 tsx 进程
- testTimeout 15000ms（vitest.config.ts:8）
- 24 个 .test.ts 全部在 tests/integration/ 下，零 unit test 拆分

**修正幻觉**: 架构 agent 称 "m22-freshness-policy.test.ts timeout"，主线复测 6/6 全过 8.16s。**m22 实际健康**，无 flaky。

**建议**: 长期分 unit 层（直接 import 命令函数）；短期 testTimeout → 30s 兜底。架构改造 ROI 高但工作量大（16–20h）。
**预估**: 短期 15min；长期 16–20h。
**POC 验证**: 短期 testTimeout 调整 ✅；长期 in-process API 太大，本次不做 POC。

### L-MED-1: module-index 顺序读取（缺并发）

**证据（已核实）** `src/core/module-index.ts:63-89`：
```typescript
for (const entry of entries.filter(...).sort()) {
  const raw = await readFile(absolutePath, "utf8");
  const parsed = matter(raw);
  modules.push({...});
}
```
纯串行，10+ 模块时 IO 累积。

**建议**: Promise.all 并发；可选 LRU 缓存。
**预估**: 30min；20 模块时加载 -50%。
**POC 验证**: ✅ 入选

### L-MED-2: view HTML 导出顺序读 evidence/inbox

**证据**: `src/view/collect.ts` collectEvidence/collectInboxCandidates 是 readdir + 逐文件 readFile + matter 解析。MAX_EVIDENCE=50 / MAX_CANDIDATES=100。
**建议**: 批量化或 JSON 拆分 + 客户端组装。
**预估**: 1.5h；当 evidence/inbox 满载时收益明显。
**POC 验证**: 待评估，可能 POC

### L-MED-3: .context IO 无进程级缓存

**证据**: pack.ts:29-35 Promise.all 中并行读 7 个 .context 文件；同进程多 sub-function 各自再读。
**建议**: src/core/context-loader.ts 统一入口 + 命令内缓存。
**预估**: 45min。
**POC 验证**: 不入选（依赖 L-HIGH-1 设计）

---

## 2. 架构 / 代码质量

### A-HIGH-1: zod 仅在输出层，CLI args / frontmatter / hook stdin 未校验

**证据（已核实）**:
- `src/view/schema.ts`、`src/core/map-patch.ts` 有完整 zod
- `src/hooks/events.ts:44-86` 用 firstString / asRecord 手工抽字段，无 schema
- `src/core/module-index.ts:69-87` matter() 解析后直接读 `parsed.data.paths/aliases/relations` 无校验
- CLI 选项如 `--format` `--mode` 类型为 string 直传到 command 内才校验

**建议**: 建 `src/schemas/` 统一目录（cli-options / frontmatter / hook-payload）；cli.ts 入口校验。
**预估**: 8–10h；不算紧急但是 v0.2 稳定性基建。
**POC 验证**: 太大，本次不做 POC（写一段 spec 进报告即可）

### A-HIGH-2: 错误处理类型化已 80%，残留 13 处 bare throw

**证据（已核实）**:
- bare `throw new Error`: **13 处**（fs/line-block.ts:31/37/74/81、core/relation-patch.ts:194/196 等）
- `throw new CmapCommandError`: **51 处**（已类型化）
- 类型化率 80%

**修正**: agent 把这条标 HIGH，但 80% 已对，剩 13 处都在 fs/core 边界，被 commands 层包裹捕获。**调整为 MED**，可顺手清理。
**建议**: 加 eslint 规则 no-bare-throw；扫一遍 13 处替换为 CmapCommandError 或 ValidationError 子类。
**预估**: 2–3h（含 eslint 配置）。
**POC 验证**: ✅ 入选

### A-MED-1: cli.ts 576 行手工注册（28 命令）

**证据（已核实）** wc -l = 576。
**建议**: agent 自己说 "不紧急 to refactor"，命令数 <40 时维持现状。建立 command registry 数组即可（不动行为）。
**预估**: defer，或 2h 改 registry。
**POC 验证**: 不入选

### A-MED-2: 170+ 处 ad-hoc path.join 无 path builder

**证据（已核实）**: rg `path\.(join|resolve)` count = **175 处**。
**建议**: 抽 `src/core/paths.ts` 集中 contextRoot/modulesDir/modulePath/inboxCandidatesDir 等命名函数。
**预估**: 4–6h。
**POC 验证**: ✅ 入选（纯重构，零行为变更，演示性强）

### A-MED-3: CLAUDE.md == AGENTS.md byte-identical

**证据（已核实）**: 都 1301 字节，sha256 应该一致（主线核实段已 diff，无差异）。
**建议**:
- 短期：用 `AGENTS.md` 作主源，`CLAUDE.md` symlink 或 generator 同步（避免漂移）
- 长期：内容分化（README+onboarding for human、directive for AI），加 CONVENTIONS.md
**预估**: 短期 15min；长期 2–3h。
**POC 验证**: 短期 symlink/script ✅

### A-LOW-1: CmapCommandError 无 cause chain

**证据（已核实）**: errors.ts 才 215 字节；hooks/events.ts:40、core/map-patch.ts:90 都把原错信息 .message 拼到新字符串里，stack 丢失。
**建议**: 加 optional cause 字段（ES2022 Error.cause 已支持）。
**预估**: 1–2h。
**POC 验证**: ✅ 入选（纯增量、零风险）

---

## 3. 配置 / 可运维

### C-HIGH-1: 无 lint / format / pre-commit hook

**证据（已核实）**: package.json 0 lint script、根目录无 .eslintrc / .prettierrc / .husky / lefthook.yml。25K 行 TS 项目零 lint gate。
**建议**: eslint 9 + @typescript-eslint + prettier；scripts/lint + prepack + CI 增 lint step。
**预估**: 4–6h（含修违规）。
**POC 验证**: ✅ 入选

### C-HIGH-2: fast-glob 死代码（双 agent 独立确认）

**证据（已核实）**:
- package.json:32 dependency `"fast-glob": "3.3.3"`
- `rg fast-glob src/ tests/ scripts/` **完全无匹配**
- 项目用 src/core/module-index.ts:166-205 自己写 globToRegExp() 替代

**建议**: 1 行 `pnpm rm fast-glob`，连带 bundle 减少。
**预估**: 1 分钟。
**POC 验证**: ✅ **必入选**（最高 ROI / 改动量比）

### C-HIGH-3: 无 release 自动化 / 无 CHANGELOG

**证据**: `git tag` 空；无 .changeset/ 或 semantic-release 配置；README 提 v0.2 路线但 package.json 仍 0.1.0。
**建议**: changesets 或 semantic-release；CI 加 publish job。
**预估**: 6–8h。
**POC 验证**: 太大，本次不做 POC（spec 入报告）

### C-MED-1: CI 单 OS 单 Node 矩阵

**证据（已核实）** `.github/workflows/cmap.yml`：
- runs-on: ubuntu-latest（无 macOS/Windows）
- node-version: 22（package.json engines >=20 但不测 v20）

**建议**: matrix [ubuntu/macos/windows] × [22, 24]（v20 状态主线核实）。
**预估**: 2–3h。
**POC 验证**: ✅ 入选（YAML 改动可量化）

### C-MED-2: vitest 无 coverage 配置

**证据（已核实）**: vitest.config.ts 4 项配置，无 coverage / isolate / threads / globals。
**建议**: coverage (v8, 80% 阈值) + isolate: true + threads。
**预估**: 2–3h。
**POC 验证**: ✅ 入选

### C-MED-3: package.json prepack 过重

**证据**: `prepack: "pnpm build && pnpm test && pnpm typecheck && pnpm smoke"` 阻塞 30–60s。
**建议**: 拆 prepack（快门 build+lint）/ release:verify（全套）/ ci。
**预估**: 1h。
**POC 验证**: 不单独 POC（合并到 C-HIGH-1 lint 引入时一起改）

### C-LOW-1: tsconfig 缺高强度选项

**证据（已核实）**: strict: true，但无 noUncheckedIndexedAccess / exactOptionalPropertyTypes。
**建议**: 加两项；ignoreDeprecations: "6.0" 加注释。
**预估**: 2–3h（含修违规）。
**POC 验证**: 不入选（POC 修违规量未知）

### C-LOW-2: Node engine >=20

**证据**: package.json engines.node = >=20。
**主线核实**（待 GPT round 时一起核 Node 20 LTS 实际时间线）。Agent 称 EOL 2026-04，但需独立来源确认。
**建议**: 视核实结果，可能升 >=22。
**预估**: 1h（含 README + CI 矩阵）。

### C-LOW-3: hook stdin 无超时

**证据（已核实）** `src/hooks/events.ts` readHookPayload() for-await stdin，无 timeout。
**建议**: 加 5s timeout。
**预估**: 1h。
**POC 验证**: ✅ 入选（小巧）

---

## 4. 关键发现总结（按 ROI 排序）

| ID | 名称 | 严重度 | 改动量 | 预估收益 | POC 入选 |
|---|---|---|---|---|---|
| C-HIGH-2 | 删 fast-glob 死代码 | HIGH | **1 分钟** | bundle -10–15KB + 依赖图简化 | ✅ |
| L-HIGH-1 | routeTask 接收 modules 参数 | HIGH | 30–45min | brief/pack 链路 -25% | ✅ |
| L-MED-1 | loadModuleIndex 并发化 | MED | 30min | 模块加载 -50% | ✅ |
| L-HIGH-2 | tsup external + bundle 减重 | HIGH | 30–60min | 启动 -15%、bundle -15% | ✅ |
| A-LOW-1 | CmapCommandError cause chain | LOW | 1–2h | 调试 UX 提升 | ✅ |
| C-HIGH-1 | eslint + prettier | HIGH | 4–6h | 工程纪律 | ✅ |
| A-HIGH-2 | 13 处 bare throw 类型化 | MED | 2–3h | 错误一致性 | ✅ |
| A-MED-2 | path builder 抽取 | MED | 4–6h | 重构成本 -90% | ✅ (部分) |
| A-MED-3 | CLAUDE/AGENTS.md 去重 | MED | 15min | 漂移防护 | ✅ |
| C-LOW-3 | hook stdin timeout | LOW | 1h | 防挂死 | ✅ |
| C-MED-1 | CI 跨平台矩阵 | MED | 2–3h | 平台 bug 暴露 | ✅ |
| C-MED-2 | vitest coverage | MED | 2–3h | 覆盖可见 | ✅ |
| L-HIGH-3 | 测试 in-process API 改造 | HIGH | 16–20h | 测试 -50% | 短期 ✅ 长期 ❌ |
| A-HIGH-1 | zod 输入边界统一 | HIGH | 8–10h | v0.2 稳定基建 | spec only |
| C-HIGH-3 | release 自动化 | HIGH | 6–8h | 发版工程化 | spec only |

---

## 5. 给 GPT 的明确提问（Round 1 弹药）

1. 上述清单里我有没有**误诊**或**漏诊**？请用 rg/cat 实地验证。
2. 有没有**更简单的方案**被我跳过？（YAGNI 视角）
3. fast-glob 历史上是为什么加进来的？（git log）有没有合法去用它的场景？
4. cli.ts 576 行 + 28 命令在 v0.2 即将引入"HTML human review layer"时，**会变成瓶颈吗**？
5. tsup ESM bundle 287KB 改 `--external` 后，用户安装时 npm install 自动拉依赖反而更慢吗？net trade-off 是什么？
6. `m22 timeout` 我证伪了，**但 vitest 默认 worker 数 + threads 行为**会不会在低性能机器（CI）上仍然 timeout？是否值得 testTimeout: 30s？
7. `.github/workflows/cmap.yml` 11 步全在一个 job 里串行跑，**是否应该拆 fast-gate 和 dogfooding 两个 job 并行**？
8. v0.1 PRD 强调 "CLI 不生成项目语义"——**当前代码里有违反这条原则的地方吗**？

---

## 6. 待 GPT 帮忙核实的外部事实

- Node.js 20 LTS 真实状态（2026-05-14）—— maintenance / EOL？
- TypeScript 6.0.x 在 npm 上最新版、是否有已知 breaking
- vitest 4.x 默认 thread/pool 策略
- tsup 8.x `--external` 行为细节
