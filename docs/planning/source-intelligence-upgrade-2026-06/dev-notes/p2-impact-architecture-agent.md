# P2 Impact / Architecture Agent Note

Date: 2026-06-04

## Scope

Implemented generated/non-canonical P2 advisory behavior for:

- `impact diff`
- `impact symbol`
- `source architecture`

This slice stays below the CMAP trust boundary. It writes no canonical `.context` facts and treats all source-derived architecture/impact claims as generated advisory evidence.

## Files Touched

- `src/source-intelligence/diff.ts`
- `src/source-intelligence/architecture.ts`
- `src/commands/impact.ts`
- `src/commands/source.ts`
- `tests/integration/source-intelligence-p2.test.ts`

## Behavior Notes

- `impact diff` can read explicit `--files` input or git diff sources, including staged changes. It aggregates per-file `impactFileWithProjectModules` reports into changed symbols, impacted symbols/files, likely tests, related CMAP modules, risk factors, freshness, confidence, and truncation metadata.
- `impact symbol` resolves a generated symbol query, reports callers/callees, and includes a file-impact fallback report. Ambiguous or missing symbols remain advisory and do not silently pick a candidate.
- `source architecture` reports entrypoints, hot files, hub symbols, unresolved areas, test coverage hints, and candidate-only architecture hints. Candidate hints are explicitly not reviewed module facts.

## Verification So Far

- Red test confirmed missing P2 fields before implementation:
  - `pnpm test tests/integration/source-intelligence-p2.test.ts` failed with missing diff source/freshness, missing symbol advisory fields, and missing architecture freshness.
- Green checks:
  - `pnpm test tests/integration/source-intelligence-p2.test.ts`
  - `pnpm typecheck`

## Risks / Follow-up

- `src/cli.ts` already had concurrent P2 command registration from main/another worker. This agent did not edit `src/cli.ts`.
- Architecture `--module` filtering is not wired in this slice because CLI registration is owned by main and the targeted tests call handlers directly.
- `impact diff` metrics are generated query metrics only; no canonical map/module relationship is updated.
