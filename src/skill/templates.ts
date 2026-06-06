import path from "node:path";

export type SkillHost = "generic" | "codex" | "claude";

export type SkillExportFile = {
  relativePath: string;
  content: string;
};

export const DEFAULT_SKILL_OUT = path.join(".cmap", "skills", "cmap");

export function skillOutputDir(out: string | undefined): string {
  return out ?? DEFAULT_SKILL_OUT;
}

export function renderSkillFiles(host: SkillHost): SkillExportFile[] {
  return [
    {
      relativePath: "SKILL.md",
      content: `---
name: cmap
description: "CMAP project map workflow. Use when starting a new coding project with cmap, connecting an existing repo to cmap, routing a task through .context/MAP.md, reading module docs, running cmap verify/finish, exporting Review HTML/Obsidian views, or maintaining generated freshness review metadata."
---

# CMAP Project Map Skill

CMAP is a repo-local project memory map and deterministic maintenance CLI.

## Start Here
1. Read \`.context/CHECKPOINT.md\`.
2. Read \`.context/MAP.md\`.
3. Run \`cmap route "<task>"\`.
4. Read routed module docs.
5. Before finishing, run \`cmap verify --changed\`.

## Canonical Facts
Trusted:
- \`.context/MAP.md\`
- \`.context/CHECKPOINT.md\`
- \`.context/STATUS.md\`
- \`.context/DECISIONS.md\`
- \`.context/VERIFY.md\`
- \`.context/modules/*.md\`

Writing rule:
- Keep canonical section headings in stable English anchors; body text can be Chinese or the project's preferred human language.

Non-canonical:
- \`.context/out/\`
- \`.context/inbox/\`
- \`.context/generated/\`
- \`.context/logs/\`
- \`.context/ideas/\`

## Source Facts
CMAP does not maintain its own source graph. For source-level
coupling, callers/callees, symbol, or impact questions, use the project's
configured code intelligence tool such as CodeGraph, then update CMAP only when
the result changes project memory, module explanations, decisions, or handoff.

## Host Hint
${hostHint(host)}

## Common Commands
See \`commands.md\`.

## Boundaries
See \`boundaries.md\`.

## Multi-agent Updates
See \`multi-agent.md\` for coordinator, research-agent, synthesis, context-updater, and reviewer prompts.
`
    },
    {
      relativePath: "commands.md",
      content: `# CMAP Commands

- \`cmap route "<task>"\` - locate relevant modules.
- \`cmap brief "<task>" --out .context/out/brief.md\` - write an AI coding brief.
- \`cmap pack "<task>" --out .context/out/pack.md\` - write a bounded context pack.
- \`cmap view export --out _cmap-view\` - export the human review page.
- \`cmap view export --ui-lang zh-CN --out _cmap-view\` - export Chinese UI labels without changing canonical facts.
- \`cmap view export --include-support --out _cmap-view\` - include generated/freshness/inbox support layers.
- \`cmap finish --agent --task "..."\` - write a closeout/update request.
- \`cmap update --agent --from <file> --apply-routine\` - apply policy-approved routine updates and route semantic changes to inbox.
- \`cmap inbox triage\` - review pending candidate context updates.
- \`cmap freshness review --all --out .context/out/freshness-review.md\` - write a drift review report.
- \`cmap freshness mark-reviewed --module <id> --evidence "..."\` - record that module facts were reviewed without editing canonical prose.
- \`cmap verify --changed\` - verify project map consistency for changed files.
`
    },
    {
      relativePath: "boundaries.md",
      content: `# CMAP Boundaries

## Canonical
- \`.context/MAP.md\`
- \`.context/CHECKPOINT.md\`
- \`.context/STATUS.md\`
- \`.context/DECISIONS.md\`
- \`.context/VERIFY.md\`
- \`.context/modules/*.md\`

## Writing Contract
- Keep \`.context\` section headings in stable English anchors such as \`Purpose\`, \`Responsibilities\`, \`Key Contracts\`, \`Read Next\`, and \`Tests / Verification\`.
- Write the body text in the project's human language when that makes review clearer.

## Non-canonical
- \`.context/out/\`
- \`.context/inbox/\`
- \`.context/generated/\`
- \`.context/logs/\`
- \`.context/ideas/\`

## Source Facts Boundary
- Source-level facts belong in the configured code-intelligence tool, such as CodeGraph.
- CMAP stores project memory: module explanations, handoff, decisions, status, candidates, and verification notes.
- If source evidence suggests a durable module or relationship change, capture it as reviewed context or a candidate instead of storing a second source graph in CMAP.

## Forbidden Direct Writes
Do not directly overwrite:
- \`.context/MAP.md\`
- \`.context/DECISIONS.md\`
- \`.context/VERIFY.md\`
- \`.context/modules/*.md\`

Use MapPatch requests, inbox candidates, or generated evidence workflows instead.
`
    },
    {
      relativePath: "multi-agent.md",
      content: `# CMAP Multi-agent Prompts

Use these prompts when a repo is large, unfamiliar, or needs cross-checking.

## Boundaries
- CodeGraph or another code-intelligence tool owns source facts: imports, callers, callees, symbols, and impact.
- CMAP owns durable project memory: module explanations, handoff, decisions, status, candidates, and verification notes.
- Do not write semantic module changes directly into canonical \`.context\` files from an unreviewed agent answer.
- Keep stable H1/H2 section anchors in English. Write body prose in Chinese or the project's preferred human language.

## Coordinator Prompt
\`\`\`text
你是 CMAP coordinator。请把这个研究任务拆成 3-5 个互不重叠的只读切片，并派给子 agent。

任务: <task>

要求:
1. 先读 .context/CHECKPOINT.md、.context/MAP.md，并用 cmap route "<task>" 找模块入口。
2. 每个子 agent 只研究自己的切片，不修改文件。
3. 子 agent 必须输出: scope, files read, source evidence, findings, candidate conclusions, risks, proposed context updates, confidence。
4. 源码关系、调用影响、import/call/symbol 事实必须用 CodeGraph 或项目配置的代码智能工具核对。
5. 汇总时只把有证据的内容写进最终中文报告；没有证据的内容标为候选或开放问题。
6. 如果结论会改变模块职责、依赖、数据流或验证路径，只提出 CMAP 更新建议，不直接当成已确认事实。
\`\`\`

## Research Agent Note
\`\`\`markdown
# Agent Note: <slice name>

## Scope
- 研究范围:
- 不研究:

## Files Read
- \`path/to/file\` - 为什么读

## Source Evidence
- 代码事实:
- CodeGraph / parser evidence:
- 文档证据:

## Findings
- 这个模块/流程做什么:
- 它依赖谁:
- 谁依赖它:
- 容易出错的地方:

## Candidate Conclusions
- 已有强证据:
- 只是推测:

## Proposed CMAP Updates
- MAP:
- STATUS / CHECKPOINT:
- modules/*.md:
- inbox candidate:

## Confidence
- high / medium / low:
- 还需要谁复核:
\`\`\`

## Synthesis Prompt
\`\`\`text
你是 CMAP synthesis agent。请阅读所有子 agent note，生成一份给项目负责人的中文报告。

报告必须包含:
1. 一句话结论。
2. 每个模块或流程的中文解释，避免技术黑话。
3. 多个 agent 结论一致的地方。
4. 互相冲突或证据不足的地方。
5. 哪些是源码事实，哪些是项目理解，哪些只是候选。
6. 建议更新哪些 .context 文件，哪些只应进入 .context/inbox/。
7. 验证记录和下一步。

不要把 import/call/symbol/impact 事实复制进 CMAP 当长期记忆；这些由 CodeGraph 维护。
\`\`\`

## Diff-driven Content Update Prompt
\`\`\`text
你是 CMAP diff-content agent。请根据本次代码/文档 diff，判断哪些 CMAP 内容可能需要更新。

输入:
- git diff --name-only 或变更文件列表
- git diff 摘要或关键 patch
- cmap route "<task>" 输出
- CodeGraph impact/call/import 证据
- 相关 .context/modules/*.md、STATUS.md、CHECKPOINT.md、DECISIONS.md

请输出中文报告:
1. 本次变更一句话说明。
2. 变更触达了哪些模块。
3. 哪些只是源码事实变化，交给 CodeGraph，不写入 CMAP。
4. 哪些改变了模块职责、边界、数据流、验证方式、项目状态或重要决策。
5. 建议新增/改写的 content map 文案，按目标文件分组。
6. 哪些建议只能进入 .context/inbox/ 作为候选。
7. 需要运行的验证命令。

边界:
- 不要因为文件改了就机械更新模块文档；只有“项目理解会变”才建议更新 CMAP。
- 不要把 import/call/symbol/impact 清单搬进 CMAP。
- 正文默认中文；稳定标题和 schema 字段保持英文。
\`\`\`

## Context-updater Prompt
\`\`\`text
你是 CMAP context-updater。请根据已验证的代码变更、diff-content 报告、验证输出、子 agent 汇总报告，生成 MapPatch 请求。

硬性边界:
1. checkpoint、generated evidence、stats 这类 routine 更新可以提出自动应用。
2. module semantics、decision、relation 这类语义更新必须作为 candidate 或 inbox，不直接覆盖 canonical context。
3. 输出必须是严格 JSON，不要附加解释文字。
4. 每条语义候选必须包含 evidence、risk、confidence、suggestedCommands。
5. 正文摘要默认中文；稳定字段名和 schema 字段保持英文。
\`\`\`

## Reviewer Prompt
\`\`\`text
你是 CMAP reviewer。请审查 .context/inbox/、freshness review、Review HTML 和验证记录。

判断:
1. 哪些候选有足够证据，可以人工合并进 MAP/STATUS/CHECKPOINT/modules/*.md。
2. 哪些候选证据不足，应该 reject 或继续研究。
3. 哪些代码变更只影响 CodeGraph 事实层，不应该写进 CMAP。
4. 合并后的正文是否中文清楚，是否能让非技术成员理解。
5. 是否需要运行 cmap verify --changed、cmap verify --freshness、cmap view export。
\`\`\`
`
    },
    {
      relativePath: "examples.md",
      content: `# CMAP Examples

## Start a Coding Task
\`\`\`bash
cmap route "implement non-destructive install"
cmap brief "implement non-destructive install" --out .context/out/brief.md
\`\`\`

## Finish a Task
\`\`\`bash
cmap finish --agent --task "implemented non-destructive install"
cmap verify --changed
\`\`\`
`
    }
  ];
}

function hostHint(host: SkillHost): string {
  if (host === "codex") {
    return "Codex users should read `AGENTS.md` first, then this skill pack. Prefer explicit `cmap route`, `cmap brief`, and `cmap verify` commands over implicit hooks.";
  }
  if (host === "claude") {
    return "Claude Code users should read `CLAUDE.md` first, then this skill pack. Hooks are optional and must not write canonical facts automatically.";
  }
  return "Generic IDE agents should read `AGENTS.md` or `CLAUDE.md` first, then this skill pack.";
}
