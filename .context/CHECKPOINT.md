---
context_type: checkpoint
status: active
updated_at: '2026-05-17T22:41:49+08:00'
source: manual
---
# Current Checkpoint

## Current Task
Verify structural heading policy for `.context`

## Current Hypothesis
The relevant "titles" are canonical `.context` Markdown structural headings (`#` / `##` anchors), not frontmatter `tags`. They should remain stable English parser anchors while body prose can be Chinese. `cmap verify` should surface non-English structural headings with exact file/title references and, when the set is large, tell agents to use a scripted dry-run batch rewrite instead of hand-editing one by one.

## Changed Files
- `src/commands/verify.ts`
- `tests/integration/verify-l0.test.ts`
- `.context/modules/verify.md`, `.context/modules/tests.md`, `.context/MAP.md`, `.context/VERIFY.md`
- `README.md`

## Verified
pnpm test tests/integration/verify-l0.test.ts; pnpm typecheck; pnpm test; pnpm build; pnpm dev verify --changed; git diff --check

## Failed / Pending
`pnpm dev verify --changed` exits 0 with 7 warnings because changed docs/context files are not mapped to modules in the current coverage table.

## Next Step
Run final checks, commit, and push the verify heading-policy slice.

## Do Not Redo
None recorded.
