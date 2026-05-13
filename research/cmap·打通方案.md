> Superseded Notice, 2026-05-13
>
> This document is historical research. Its old PR-6 import graph / test ownership, route v2, and pack v2 sequence is paused and must not be treated as the current roadmap.
>
> Current direction:
>
> - AI reads code and proposes relation candidates.
> - CLI validates, audits, and routes candidates to inbox.
> - Canonical graph is built only from reviewed module docs.
> - Route does not consume unpromoted candidates.
> - HTML view is the next human review layer.
>
> See `research/cmap-v0.2-trust-boundary-human-review-layer.md`, `.context/STATUS.md`, and `.context/CHECKPOINT.md` for the active plan.

下面是一份我建议你直接按 PR 拆分执行的  **cmap 完整落地技术方案** 。我会以你当前 GitHub main 的状态为基线，而不是只按交接报告里的旧状态判断：你的 README 和 `src/cli.ts` 已经显示现在命令面包含 `pack / evidence / hooks render-test-stop / graph / inbox / verify --stale --ci / benchmark / reconcile` 等能力，明显比交接报告中的 P0 多。

# 0. 总体判断

当前 cmap 已经完成了“项目地图 CLI”的大骨架，但还差一个关键跃迁：

> 从“功能很多、能 dogfood”变成“边界清晰、自动维护可信、真实 hooks 可用、route 足够准、上下文包足够好、可发布推广”。

所以接下来不要继续无序加命令，而要围绕 6 个工程目标收敛：

1. **真实 hooks 闭环** ：不是只 `hooks test`，而是能吃宿主 stdin JSON payload。
2. **canonical 与 generated 分层** ：generated evidence 不再污染 module doc 的 mtime 和信任边界。
3. **policy / MapPatch / inbox 行为一致** ：用户看到的开关必须真实生效。
4. **低风险候选自动 promote** ：解决 inbox 堆积问题。
5. **route 从文档图升级到轻量代码图** ：import graph + test ownership + changed-file mapping。
6. **pack 从截断 Markdown 升级为优先级上下文组装** 。

最终目标仍然不变：

```text
cmap = repo-local project memory map + deterministic maintenance CLI
```

不要把它做成完整 agent OS、RAG server 或自动架构师。

---

# 1. 目标架构

## 1.1 新 `.context/` 分层

你现在已经有 canonical / inbox / out / audit / backups / logs / stats / graph 等概念，但还需要把 **generated 支持层** 从 canonical markdown 里拿出来。

建议目标结构：

```text
.context/
  # Canonical trusted facts
  MAP.md
  STATUS.md
  CHECKPOINT.md
  DECISIONS.md
  VERIFY.md
  policy.yml
  modules/
    route.md
    hooks-doctor.md
    ...

  # Generated, non-canonical support layer
  generated/
    evidence/
      modules/
        route.jsonl
        hooks-doctor.jsonl
      verification.jsonl
    stats/
      route-usage.json
      module-activity.json
      hook-usage.json
    sessions/
      current.jsonl
      session-<id>.jsonl

  # Deterministic graph projections
  graph/
    modules.json
    files.json
    edges.json
    imports.json
    test-ownership.json
    ownership.json
    graph.meta.json

  # Candidate layer
  inbox/
    update-*.md
    candidates/
      <id>.json
    archive/

  # Task-local generated outputs
  out/
    brief.md
    session-brief.md
    pack.md
    update-request-*.md

  # Safety and traceability
  audit/
  backups/
  logs/
  ideas/
```

核心原则：

| 层                                                | 是否可信 | 是否允许 AI 自动写 | 用途                     |
| ------------------------------------------------- | -------: | -----------------: | ------------------------ |
| `MAP.md / STATUS.md / DECISIONS.md / VERIFY.md` |       是 |             默认否 | 长期事实、决策、验证政策 |
| `modules/*.md`                                  |       是 |             默认否 | 模块职责、边界、关系     |
| `generated/evidence`                            |       否 |               可以 | 支持证据、近期观察       |
| `generated/stats`                               |       否 |               可以 | route/模块热度           |
| `graph/*.json`                                  |     派生 |               可以 | deterministic projection |
| `inbox`                                         |     候选 |               可以 | 待审语义变更             |
| `out`                                           |       否 |               可以 | 任务临时包               |
| `audit/backups`                                 |     证据 |               可以 | 回滚、追踪               |

---

# 2. 总体 PR 路线

我建议拆成 10 个 PR，不要一次性大改。

```text
PR-1  Hooks payload ingestion
PR-2  Generated evidence store migration
PR-3  Policy v2 + MapPatch v2 alignment
PR-4  Inbox low-risk promotion
PR-5  Stale / freshness verifier v2
PR-6  Import graph + test ownership
PR-7  Route v2 scoring
PR-8  Pack v2 priority context assembly
PR-9  Benchmark expansion + real dogfood metrics
PR-10 Productization: npm/release/docs/doctor
```

每个 PR 都应该能单独合入、单独测试、单独回滚。

---

# 3. PR-1：真实 hooks payload ingestion

## 3.1 当前问题

你现在 `hooks render` 能生成 Claude lifecycle settings，`hooks test` 也能模拟 `UserPromptSubmit / PreToolUse / PostToolUse / Stop`，但核心问题是：真实宿主 hook 运行时会通过 stdin 传 JSON，而你当前 `runHookTest()` 主要吃 CLI 参数 `--prompt / --tool / --file / --command`。`src/hooks/templates.ts` 生成的命令也是 `cmap hooks test --event ...`，没有解析 stdin payload。

