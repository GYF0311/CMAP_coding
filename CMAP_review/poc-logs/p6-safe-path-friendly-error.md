# POC P-6: safe-path 错误信息友好化

**分支**: `poc/p6-safe-path-friendly-error`
**改动量**: 1 个文件，2 处错误信息扩展
**风险**: 极低（保留原前缀，已有测试 toContain 仍能匹配）

## 改动

`src/fs/safe-path.ts`：
- 旧：`Path escapes project root: ${inputPath}`
- 新：`Path escapes project root: ${inputPath}. Output paths must stay inside the project — use a relative path (e.g. _cmap-view/ or .context/out/view.html) or an absolute path inside ${root}.`

Symlink 错误信息同样扩展，加上实际解析后的目标路径，便于诊断。

## 验证

| 检查 | 结果 |
|---|---|
| typecheck | pass |
| m3.test.ts（含 `toContain("Path escapes project root")`） | 6/6 pass |
| 全量 test | 134/134 pass (49s) |
| 实测 `pnpm dev view export --out /tmp/cmap-bad-path` | 新文案完整显示 |

## Before / After

**Before**:
```
Path escapes project root: /tmp/cmap-bad-path/index.html
```

**After**:
```
Path escapes project root: /tmp/cmap-bad-path/index.html. Output paths must stay inside the project — use a relative path (e.g. _cmap-view/ or .context/out/view.html) or an absolute path inside /Users/macbookpro/Desktop/CMAP_review/CMAP_coding.
```

## 建议

**采纳**。零风险 UX 改进，用户不再需要去看源码或文档才知道为什么 `/tmp/...` 输出被拒。

## 备注

如果项目想做 i18n，这条错误也应该进 i18n 词典；本 POC 暂用英文（与 src/view/render.ts 当前一致）。
