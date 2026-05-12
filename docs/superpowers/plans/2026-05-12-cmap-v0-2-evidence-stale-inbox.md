# cmap v0.2 Evidence, Stale Verify, and Inbox Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first v0.2 slice from the ChatGPT Pro research report: generated evidence, stale module checks, and inbox visibility.

**Architecture:** Keep `.context` canonical semantics protected. Add a generated evidence layer that can update bounded evidence blocks in module docs, add deterministic stale checks to `verify`, and expose `inbox status` so candidate semantic work cannot silently pile up.

**Tech Stack:** TypeScript CLI, Commander, gray-matter, Vitest integration tests, existing `.context/modules/*.md` frontmatter schema.

---

## File Structure

- Create `src/commands/evidence.ts`
  - Implements `cmap evidence append --module <id> --file <path> --summary <text> [--command <cmd>]`.
  - Resolves a module by id or alias from `loadModuleIndex`.
  - Verifies file evidence exists inside the project.
  - Appends or updates a bounded generated evidence section in the module doc.

- Create `src/commands/inbox.ts`
  - Implements `cmap inbox status`.
  - Counts `.context/inbox/*.md` files and classifies simple high-risk candidates by text markers.
  - Prints actionable next commands.

- Modify `src/commands/verify.ts`
  - Add `--stale`.
  - Warn when owned source files are newer than their module doc.
  - Warn when `.context/inbox` has review candidates, especially high-risk ones.

- Modify `src/cli.ts`
  - Wire `evidence append`, `inbox status`, and `verify --stale`.

- Add `tests/integration/m8-evidence-stale-inbox.test.ts`
  - TDD coverage for the new commands and stale checks.

- Update `README.md`, `.context/MAP.md`, `.context/STATUS.md`, `.context/VERIFY.md`, `.context/modules/verify.md`, `.context/modules/update-agent.md`, and add `.context/modules/evidence.md`.
  - Record the new v0.2 evidence/inbox/stale verify slice without expanding semantic auto-write permissions.

---

### Task 1: Failing Tests For Evidence, Inbox, And Stale Verify

**Files:**
- Create: `tests/integration/m8-evidence-stale-inbox.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { mkdir, readdir, readFile, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createEvidenceProject(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await mkdir(path.join(cwd, "src/commands"), { recursive: true });
  await writeFile(path.join(cwd, "src/commands/route.ts"), "export const route = true;\n", "utf8");
  await mkdir(path.join(cwd, ".context/modules"), { recursive: true });
  await writeFile(
    path.join(cwd, ".context/modules/route.md"),
    `---
context_type: module
module: route
paths:
  - src/commands/route.ts
aliases:
  - route
confidence: ai-drafted
---
# Module: route

## Purpose
Recommend module docs for a task.
`,
    "utf8"
  );
  return cwd;
}

describe("M8 evidence, stale verify, and inbox governance", () => {
  test("evidence append writes a bounded generated evidence block to a module doc", async () => {
    const cwd = await createEvidenceProject("m8-evidence");

    const result = await runCmap(
      [
        "evidence",
        "append",
        "--module",
        "route",
        "--file",
        "src/commands/route.ts",
        "--summary",
        "Route command was inspected while improving graph-aware routing.",
        "--command",
        "pnpm test tests/integration/m8-evidence-stale-inbox.test.ts"
      ],
      cwd
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Updated .context/modules/route.md");
    const routeDoc = await expectFile(path.join(cwd, ".context/modules/route.md"));
    expect(routeDoc).toContain("<!-- cmap:generated:evidence:start -->");
    expect(routeDoc).toContain("Route command was inspected while improving graph-aware routing.");
    expect(routeDoc).toContain("src/commands/route.ts");
    expect(routeDoc).toContain("pnpm test tests/integration/m8-evidence-stale-inbox.test.ts");
  });

  test("evidence append rejects missing file evidence and does not edit module docs", async () => {
    const cwd = await createEvidenceProject("m8-evidence-missing");
    const before = await expectFile(path.join(cwd, ".context/modules/route.md"));

    const result = await runCmap(
      ["evidence", "append", "--module", "route", "--file", "src/missing.ts", "--summary", "Missing evidence."],
      cwd
    );

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Evidence file does not exist: src/missing.ts");
    await expect(expectFile(path.join(cwd, ".context/modules/route.md"))).resolves.toBe(before);
  });

  test("inbox status reports review backlog and high-risk candidate count", async () => {
    const cwd = await createEvidenceProject("m8-inbox");
    await mkdir(path.join(cwd, ".context/inbox"), { recursive: true });
    await writeFile(path.join(cwd, ".context/inbox/one.md"), "# Candidate\nrisk: high\n", "utf8");
    await writeFile(path.join(cwd, ".context/inbox/two.md"), "# Candidate\nrisk: routine\n", "utf8");

    const result = await runCmap(["inbox", "status"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Total candidates: 2");
    expect(result.stdout).toContain("High-risk candidates: 1");
    expect(result.stdout).toContain("cmap inbox status");
  });

  test("verify --stale warns when owned source files are newer than their module doc", async () => {
    const cwd = await createEvidenceProject("m8-stale");
    const moduleDoc = path.join(cwd, ".context/modules/route.md");
    const ownedFile = path.join(cwd, "src/commands/route.ts");
    const oldTime = new Date("2020-01-01T00:00:00Z");
    const newTime = new Date("2020-01-02T00:00:00Z");
    await utimes(moduleDoc, oldTime, oldTime);
    await utimes(ownedFile, newTime, newTime);

    const result = await runCmap(["verify", "--stale"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Module doc may be stale: .context/modules/route.md");
    expect(result.stdout).toContain("src/commands/route.ts");
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```bash
pnpm test tests/integration/m8-evidence-stale-inbox.test.ts
```

Expected: FAIL because `evidence`, `inbox`, and `verify --stale` are not implemented.

---

### Task 2: Implement Evidence Append

**Files:**
- Create: `src/commands/evidence.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Add implementation**

