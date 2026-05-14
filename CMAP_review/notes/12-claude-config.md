# Claude DevOps & 配置分析（CMAP_coding）

**日期**: 2026-05-14
**视角**: 配置与可运维 (Explore subagent 输出 + 主线核实)

> 注：原 agent 的全部分析见下文。**所有 file path / 行号声明在最终诊断前会被主线 grep 二次核实**，命中证据另存于 `20-claude-diagnosis.md`。

---

## 1. CRITICAL: 缺 lint / format / pre-commit hook (HIGH)

证据：`grep -E "eslint|prettier|lint|format" package.json` 仅匹配 build 字眼；无 `.eslintrc*` / `.prettierrc*` / `.husky/` / `lefthook.yml`。
影响：12+ 模块、24 测试文件、~25K 行 TS 0 自动 lint。无 import 顺序、未用变量、no-floating-promises 等 TS 专项规则。
建议：eslint 9 + @typescript-eslint + prettier；脚本 `lint` / `lint:check`；加入 prepack + CI。
工作量：4–6h。

## 2. Package.json: prepack 过重 (MEDIUM)

证据：`"prepack": "pnpm build && pnpm test && pnpm typecheck && pnpm smoke"`，pack dry-run 阻塞 30–60s。
建议：拆为 prepack (快门) / release:verify (全套) / ci。
工作量：1h。

## 3. CI: 单 Node 单 OS (MEDIUM)

证据（agent 称 `.github/workflows/cmap.yml`，**待主线核实**）：runs-on ubuntu-latest，node v22 单一。
矛盾：package.json engines node >=20，CI 没测 v20。
建议：matrix [ubuntu/macos/windows] × [20, 22, 24]。
工作量：2–3h。

## 4. 无 release 自动化 / 无 CHANGELOG (HIGH)

证据：`git tag` 空；无 `.changeset/` / semantic-release 配置；package.json v0.1.0 但 README 提 v0.2 方向。
建议：changesets 或 semantic-release。
工作量：6–8h。

## 5. tsconfig 缺高强度选项 (LOW-MEDIUM)

证据：`strict: true` 但缺 noUncheckedIndexedAccess / exactOptionalPropertyTypes；`ignoreDeprecations: "6.0"` 在压制 TS 6.0 弃用。
建议：补两项；为 ignoreDeprecations 添注释。
工作量：2–3h。

## 6. Hook ingest stdin: 总体健壮，缺超时 (LOW)

证据：`src/hooks/events.ts` 的 `readHookPayload()` 已正确处理空 stdin / 错误 JSON / exit code 2。
缺陷：无 stdin 读取超时，父管道断裂可挂死。
建议：增加 5s timeout。
工作量：1h。

## 7. Vitest 配置: 无 coverage / 无 isolate 显式声明 (MEDIUM)

证据：vitest.config.ts 仅 environment/include/restoreMocks/testTimeout 四项。
建议：加 coverage (v8 provider, 80% 阈值) + isolate: true + threads。
工作量：2–3h。

## 8. 依赖激进 (MEDIUM)

证据：typescript@6.0.3 / commander@14.0.3 都是 cutting-edge；vitest@4.1.5 落后 4.1.6 一个 patch。
风险：TS 6.0 churn。
建议：README 注 dev 要求；CI 周期 update --latest + test。
工作量：1h。

## 9. .gitignore 充分 (LOW)

证据：覆盖 node_modules/dist/coverage/.DS_Store/.context/out/stats/backups/audit。
建议：无需改动。

## 10. 缺 CONTRIBUTING.md / SECURITY.md (LOW-MEDIUM)

证据：根目录 ls 无对应文件。
建议：模板 1–2h。

## 11. package.json files 字段太精简 (MEDIUM)

证据：`"files": ["dist", "README.md", "LICENSE"]`，未含 CONTRIBUTING / SECURITY / docs。
建议：补全。
工作量：0.5h。

## 12. CI 无 lint 步 (MEDIUM)

证据（主线核实）：workflow 实际 11 个步骤（Test/Typecheck/Build/Smoke/Verify context/Verify stale/Snapshot freshness/Verify freshness/Export HTML view/Check HTML view/Route benchmark），其中后 7 步是 dogfooding 自己——跑 `pnpm dev verify`、`pnpm dev benchmark route`、`pnpm dev view export`。
**修正 agent 简化描述**：CI 不是"基础四件套"，而是把 cmap 自己当 CI gate（route benchmark 设了 min-top1 80 / min-top3 80 / min-context 80 / max-bad 0 阈值）—— 这是产品级 dogfooding，是设计亮点不是缺陷。
建议：在 dogfooding 前面加一步 Lint。
工作量：1h。

## 12b. CI dogfooding (新增观察, INSIGHT)

证据：`.github/workflows/cmap.yml` 11 步里 7 步在跑自己的 cmap 命令，benchmark 设 80% 阈值作为硬门。
评价：**项目把 PRD 第 5 条"必须证明的事"内化到 CI**——cmap 自己的 route 准确率退步就 fail PR。这是高质量工程实践。
风险：bench/tasks.jsonl 维护成本——如果地图大改，benchmark 阈值可能误报。
建议：保持，但配套需要 CHANGELOG 注明 benchmark 阈值调整事件。

## 13. Node engine >=20 (Agent 声称已 EOL，待核实)

⚠️ Agent claim "v20 LTS ended April 2026" 需主线核对实际时间线，避免幻觉。今天 2026-05-14，Node 20 实际状态在主线核实段确认。
建议（如确认 EOL）：engines.node >=22；CI 矩阵去 v20。
工作量：1h。

## 14. 测试结构: 24 集成测试，无 unit/e2e 分层 (LOW-MEDIUM)

证据：tests/integration/ 下 24 文件，命名 m1..m23。
评价：v0.1 可接受。
建议：增长后再分 tests/unit。

## 15. Smoke 测试: 优秀 (无建议)

证据：scripts/smoke-test.mjs 创建临时项目跑 13 命令路径，断言齐全。

---

## P0 / P1 / P2 落地清单

**P0**（2 周内）
1. 加 eslint + prettier (4–6h)
2. 升 Node engine 至 >=22（核实后）(1h)
3. release 自动化 (6–8h)

**P1**（一月内）
4. CI lint + 跨平台矩阵 (2–3h)
5. Vitest coverage (2–3h)
6. 拆分 scripts (1h)

**P2**（锦上添花）
7. CONTRIBUTING / SECURITY (1–2h)
8. tsconfig 高强度 (2–3h)
9. Hook stdin timeout (1h)
10. files 字段补全 (0.5h)

**总工作量**: 23–30 小时。
