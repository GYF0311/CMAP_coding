# POC P-8: HTML view redaction 扩规则

**分支**: `poc/p8-html-redaction-strengthen`
**改动量**: 1 个文件 9 行扩展 + 新增 7 个单元测试
**风险**: 低（不误伤标识符，已加防回归测试）

## 改动

`src/view/render.ts` 的 `redact()` 函数从 2 条规则扩到 3 条规则集：

**Before**（覆盖）：
- `api_key | token | secret | password` 字段
- `Bearer ...` HTTP header

**After**（新增覆盖）：
- 上述 + `authorization | client_secret | access_key | access_token | refresh_token | private_key | x-api-key` 字段（云 SDK 环境变量惯用名）
- PEM 私钥块（RSA / OPENSSH / EC / DSA / ENCRYPTED）

## 改动 diff 摘要

```diff
function redact(value: string): string {
   return value
-    .replace(/\b(api[_-]?key|token|secret|password)(\s*[:=]\s*)(["']?)[^\s"'`<>&]+/gi, "$1$2[REDACTED]")
-    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g, "Bearer [REDACTED]");
+    .replace(
+      /\b(api[_-]?key|token|secret|password|authorization|client[_-]?secret|access[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|x[_-]api[_-]key)(\s*[:=]\s*)(["']?)[^\s"'`<>&]+/gi,
+      "$1$2[REDACTED]"
+    )
+    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g, "Bearer [REDACTED]")
+    .replace(/-----BEGIN[^-\n]+PRIVATE KEY-----[\s\S]*?-----END[^-\n]+PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]");
}
```

## 新增测试 `tests/unit/redact.test.ts` (7 个用例)

| 用例 | 输入 | 期望 | 结果 |
|---|---|---|---|
| baseline | `api_key=AKIA... and token: secret-...` | 都 REDACTED | ✓ |
| Authorization | `Authorization: my-app-token-value-here` | REDACTED | ✓ |
| x-api-key | `x-api-key: hunter2-token-abc` | REDACTED | ✓ |
| cloud SDK | `client_secret=CS-VALUE access_key=AK ...` | 全 REDACTED | ✓ |
| PEM block | `-----BEGIN RSA PRIVATE KEY-----...-----END...-----` | `[REDACTED PRIVATE KEY]` | ✓ |
| Bearer 回归 | `... Bearer aaaaaaaaaaaaaaaa1234567890` | `Bearer [REDACTED]` | ✓ |
| 不误伤 | `user-tokenization in src/lib/tokens.ts` | tokenization / tokens.ts **保留** | ✓ |

## 验证

| 检查 | 结果 |
|---|---|
| typecheck | pass |
| 新增 7 个单元测试 | 7/7 pass (170ms) |
| 全量测试（含已有 redaction 集成测试 m19/m16） | 141/141 pass (48s) |
| smoke | pass |

## 建议

**强烈采纳**。HTML view 是 dogfood 时常被分享的 artifact（开 PR review、给同事看模块图）；扩展 redaction 减少意外泄露面，**改动量小、有回归测试、不误伤**。

## 备注

PEM 块 redaction 是新增独立 regex，对 multiline content 用 `[\s\S]*?` 非贪婪匹配，避免一个 PEM 块误吃后续内容。云 SDK 字段名按"业界最常见环境变量惯用名"覆盖，未来若发现新模式可继续加。
