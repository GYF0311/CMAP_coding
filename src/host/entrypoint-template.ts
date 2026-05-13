export function hostEntrypoint(projectName: string): string {
  return `# Project: ${projectName}

This project uses cmap: a shared project map for humans and AI coding agents.

## Start Here
1. Read \`.context/MAP.md\` for the project map.
2. Read \`.context/CHECKPOINT.md\` for the current handoff, then \`.context/STATUS.md\` for durable status.
3. Use \`cmap route "<task>"\` to find relevant modules.
4. Before editing a module, read its \`.context/modules/<module>.md\` file.
5. Before claiming done, run \`cmap finish\` and \`cmap verify --changed\`.

## Rules
- Do not read every \`.context\` file by default. Read by route.
- Do not treat \`logs/\`, \`ideas/\`, \`inbox/\`, or generated files as canonical facts.
- Only \`MAP.md\`, \`CHECKPOINT.md\`, \`STATUS.md\`, \`DECISIONS.md\`, \`VERIFY.md\`, and \`modules/*.md\` are trusted project memory.
- If code changes module responsibilities, dependencies, data flow, or verification, update \`.context\`.
- If context is getting full, run \`cmap checkpoint write --task "..." --next "..."\`.

## Tools
- \`cmap route "task"\` — locate relevant modules.
- \`cmap checkpoint read\` — read the current handoff.
- \`cmap checkpoint write --task "..." --next "..."\` — save the current handoff.
- \`cmap finish\` — close the task and suggest context updates.
- \`cmap verify\` — check project map consistency.
- \`cmap cp\` — move/copy/delete existing line blocks losslessly.
`;
}
