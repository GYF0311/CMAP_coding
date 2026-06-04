# CMAP Source Intelligence Upgrade Implementation Roadmap

Date: 2026-06-04
Workspace: `/Users/gaoyifan/Desktop/CMAP_coding`

## Executive Summary

CMAP 当前缺的不是“再做一个知识图谱产品”，而是一个低于 Trust Boundary 的源码智能层：它能回答 callers/callees、file impact、architecture scan、token-saving context pack 这些高频 coding 问题，但所有结果都必须保持 generated evidence / candidate 状态，不能直接写入 canonical `.context`。

推荐路线：

```text
reviewed `.context` map
  stays canonical

source files
  -> generated source index
  -> source evidence / impact reports / query metrics
  -> brief, pack, Review HTML, inbox candidates
  -> human review
  -> canonical `.context` only after promotion
```

MVP 应先用 TypeScript 重写一个 TS/JS-only source index 和 file impact，不复制任何竞品源码；第二阶段补 symbol callers/callees、source-aware brief、Review HTML 支撑面板；第三阶段再考虑 MCP、architecture scan、benchmark 扩展和跨语言。

## 1. Current CMAP Gaps

CMAP 已经有可靠的项目记忆治理：route、brief、pack、generated evidence、candidate inbox、Review HTML、verify/finish 都在保护 `.context` 的可信边界。

缺口集中在源码结构问题：

| Gap | Why It Hurts Today | Desired Capability |
|---|---|---|
| 函数/符号谁调用 | Agent 需要反复 `rg` 和读文件 | `cmap symbol callers <symbol>` |
| 函数/符号调用谁 | 很难快速判断改动下游 | `cmap symbol callees <symbol>` |
| 改文件影响谁 | 改动前不知道影响面和测试范围 | `cmap impact file <path>` |
| 代码架构快速扫描 | `.context` 是 reviewed map，不等于源码现状扫描 | `cmap source architecture` as generated evidence |
| 省 token 查代码 | `brief/pack` 只基于 map，不基于源码索引 | `brief --with-source-evidence` |
| source evidence 边界 | 源码图很容易被误当成事实 | 全部标记 generated/non-canonical/stale-aware |
| skills/README/MAP/view 更新 | Agent 还不知道何时查源码索引 | 更新文档和 skill，但保留 `.context` 优先级 |

## 2. Why These Capabilities Matter

这些能力直接减少 AI coding 的盲搜成本：

- 让 Agent 在读大文件前先问结构化问题。
- 让改动影响面从“凭经验猜”变成“带置信度的候选证据”。
- 让 `brief` 和 `pack` 从项目地图扩展到小而准的源码证据。
- 让 Review HTML 不只看 canonical map，也能看 generated support layer。
- 让 token-saving 可以被 benchmark 量化，而不是凭体感宣称。

但它们的重要性不等于它们天然可信。源码静态分析会漏动态调用、路径 alias、barrel exports、框架隐式 wiring、运行时行为，所以它只能作为 evidence，不是 canonical memory。

## 3. Competitor Patterns Worth Absorbing

| Project | Worth Absorbing | CMAP Interpretation |
|---|---|---|
| CodeGraph | TS/Node local index, SQLite-like schema, freshness, unresolved refs, bounded traversal, CLI/MCP query surface | P0 最强参考：TS/JS source-index + source status + callers/callees/impact |
| Code Review Graph | diff-to-symbol, recursive impact, minimal review context, context-savings metadata, small query vocabulary | file impact 和 token-saving benchmark 的核心参考 |
| Graphify | confidence labels, provenance, reverse traversal, architecture scan hints | 每条 source edge 带 confidence/provenance；architecture scan 只做 advisory |
| Understand Anything | onboarding, diff/explain/chat context builders, dashboard progressive disclosure, freshness warnings | Review HTML/source-aware brief 的 UX 参考 |
| CodeGraphContext | allowed-root guard, MCP manifest, read-only tool handlers, response caps, disabled tools | 未来 MCP 和 guardrail 参考；CLI 先行 |
| LeanKG | token metrics, benchmark A/B, cache/freshness, MCP token budget, plugin guidance | 评测纪律参考：记录 wins/losses，不吹 token-saving |
| GitNexus | one-tool product shape, `source status`, `symbol explain`, `impact diff`, summary-first UI | PolyForm Noncommercial: design-only, no code/template reuse |

## 4. Capabilities Not Suitable To Absorb

