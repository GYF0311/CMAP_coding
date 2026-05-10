import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, runCmap } from "../helpers.js";

describe("verify L0 drift checks", () => {
  test("reports MAP module table docs that do not exist", async () => {
    const cwd = await createTempProject("verify-map-doc");
    await runCmap(["init", "--auto"], cwd);
    const mapPath = path.join(cwd, ".context", "MAP.md");
    const map = await readFile(mapPath, "utf8");
    await writeFile(
      mapPath,
      map.replace(
        "| TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) |",
        "| billing | Payments | `src/billing` | `.context/modules/billing.md` | billing |"
      ),
      "utf8"
    );

    const result = await runCmap(["verify"], cwd);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("MAP.md references missing module doc: .context/modules/billing.md");
  });

  test("warns when AGENTS.md and CLAUDE.md drift apart", async () => {
    const cwd = await createTempProject("verify-entrypoints");
    await runCmap(["init", "--auto"], cwd);
    await runCmap(["install", "--host", "both"], cwd);
    await writeFile(path.join(cwd, "CLAUDE.md"), "# Different\n", "utf8");

    const result = await runCmap(["verify"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("AGENTS.md and CLAUDE.md differ");
  });

  test("warns about TODO(ai-fill) inside module docs", async () => {
    const cwd = await createTempProject("verify-module-todo");
    await runCmap(["init", "--auto"], cwd);
    await mkdir(path.join(cwd, ".context", "modules"), { recursive: true });
    await writeFile(
      path.join(cwd, ".context", "modules", "chat.md"),
      `---
context_type: module
module: chat
paths:
  - src/chat
aliases:
  - chat
confidence: candidate
---
# Module: chat

## Purpose
TODO(ai-fill)
`,
      "utf8"
    );

    const result = await runCmap(["verify"], cwd);

    expect(result.stdout).toContain(".context/modules/chat.md contains TODO(ai-fill)");
  });

  test("warns when VERIFY.md omits package verification scripts", async () => {
    const cwd = await createTempProject("verify-missing-script");
    await writeFile(path.join(cwd, "package.json"), JSON.stringify({ scripts: { test: "vitest run", build: "vite build" } }), "utf8");
    await runCmap(["init", "--auto"], cwd);
    const verifyPath = path.join(cwd, ".context", "VERIFY.md");
    const verify = await readFile(verifyPath, "utf8");
    await writeFile(verifyPath, verify.replace("| build | `npm run build` | exit 0 | before release or handoff |\n", ""), "utf8");

    const result = await runCmap(["verify"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("VERIFY.md does not mention package script: build");
  });

  test("warns when pending updates exceed the v0.1 threshold", async () => {
    const cwd = await createTempProject("verify-pending-threshold");
    await runCmap(["init", "--auto"], cwd);
    await mkdir(path.join(cwd, ".context", "pending"), { recursive: true });
    for (const name of ["one", "two", "three", "four"]) {
      await writeFile(path.join(cwd, ".context", "pending", `${name}.md`), `# Pending ${name}\n`, "utf8");
    }

    const result = await runCmap(["verify"], cwd);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Pending: 4 pending updates need review");
  });
});
