import path from "node:path";

export type SkillHost = "generic" | "codex" | "claude" | "cursor";
export type SkillLocale = "en" | "zh-CN";

export type SkillExportOptions = {
  host: SkillHost;
  locale: SkillLocale;
};

export type SkillExportFile = {
  relativePath: string;
  content: string;
};

export const DEFAULT_SKILL_OUT = path.join(".cmap", "skills", "cmap");

export function skillOutputDir(out: string | undefined, locale: SkillLocale): string {
  const base = out ?? DEFAULT_SKILL_OUT;
  return locale === "en" ? base : path.join(base, locale);
}

export function renderSkillFiles(options: SkillExportOptions): SkillExportFile[] {
  return options.locale === "zh-CN" ? renderZhSkillFiles(options.host) : renderEnSkillFiles(options.host);
}

function renderEnSkillFiles(host: SkillHost): SkillExportFile[] {
  return [
    {
      relativePath: "SKILL.md",
      content: `# CMAP Project Map Skill

## What This Skill Is
CMAP is a repo-local project memory map and deterministic maintenance CLI. Use it to find the right context, preserve trusted project facts, and hand work off cleanly between AI coding sessions.

## Start Here
1. Read \`.context/CHECKPOINT.md\`.
2. Read \`.context/MAP.md\`.
3. Run \`cmap route "<task>"\`.
4. Read the routed \`.context/modules/<module>.md\` files before editing their code.
5. Before finishing, run \`cmap finish\` and \`cmap verify --changed\`.

## Canonical Facts
Trusted files:
- \`.context/MAP.md\`
- \`.context/CHECKPOINT.md\`
- \`.context/STATUS.md\`
- \`.context/DECISIONS.md\`
- \`.context/VERIFY.md\`
- \`.context/modules/*.md\`

Non-canonical files:
- \`.context/out/\`
- \`.context/inbox/\`
- \`.context/generated/\`
- \`.context/logs/\`
- \`.context/ideas/\`
- \`.context/i18n/\`

## Host Hint
${hostHint(host)}

## Common Commands
See \`commands.md\`.

## Boundaries
See \`boundaries.md\`.
`
    },
    {
      relativePath: "commands.md",
      content: `# CMAP Commands

- \`cmap route "<task>"\` - locate relevant modules.
- \`cmap brief "<task>" --out .context/out/brief.md\` - write an AI startup brief.
- \`cmap pack "<task>" --out .context/out/pack.md\` - write a bounded context pack.
- \`cmap view export --lang zh-CN --out _cmap-view\` - export the human review page.
- \`cmap finish --agent --task "..."\` - write a closeout/update request.
- \`cmap update --agent --from <file> --apply-routine\` - apply policy-approved routine updates and route semantic changes to inbox.
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

## Non-canonical
- \`.context/out/\`
- \`.context/inbox/\`
- \`.context/generated/\`
- \`.context/logs/\`
- \`.context/ideas/\`
- \`.context/i18n/\`

## Forbidden Direct Writes
Do not directly overwrite:
- \`.context/MAP.md\`
- \`.context/DECISIONS.md\`
- \`.context/VERIFY.md\`
- \`.context/modules/*.md\`

Use candidate inbox files or MapPatch requests for semantic changes.
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
    },
    {
      relativePath: "install.md",
      content: `# IDE Installation Notes

CMAP skill export is a portable instructions pack. It does not replace \`AGENTS.md\`, \`CLAUDE.md\`, or \`.context/\`.

Recommended entry chain:
1. Read \`AGENTS.md\` or \`CLAUDE.md\`.
2. Read this skill pack.
3. Read \`.context/CHECKPOINT.md\` and \`.context/MAP.md\`.
4. Run \`cmap route "<task>"\`.
`
    }
  ];
}