不建议吸收：

- 竞品源码、schema strings、hook scripts、skills 文案、UI components。
- GitNexus 任何代码或模板，因为 PolyForm Noncommercial。
- LeanKG/CodeGraphContext 的多后端图数据库抽象。
- 默认 daemon/watch/git hook 自动更新。
- 全语言 tree-sitter 矩阵作为 MVP。
- LLM 生成的 architecture summary 直接变事实。
- raw Cypher/raw graph query 作为主用户能力。
- Web UI 控制台、Obsidian 写回、global repo registry。
- 阻断 `rg`/grep 的强制 hook。

## 5. CMAP TypeScript Rewrite Plan

新增未来模块建议叫：

```text
source-intelligence
```

推荐源码布局：

```text
src/source-intelligence/
  guards.ts
  discovery.ts
  schema.ts
  indexer.ts
  extractors/typescript.ts
  resolver.ts
  store.ts
  queries.ts
  impact.ts
  evidence.ts
  freshness.ts
  metrics.ts
```

推荐生成状态：

```text
.context/generated/source-index/
  source-index.meta.json
  files.json
  symbols.json
  edges.json
  unresolved-refs.json
  evidence/*.jsonl
  metrics/*.jsonl
```

P0 schema:

```ts
type SourceFile = {
  path: string;
  language: "typescript" | "javascript" | "unknown";
  hash: string;
  size: number;
  modifiedAt: string;
  indexedAt: string;
  gitHead?: string;
  parseErrors: string[];
};

type SourceSymbol = {
  id: string;
  kind: "File" | "Function" | "Class" | "Method" | "Type" | "Variable" | "Test";
  name: string;
  qualifiedName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  parentId?: string;
  signature?: string;
};

type SourceEdge = {
  kind: "CONTAINS" | "IMPORTS_FROM" | "EXPORTS" | "CALLS" | "REFERENCES" | "TESTED_BY";
  sourceId: string;
  targetId?: string;
  unresolvedTarget?: string;
  filePath: string;
  line?: number;
  confidenceTier: "parsed" | "resolved-local" | "resolved-import" | "typechecker" | "heuristic" | "unresolved";
  confidence: number;
  provenance: string;
};
```

P0 先用 TypeScript compiler API 或 TS-native AST 工具实现：

- file discovery with `.gitignore`/CMAP ignore policy
- TS/JS import/export/re-export
- functions/classes/methods/exported constants
- same-file and imported-symbol call evidence
- test file/test block detection
- stale/fresh status by hash + git HEAD

SQLite 可以后置。先把 public query API 和 trust-boundary schema 稳住，物理存储以后可替换。

## 6. CLI Command Plan

MVP:

```bash
cmap source index
cmap source status
cmap impact file <path>
```

Second stage:

```bash
cmap symbol find <query>
cmap symbol explain <symbol>
cmap symbol callers <symbol>
cmap symbol callees <symbol>
cmap brief "<task>" --with-source-evidence
```

Third stage:

```bash
cmap source architecture
cmap impact symbol <symbol>
cmap impact diff --scope staged
cmap impact diff --base <ref>
cmap benchmark source-intelligence
```

Future MCP, only after CLI schema stabilizes:

```text
cmap_source_status
cmap_symbol_find
cmap_symbol_explain
cmap_symbol_callers
cmap_symbol_callees
cmap_impact_file
cmap_source_brief
```

Every command must print:

- generated/non-canonical label
- query target and match candidates
- freshness summary
- confidence/provenance
- truncated/omitted counts
- recommended next command

## 7. Docs, Skills, MAP, Review HTML Updates

When implementation begins, update:

| Surface | Required Update |
|---|---|
| `.context/MAP.md` | Add `source-intelligence` module only after code exists; do not claim shipped behavior in planning |
| `.context/modules/evidence.md` | Generated source evidence and metrics ownership |
| `.context/modules/brief.md` | Optional source-evidence block after reviewed context |
| `.context/modules/pack.md` | Budgeted source snippets and redaction rules |
| `.context/modules/view.md` | Read-only source evidence panels |
| `.context/modules/benchmark.md` | Source-intelligence A/B benchmark family |
| `.context/modules/skill.md` | Agent guidance for source query before broad read |
| README | Add Source Intelligence section with trust-boundary warning |
| `src/skill/templates.ts` | Add commands and boundary language after commands ship |
| Review HTML | Source index status, symbol evidence, impact evidence, architecture candidates |

