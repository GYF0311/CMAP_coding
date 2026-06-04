# CMAP Source Intelligence Upgrade Final Review

## 范围

- 审查对象：CMAP Source Intelligence Upgrade 的 P0/P1/P2 最终实现。
- 审查重点：trust boundary、generated/non-canonical 标识、freshness/truncated/omitted/confidence 元数据、CLI/README/skill 声明一致性、P0/P1/P2 测试覆盖、竞品源码/文本复制风险、依赖/MCP/daemon 过早引入风险、P2 impact diff / impact symbol / source architecture / benchmark source-intelligence 边界。
- 约束：只读业务源码与测试；未改业务代码；仅写本审查记录文件。

## 看过文件

- 项目与计划上下文：`AGENTS.md`、`.context/MAP.md`、`.context/CHECKPOINT.md`、`.context/STATUS.md`、`.context/modules/source-intelligence.md`、`docs/planning/source-intelligence-upgrade-2026-06/execution-plan.json`、`docs/planning/source-intelligence-upgrade-2026-06/mcp-wrapper-candidate.md`、`docs/planning/source-intelligence-upgrade-2026-06/module-notes/source-index.md`
- Source intelligence 源码：`src/source-intelligence/architecture.ts`、`brief.ts`、`diff.ts`、`discovery.ts`、`evidence.ts`、`format.ts`、`freshness.ts`、`guards.ts`、`impact.ts`、`indexer.ts`、`metrics.ts`、`queries.ts`、`resolver.ts`、`schema.ts`、`store.ts`
- CLI / view / skill：`src/cli.ts`、`src/commands/source.ts`、`src/commands/symbol.ts`、`src/commands/impact.ts`、`src/commands/benchmark.ts`、`src/commands/brief.ts`、`src/view/collect.ts`、`src/view/render.ts`、`src/view/schema.ts`、`src/skill/templates.ts`
- 测试与文档：`tests/integration/source-intelligence.test.ts`、`source-intelligence-package.test.ts`、`source-intelligence-symbol.test.ts`、`source-intelligence-brief-view.test.ts`、`source-intelligence-p2.test.ts`、`source-intelligence-benchmark.test.ts`、`README.md`
- 补充检查：`package.json`、`.gitignore`

## 发现列表

### P1 - Review HTML source freshness 可能把 stale index 显示为 fresh

- 文件：`src/view/collect.ts:350-380`
- 问题：`collectSourceEvidence()` 读取 generated source index 后直接调用 `summarizeSourceFreshness(index, { cwd })`，没有像 `source status`、`brief`、`impact`、`architecture` 那样先取 `currentSourceFileStates(cwd, index)`。结果是 `cmap view export --include-support` 的 Source Evidence 面板只能根据 index metadata 判断 freshness；如果源码在 `cmap source index` 后发生变化，Review HTML 仍可能显示 `fresh`，只在 notes 里有 "No current file-state snapshot..." 这种弱提示。
- 影响：这会破坏 Human Review Layer 的可信度。HTML 是人工审查 generated support layer 的入口，stale evidence 被展示为 fresh 会误导后续 Agent 或人工把过期 source graph 当成当前证据。
- 建议修复：在 `collectSourceEvidence()` 中导入并调用 `currentSourceFileStates(cwd, index)`，改为 `summarizeSourceFreshness(index, { cwd, currentFiles })`。补一条 view integration 回归：index 后改 `src/a.ts`，再 `view export --include-support`，断言 embedded `sourceEvidence.freshness.status === "stale"` 且 `staleFiles` 包含该文件。

### P1 - Source discovery 不尊重 `.codexignore`，可能索引被 Agent 明确排除的源码

- 文件：`src/source-intelligence/discovery.ts:37-43`、`src/source-intelligence/discovery.ts:125-140`
- 问题：source scanner 只读取 `.gitignore`，没有读取 `.codexignore`。P0 修过 `.gitignore` wildcard，但如果项目用 `.codexignore` 排除私有源码、fixture、vendor snapshot 或安全敏感文件，`cmap source index` 仍会把这些 TS/JS 文件写进 `.context/generated/source-index/**`，后续 `brief --with-source-evidence` 还可能生成 snippet。
- 影响：这是 source-intelligence 层的隐私/信任边界缺口。`.codexignore` 的语义就是不让 Agent 读取/使用的项目内容；source index 绕过它会把被排除内容转成 generated evidence。
- 建议修复：把 ignore 读取扩展为 `.gitignore` + `.codexignore`，复用现有 glob parser，并在 metadata 里标注 loaded ignore files。补集成测试：创建 `.codexignore` 排除 `private/*.ts` 或 `*.secret.ts`，运行 `source index` 后断言 `files.json` 不包含这些路径。

