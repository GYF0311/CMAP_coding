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
- \`cmap brief "<task>" --out .context/out/brief.md\` - write an AI coding brief.
- \`cmap pack "<task>" --out .context/out/pack.md\` - write a bounded context pack.
- \`cmap view export --out _cmap-view\` - export the human review page.
- \`cmap view export --ui-lang zh-CN --out _cmap-view\` - export Chinese UI labels without changing canonical facts.
- \`cmap view export --include-support --out _cmap-view\` - include generated/freshness/inbox support layers.
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

## Writing Contract
- Keep \`.context\` section headings in stable English anchors such as \`Purpose\`, \`Responsibilities\`, \`Key Contracts\`, \`Read Next\`, and \`Tests / Verification\`.
- Write the body text in the project's human language when that makes review clearer.

## Non-canonical
- \`.context/out/\`
- \`.context/inbox/\`
- \`.context/generated/\`
- \`.context/logs/\`
- \`.context/ideas/\`

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
