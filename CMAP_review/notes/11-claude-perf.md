# Claude 性能与链路分析（CMAP_coding）

**日期**: 2026-05-14
**视角**: 性能与链路 (Explore subagent 输出 + 主线核实)

> 注：以下原始 agent 输出 + 主线核实段。任何 file:line 在最终诊断前必须主线 grep 二次核实，特别是 fast-glob / gray-matter / loadModuleIndex 三处关键 claim。

---

## 发现 1: 冷启动 100–130ms / bundle 287KB / gray-matter 重复 (HIGH)

证据：
- `time node dist/cli.js version` 中位数 100ms wall clock
- `time node dist/cli.js --help` 中位数 103ms
- `time pnpm dev --help` (tsx) 630ms
- bundle 287KB（tsup `--format esm --dts`，无 `--external`）
- agent claim "bundle 内 gray-matter 导入 7 次（matter1~matter7）" → **核实段验证**

建议：tsup 加 `--external commander,gray-matter,zod`（peer dep 化），或动态 import 命令模块；引入单一 frontmatter 解析出口。
工作量：1–2h。

## 发现 2: brief/pack 重复 loadModuleIndex (MEDIUM)

证据：
- `src/commands/brief.ts` Promise.all 同时调 `routeTask(...)` 和 `loadModuleIndex(cwd)`
- `routeTask` 内部 (src/commands/route.ts) 又调 loadModuleIndex
- pack.ts 同样模式

建议：routeTask 增加 `modules?: ContextModule[]` 可选参；callsite 预加载传入。
实测：brief 从 ~115ms → ~85ms（agent 声称，主线 POC 段会复测）。
工作量：30–45min。

## 发现 3: View HTML 导出成本 (MEDIUM)

证据：
- `src/view/collect.ts` 中 collectEvidence/Inbox 是 readdir + 逐文件 readFile + matter 解析
- 上限 MAX_EVIDENCE=50 / MAX_CANDIDATES=100

建议：collectEvidenceBatch 一次性遍历；大数据集时 HTML 拆成 JSON + JS 组装。
工作量：1.5h。

## 发现 4: 测试 15s 超时根因 — tsx 启动开销 (HIGH)

证据：
- vitest.config.ts `testTimeout: 15000`
- tests/helpers.ts `execFileAsync(tsxBin, [cliPath, ...args])` —— 每次启全新 tsx 进程
- 多个测试卡在 15s 上限（checkpoint/verify/benchmark/freshness）

建议：
- 短期：testTimeout 30s
- 长期：抽 `src/api.ts` 内部命令函数，tests 改 in-process 调用，跳过 fork
- 工作量：2–4h，测试加速 3–5x

## 发现 5: fast-glob 死代码 (LOW / UNUSED — 但高 ROI 修复)

⚠️ **关键 claim**：agent 称 `package.json` 声明 `fast-glob 3.3.3` 但 `grep -r fast-glob src/` 返回空。主线必须核实。

建议（核实成立后）：删 fast-glob dependency；bundle 减 10–15KB。
工作量：1 分钟。

## 发现 6: loadModuleIndex 无并发 (MEDIUM)

证据：`src/core/module-index.ts` 用 `for await` 顺序 readFile。

建议：
```typescript
const results = await Promise.all(entries.map(e => readFile(...)));
```
工作量：30min，~50% 加速。

## 发现 7: 测试 wall clock 翻倍 (MEDIUM — 待复测)

agent claim baseline 61s 第二次跑 117s。可能是 agent 自己跑的时候机器抖动或并发 worker 退化。
主线复测：将在 POC 段使用 hyperfine 多次跑取中位数确认。

## 发现 8: .context 文件 IO 策略未优化 (LOW)

证据：pack.ts Promise.all 中并行读 7 个 .context 文件，无进程级缓存。

建议：context-loader.ts 统一入口 + 命令内缓存。
工作量：45min。

---

## Top 3 高 ROI 优化（pending POC 复测）

1. **删 fast-glob + tsup external** — 45min，启动 +20%、bundle -6%（待核实）
2. **routeTask 接收 modules 参数** — 35min，brief/pack 链路 +25–30%（待 POC）
3. **loadModuleIndex 并发 + testTimeout 30s** — 40min，测试 -40%、模块加载 +50%（待 POC）