Implement `runEvidenceAppend(cwd, options)` with:

- required `--module`, `--file`, `--summary`;
- optional `--command`;
- module lookup by id or alias;
- project-root path validation through `resolveInsideRoot`;
- generated section markers:
  - `<!-- cmap:generated:evidence:start -->`
  - `<!-- cmap:generated:evidence:end -->`
- bounded history of 10 latest bullets.

- [ ] **Step 2: Wire CLI**

Add:

```ts
const evidence = program.command("evidence").description("Maintain generated evidence notes");
evidence
  .command("append")
  .requiredOption("--module <id>", "Module id or alias")
  .requiredOption("--file <path>", "Project-relative evidence file")
  .requiredOption("--summary <text>", "Evidence summary")
  .option("--command <cmd>", "Verification command or shell evidence")
  .action(async (options) => {
    await runEvidenceAppend(process.cwd(), options);
  });
```

- [ ] **Step 3: Run focused test**

Run:

```bash
pnpm test tests/integration/m8-evidence-stale-inbox.test.ts
```

Expected: evidence tests pass; inbox/stale tests still fail.

---

### Task 3: Implement Inbox Status

**Files:**
- Create: `src/commands/inbox.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Add implementation**

Implement `runInboxStatus(cwd)`:

- read `.context/inbox/*.md`;
- count total candidates;
- count high-risk candidates by matching `risk: high`, `operation is marked high risk`, or `high-risk`;
- print next commands and say inbox files are candidate input, not canonical facts.

- [ ] **Step 2: Wire CLI**

Add:

```ts
const inbox = program.command("inbox").description("Inspect candidate context updates");
inbox.command("status").action(async () => {
  await runInboxStatus(process.cwd());
});
```

- [ ] **Step 3: Run focused test**

Run:

```bash
pnpm test tests/integration/m8-evidence-stale-inbox.test.ts
```

Expected: evidence and inbox tests pass; stale test still fails.

---

### Task 4: Implement Verify --stale

**Files:**
- Modify: `src/commands/verify.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Add option type and CLI flag**

Add `stale?: boolean` to `VerifyOptions` and wire:

```ts
.option("--stale", "Warn when module docs appear older than owned files or inbox has pending candidates")
```

- [ ] **Step 2: Add deterministic stale checks**

When `--stale` is passed:

- for each module path with no glob, compare module doc mtime to owned file/directory mtime;
- warn: `Module doc may be stale: <doc> is older than <file>`;
- inspect `.context/inbox/*.md` and warn about candidate backlog.

- [ ] **Step 3: Run focused test**

Run:

```bash
pnpm test tests/integration/m8-evidence-stale-inbox.test.ts
```

Expected: all M8 tests pass.

---

### Task 5: Docs And Context Updates

**Files:**
- Modify: `README.md`
- Modify: `.context/MAP.md`
- Modify: `.context/STATUS.md`
- Modify: `.context/VERIFY.md`
- Modify: `.context/modules/verify.md`
- Modify: `.context/modules/update-agent.md`
- Create: `.context/modules/evidence.md`

- [ ] **Step 1: Update README command list**

Document:

```bash
cmap evidence append --module route --file src/commands/route.ts --summary "..."
cmap inbox status
cmap verify --stale
```

- [ ] **Step 2: Update `.context`**

Record evidence/inbox/stale verify as v0.2 first slice. Keep boundary explicit:

```text
Generated evidence is deterministic support data.
Semantic module responsibilities still require review/promotion.
```

- [ ] **Step 3: Run project verification**

Run:

```bash
pnpm dev verify --changed --stale
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: all pass, with at most known warnings from currently changed research files if not mapped.

---

### Task 6: Save Progress

**Files:**
- Git commit selected implementation, docs, research result, and `.context` updates.

- [ ] **Step 1: Review changed files**

Run:

```bash
git status --short
git diff --stat
```

- [ ] **Step 2: Commit**

Run:

```bash
git add <implementation-and-doc-files>
git commit -m "feat: add evidence and stale map maintenance"
```

- [ ] **Step 3: Push**

Run:

```bash
git push
```

Expected: remote `main` receives the implementation commit.
