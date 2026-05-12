# cmap

给 AI coding 的项目小地图。

cmap 在你的项目里维护一组 `.context/` 文件，记录项目目标、模块关系、当前主线、历史决策、验证方式、工作日志和灵感池。人能看，AI 也能看。

当你从 0 到 1 做项目、上下文被压缩、新会话重新接手、或者项目模块越来越多时，AI 可以先读这张地图，快速知道：

- 现在在做什么
- 该改哪个模块
- 会影响哪些地方
- 哪些决策不能忘
- 改完怎么验证

cmap 不是 AI coding 全家桶。它只做一件事：让项目持续可理解。

## Install

```bash
pnpm install
pnpm build
node dist/cli.js version
```

During local development:

```bash
pnpm dev --help
```

## Quick Start

New project:

```bash
cmap init --auto
cmap install --host both
cmap verify
```

Existing project:

```bash
cmap adopt
cmap install --host both
cmap verify
```

Daily task:

```bash
cmap route "多人对话页面消息发不出去" --max-context 4
cmap checkpoint write --task "多人对话页面消息发不出去" --next "Read routed module docs"
cmap brief "多人对话页面消息发不出去" --max-context 4 --out .context/out/brief.md
cmap finish
cmap finish --agent --task "多人对话页面消息发不出去"
cmap update --agent --from .context/out/update-request-xxxx.md --apply-routine
cmap evidence append --module route --file src/commands/route.ts --summary "Route behavior verified"
cmap hooks stop --profile assist --changed src/commands/route.ts --summary "Observed route work"
cmap hooks render --host claude --mode assist --out .context/hooks/claude.settings.generated.json
cmap hooks test --event PostToolUse --mode observe --tool Read --file src/commands/route.ts
cmap graph build
cmap graph explain route
cmap inbox status
cmap inbox triage
cmap inbox promote update-xxxx --dry-run
cmap inbox archive update-xxxx
cmap verify --stale
cmap verify --coverage --changed
cmap obsidian export
cmap benchmark route --file bench/tasks.jsonl
cmap reconcile --adapter gsd-v1 --from .planning
```

## Commands

