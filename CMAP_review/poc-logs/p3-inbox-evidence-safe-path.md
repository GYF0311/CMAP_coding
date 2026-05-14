# POC P-3: inbox promote evidence path 用 resolveInsideRoot

**分支**: `poc/p3-inbox-evidence-safe-path`
**改动量**: 1 个 import + 5 行 inbox.ts + 新增 1 个测试文件
**风险**: 低
**结论**: ✅ POC 通过，**真实安全漏洞已修复**

## 漏洞确认

- **来源**: 外部 gptpro 报告 P0.5-1，Claude 三视角 review 完全漏诊
- **GPT round 1 独立验证调用链**:
  1. `cmap update --agent --from <file>` 读外部 AI MapPatch
  2. `--write-inbox` 写 structured candidate (`src/core/map-patch.ts:620-645`)
  3. candidate.evidence 原样进 candidate-store
  4. `cmap inbox promote <id> --apply` 走 `applyInboxCandidate` (inbox.ts:147-150)
  5. **evidence 校验是 `fileExists(path.join(cwd, item))` 不是 resolveInsideRoot**（inbox.ts:343 旧）
- 项目其他位置（relate.ts / map-patch.ts / pack.ts / freshness.ts）都正确使用 resolveInsideRoot，**唯独 inbox.ts 这一处遗漏**——这是 inconsistency 引入的安全洞
- 用 `../outside` 或 `/etc/passwd` 当 evidence path 可绕过 trust boundary，把 repo 外路径当可信 evidence 写进 generated evidence

## 改动

`src/commands/inbox.ts`：
```diff
-import { projectRelative } from "../fs/safe-path.js";
+import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";

   const evidence = stringArrayField(candidate.data.evidence);
   for (const item of evidence) {
-    if (!(await fileExists(path.join(cwd, item)))) {
+    // Reject path-escape (e.g. "../outside") and symlinks pointing outside repo.
+    // Aligns with relation-patch.ts / map-patch.ts / pack.ts which already use resolveInsideRoot.
+    const resolved = await resolveInsideRoot(cwd, item);
+    if (!(await fileExists(resolved))) {
       throw new CmapCommandError(`Evidence file does not exist: ${item}`, 2);
     }
   }
```

## 新测试

`tests/integration/m24-inbox-path-escape.test.ts`（3 个用例）：

| 用例 | evidence 路径 | 预期 | 实测 |
|---|---|---|---|
| relative escape | `../outside-file.txt` | 拒（Path escapes project root） | ✓ |
| absolute escape | `/etc/passwd` | 拒（Path escapes project root） | ✓ |
| inside ok | `src/commands/route.ts` | 不触发 path-escape | ✓ |

## 验证

| 检查 | 结果 |
|---|---|
| typecheck | pass |
| 全量测试（含新增 m24） | 134/134 + 3/3 = 137/137 pass |
| smoke | pass |
| 新测试单独跑 | 3/3 pass, 3.09s |

## 建议

**强烈采纳**。修复真实安全漏洞 + 跟项目其他模块的安全风格一致 + 含 path-escape 回归测试。

## 影响范围

唯一可能的 user-visible 变化：
- 之前能 promote 但用了 repo 外 evidence path 的 candidate（如果有这种情况，本身就是 trust-boundary 违反），现在会被拒。这是预期行为，应该没有合法用例依赖之前的漏校验。