function renderZhSkillFiles(host: SkillHost): SkillExportFile[] {
  return [
    {
      relativePath: "SKILL.md",
      content: `# CMAP 项目地图 Skill

## 这个 Skill 是什么
CMAP 是 repo-local 的项目记忆地图和确定性维护 CLI。它帮助 AI coding 工具找到正确上下文、保护可信项目事实，并在多轮任务之间完成交接。

## 开始步骤
1. 读取 \`.context/CHECKPOINT.md\`。
2. 读取 \`.context/MAP.md\`。
3. 运行 \`cmap route "<task>"\`。
4. 修改模块前，先读 route 指向的 \`.context/modules/<module>.md\`。
5. 收尾前运行 \`cmap finish\` 和 \`cmap verify --changed\`。

## 可信事实
可信文件：
- \`.context/MAP.md\`
- \`.context/CHECKPOINT.md\`
- \`.context/STATUS.md\`
- \`.context/DECISIONS.md\`
- \`.context/VERIFY.md\`
- \`.context/modules/*.md\`

非可信事实：
- \`.context/out/\`
- \`.context/inbox/\`
- \`.context/generated/\`
- \`.context/logs/\`
- \`.context/ideas/\`
- \`.context/i18n/\`

## Host 提示
${zhHostHint(host)}

## 常用命令
见 \`commands.md\`。

## 边界
见 \`boundaries.md\`。
`
    },
    {
      relativePath: "commands.md",
      content: `# CMAP 常用命令

- \`cmap route "<task>"\` - 定位相关模块。
- \`cmap brief "<task>" --out .context/out/brief.md\` - 生成 AI 开工包。
- \`cmap pack "<task>" --out .context/out/pack.md\` - 生成有预算的上下文包。
- \`cmap view export --lang zh-CN --out _cmap-view\` - 导出人类审阅页。
- \`cmap finish --agent --task "..."\` - 生成收尾和更新请求。
- \`cmap update --agent --from <file> --apply-routine\` - 只应用策略允许的例行更新，把语义变化送入 inbox。
- \`cmap verify --changed\` - 检查 changed files 与项目地图一致性。
`
    },
    {
      relativePath: "boundaries.md",
      content: `# CMAP 边界

## Canonical
- \`.context/MAP.md\`
- \`.context/CHECKPOINT.md\`
- \`.context/STATUS.md\`
- \`.context/DECISIONS.md\`
- \`.context/VERIFY.md\`
- \`.context/modules/*.md\`

## Non-canonical
- \`.context/out/\`
- \`.context/inbox/\`
- \`.context/generated/\`
- \`.context/logs/\`
- \`.context/ideas/\`
- \`.context/i18n/\`

## 禁止直接覆盖
不要直接覆盖：
- \`.context/MAP.md\`
- \`.context/DECISIONS.md\`
- \`.context/VERIFY.md\`
- \`.context/modules/*.md\`

语义变化应先写入候选 inbox 或 MapPatch 请求。
`
    },
    {
      relativePath: "examples.md",
      content: `# CMAP 示例

## 开始编程任务
\`\`\`bash
cmap route "实现非破坏式 install"
cmap brief "实现非破坏式 install" --out .context/out/brief.md
\`\`\`

## 任务收尾
\`\`\`bash
cmap finish --agent --task "实现非破坏式 install"
cmap verify --changed
\`\`\`
`
    },
    {
      relativePath: "install.md",
      content: `# IDE 接入说明

CMAP skill export 是可移植的说明包。它不替代 \`AGENTS.md\`、\`CLAUDE.md\` 或 \`.context/\`。

推荐入口链路：
1. 读取 \`AGENTS.md\` 或 \`CLAUDE.md\`。
2. 读取这个 skill 包。
3. 读取 \`.context/CHECKPOINT.md\` 和 \`.context/MAP.md\`。
4. 运行 \`cmap route "<task>"\`。
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
  if (host === "cursor") {
    return "Cursor users should treat this as a project-local skill/reference pack and keep `AGENTS.md` as the lowest-common-denominator entrypoint.";
  }
  return "Generic IDE agents should read `AGENTS.md` or `CLAUDE.md` first, then this skill pack.";
}

function zhHostHint(host: SkillHost): string {
  if (host === "codex") {
    return "Codex 用户先读 `AGENTS.md`，再读这个 skill 包。优先使用显式 `cmap route`、`cmap brief` 和 `cmap verify`，不要依赖隐式 hooks。";
  }
  if (host === "claude") {
    return "Claude Code 用户先读 `CLAUDE.md`，再读这个 skill 包。hooks 只是可选增强，不能自动写 canonical facts。";
  }
  if (host === "cursor") {
    return "Cursor 用户可以把这里当成项目内 skill/reference 包，同时保留 `AGENTS.md` 作为最低兼容入口。";
  }
  return "通用 IDE agent 先读 `AGENTS.md` 或 `CLAUDE.md`，再读这个 skill 包。";
}