### P2 - impact likelyTests 会无条件加入所有 Test symbol 文件

- 文件：`src/source-intelligence/impact.ts:655-685`
- 问题：`addLikelyTestsFromNames()` 先按 affected file name 匹配 likely tests，但最后又遍历 `index.symbols`，把所有 `symbol.kind === "Test"` 的文件都加入 `likelyTests`。这意味着任何 impact query 只要项目里存在多个 test block，结果都会混入完全无关的测试文件。
- 影响：`impact file`、`impact diff`、`impact symbol` 和 `benchmark source-intelligence` 都会出现 false positive likely tests。它不会写 canonical，但会误导验证范围和 benchmark 质量指标。
- 建议修复：删除无条件加入所有 Test symbol 的循环，或只加入位于已匹配 likely test 文件中的 Test symbol 文件。补测试：同一 fixture 加 `tests/unrelated.test.ts`，它包含 `test(...)` 但不 import/call affected source；断言 `impact file src/core.ts --json` 不包含 unrelated test。

### P2 - `symbol callers/callees` 缺少 truncated 元数据

- 文件：`src/commands/symbol.ts:190-202`
- 问题：`symbol callers` / `symbol callees` 会按 `--limit` 截断并返回 `omitted`，但 JSON payload 和 Markdown 输出没有 `truncated` 字段；metrics 里也只记录 omitted count。`symbol explain` 已经补了 `truncated`，但 callers/callees 仍不完整。
- 影响：CLI 输出不满足 generated evidence 的元数据契约。调用方必须自己根据 omitted 推断 truncated，且 Markdown 用户看不到统一的 truncation 标识。
- 建议修复：计算 `const omittedCount = Math.max(0, allEdges.length - visible.length)`，在 result 和 metric queryMetrics 中加入 `truncated: omittedCount > 0`，Markdown 增加 `Truncated: yes/no`。补测试断言 `symbol callers target --json --limit 1` 返回 `truncated: true`。

### P3 - `source architecture --include-candidates` 选项语义反了，且 advisory 缺少 omitted/confidence 汇总

- 文件：`src/source-intelligence/architecture.ts:106-137`、`src/commands/source.ts:93-111`
- 问题：CLI 定义了 `--include-candidates`，但 `analyzeSourceArchitecture()` 在 `includeCandidates` 为 `undefined` 时也会输出 `architectureCandidateHints`，只有显式传 `false` 才关闭。当前 CLI 没有 `--no-include-candidates`，所以 candidate hints 实际默认开启。与此同时 architecture report 只有 `truncated`，没有各 section 的 omitted count，也没有整体 confidence。
- 影响：这不是 canonical write，但会让 CLI 选项和文档语义不一致；也让 architecture advisory 的 generated metadata 不如 impact/symbol 完整。
- 建议修复：改成 `options.includeCandidates ? candidateHintObjects(...) : []`，并在 README/MCP candidate 中明确默认是否显示 candidate hints。为 architecture report 增加 `omitted` 计数和 `confidence`，至少由 freshness/truncation/unresolved refs 推导。

## 验证命令和结果

- `pnpm typecheck`
  - 结果：通过，`tsc --noEmit` exit 0。
- `pnpm test tests/integration/source-intelligence.test.ts tests/integration/source-intelligence-package.test.ts tests/integration/source-intelligence-symbol.test.ts tests/integration/source-intelligence-brief-view.test.ts tests/integration/source-intelligence-p2.test.ts tests/integration/source-intelligence-benchmark.test.ts`
  - 结果：通过，6 个 test files / 20 tests passed。
- `git diff --check`
  - 结果：通过，exit 0。
- `pnpm dev verify --changed`
  - 结果：通过但有已知 coverage warnings；0 errors / 12 warnings。Warnings 为 `.context/*`、README、package/lock 等 changed files 未映射到 module。

## 总体结论

不能作为 clean review 通过。实现主线没有发现 canonical `.context` 直接写入，也没有发现过早 MCP/server/daemon 化或新增过宽依赖；README、skill、MCP candidate 文档基本只声明已实现 CLI surface。

