# POC P-1: 删除死代码依赖 fast-glob

**分支**: `poc/p1-rm-fast-glob`
**改动量**: 1 个 `pnpm rm fast-glob` 命令（自动改 package.json + pnpm-lock.yaml）
**风险**: 极低
**结论**: ✅ POC 通过，**但收益与预期不符**

## 改动

```bash
pnpm rm fast-glob
# - fast-glob 3.3.3 (从 dependencies 移除)
# - pnpm-lock.yaml 自动更新
```

## 验证（全绿）

| 检查 | 改前 | 改后 |
|---|---|---|
| `pnpm typecheck` | pass | pass |
| `pnpm test` | 134/134 (61s) | 134/134 (48s)* |
| `pnpm build` | 245ms / 287.26 KB | 522ms / 287.26 KB |
| `pnpm smoke` | pass | pass |

*测试 48s vs baseline 61s 的差异是机器抖动 + 缓存命中状态，不归因于本 POC

## ROI 实测修正

**预期**：bundle 减 10–15 KB（来自性能 agent 和 GPT 双方推测）
**实测**：bundle **完全不变**（287.26 KB → 287.26 KB）
**原因**：fast-glob 从未被任何源文件 import，tsup tree-shaking 本来就把它完全剔除，bundle 里根本没有它的代码

**真实收益**：
- `node_modules` 减 1 个 top-level dep + 其传递依赖（fast-glob 依赖 picomatch 等几个包，约 200-500 KB 磁盘）
- `pnpm install` 略快（少装 1 个包）
- 依赖一致性提升（package.json 不再列出不用的库，新人不会困惑"是不是应该改造代码用 fast-glob"）

## 建议

**采纳** —— 改动量极小，安全度极高，主要收益在依赖洁净度而非 bundle 大小。

## 可改进点

如果以后真要做 bundle 优化，目标应该转向 `commander/zod/gray-matter` 的 `--external` 化，把 dist/cli.js 287KB 真正瘦身。但那是另一个 POC（本次未做）。
