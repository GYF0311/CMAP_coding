---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-12T13:36:08+08:00'
confidence: ai-drafted
---
# Status

## Active Goal
Land the P0 AI-maintained map workflow without letting the CLI invent trusted project semantics.

## Done Recently
Added `cmap update --agent` as a MapPatch policy gate. It parses AI-authored JSON, classifies operations into routine apply / inbox / reject, applies only low-risk `CHECKPOINT.md` updates with backup/audit, routes semantic proposals to `.context/inbox/`, and supports `cmap update rollback <backupId>`. Added `finish --agent` to generate a local MapPatch request artifact under `.context/out/`.

## Left Off
Implementation and verification passed locally. Full test discovery was tightened to `tests/**/*.test.ts` after Vitest picked up historical test copies under `.context/out/`.

## Next Steps
Commit and push the MapPatch/update-agent implementation. Then dogfood `finish --agent` -> filled MapPatch -> `update --agent --apply-routine` on a real follow-up task before expanding auto-apply beyond checkpoint state.

## Changed Files
- README.md
- .context/MAP.md
- .context/CHECKPOINT.md
- .context/STATUS.md
- .context/VERIFY.md
- .context/modules/cli.md
- .context/modules/finish.md
- .context/modules/handoff.md
- .context/modules/update-agent.md
- src/cli.ts
- src/commands/finish.ts
- src/commands/update.ts
- src/core/map-patch.ts
- tests/integration/m7-update-agent.test.ts
- vitest.config.ts

## Risks
P0 intentionally does not auto-write module responsibilities, module relationships, `MAP.md`, `DECISIONS.md`, `VERIFY.md`, or code files. The main product risk is inbox candidates being ignored; future finish/verify work should keep pending candidates visible.

## Last Verified
2026-05-12: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm dev verify`, `pnpm smoke`, `pnpm dev route "AI 自动维护 MapPatch rollback inbox"`, and `git diff --check` passed.
