type HookOptions = {
  profile: "reminder" | "maintain";
};

export async function runHookSessionStart(_cwd: string, options: HookOptions): Promise<void> {
  process.stdout.write(`# cmap session reminder

- Read .context/MAP.md for the project map.
- Read .context/CHECKPOINT.md for the current handoff, then .context/STATUS.md for durable status.
- Use cmap route "<task>" before editing modules.
- Treat logs/, ideas/, and pending/ as non-canonical.

Profile: ${options.profile}
`);
}

export async function runHookStop(_cwd: string, options: HookOptions): Promise<void> {
  if (options.profile === "maintain") {
    process.stdout.write(`## cmap maintain reminder

Changed files may affect project context.

Please check:
1. Did module responsibility change?
2. Did module dependency change?
3. Did data flow change?
4. Was a new trap discovered?
5. Should CHECKPOINT.md or STATUS.md be updated?
6. Should a work log be added?

Suggested commands:
- cmap route "current task"
- cmap checkpoint write --task "current task" --next "next step"
- cmap verify --changed
`);
    return;
  }

  process.stdout.write(`## cmap reminder

Before ending work, consider:
- cmap checkpoint write --task "current task" --next "next step"
- cmap finish
- cmap verify --changed
`);
}
