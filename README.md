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

Current v0.2 direction is **Trust Boundary + Human Review Layer**:

- Graph means a deterministic projection of reviewed canonical module relations, not an import graph.
- Route uses canonical module docs and reviewed relations only; unpromoted candidates can be surfaced for review but must not affect `route.modules`, `route.contextModules`, or benchmark scoring.
- HTML view is the English human review layer for maps, evidence, freshness, and candidates.
- i18n / zh-CN / locale mirrors are paused; future translation work should be a separate candidate workflow, not a second maintained fact store.
- Old import graph, route v2, and pack v2 plans are paused historical ideas, not the active roadmap.

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
cmap bootstrap --host both --skill
cmap verify
```

Existing project:

```bash
cmap adopt
cmap install --host both
cmap skill export --host generic
cmap verify
```

Daily task:

```bash
cmap route "多人对话页面消息发不出去" --max-context 4
cmap checkpoint write --task "多人对话页面消息发不出去" --next "Read routed module docs"
cmap brief "多人对话页面消息发不出去" --max-context 4 --out .context/out/brief.md
cmap pack "多人对话页面消息发不出去" --budget 1200 --format markdown --out .context/out/pack.md
cmap finish
cmap finish --agent --task "多人对话页面消息发不出去"
cmap update --agent --from .context/out/update-request-xxxx.md --apply-routine
cmap evidence append --module route --file src/commands/route.ts --summary "Route behavior verified"
cmap evidence list --module route
cmap evidence migrate --from-module-docs --dry-run
cmap policy validate
cmap freshness snapshot
cmap freshness mark-reviewed --module route --evidence "Reviewed route semantics"
cmap hooks stop --profile assist --changed src/commands/route.ts --summary "Observed route work"
cmap hooks render --host codex --mode assist
cmap hooks ingest --host codex --event UserPromptSubmit --mode assist < codex-hook-payload.json
cmap hooks test --event UserPromptSubmit --mode assist --prompt "多人对话页面消息发不出去"
cmap hooks test --event PostToolUse --mode observe --tool Read --file src/commands/route.ts
cmap graph build
cmap graph explain route
cmap inbox status
cmap inbox triage
cmap inbox promote update-xxxx --dry-run
cmap inbox archive update-xxxx
cmap verify --stale
cmap verify --freshness
cmap verify --coverage --changed
cmap verify --ci --format markdown
cmap obsidian export
cmap obsidian export --check
cmap view export --out _cmap-view
cmap view export --check --out _cmap-view
cmap skill export --host codex
cmap skill export --check
cmap bootstrap --host both --skill
cmap relate request --task "多人对话页面消息发不出去" --changed src/commands/route.ts --out .context/out/relation-request.md
cmap relate ingest --from .context/out/relation-patch.json --dry-run
cmap benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0
cmap reconcile --adapter gsd-v1 --from .planning
```

## Commands

| Command | Purpose |
|---|---|
| `cmap version` | Print version. |
| `cmap init --auto` | Create `.context` skeleton for a new project. |
| `cmap bootstrap --host claude\|codex\|both --skill` | In an initialized project, merge host entrypoints, optionally export skill instructions, and write `.context/out/start-here.md`. |
| `cmap adopt` | Create adoption workspace and candidate signals for an existing project. |
| `cmap install --host claude\|codex\|both` | Merge short cmap marker blocks into host entrypoints without overwriting existing rules. |
| `cmap install --host both --mode print` | Print the cmap marker block without writing files. |
| `cmap install --host both --force` | Explicitly overwrite host entrypoints with standalone cmap entrypoints. |
| `cmap install --host both --backup` | Back up existing entrypoints under `.context/backups/install-*` before writing. |
| `cmap skill export --host generic\|codex\|claude` | Export a project-local skill/reference pack under `.cmap/skills/cmap/`. |
| `cmap skill export --check` | Fail when the exported skill pack is missing or stale. |
| `cmap install --host both --hooks reminder` | Write project-local hook templates under `.context/hooks/`. |
| `cmap install --host both --hooks assist` | Write hook templates that can record generated evidence from changed files. |
| `cmap hooks render --host codex --mode observe\|assist\|strict` | Render Codex lifecycle settings to `.codex/hooks.json` without editing global host config. |
| `cmap hooks render --host claude --mode observe\|assist\|strict` | Render Claude lifecycle hook settings without editing global host config. |
| `cmap hooks ingest --host codex --event <event> --mode observe\|assist\|strict` | Read a real host hook JSON payload from stdin, write session logs/briefs, and return Codex-compatible JSON. |
| `cmap hooks test --event <event> --mode observe\|assist\|strict` | Simulate hook lifecycle events and strict guard decisions locally. |
| `cmap codex start "<task>"` | Run the supported explicit Codex startup workflow without relying on hook parity. |
| `cmap codex finish --task ... --verified ...` | Close a Codex task through finish/update/verify reminders. |
| `cmap codex guard --changed` | Run changed/stale/freshness/inbox guard checks for Codex handoff. |
| `cmap route "<task>" --max-context 4` | Recommend direct modules, bounded related context files, and suggested verification commands. |
| `cmap route "<task>" --graph` | Enable explicit graph-aware route explanation while keeping direct matches separate from related context. |
| `cmap brief "<task>" --max-context 4` | Render an AI coding brief from route, checkpoint/status, bounded context pack, and module docs. |
| `cmap pack "<task>" --budget 1200 --format markdown` | Render a redacted, budgeted context pack from the routed graph neighborhood. |
| `cmap status` | Print `.context/STATUS.md`. |
| `cmap checkpoint read` | Print `.context/CHECKPOINT.md`, falling back to `.context/STATUS.md`. |
| `cmap checkpoint write --task ... --next ...` | Update `.context/CHECKPOINT.md` from explicit handoff fields. |
| `cmap checkpoint close\|clear` | Close or clear the current `.context/CHECKPOINT.md`. |
| `cmap checkpoint --goal ... --next ...` | Legacy-compatible update of `.context/STATUS.md`. |
| `cmap verify [--changed]` | Check context structure. |
| `cmap verify --ci --format markdown` | Print a stable CI-friendly Markdown report for GitHub Actions or PR logs. |
| `cmap finish [--changed files]` | Print a QA-lite context closeout report. |
| `cmap finish --agent --task ...` | Write a local MapPatch request artifact under `.context/out/`. |
| `cmap update --agent --from <json>` | Classify an AI-authored MapPatch without changing canonical facts. |
| `cmap update --agent --from <json> --apply-routine` | Apply routine/generated MapPatch v2 operations; route semantic candidates to `.context/inbox/`. |
| `cmap update rollback <backupId>` | Restore files from a backup printed by `update --apply-routine`. |
| `cmap policy show` | Print the merged deterministic policy v2 JSON. |
| `cmap policy validate` | Warn about unknown policy keys without mutating files. |
| `cmap evidence append --module <id> --file <path> --summary ...` | Append bounded generated evidence to `.context/generated/evidence/modules/<id>.jsonl`. |
| `cmap evidence list --module <id>` | List generated module evidence entries. |
| `cmap evidence migrate --from-module-docs --dry-run\|--apply` | Move legacy generated evidence blocks out of module docs. |
| `cmap freshness snapshot` | Write `.context/generated/freshness.json`. |
| `cmap freshness diff` | Compare current files to the generated freshness snapshot. |
| `cmap freshness mark-reviewed --module <id>` | Mark module semantic facts as reviewed. |
| `cmap hooks stop --profile observe\|assist --changed <files>` | Record hook events; assist can append generated evidence for mapped changed files. |
| `cmap inbox status` | Count candidate context updates and high-risk backlog under `.context/inbox/`. |
| `cmap inbox triage` | Group candidate context updates by risk/type and suggest the next review action. |
| `cmap inbox promote <id> --dry-run` | Preview promotion guidance without editing canonical context. |
| `cmap inbox promote <id> --apply` | Apply allowed low-risk alias/path/evidence candidates with backup, audit, verify, and archive. |
| `cmap inbox reject <id> --reason ...` | Archive a reviewed false candidate with an explicit rejection reason. |
| `cmap inbox archive <id>` | Move reviewed candidates to `.context/inbox/archive/` without deleting them. |
| `cmap verify --stale` | Warn when module docs are older than owned files or inbox candidates need review. |
| `cmap verify --freshness` | Warn when reviewed facts are older than owned files, generated evidence, or pending candidates. |
| `cmap obsidian export` | Export Obsidian-friendly module notes under `_cmap/<project>/`. |
| `cmap obsidian export --check` | Fail when the generated Obsidian view layer is missing or stale. |
| `cmap obsidian open <module>` | Print an `obsidian://` URI for a module note. |
| `cmap obsidian pull --dry-run` | Detect candidate edits from exported Obsidian notes without changing `.context`. |
| `cmap view export --out _cmap-view` | Export a read-only single-file HTML project-map review dashboard. |
| `cmap view export --check --out _cmap-view` | Fail when the HTML review dashboard is missing or stale. |
| `cmap relate request --task ... --changed ...` | Generate an AI RelationPatch request prompt/template. |
| `cmap relate ingest --from <json> --dry-run` | Validate AI relation candidates without writing inbox files. |
| `cmap relate ingest --from <json> --write-inbox` | Write accepted relation candidates to `.context/inbox/relations/*.json|md` with audit. |
| `cmap relate promote <id> --dry-run` | Preview relation promotion only; v0.2 does not auto-apply canonical relation edits. |
| `cmap graph build` | Write deterministic `.context/graph/*.json` projections from reviewed module docs. |
| `cmap graph explain <module>` | Explain one module's files and typed graph relations. |
| `cmap benchmark route --file bench/tasks.jsonl` | Measure route top-k and context-pack accuracy against JSONL task fixtures. |
| `cmap benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0` | Fail CI when route quality falls below explicit thresholds. |
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
- `graph build` projects canonical module relations reviewed in `.context/modules/*.md`; it does not infer imports, symbols, tests, or ownership from source code.
- Unpromoted inbox/relation candidates are non-canonical. They may appear as warnings or review material, but route and benchmark must not score from them.
- `--max-context` only limits selected context modules and derived verify suggestions; it does not change module scoring.
- `pack` only includes routed graph-neighborhood context; it does not scan or embed the whole repository.
- `pack --budget` uses a deterministic approximate token budget and redacts obvious secret-looking values before output.
- AI or users write project purpose, module responsibilities, decisions, and current state.
- `update --agent` can process AI-authored MapPatch JSON; routine checkpoint/generated evidence/stats operations can auto-apply with policy gates, while module semantics and decisions go to `.context/inbox/`.
- `evidence append` writes generated support evidence only. It does not make module responsibilities, dependencies, or decisions canonical.
- `.context/policy.yml` controls bounded routine/generated maintenance defaults such as stats updates and inbox thresholds; semantic and decision auto-writes remain disabled.
- Route commands and assist hook prompt events may update generated `.context/generated/stats/route-usage.json` when policy allows `stats.update`; these counters are not canonical semantics.
- `inbox status`, `inbox triage`, `inbox promote --dry-run`, `inbox promote --apply`, `inbox reject`, `verify --stale`, and `verify --freshness` keep candidate backlog and map drift visible. Only low-risk alias/path/evidence candidates can be promoted automatically.
- Reminder/maintain hooks only remind. Observe hooks write non-canonical hook logs/session events. Assist hooks may write generated evidence under `.context/generated/` or generated session briefs, and strict Codex ingest / local hook tests can block direct semantic canonical writes, but hooks do not update `MAP.md`, `CHECKPOINT.md`, `STATUS.md`, `DECISIONS.md`, module responsibilities, or decisions.
- `hooks ingest --host codex --event UserPromptSubmit --mode assist` and `hooks test --event UserPromptSubmit --mode assist --prompt ...` write `.context/out/session-brief.md` as a generated startup artifact, not trusted project memory.
- `logs/`, `ideas/`, `inbox/`, and `.context/generated/` are not canonical project facts.

## Route Benchmark Fixtures

`bench/tasks.jsonl` supports:

- `expected_modules`: direct route modules that should appear in top results.
- `bad_modules`: direct route modules that should not appear in top results.
- `expected_context_modules`: context-pack modules that should be selected through direct matches or graph relations.

CI can enforce benchmark thresholds with:

```bash
cmap benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0
```

## Verify

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm dev verify --ci --format markdown
pnpm dev verify --stale
pnpm dev verify --freshness
pnpm dev obsidian export --check
pnpm smoke
pnpm dev benchmark route --file bench/tasks.jsonl --min-top1 80 --min-top3 80 --min-context 80 --max-bad 0
```