For this planning slice, only `showcase` should map the new planning docs. The actual `source-intelligence` module should wait until implementation files exist.

## 8. Generated Evidence Vs Canonical Memory

Generated source intelligence may write:

```text
.context/generated/source-index/**
.context/generated/evidence/**
.context/generated/stats/**
.context/out/**
.context/inbox/candidates/** when explicitly requested
```

It must not directly write:

```text
.context/MAP.md
.context/modules/*.md
.context/DECISIONS.md
.context/VERIFY.md
```

Promotion rule:

```text
source evidence
  -> candidate report
  -> human review
  -> explicit map/module update
  -> verify
```

If generated source evidence contradicts `.context`, the system should say so and create a candidate. It should not silently correct canonical memory.

## 9. Phase Plan

### MVP

Goal: answer "改文件 X 影响谁" and produce trustworthy generated evidence.

Deliverables:

- `src/source-intelligence` basic schema and store.
- TS/JS file scanner and extractor.
- Import/re-export graph.
- `cmap source index`.
- `cmap source status`.
- `cmap impact file <path>`.
- Generated evidence writer.
- Freshness warnings and worktree/git metadata.
- Tests for path safety, freshness, imports, file impact, and no canonical writes.

Success bar:

- A CMAP contributor can run `cmap impact file src/commands/route.ts` and get likely dependents/tests/modules with freshness and confidence.

### Second Stage

Goal: source intelligence becomes useful for daily coding and token saving.

Deliverables:

- Symbol index for functions/classes/methods/exported constants.
- `symbol find/explain/callers/callees`.
- Same-file/imported-symbol call resolution with confidence tiers.
- `brief --with-source-evidence`.
- Budgeted snippets and redaction.
- Review HTML source evidence panels.
- Source query metrics.

Success bar:

- Agent answers "function A 谁调用" without broad repo reads and includes enough provenance for human verification.

### Third Stage

Goal: evaluate, expose, and scale the layer.

Deliverables:

- `impact diff`.
- `source architecture` advisory scan.
- `benchmark source-intelligence`.
- MCP wrappers over stable CLI handlers.
- Optional cache/SQLite backend if JSON store becomes slow.
- Optional multi-language extractor pilots.
- Skill/README/MAP updates for shipped commands.

Success bar:

- Benchmark shows lower tool calls/files read/source tokens on representative tasks, without lower affected-file recall or false canonical promotion.

## 10. Token And Tool-Call Verification

Do not claim token savings without measurement.

Benchmark fixture shape:

```json
{
  "task": "Change route output format",
  "changed_files": ["src/commands/route.ts"],
  "target_symbol": "runRoute",
  "expected_callers": ["src/cli.ts"],
  "expected_callees": ["src/core/context-graph.ts"],
  "expected_impacted_files": ["src/commands/brief.ts"],
  "expected_tests": ["tests/integration/m10-route-context-pack.test.ts"],
  "bad_files": ["docs/cmap-product-overview.html"]
}
```

Metrics:

- baseline tool calls
- source-intelligence tool calls
- files read
- source tokens read
- generated evidence tokens
- elapsed time
- expected-file precision
- expected-file recall
- F1
- stale warnings
- false canonical writes

Comparison:

```text
baseline agent: route + rg + read files
source agent: route + source status + impact/symbol query + targeted reads
```

A good result is not only lower token count. It must also preserve or improve correctness.

## Implementation Order Recommendation

1. Create `source-intelligence` module doc only when code lands.
2. Build TS/JS source index and `source status`.
3. Add `impact file` because it is the highest-value low-ambiguity query.
4. Add symbol query only after import/export and ambiguity handling are stable.
5. Add source-aware brief and Review HTML panels after evidence labels and budgets are tested.
6. Add benchmark before marketing or README claims about token savings.
7. Add MCP only after CLI output schema stops changing.

## Decision Summary

CMAP is better than the competitor projects in one important way: it already has a clear trust boundary and human review layer. Most source-graph tools optimize retrieval power first and governance second. CMAP should keep that advantage.

The right upgrade is therefore not "copy CodeGraph/LeanKG/GitNexus into CMAP." It is:

```text
CMAP governance
  + TS-native generated source index
  + bounded source queries
  + measured token savings
  + review-before-memory promotion
```

That gives先生想要的 one-tool coding workflow, while avoiding the trap where a generated source graph quietly becomes an unreviewed second memory system.
