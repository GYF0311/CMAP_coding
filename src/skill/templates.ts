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

## Source Intelligence
For source-level coupling questions, query generated source evidence before broad grep/read:
- \`cmap source status\`
- \`cmap source architecture\`
- \`cmap symbol find <query>\`
- \`cmap symbol explain <query>\`
- \`cmap impact file <path>\`
- \`cmap impact diff --files <csv>\`
- \`cmap impact symbol <query>\`

Generated source evidence is non-canonical. If it conflicts with reviewed \`.context\` facts, create or review a candidate instead of editing canonical memory directly.

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
- \`cmap source index\` - build generated/non-canonical source evidence.
- \`cmap source status\` - check generated source-index freshness.
- \`cmap source architecture\` - render generated/non-canonical source architecture advisory.
- \`cmap symbol find <query>\` - find generated source symbols.
- \`cmap symbol explain <query>\` - inspect generated callers, callees, imports, and confidence for one symbol.
- \`cmap symbol callers <query>\` - list generated callers for one symbol.
- \`cmap symbol callees <query>\` - list generated callees for one symbol.
- \`cmap impact file <path>\` - inspect generated/non-canonical file impact and likely tests.
- \`cmap impact diff --files <csv>\` - aggregate generated/non-canonical impact for changed source files.
- \`cmap impact symbol <query>\` - inspect generated/non-canonical symbol impact with callers/callees and file-impact fallback.
- \`cmap brief "<task>" --out .context/out/brief.md\` - write an AI coding brief.
- \`cmap brief "<task>" --with-source-evidence --out .context/out/brief.md\` - append generated source evidence after reviewed context.
- \`cmap pack "<task>" --out .context/out/pack.md\` - write a bounded context pack.
- \`cmap view export --out _cmap-view\` - export the human review page.
- \`cmap view export --ui-lang zh-CN --out _cmap-view\` - export Chinese UI labels without changing canonical facts.
- \`cmap view export --include-support --out _cmap-view\` - include generated/freshness/inbox support layers.
- \`cmap finish --agent --task "..."\` - write a closeout/update request.
- \`cmap update --agent --from <file> --apply-routine\` - apply policy-approved routine updates and route semantic changes to inbox.
- \`cmap benchmark source-intelligence --file bench/source-intelligence.jsonl\` - measure generated source-evidence precision/recall/F1 and token/tool-call proxies.
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

## Source Intelligence Boundary
- \`.context/generated/source-index/**\` is generated support material.
- Source graph facts can be stale or wrong and must not replace reviewed module docs.
- Source evidence may suggest relation or module candidates, but canonical module relationships still require human review.
- Source benchmark metrics are measurement proxies and should include \`falseCanonicalWrites=0\`.

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