| Command | Purpose |
|---|---|
| `cmap version` | Print version. |
| `cmap init --auto` | Create `.context` skeleton for a new project. |
| `cmap adopt` | Create adoption workspace and candidate signals for an existing project. |
| `cmap install --host claude\|codex\|both` | Write short host entrypoints. |
| `cmap install --host both --hooks reminder` | Write project-local hook templates under `.context/hooks/`. |
| `cmap install --host both --hooks assist` | Write hook templates that can record generated evidence from changed files. |
| `cmap hooks render --host claude --mode observe\|assist\|strict` | Render Claude lifecycle hook settings without editing global host config. |
| `cmap hooks test --event <event> --mode observe\|assist\|strict` | Simulate hook lifecycle events and strict guard decisions locally. |
| `cmap route "<task>" --max-context 4` | Recommend direct modules, bounded related context files, and suggested verification commands. |
| `cmap route "<task>" --graph` | Enable explicit graph-aware route explanation while keeping direct matches separate from related context. |
| `cmap brief "<task>" --max-context 4` | Render an AI coding brief from route, checkpoint/status, bounded context pack, and module docs. |
| `cmap status` | Print `.context/STATUS.md`. |
| `cmap checkpoint read` | Print `.context/CHECKPOINT.md`, falling back to `.context/STATUS.md`. |
| `cmap checkpoint write --task ... --next ...` | Update `.context/CHECKPOINT.md` from explicit handoff fields. |
| `cmap checkpoint close\|clear` | Close or clear the current `.context/CHECKPOINT.md`. |
| `cmap checkpoint --goal ... --next ...` | Legacy-compatible update of `.context/STATUS.md`. |
| `cmap verify [--changed]` | Check context structure. |
| `cmap finish [--changed files]` | Print a QA-lite context closeout report. |
| `cmap finish --agent --task ...` | Write a local MapPatch request artifact under `.context/out/`. |
| `cmap update --agent --from <json>` | Classify an AI-authored MapPatch without changing canonical facts. |
| `cmap update --agent --from <json> --apply-routine` | Apply only routine checkpoint updates; route semantic candidates to `.context/inbox/`. |
| `cmap update rollback <backupId>` | Restore files from a backup printed by `update --apply-routine`. |
| `cmap evidence append --module <id> --file <path> --summary ...` | Append bounded generated evidence to a module doc. |
| `cmap hooks stop --profile observe\|assist --changed <files>` | Record hook events; assist can append generated evidence for mapped changed files. |
| `cmap inbox status` | Count candidate context updates and high-risk backlog under `.context/inbox/`. |
| `cmap inbox triage` | Group candidate context updates by risk/type and suggest the next review action. |
| `cmap inbox promote <id> --dry-run` | Preview promotion guidance without editing canonical context. |
| `cmap inbox archive <id>` | Move reviewed candidates to `.context/inbox/archive/` without deleting them. |
| `cmap verify --stale` | Warn when module docs are older than owned files or inbox candidates need review. |
| `cmap obsidian export` | Export Obsidian-friendly module notes under `_cmap/<project>/`. |
| `cmap obsidian open <module>` | Print an `obsidian://` URI for a module note. |
| `cmap obsidian pull --dry-run` | Detect candidate edits from exported Obsidian notes without changing `.context`. |
| `cmap graph build` | Write deterministic `.context/graph/*.json` projections from reviewed module docs. |
| `cmap graph explain <module>` | Explain one module's files and typed graph relations. |
| `cmap benchmark route --file bench/tasks.jsonl` | Measure route top-k and context-pack accuracy against JSONL task fixtures. |
| `cmap reconcile --adapter gsd-v1\|gsd-v2 --from <dir>` | Dry-run candidate facts from external workflow artifacts. |
| `cmap add-module <name>` | Create a candidate module doc. |
| `cmap cp copy/move/delete/restore` | Move existing line blocks with backups for destructive edits. |
| `cmap log add "..."` | Append a work log entry. |
| `cmap idea add "..."` | Append a non-canonical idea. |
| `cmap doctor` | Diagnose context, entrypoints, and hook templates. |

## Boundary

cmap CLI does not generate trusted project semantics.

- CLI creates skeletons, scans deterministic signals, routes by aliases, and checks structure.
- Route graph expansion is a context-pack hint only. Related modules are not treated as direct task matches.
- `--max-context` only limits selected context modules and derived verify suggestions; it does not change module scoring.
- AI or users write project purpose, module responsibilities, decisions, and current state.
- `update --agent` can process AI-authored MapPatch JSON, but P0 only auto-applies low-risk checkpoint state with backup/audit; module semantics and decisions go to `.context/inbox/`.
- `evidence append` writes generated support evidence only. It does not make module responsibilities, dependencies, or decisions canonical.
- `.context/policy.yml` controls bounded routine/generated maintenance defaults such as stats updates and inbox thresholds; semantic and decision auto-writes remain disabled.
- `inbox status`, `inbox triage`, `inbox promote --dry-run`, and `verify --stale` keep candidate backlog and map drift visible, but they do not promote facts automatically.
- Reminder/maintain hooks only remind. Observe hooks write non-canonical hook logs/session events. Assist hooks may write generated evidence blocks, and strict hook tests can block direct semantic canonical writes, but hooks do not update `MAP.md`, `CHECKPOINT.md`, `STATUS.md`, `DECISIONS.md`, module responsibilities, or decisions.
- `logs/`, `ideas/`, and `pending/` are not canonical project facts.

## Route Benchmark Fixtures

`bench/tasks.jsonl` supports:

- `expected_modules`: direct route modules that should appear in top results.
- `bad_modules`: direct route modules that should not appear in top results.
- `expected_context_modules`: context-pack modules that should be selected through direct matches or graph relations.

## Verify

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm dev verify
pnpm smoke
```