但仍有 2 个 P1 trust-boundary/metadata 风险和 2 个 P2 behavior bug：Review HTML stale freshness、`.codexignore` 漏尊重、impact likelyTests false positives、symbol callers/callees truncated metadata 缺失。建议主线程先修 P1/P2，再补对应回归测试后重跑 source-intelligence 测试、typecheck、`git diff --check`、`pnpm dev verify --changed`。

## 二次 Review

### 范围

- 二次审查对象：上一次 5 个 findings 的修复。
- 审查方式：只读修复后的源码、测试和文档；未改业务代码；仅追加本审查记录。

### 看过文件

- `src/view/collect.ts`
- `src/source-intelligence/discovery.ts`
- `src/source-intelligence/schema.ts`
- `src/source-intelligence/indexer.ts`
- `src/source-intelligence/impact.ts`
- `src/commands/symbol.ts`
- `src/source-intelligence/architecture.ts`
- `src/commands/source.ts`
- `src/cli.ts`
- `tests/integration/source-intelligence.test.ts`
- `tests/integration/source-intelligence-symbol.test.ts`
- `tests/integration/source-intelligence-brief-view.test.ts`
- `tests/integration/source-intelligence-p2.test.ts`
- `README.md`
- `src/skill/templates.ts`
- `docs/planning/source-intelligence-upgrade-2026-06/mcp-wrapper-candidate.md`

### 修复核对

- P1 Review HTML stale freshness：通过。`collectSourceEvidence()` 现在导入并调用 `currentSourceFileStates(cwd, index)`，再传给 `summarizeSourceFreshness(index, { cwd, currentFiles })`。测试在 index 后修改 `src/a.ts`，再导出 `view --include-support`，断言 embedded `sourceEvidence.freshness.status === "stale"` 且 stale files 包含 `src/a.ts`。
- P1 `.codexignore`：通过。discovery 现在读取 `.gitignore` 和 `.codexignore`，保持原有 glob ignore 逻辑，并把 loaded ignore files 写进 `meta.discovery.ignoreFiles`。测试同时覆盖 `.gitignore` 的 `*.secret.ts` / `**/*.secret.ts` / `src/generated/*.ts` 和 `.codexignore` 的 `private/*.ts`。
- P2 unrelated Test symbol false positives：通过。`impact.ts` 已去掉无条件把所有 `kind === "Test"` symbol 文件加入 likelyTests 的循环，只保留基于 affected source names 的匹配。P0/P2 测试都加了 `tests/unrelated.test.ts` 并断言 impact outputs 不包含它。
- P2 `symbol callers/callees` truncated metadata：通过。`runSymbolEdges()` 现在计算 `omittedCount` 和 `truncated`，JSON result 与 query metrics 都包含 `truncated`，Markdown 输出也包含 `Truncated: yes/no`。测试覆盖 callers limit=1 的 JSON/Markdown truncated，以及 callees 未截断时 `truncated: false`。
- P3 `source architecture --include-candidates` / omitted / confidence：通过。`architectureCandidateHints` 现在只在 `includeCandidates` 为 true 时输出；CLI `--include-candidates` 语义正确。architecture report 增加了 `confidence` 和 `omitted`，`source architecture` metrics 和 Markdown 也输出这些字段。测试覆盖显式 include 时有 candidate hints、默认不输出 structured `architectureCandidateHints`、并断言 `confidence` 和 `omitted` 存在。

### 新发现

无新增 P1/P2/P3 findings。

### 验证命令和结果

- `pnpm typecheck`
  - 结果：通过，`tsc --noEmit` exit 0。
- `pnpm test tests/integration/source-intelligence.test.ts tests/integration/source-intelligence-package.test.ts tests/integration/source-intelligence-symbol.test.ts tests/integration/source-intelligence-brief-view.test.ts tests/integration/source-intelligence-p2.test.ts tests/integration/source-intelligence-benchmark.test.ts`
  - 结果：通过，6 个 test files / 20 tests passed。
- `git diff --check`
  - 结果：通过，exit 0。
- `pnpm dev verify --changed`
  - 结果：通过但仍有已知 changed-file coverage warnings；0 errors / 12 warnings。Warnings 为 `.context/*`、README、package/lock 等 changed files 未映射到 module。

### 二次结论

二次 Review 通过。上次 5 个 findings 的修复都已在实现和测试中闭环；未发现新的 trust-boundary、metadata、CLI 语义或测试覆盖问题。