Claude Code 官方 hooks 文档明确说明 command hooks 的 input 是 JSON via stdin，`UserPromptSubmit` / `SessionStart` 的 stdout 会被加入上下文，`PreToolUse` 可以通过 exit code 2 或 JSON 输出阻断工具调用。([Claude API Docs](https://docs.claude.com/en/docs/claude-code/hooks?utm_source=chatgpt.com "Hooks reference - Claude Docs"))

## 3.2 新命令

```bash
cmap hooks ingest --host claude --event SessionStart --mode assist
cmap hooks ingest --host claude --event UserPromptSubmit --mode assist
cmap hooks ingest --host claude --event PreToolUse --mode strict
cmap hooks ingest --host claude --event PostToolUse --mode observe
cmap hooks ingest --host claude --event Stop --mode assist
```

保留旧命令：

```bash
cmap hooks test ...
```

但定位变成本地模拟，不再作为真实 hook template 的目标命令。

## 3.3 数据模型

新增 `src/hooks/events.ts`：

```ts
export type HookHost = "claude" | "codex" | "copilot" | "cursor" | "opencode";

export type HookEventName =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "Stop"
  | "SessionEnd"
  | "PreCompact"
  | "PostCompact";

export type HookMode = "reminder" | "observe" | "assist" | "strict";

export type NormalizedHookEvent = {
  host: HookHost;
  event: HookEventName;
  mode: HookMode;
  cwd: string;
  sessionId?: string;
  turnId?: string;
  source?: string;

  prompt?: string;

  tool?: {
    name: string;
    input?: unknown;
    output?: unknown;
  };

  file?: string;
  files?: string[];
  command?: string;

  raw: unknown;
  receivedAt: string;
};
```

新增 host adapter：

```text
src/hooks/adapters/
  claude.ts
  codex.ts
  generic.ts
```

接口：

```ts
export interface HookAdapter {
  parse(raw: unknown, input: {
    event: HookEventName;
    mode: HookMode;
    cwd: string;
  }): NormalizedHookEvent;
}
```

Claude adapter 做字段兼容解析，不要假设 payload 永远稳定：

```ts
function pickPrompt(raw: any): string | undefined {
  return firstString([
    raw.prompt,
    raw.user_prompt,
    raw.userPrompt,
    raw.message,
    raw.input?.prompt,
  ]);
}

function pickToolName(raw: any): string | undefined {
  return firstString([
    raw.tool_name,
    raw.toolName,
    raw.tool?.name,
  ]);
}

function pickFile(raw: any): string | undefined {
  const input = raw.tool_input ?? raw.toolInput ?? raw.tool?.input ?? {};
  return firstString([
    input.file_path,
    input.filePath,
    input.path,
    input.filename,
  ]);
}

function pickCommand(raw: any): string | undefined {
  const input = raw.tool_input ?? raw.toolInput ?? raw.tool?.input ?? {};
  return firstString([
    input.command,
    input.cmd,
  ]);
}
```

## 3.4 Hook 行为矩阵

| Event                | reminder                | observe              | assist                                                      | strict                                   |
| -------------------- | ----------------------- | -------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `SessionStart`     | 输出读 `.context`提醒 | 写 session log       | 输出 checkpoint/status 摘要                                 | 同 assist                                |
| `UserPromptSubmit` | 提醒 run route          | 记录 prompt          | route + 写 `out/session-brief.md`+ stdout 注入 brief 摘要 | 同 assist，可阻断明显危险 prompt         |
| `PreToolUse`       | 不阻断                  | 记录 tool            | 检查危险 `.context`写入，提示用 update/inbox              | 阻断危险 canonical writes                |
| `PostToolUse`      | 无                      | 记录 read/write/bash | 记录 changed/read files，候选 evidence                      | 同 assist                                |
| `Stop`             | 收尾提醒                | 写 session summary   | changed files -> module evidence / update request           | 若 checkpoint/verify 缺失，可 block stop |

## 3.5 输出协议

Claude：

* `UserPromptSubmit`：输出 JSON，使用 `hookSpecificOutput.additionalContext` 注入简洁上下文。
* `PreToolUse strict`：危险写入时输出 block decision 或 exit code 2。
* `Stop strict`：如果发现未验证、未 checkpoint，可 `decision: "block"` 让 Claude 继续补收尾。

示例：

```json
{
  "decision": "block",
  "reason": "Direct semantic writes to .context/modules/*.md are blocked. Use cmap update/evidence/inbox promotion instead."
}
```

Claude 文档说明 `UserPromptSubmit` 可以添加 context，也可以 block；`PreToolUse` / `Stop` 也有阻断语义，但不同事件的字段和行为不同，所以实现时要分事件输出。([Claude](https://code.claude.com/docs/en/hooks?utm_source=chatgpt.com "Hooks reference - Claude Code Docs"))

Codex：

* 先只做 best-effort adapter。
* 如果 Codex 当前 hook 事件支持不稳定或字段与 Claude 不一致，`cmap hooks render --host codex` 默认只开 `SessionStart / Stop / Bash` 观察，不承诺完整 file edit guard。
* 公开 issues 和社区材料显示 Codex hooks 仍有变动和限制，尤其 file edit / large payload 场景需要谨慎支持。([GitHub](https://github.com/openai/codex/issues/14754?utm_source=chatgpt.com "Add PreToolUse and PostToolUse hook events for code quality enforcement · Issue #14754 · openai/codex · GitHub"))

## 3.6 文件改动

```text
src/cli.ts
src/commands/hooks.ts
src/hooks/templates.ts
src/hooks/events.ts
src/hooks/adapters/claude.ts
src/hooks/adapters/codex.ts
src/hooks/output.ts
src/hooks/safety.ts
tests/integration/m17-hooks-payload.test.ts
```

## 3.7 验收标准

```bash
pnpm test tests/integration/m17-hooks-payload.test.ts
pnpm dev hooks ingest --host claude --event UserPromptSubmit --mode assist < fixtures/hooks/claude-user-prompt.json
pnpm dev hooks ingest --host claude --event PreToolUse --mode strict < fixtures/hooks/claude-edit-context-module.json
```

必须通过：

* stdin prompt 能生成 `.context/out/session-brief.md`
* stdout 能返回可注入的 brief/context
* strict 能阻断 `.context/MAP.md`、`.context/DECISIONS.md`、`.context/VERIFY.md`、`.context/modules/*.md` 的直接 Edit/Write
* observe 能写 `.context/generated/sessions/current.jsonl`
* hook payload 缺字段时不崩溃，降级为 reminder

---

# 4. PR-2：generated evidence store migration

## 4.1 当前问题

当前 `evidence append` 会直接修改 `.context/modules/*.md`，虽然用 marker 标明 generated evidence block，但仍会更新 module doc 的 mtime。

而 `verify --stale` 当前通过 module doc mtime 与 owned code path mtime 比较来判断 module doc 是否可能过期。

这会造成假阴性：

> 代码改了，AI append 了一条 generated evidence，module doc mtime 变新，verify 以为 module doc 不 stale，但 module responsibilities/relations 其实没更新。

## 4.2 新存储

```text
.context/generated/evidence/modules/<module-id>.jsonl
.context/generated/evidence/verification.jsonl
.context/generated/stats/module-activity.json
.context/generated/stats/route-usage.json
```

`modules/*.md` 不再自动写 generated block。

## 4.3 数据模型

```ts
export type GeneratedEvidence = {
  version: 1;
  id: string;
  moduleId: string;
  createdAt: string;
  source: "manual" | "hook" | "mappatch" | "reconcile" | "obsidian-pull";
  task?: string;
  summary: string;
  files: string[];
  commands?: string[];
  confidence: number;
  canonical: false;
};
```

verification evidence：

```ts
export type VerificationEvidence = {
  version: 1;
  id: string;
  createdAt: string;
  source: "manual" | "hook" | "ci" | "mappatch";
  command: string;
  result: "pass" | "fail" | "unknown";
  exitCode?: number;
  summary?: string;
  files?: string[];
  canonical: false;
};
```

## 4.4 命令调整

保留：

```bash
cmap evidence append --module route --file src/commands/route.ts --summary "Route behavior verified"
```

但写入位置变成：

```text
.context/generated/evidence/modules/route.jsonl
```

新增：

```bash
cmap evidence list --module route
cmap evidence compact --module route --max 20
cmap evidence migrate --from-module-docs
```

## 4.5 pack / obsidian 集成

`pack` 读取 generated evidence，但明确标注为 non-canonical：

```markdown
## Generated Evidence
These items are support signals, not canonical module facts.

- 2026-05-12 ... src/commands/route.ts ...
```

`obsidian export` 可选渲染：

```bash
cmap obsidian export --include-generated
```

默认可以不渲染，避免 Obsidian 图被 generated 噪声污染。

## 4.6 迁移策略

新增：

```bash
cmap evidence migrate --from-module-docs --dry-run
cmap evidence migrate --from-module-docs --apply
```

迁移步骤：

1. 扫描 `.context/modules/*.md`
2. 找到 marker：

```text
<!-- cmap:generated:evidence:start -->
...
<!-- cmap:generated:evidence:end -->
```

3. 解析每条 evidence
4. 写入 `.context/generated/evidence/modules/<module>.jsonl`
5. `--apply` 时从 module doc 删除 generated block
6. 写 audit：

```text
.context/audit/evidence-migration-*.md
```

## 4.7 验收标准

* `evidence append` 不改 `.context/modules/*.md`
* `verify --stale` 不被 evidence append 干扰
* `pack` 能包含 generated evidence
* `obsidian export --include-generated` 能渲染 evidence
* migration 可 dry-run、可 backup、可 rollback

---

# 5. PR-3：Policy v2 + MapPatch v2 对齐

## 5.1 当前问题

你有 `policy.yml` 加载逻辑，默认 policy 里包含 `checkpoint.write / checkpoint.close / verification.record / evidence.append / stats.update / semantic.update / decision.append` 等开关。

但 `map-patch.ts` 实际 auto-apply 基本只有 `checkpoint.write`，`status.update`、`verification.record`、`module.update`、`decision.record` 都进入 inbox。

这会让 policy 看起来比真实行为更激进，增加理解成本。

## 5.2 Policy v2

`.context/policy.yml` 改为：

```yaml
version: 2

auto_apply:
  checkpoint.write: true
  checkpoint.close: true
  evidence.append: true
  stats.update: true
  verification.evidence: true

candidate_only:
  status.update: true
  module.alias.add: false
  module.path.add: false
  module.semantic.update: true
  decision.record: true
  verify.policy.update: true

blocked:
  code.write: true
  shell.run: true
  module.delete: true
  module.rename: true
  map.semantic.overwrite: true

thresholds:
  routine_confidence: 0.75
  evidence_confidence: 0.70
  max_inbox_pending: 0
  max_high_risk: 0
  generated_evidence_max_entries: 50
```

解释：

* `verification.evidence` 可以自动写 generated verification evidence。
* `verify.policy.update` 不能自动写 `.context/VERIFY.md`。
* `module.alias.add` 和 `module.path.add` 先放到 candidate，PR-4 再允许 promote apply。
* `semantic.update` / `decision.record` 永远不能自动写 canonical。

## 5.3 MapPatch v2 schema

保留 v1 兼容，新增 v2：

```ts
type MapPatchV2 = {
  schema: "cmap.map_patch.v2";
  agent?: string;
  source?: string;
  task?: string;
  summary: string;
  operations: MapPatchOperationV2[];
};

type MapPatchOperationV2 =
  | CheckpointWriteOp
  | CheckpointCloseOp
  | EvidenceAppendOp
  | VerificationEvidenceOp
  | ModuleAliasCandidateOp
  | ModulePathCandidateOp
  | ModuleSemanticCandidateOp
  | DecisionCandidateOp;
```

示例：

```json
{
  "schema": "cmap.map_patch.v2",
  "agent": "claude",
  "task": "hooks payload ingestion",
  "summary": "Implemented hook stdin parsing",
  "operations": [
    {
      "op": "checkpoint.write",
      "risk": "routine",
      "confidence": 0.88,
      "fields": {
        "task": "hooks payload ingestion",
        "next": "run hooks payload tests",
        "files": ["src/commands/hooks.ts"]
      },
      "evidence": ["src/commands/hooks.ts"]
    },
    {
      "op": "evidence.append",
      "risk": "routine",
      "confidence": 0.82,
      "target": ".context/generated/evidence/modules/hooks-doctor.jsonl",
      "fields": {
        "module": "hooks-doctor",
        "summary": "Hook payload parser added",
        "files": ["src/commands/hooks.ts"]
      },
      "evidence": ["src/commands/hooks.ts"]
    }
  ]
}
```

## 5.4 Operation 行为矩阵

| op                         |   auto apply | 写入目标                                  | 条件                                                     |
| -------------------------- | -----------: | ----------------------------------------- | -------------------------------------------------------- |
| `checkpoint.write`       |           是 | `CHECKPOINT.md`                         | confidence >= threshold, task/next 存在, evidence exists |
| `checkpoint.close`       |           是 | `CHECKPOINT.md`                         | verified 存在，无 failed                                 |
| `evidence.append`        |           是 | `generated/evidence`                    | module 存在, file exists                                 |
| `verification.evidence`  |           是 | `generated/evidence/verification.jsonl` | command/result 存在                                      |
| `stats.update`           |           是 | `generated/stats`                       | generated-only                                           |
| `module.alias.add`       | 否，进 inbox | candidate                                 | module 存在                                              |
| `module.path.add`        | 否，进 inbox | candidate                                 | path exists                                              |
| `module.semantic.update` |           否 | inbox                                     | 永远 candidate                                           |
| `decision.record`        |           否 | inbox                                     | 永远 candidate                                           |
| `verify.policy.update`   |           否 | inbox                                     | 永远 candidate                                           |
| `code.write`             |         拒绝 | 无                                        | forbidden                                                |

## 5.5 新命令

```bash
cmap policy show
cmap policy validate
cmap update --agent --from patch.json --schema v2 --dry-run
cmap update --agent --from patch.json --apply-routine
```

## 5.6 验收标准

* policy 里每个 key 都有测试覆盖
* 未知 policy key warning
* policy 关闭 `evidence.append` 后，MapPatch evidence 自动进 inbox
* `verification.evidence` 写 generated store，不改 `VERIFY.md`
* `decision.record` 永远不能 auto apply
* apply 后自动 `verifyContext()`，若新增 error 自动 rollback

---

# 6. PR-4：Inbox low-risk promotion

## 6.1 当前问题

`inbox promote` 目前只支持 `--dry-run`，明确要求 canonical promotion 手动完成。

这保证安全，但不能解决长期维护成本。下一步要允许 **低风险、可验证、可回滚** 的 candidate promotion。

## 6.2 Candidate JSON 格式

新增 `.context/inbox/candidates/<id>.json`：

```ts
export type InboxCandidate = {
  version: 1;
  id: string;
  createdAt: string;
  source: "mappatch" | "obsidian-pull" | "reconcile" | "hook" | "manual";
  risk: "routine" | "medium" | "high";
  type:
    | "module.alias.add"
    | "module.path.add"
    | "evidence.merge"
    | "verification.evidence"
    | "module.semantic.update"
    | "decision.record"
    | "verify.policy.update";
  target: string;
  summary: string;
  fields: Record<string, unknown>;
  evidence: string[];
  confidence: number;
};
```

Markdown inbox 继续保留给人读，但 CLI promotion 用 JSON candidate。

## 6.3 新命令

```bash
cmap inbox promote <id> --dry-run
cmap inbox promote <id> --apply
cmap inbox promote <id> --apply --type module.alias.add
cmap inbox reject <id> --reason "not true anymore"
cmap inbox archive <id>
```

## 6.4 允许 apply 的类型

| 类型                       | apply? | 条件                               |
| -------------------------- | -----: | ---------------------------------- |
| `module.alias.add`       |     是 | module exists, alias 非空, 不重复  |
| `module.path.add`        |     是 | module exists, path exists, 不重复 |
| `evidence.merge`         |     是 | 写 generated evidence              |
| `verification.evidence`  |     是 | 写 generated verification          |
| `module.semantic.update` |     否 | 必须人工编辑                       |
| `decision.record`        |     否 | 必须人工确认                       |
| `verify.policy.update`   |     否 | 必须人工确认                       |

## 6.5 YAML/frontmatter 修改策略

对 module alias/path 的 apply，不建议手写字符串替换，应该走 gray-matter：

```ts
const parsed = matter(raw);
parsed.data.aliases = unique([...oldAliases, newAlias]);
const next = matter.stringify(parsed.content, parsed.data);
```

要求：

* 保留正文
* 保留 unknown frontmatter keys
* 排序稳定
* 所有 apply 前 backup
* 所有 apply 后 audit

## 6.6 Audit

```text
.context/audit/inbox-promote-2026-05-12T....md
```

内容：

```markdown
# Inbox Promote Audit

Candidate: <id>
Type: module.alias.add
Target: .context/modules/route.md
Backup: <backupId>
Applied fields:
- alias: "context pack"

Evidence:
- src/commands/pack.ts
```

## 6.7 验收标准

* low-risk alias/path candidate 可 apply
* semantic/decision candidate apply 报错
* apply 后 `verify` 无新增 error
* backup rollback 可恢复
* promote 后 candidate 自动移动到 archive 或标记 applied

---

# 7. PR-5：Freshness / stale verifier v2

## 7.1 当前问题

当前 `verify --stale` 主要看文件 mtime，这对 canonical/generate 混写不稳定。迁移 evidence 后要重写 freshness 逻辑。

## 7.2 新 freshness model

给每个 module doc frontmatter 增加：

```yaml
semantic_updated_at: 2026-05-12T22:17:54+08:00
semantic_hash: sha256:...
```

或不写 frontmatter，生成独立 index：

```text
.context/generated/stats/semantic-freshness.json
```

推荐独立 index，减少自动写 canonical：

```json
{
  "version": 1,
  "updated_at": "2026-05-12T...",
  "modules": {
    "route": {
      "doc": ".context/modules/route.md",
      "semantic_hash": "sha256:...",
      "last_semantic_reviewed_at": "2026-05-12T...",
      "owned_files": {
        "src/commands/route.ts": {
          "mtime": "...",
          "hash": "sha256:..."
        }
      }
    }
  }
}
```

## 7.3 新命令

```bash
cmap verify --freshness
cmap freshness snapshot
cmap freshness diff
cmap freshness mark-reviewed --module route --evidence "reviewed route responsibilities"
```

`mark-reviewed` 可以写 generated freshness index，不改 module doc。

## 7.4 Freshness 判定

warning 条件：

* owned code file 比 `last_semantic_reviewed_at` 新
* module path 已删除
* module has generated evidence newer than semantic review
* module has high-risk inbox candidate
* import/test graph 显示新增依赖，但 module relation 没更新

输出示例：

```text
⚠ Module route may be stale:
- src/commands/route.ts changed after last semantic review
- generated evidence has 3 newer observations
- import graph added dependency on graph
Suggested:
- cmap pack "review route module freshness" --module route
- cmap inbox triage --module route
- cmap freshness mark-reviewed --module route --evidence "..."
```

## 7.5 验收标准

* evidence append 不会让 freshness 假通过
* changed code file 能触发 module stale warning
* `mark-reviewed` 后 warning 消失
* high-risk inbox candidate 会触发 freshness warning

---

# 8. PR-6：Import graph + test ownership

## 8.1 当前问题

当前 route 主要靠 alias/module name/path keyword，graph 也只是 module frontmatter relation projection。`route.ts` 的 direct strong match 依赖 alias 或 module name；`context-graph.ts` 的 edge 来源是 `module_relations`。

这对 cmap 自己这种模块文档维护好的项目有效，但对大项目、隐含任务、同义词任务不够。

## 8.2 不要直接上 embeddings

先做 deterministic code graph：

* TypeScript/JavaScript import graph
* package exports graph
* test ownership graph
* changed-file -> module ownership
* route usage heat

暂时不做：

* full AST
* LSP
* embeddings
* call graph
* semantic clustering

## 8.3 新命令

```bash
cmap graph build --imports --tests
cmap graph build --all
cmap graph explain route --imports --tests
cmap graph stale
```

## 8.4 文件结构

```text
.context/graph/
  imports.json
  test-ownership.json
  ownership.json
  graph.meta.json
```

## 8.5 Import graph 数据模型

```ts
export type ImportEdge = {
  from: string;
  to: string;
  rawSpecifier: string;
  kind: "static_import" | "dynamic_import" | "require" | "export_from";
  resolved: boolean;
  moduleIds: {
    from?: string[];
    to?: string[];
  };
};
```

## 8.6 Test ownership 数据模型

```ts
export type TestOwnershipEdge = {
  testFile: string;
  sourceFile?: string;
  moduleIds: string[];
  confidence: number;
  reason: "same_dir" | "name_match" | "imports_source" | "module_path";
};
```

## 8.7 最小 import parser

只覆盖：

```ts
import x from "./x";
import { y } from "../y";
export * from "./x";
const x = require("./x");
await import("./x");
```

不要解析 node_modules，不做复杂 tsconfig path alias。第一版只解析相对路径。

文件扫描：

```text
src/**/*.ts
src/**/*.tsx
src/**/*.js
src/**/*.jsx
tests/**/*.ts
```

排除：

```text
node_modules
dist
coverage
.git
.context
_cmap
```

## 8.8 Resolver

```ts
resolveImport(fromFile, specifier):
  if !specifier.startsWith(".") return unresolved external
  candidates:
    specifier
    specifier + ".ts"
    specifier + ".tsx"
    specifier + ".js"
    specifier + ".jsx"
    specifier + "/index.ts"
    specifier + "/index.tsx"
```

## 8.9 Ownership

复用 `module-index.ts` 的 `mapChangedFilesToModules()`，把 file -> modules 投影到 graph。

`module-index.ts` 已经支持 frontmatter paths include/exclude、glob 匹配和 changed files mapping，是很好的基础。

## 8.10 验收标准

* `graph build --imports` 生成 imports.json
* `graph build --tests` 生成 test-ownership.json
* `graph explain route` 能展示：
  * owned files
  * module relations
  * incoming imports
  * outgoing imports
  * owned tests
* 不存在 import target 时不报 error，只标 unresolved
* route v2 可以使用 import/test graph，但 graph 不存在时降级

---

# 9. PR-7：Route v2 scoring

## 9.1 目标

让 route 不再只靠 alias，而是把以下信号组合：

| Signal             | 用途                   |
| ------------------ | ---------------------- |
| alias/module name  | 直接语义命中           |
| path mention       | 用户提到文件/目录      |
| changed files      | 当前改动映射模块       |
| import graph       | 相关上下游模块         |
| test ownership     | 该跑哪些测试           |
| generated stats    | 最近常用模块，但低权重 |
| benchmark feedback | 发现 bad route         |

## 9.2 新命令

```bash
cmap route "<task>" --signals aliases,paths,graph,tests,usage
cmap route "<task>" --changed src/commands/route.ts
cmap route "<task>" --format json --explain-signals
```

## 9.3 RouteReport v2

```ts
export type RouteReportV2 = {
  task: string;
  directModules: RouteModuleScore[];
  contextModules: RouteContextModule[];
  readFirst: string[];
  verifyCommands: string[];
  codeHints: CodeHint[];
  confidence: "high" | "medium" | "low";
  signals: RouteSignal[];
  warnings: string[];
};

export type RouteSignal = {
  moduleId: string;
  kind:
    | "alias"
    | "module_name"
    | "path_mention"
    | "changed_file"
    | "import_neighbor"
    | "test_owner"
    | "route_usage"
    | "relation";
  score: number;
  evidence: string;
};
```

## 9.4 Scoring

```text
alias exact/contains        +5
module name                +4
explicit path mention      +5
changed file owned         +6
test file ownership        +4
import neighbor            +2
module relation            +2
route usage heat           +1 max
generated evidence hit     +1 max
```

重要：`route_usage` 和 `generated evidence` 只能加小分，不能单独制造 high confidence。

## 9.5 Confidence

```ts
high:
  directModules[0].score >= 6
  and has signal alias/module_name/path_mention/changed_file

medium:
  score >= 4
  and at least 2 independent signal kinds

low:
  otherwise
```

## 9.6 输出变化

```markdown
## Route Result

Confidence: high

Direct modules:
1. route
   - alias: route
   - changed file owned: src/commands/route.ts

Related context:
- graph: import neighbor from route
- benchmark: route quality checks

Read first:
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/modules/route.md
- src/commands/route.ts
- tests/integration/m11-context-size-controls.test.ts

Suggested verify:
- pnpm test tests/integration/m11-context-size-controls.test.ts
- pnpm dev benchmark route --file bench/tasks.jsonl ...
```

## 9.7 验收标准

* 旧 route tests 不破
* `--explain-signals` 输出稳定 JSON
* bad module 不因 usage heat 被推上 top1
* changed file 能直接命中 module
* benchmark 能统计 signal-based route hit

---

# 10. PR-8：Pack v2 priority context assembly

## 10.1 当前问题

`pack.ts` 已经能生成 redacted、budgeted context pack，但预算是 chars/token 近似，超预算时尾部截断，缺少 section priority 和 omitted list。

## 10.2 新命令

```bash
cmap pack "<task>" \
  --budget 4000 \
  --strategy priority \
  --include-code-snippets \
  --include-generated \
  --explain-budget \
  --out .context/out/pack.md
```

## 10.3 Pack item model

```ts
type PackItem = {
  id: string;
  title: string;
  kind:
    | "task"
    | "route"
    | "checkpoint"
    | "status"
    | "module_doc"
    | "decision"
    | "verify"
    | "code_snippet"
    | "test_hint"
    | "generated_evidence"
    | "inbox_warning";
  priority: number;
  source: string;
  content: string;
  estimatedTokens: number;
  canonical: boolean;
};
```

## 10.4 优先级

| Priority | 内容                             |
| -------: | -------------------------------- |
|      100 | task、route confidence、warnings |
|       95 | CHECKPOINT current task/next     |
|       90 | direct module docs               |
|       85 | changed files / code snippets    |
|       80 | verify commands                  |
|       75 | relevant decisions               |
|       65 | related module docs              |
|       50 | generated evidence               |
|       40 | inbox warnings                   |
|       20 | extra status/history             |

## 10.5 Budget algorithm

```ts
const selected = [];
let remaining = budget;

for item in sortByPriority(items):
  if item.tokens <= remaining:
    selected.push(item)
    remaining -= item.tokens
  else if canSummarize(item):
    selected.push(truncateItem(item, remaining))
    remaining = 0
  else:
    omitted.push(item)
```

输出末尾：

```markdown
## Omitted Due To Budget

- related module: obsidian-adapter
- generated evidence: 12 entries
- decisions: 2 old entries
```

## 10.6 Code snippets

只截取小段：

* direct module owned files
* changed files
* test ownership files
* package scripts
* max lines per file 80
* default 不包含代码，除非 `--include-code-snippets`

## 10.7 Redaction v2

增加：

```text
.env style:
  KEY=value
  SECRET=value
  PASSWORD=value
  TOKEN=value

headers:
  Authorization:
  x-api-key:

private keys:
  -----BEGIN ... PRIVATE KEY-----
```

## 10.8 验收标准

* `pack --budget 500` 不丢 task/checkpoint/route
* `pack --explain-budget` 输出 included/omitted
* secret redaction 测试覆盖
* code snippets 只来自 route neighborhood，不扫全仓
* pack 中 canonical/generated 明确分区

---

# 11. PR-9：Benchmark expansion + dogfood metrics

## 11.1 当前已有

`.context/VERIFY.md` 已经把 route benchmark threshold 纳入验证命令；GitHub Actions 也有 benchmark route gate。

## 11.2 问题

现在 benchmark 仍然容易自证循环：

* fixture 太少
* 多是 cmap 自己任务
* alias 调优可能刷分
* 不衡量阅读减少
* 不衡量 pack 成功率
* 不衡量维护成本

## 11.3 新 fixture 格式

```json
{
  "task": "任务结束前自动生成 MapPatch request",
  "expected_modules": ["finish", "update-agent"],
  "expected_context_modules": ["handoff", "verify"],
  "bad_modules": ["obsidian-adapter"],
  "changed_files": ["src/commands/finish.ts"],
  "expected_read_first_contains": [
    ".context/modules/finish.md",
    "src/commands/finish.ts"
  ],
  "expected_verify_contains": [
    "pnpm test"
  ],
  "notes": "historical task"
}
```

## 11.4 新 benchmark 命令

```bash
cmap benchmark route --file bench/tasks.jsonl \
  --min-top1 70 \
  --min-top3 85 \
  --min-context 80 \
  --max-bad 0

cmap benchmark pack --file bench/tasks.jsonl \
  --budget 2000 \
  --min-critical-retention 90

cmap benchmark dogfood --file bench/dogfood.jsonl
```

## 11.5 Dogfood metrics

新增 `.context/generated/stats/dogfood.json`：

```ts
type DogfoodMetrics = {
  totalTasks: number;
  routeTop1Hit: number;
  routeTop3Hit: number;
  avgReadFirstFiles: number;
  avgPackTokens: number;
  inboxCreated: number;
  inboxPromoted: number;
  inboxArchived: number;
  avgMaintenanceMinutes?: number;
};
```

## 11.6 一周真实实验

你应该用 20 个真实任务跑：

```text
A 组：不用 cmap
B 组：用 cmap route/brief/pack
```

记录：

* AI 首轮读取文件数
* 是否第一次定位正确模块
* 是否重复问背景
* 是否误用旧事实
* finish 后是否产生有用 evidence/MapPatch
* inbox 是否能 10 分钟内清完

验收目标：

| 指标                     |      目标 |
| ------------------------ | --------: |
| 首轮读取文件数           | 降低 40%+ |
| route top3               |      85%+ |
| bad module hit           |         0 |
| 每次维护成本             |  < 2 分钟 |
| 自动污染 canonical facts |         0 |

---

# 12. PR-10：产品化发布

## 12.1 当前问题

`package.json` 还是原型状态：依赖用 `latest`，没有 `license`、`repository`、`engines`、`files` 等发布字段。

## 12.2 package.json

建议改成：

```json
{
  "name": "@gyf/cmap",
  "version": "0.2.0",
  "description": "Repo-local project memory map CLI for AI coding",
  "type": "module",
  "bin": {
    "cmap": "dist/cli.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/GYF0311/CMAP_coding.git"
  },
  "license": "MIT",
  "scripts": {
    "build": "tsup src/cli.ts --format esm --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "dev": "tsx src/cli.ts",
    "smoke": "pnpm build && node scripts/smoke-test.mjs",
    "prepack": "pnpm build && pnpm test && pnpm typecheck && pnpm smoke"
  }
}
```

依赖不要用 `latest`，固定版本。

## 12.3 README 重构

现在 README 命令很多，信息密度高。建议分层：

```text
README.md
docs/
  getting-started.md
  concepts.md
  commands.md
  hooks.md
  policy.md
  map-patch.md
  context-pack.md
  graph.md
  safety.md
```

README 只保留：

* 一句话定位
* 3 个核心 workflow
* 安装
* 最小命令
* 安全边界
* 链接到详细 docs

## 12.4 Doctor 强化

新增：

```bash
cmap doctor --release
cmap doctor --hooks
cmap doctor --policy
cmap doctor --graph
```

`doctor --release` 检查：

* package fields
* build exists
* README exists
* LICENSE exists
* no `latest` deps
* CI workflow exists
* smoke pass hint
* `.context/policy.yml` valid

---

# 13. 最终命令面设计

目标命令面：

```bash
# Init / adoption
cmap init --auto
cmap adopt
cmap install --host claude|codex|both
cmap doctor

# Start work
cmap route "<task>" --explain-signals
cmap brief "<task>" --out .context/out/brief.md
cmap pack "<task>" --budget 4000 --strategy priority --out .context/out/pack.md

# Handoff
cmap status
cmap checkpoint read
cmap checkpoint write --task ... --next ...
cmap checkpoint close

# Maintenance
cmap finish --agent --task ... --verified ...
cmap update --agent --from patch.json --dry-run
cmap update --agent --from patch.json --apply-routine
cmap update rollback <backupId>

# Evidence
cmap evidence append --module <id> --file <path> --summary ...
cmap evidence list --module <id>
cmap evidence migrate --from-module-docs --dry-run|--apply

# Inbox
cmap inbox status
cmap inbox triage
cmap inbox promote <id> --dry-run
cmap inbox promote <id> --apply
cmap inbox reject <id> --reason ...
cmap inbox archive <id>

# Hooks
cmap hooks render --host claude --mode assist
cmap hooks ingest --host claude --event UserPromptSubmit --mode assist
cmap hooks test --event UserPromptSubmit --mode assist --prompt ...
cmap hooks stop --profile assist

# Graph
cmap graph build --all
cmap graph build --imports --tests
cmap graph explain <module> --imports --tests
cmap graph stale

# Verify
cmap verify
cmap verify --stale
cmap verify --freshness
cmap verify --policy
cmap verify --coverage --changed
cmap verify --ci --format markdown

# Obsidian
cmap obsidian export
cmap obsidian export --include-generated
cmap obsidian export --check
cmap obsidian pull --dry-run
cmap obsidian pull --write-inbox

# Benchmarks
cmap benchmark route --file bench/tasks.jsonl --min-top1 70 --min-top3 85
cmap benchmark pack --file bench/tasks.jsonl --budget 2000
cmap benchmark dogfood --file bench/dogfood.jsonl

# External adapters
cmap reconcile --adapter gsd-v1 --from .planning --write-inbox
cmap reconcile --adapter gsd-v2 --from .gsd --write-inbox
```

---

# 14. MapPatch / Inbox / Evidence 的统一闭环

目标闭环：

```text
AI task
  -> cmap route / brief / pack
  -> coding
  -> hooks observe reads/writes
  -> finish --agent
  -> AI fills MapPatch v2
  -> update --agent --dry-run
  -> routine generated/checkpoint writes applied
  -> semantic candidates to inbox
  -> low-risk candidates promoted
  -> high-risk candidates reviewed manually
  -> verify --freshness / --policy / --stale
```

## 自动写入策略

| 写入                  |                P0 |                 P1 |                           P2 |
| --------------------- | ----------------: | -----------------: | ---------------------------: |
| checkpoint.write      |                是 |                 是 |                           是 |
| checkpoint.close      |             否/弱 |                 是 |                           是 |
| generated evidence    | 当前写 module doc | 写 generated store |                           是 |
| stats.update          |                是 |                 是 |                           是 |
| verification evidence |                否 | 写 generated store |                           是 |
| alias.add             |             inbox |      promote apply |               可 policy 控制 |
| path.add              |             inbox |      promote apply |               可 policy 控制 |
| module relationship   |             inbox |              inbox | 可能 allow with two evidence |
| module responsibility |             inbox |              inbox |                       manual |
| decision              |             inbox |              inbox |                       manual |
| VERIFY policy         |             inbox |              inbox |                       manual |
| MAP semantic rewrite  |              禁止 |               禁止 |                         禁止 |
| code files            |              禁止 |               禁止 |                         禁止 |

---

# 15. 安全策略

## 15.1 Canonical write whitelist

自动写 canonical 只允许：

```text
.context/CHECKPOINT.md
```

P1 后也不建议自动写：

```text
.context/MAP.md
.context/DECISIONS.md
.context/VERIFY.md
.context/modules/*.md semantic sections
```

允许 promote apply 改 module frontmatter 的 alias/path，但必须满足：

* candidate 类型明确
* module exists
* evidence exists
* backup exists
* audit exists
* verify 无新增 error

## 15.2 Strict hook guard

阻断：

```text
Write/Edit/MultiEdit:
  .context/MAP.md
  .context/DECISIONS.md
  .context/VERIFY.md
  .context/modules/*.md
```

允许：

```text
.context/out/**
.context/generated/**
.context/logs/**
.context/inbox/**
```

对 `.context/CHECKPOINT.md`：

* 允许 `cmap checkpoint write`
* 不建议直接 Edit/Write
* strict mode 可以阻断直接写，提示用命令

## 15.3 Shell guard

PreToolUse 对 Bash：

阻断：

```bash
rm -rf .context
rm -rf .git
git reset --hard
git clean -fd
sed -i ... .context/MAP.md
```

不是永远禁止，而是 strict mode 阻断，assist mode warning。

---

# 16. 验证策略

## 16.1 必跑命令

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm smoke
pnpm dev verify
pnpm dev verify --stale
pnpm dev verify --freshness
pnpm dev verify --policy
pnpm dev verify --ci --format markdown
pnpm dev obsidian export --check
pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 70 --min-top3 85 --min-context 80 --max-bad 0
```

## 16.2 新增测试文件

```text
tests/integration/m17-hooks-payload.test.ts
tests/integration/m18-generated-evidence-store.test.ts
tests/integration/m19-policy-mappatch-v2.test.ts
tests/integration/m20-inbox-promote-apply.test.ts
tests/integration/m21-freshness-v2.test.ts
tests/integration/m22-import-test-graph.test.ts
tests/integration/m23-route-v2-signals.test.ts
tests/integration/m24-pack-v2-priority.test.ts
tests/integration/m25-dogfood-benchmark.test.ts
tests/integration/m26-release-doctor.test.ts
```

## 16.3 CI workflow

当前 workflow 已经有基础质量门。
建议扩展：

```yaml
- name: Verify policy
  run: pnpm dev verify --policy

- name: Verify freshness
  run: pnpm dev verify --freshness

- name: Obsidian export check
  run: pnpm dev obsidian export --check

- name: Pack benchmark
  run: pnpm dev benchmark pack --file bench/tasks.jsonl --budget 2000 --min-critical-retention 90
```

---

# 17. 迁移方案

## 17.1 v0.1 -> v0.2 migration

新增命令：

```bash
cmap migrate --to 0.2 --dry-run
cmap migrate --to 0.2 --apply
```

步骤：

1. 创建 `.context/generated/`
2. 移动 `.context/stats/*.json` 到 `.context/generated/stats/`
3. 从 module docs 提取 generated evidence
4. 生成 policy v2，保留旧 policy 值
5. 生成 freshness snapshot
6. 写 audit
7. verify

## 17.2 Migration report

```markdown
# cmap Migration Report

From: 0.1
To: 0.2

Created:
- .context/generated/evidence/
- .context/generated/stats/

Migrated:
- route generated evidence: 4 entries
- hooks-doctor generated evidence: 2 entries

Warnings:
- module X has malformed generated evidence block

Backup:
- backup-...
```

## 17.3 Rollback

```bash
cmap migrate rollback <backupId>
```

---

# 18. Roadmap

## v0.2：安全维护闭环

目标：

* hooks payload ingestion
* generated evidence store
* policy v2
* MapPatch v2
* inbox low-risk promotion
* freshness v2

验收：

* 真实 hook stdin payload 可工作
* evidence 不改 module doc
* inbox 可低风险 apply
* policy 行为可解释
* verify 能发现 stale 和 inbox backlog

## v0.3：自动维护可用

目标：

* assist hooks 稳定运行
* Stop hook 自动产生 update request
* UserPromptSubmit 自动注入 session brief
* PreToolUse strict 防污染
* PostToolUse 记录 read/write files

验收：

* 20 个真实任务 dogfood
* 每次维护成本 < 2 分钟
* canonical pollution = 0

## v0.4：route / graph / pack 准确性

目标：

* import graph
* test ownership
* route v2 scoring
* pack v2
* benchmark 扩展

验收：

* route top3 > 85%
* bad module = 0
* pack critical retention > 90%
* AI 首轮读文件数降低 40%+

## v0.5：可推广产品

目标：

* npm package
* release docs
* install UX
* doctor --release
* host compatibility docs
* examples repo

验收：

* 新用户 10 分钟内能 init/adopt
* README 不需要读完整 PRD
* CI / smoke / release doctor 全过
* 外部项目 dogfood 3 个以上

---

# 19. 最小可执行顺序

你下一步直接这么做：

```text
Day 1-2:
  PR-1 hooks ingest
  PR-2 generated evidence store

Day 3:
  PR-3 policy v2 + MapPatch v2

Day 4:
  PR-4 inbox promote apply
  PR-5 freshness v2

Day 5-6:
  PR-6 import/test graph
  PR-7 route v2

Day 7:
  PR-8 pack v2
  PR-9 benchmark dogfood
  PR-10 release polish
```

更现实的节奏是 2-3 周，但实现顺序不要变。**先修信任边界，再提升 route 准确率。**

---

# 20. 最终建议

我建议你继续当前方向，但必须暂停“继续加散命令”的冲动。

当前 cmap 最大风险不是功能不够，而是：

```text
generated 和 canonical 混在一起
hooks 没真正吃 payload
policy 和行为不完全一致
inbox 不能低风险 apply
route 没代码图
pack 还只是截断器
```

把这 6 个问题补完，cmap 才会真正从“好用的个人 dogfood 工具”进入“可信、可维护、可推广的 AI coding 项目地图 CLI”。

最重要的一句话：

> cmap 不应该替 AI 做架构判断；cmap 应该让 AI 的判断留下证据、候选、审计、回滚和下一次可读的上下文。
>
