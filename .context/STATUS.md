---
cmap_version: 0.1
context_type: status
project: CMAP_coding
source_commit: unknown
updated_at: '2026-05-10T10:08:16.265Z'
confidence: ai-drafted
---
# Status

## Active Goal
Finish cmap v0.1 CLI and prepare release-facing docs

## Done Recently
M1-M5 command surface implemented: init/adopt/install/route/status/checkpoint/verify/finish/add-module/cp/log/idea/doctor/hooks

## Left Off
Core v0.1 commands are implemented and tested; README polish remains

## Next Steps
Write README first screen and usage examples, then run final verification and commit

## Changed Files
- src/commands/adopt.ts
- src/commands/add-module.ts
- src/commands/doctor.ts
- src/commands/hooks.ts
- src/hooks/templates.ts
- src/context/adoption-scanner.ts
- src/commands/install.ts
- tests/integration/m4m5.test.ts
- .context/MAP.md
- .context/modules/adoption.md
- .context/modules/module-docs.md
- .context/modules/hooks-doctor.md

## Risks
Hook templates are project-local and not automatically installed into host global config

## Last Verified
pnpm test, pnpm typecheck, and pnpm build passed after M4/M5 implementation
