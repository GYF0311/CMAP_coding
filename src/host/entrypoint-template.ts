export function hostEntrypoint(projectName: string): string {
  return `# Project: ${projectName}

${hostEntrypointBlock()}
`;
}

export function hostEntrypointBlock(): string {
  return `<!-- cmap:start -->
## CMAP Project Map

This project uses cmap: a shared project map for humans and AI coding agents.

## Start Here
1. Read \`.context/MAP.md\` for the project map.
2. Read \`.context/CHECKPOINT.md\` for the current handoff, then \`.context/STATUS.md\` for durable status.
3. Use \`cmap route "<task>"\` to find relevant modules.
4. Before editing a module, read its \`.context/modules/<module>.md\` file.
5. Before claiming done, run \`cmap finish --compact\` and \`cmap verify --changed\`.

## Rules
- Do not read every \`.context\` file by default. Read by route.
- Do not treat \`logs/\`, \`ideas/\`, \`inbox/\`, or generated files as canonical facts.
- Only \`MAP.md\`, \`CHECKPOINT.md\`, \`STATUS.md\`, \`DECISIONS.md\`, \`VERIFY.md\`, and \`modules/*.md\` are trusted project memory.
- Keep canonical \`.context\` section headings in stable English anchors; body text may use the project's human language.
- If code changes module responsibilities, dependencies, data flow, or verification, update \`.context\`.
- If context is getting full, run \`cmap checkpoint write --task "..." --next "..."\`.

## Git Safety Rules
Before making changes:
1. Run \`git status --short\`.
2. If there are existing user changes, do not overwrite, reset, restore, or delete them.
3. State which files you plan to edit.
4. Only edit files required for the current task.

Forbidden unless explicitly requested by the user:
- \`git reset --hard\`
- \`git checkout -- .\`
- \`git restore .\`
- \`git clean -fd\`
- deleting untracked research/context files
- overwriting \`AGENTS.md\` or \`CLAUDE.md\`

During work:
- Keep changes small and grouped by purpose.
- After each coherent slice, run targeted tests.
- Use \`git diff --check\` before finishing.
- Do not mix roadmap/doc cleanup with unrelated feature work.

Commit policy:
- Proactive commits are allowed after a coherent, verified work slice.
- Stage only task-related files.
- Report the commit hash after committing.
- Never commit unrelated user changes.

Rollback safety:
- End every task with changed files, verification run, warnings, and recommended rollback point.

## Tools
- \`cmap route "task"\` — locate relevant modules.
- \`cmap checkpoint read\` — read the current handoff.
- \`cmap checkpoint write --task "..." --next "..."\` — save the current handoff.
- \`cmap finish --compact\` — close the task with bounded AI-facing output.
- \`cmap verify\` — check project map consistency.
- \`cmap cp\` — move/copy/delete existing line blocks losslessly.
<!-- cmap:end -->
`;
}
