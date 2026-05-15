# Project: CMAP_coding

This project uses cmap: a shared project map for humans and AI coding agents.

## Start Here
1. Read `.context/CHECKPOINT.md` for the current handoff.
2. Read `.context/MAP.md` for the project map, then `.context/STATUS.md` for durable status.
3. Use `cmap route "<task>"` to find relevant modules.
4. Before editing a module, read its `.context/modules/<module>.md` file.
5. Before claiming done, run relevant verification, then `cmap finish` and `cmap verify --changed`.

## Current Direction
- Current roadmap: Trust Boundary + Human Review Layer.
- Review HTML is important: keep `cmap view export` focused on rendering existing `.context` map content.
- Review HTML uses English UI by default.
- Do not revive `i18n`, `zh-CN`, `locale`, translation mirrors, `init --lang`, `view --lang`, or `config locale` as the active roadmap.
- Future translation work, if needed, should be a separate candidate workflow and must not create a second maintained fact store.
- Do not revive import graph, route v2, or pack v2 as the active roadmap unless a new explicit plan supersedes this direction.
- AI relation candidates are allowed, but remain candidate-only until reviewed.
- Review HTML must not perform new semantic analysis; it renders the reviewed project map and support layers.

## Rules
- Do not read every `.context` file by default. Read by route.
- Do not treat `logs/`, `ideas/`, or `pending/` as canonical facts.
- Only `MAP.md`, `CHECKPOINT.md`, `STATUS.md`, `DECISIONS.md`, `VERIFY.md`, and `modules/*.md` are trusted project memory.
- If code changes module responsibilities, dependencies, data flow, or verification, update `.context`.
- If context is getting full, run `cmap checkpoint write --task "..." --next "..."`.

## Git Safety
- Run `git status --short` before making changes.
- Do not overwrite, reset, restore, or delete existing user changes.
- Do not use `git reset --hard`, `git checkout -- .`, `git restore .`, or `git clean -fd` unless the user explicitly asks.
- Delete files with `/usr/bin/trash`, not `rm`.
- Keep changes small and grouped by purpose.
- Never stage or commit unrelated user changes.

## Commit Policy
- Proactive commits are allowed in this project after a coherent, verified work slice.
- Before committing, inspect `git status --short`, stage only task-related files, run relevant verification, and use a specific commit message.
- Never commit unrelated user changes; if unrelated changes exist, leave them unstaged and report them.
- Report the commit hash after committing.

## Tools
- `cmap route "task"` — locate relevant modules.
- `cmap checkpoint read` — read the current handoff.
- `cmap checkpoint write --task "..." --next "..."` — save the current handoff.
- `cmap finish` — close the task and suggest context updates.
- `cmap verify` — check project map consistency.
- `cmap cp` — move/copy/delete existing line blocks losslessly.

<!-- cmap:start -->
## CMAP Project Map

This project uses cmap: a shared project map for humans and AI coding agents.

## Start Here
1. Read `.context/MAP.md` for the project map.
2. Read `.context/CHECKPOINT.md` for the current handoff, then `.context/STATUS.md` for durable status.
3. Use `cmap route "<task>"` to find relevant modules.
4. Before editing a module, read its `.context/modules/<module>.md` file.
5. Before claiming done, run `cmap finish` and `cmap verify --changed`.

## Rules
- Do not read every `.context` file by default. Read by route.
- Do not treat `logs/`, `ideas/`, `inbox/`, or generated files as canonical facts.
- Only `MAP.md`, `CHECKPOINT.md`, `STATUS.md`, `DECISIONS.md`, `VERIFY.md`, and `modules/*.md` are trusted project memory.
- If code changes module responsibilities, dependencies, data flow, or verification, update `.context`.
- If context is getting full, run `cmap checkpoint write --task "..." --next "..."`.

## Git Safety Rules
Before making changes:
1. Run `git status --short`.
2. If there are existing user changes, do not overwrite, reset, restore, or delete them.
3. State which files you plan to edit.
4. Only edit files required for the current task.

Forbidden unless explicitly requested by the user:
- `git reset --hard`
- `git checkout -- .`
- `git restore .`
- `git clean -fd`
- deleting untracked research/context files
- overwriting `AGENTS.md` or `CLAUDE.md`

During work:
- Keep changes small and grouped by purpose.
- After each coherent slice, run targeted tests.
- Use `git diff --check` before finishing.
- Do not mix roadmap/doc cleanup with unrelated feature work.

Commit policy:
- Proactive commits are allowed after a coherent, verified work slice.
- Stage only task-related files.
- Report the commit hash after committing.
- Never commit unrelated user changes.

Rollback safety:
- End every task with changed files, verification run, warnings, and recommended rollback point.

## Tools
- `cmap route "task"` — locate relevant modules.
- `cmap checkpoint read` — read the current handoff.
- `cmap checkpoint write --task "..." --next "..."` — save the current handoff.
- `cmap finish` — close the task and suggest context updates.
- `cmap verify` — check project map consistency.
- `cmap cp` — move/copy/delete existing line blocks losslessly.
<!-- cmap:end -->
