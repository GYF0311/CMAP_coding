---
cmap_version: 0.1
context_type: decision
project: CMAP_coding
source_commit: unknown
updated_at: 2026-05-10T09:44:43.433Z
confidence: high
---
# Decisions

## 2026-05-10 — CLI does not generate trusted project semantics

**Context:** cmap's product boundary is that AI/user write project meaning, while the CLI performs deterministic maintenance.
**Decision:** `init` creates short templates and deterministic VERIFY command hints only. It leaves project purpose, module map, decisions, and current state as fillable memory.
**Why:** If the CLI invents module responsibilities or design decisions, `.context` becomes misleading instead of trustworthy.
**Impact:** Commands may create skeleton files, scan package scripts, and warn about TODO markers, but cannot promote candidates into canonical facts.
**Revisit if:** v0.2 adds AI-assisted suggestions; even then they must land in `pending/` until reviewed.

## 2026-05-10 — Test public CLI behavior through temporary projects

**Context:** M1 behavior is mostly file creation and process output.
**Decision:** Integration tests spawn the CLI in temporary directories and assert real files, stdout, and exit codes.
**Why:** This catches command wiring, cwd behavior, and filesystem side effects better than isolated function tests.
**Impact:** Tests use this repo's local `node_modules/.bin/tsx` as the loader, while cwd stays inside a temp project.
**Revisit if:** The package gains a stable built binary test harness.

## 2026-05-10 — Hook install writes project-local templates only

**Context:** v0.1 hooks should lower maintenance cost without taking over a host's global config or writing trusted memory.
**Decision:** `install --hooks reminder|maintain` writes JSON templates under `.context/hooks/` and `cmap hooks ...` only prints reminders.
**Why:** Project-local templates are inspectable, git-friendly, and avoid surprising host-level side effects.
**Impact:** Users or future installers can copy these templates into host configs, while `doctor` can still detect the project-local hook profile.
**Revisit if:** A later version adds explicit, confirmed host config installation.
