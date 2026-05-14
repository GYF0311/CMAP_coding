import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createTempProject, expectFile, runCmap } from "../helpers.js";

async function createProjectWithContext(name: string): Promise<string> {
  const cwd = await createTempProject(name);
  await runCmap(["init", "--auto"], cwd);
  await writeFile(
    path.join(cwd, ".context", "MAP.md"),
    `---
cmap_version: 0.1
context_type: map
project: ${name}
source_commit: unknown
updated_at: 2026-05-14T00:00:00.000Z
confidence: ai-drafted
---
# Project Map

## Purpose
English canonical purpose.
`
  );
  await mkdir(path.join(cwd, ".context", "modules"), { recursive: true });
  await writeFile(
    path.join(cwd, ".context", "modules", "view.md"),
    `---
cmap_version: 0.1
context_type: module
project: ${name}
source_commit: unknown
updated_at: 2026-05-14T00:00:00.000Z
confidence: ai-drafted
module: view
paths:
  - src/view
relations:
  reads:
    - evidence
---
# Module: view

## Purpose
Render a read-only HTML review dashboard.
`
  );
  return cwd;
}

describe("P0 i18n and config scaffold", () => {
  test("i18n export creates a zh-CN scaffold mirror without overwriting canonical context", async () => {
    const cwd = await createProjectWithContext("i18n-export");
    const canonicalBefore = await readFile(path.join(cwd, ".context", "MAP.md"), "utf8");

    const result = await runCmap(["i18n", "export", "--lang", "zh-CN"], cwd);

    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Exported zh-CN i18n scaffold");

    const mirroredMap = await expectFile(path.join(cwd, ".context", "i18n", "zh-CN", "MAP.md"));
    expect(mirroredMap).toContain("source_path: .context/MAP.md");
    expect(mirroredMap).toContain("English canonical purpose.");
    expect(mirroredMap).toContain("TODO(ai-translate)");

    const mirroredModule = await expectFile(path.join(cwd, ".context", "i18n", "zh-CN", "modules", "view.md"));
    expect(mirroredModule).toContain("module: view");
    expect(mirroredModule).toContain("paths:");
    expect(mirroredModule).toContain("Render a read-only HTML review dashboard.");
    expect(mirroredModule).toContain("TODO(ai-translate)");

    const rules = await expectFile(path.join(cwd, ".context", "i18n", "zh-CN", "TRANSLATION_RULES.md"));
    expect(rules).toContain("Only translate prose");
    expect(rules).toContain("Do not translate file paths, commands, module ids, code identifiers, schema names, or operation names.");
    expect(rules).toContain("Keep frontmatter and relations unchanged.");
    expect(rules).toContain("Do not overwrite canonical .context files.");

    await expect(readFile(path.join(cwd, ".context", "MAP.md"), "utf8")).resolves.toBe(canonicalBefore);
  });

  test("i18n check reports missing mirrors and accepts a complete export", async () => {
    const cwd = await createProjectWithContext("i18n-check");

    const missing = await runCmap(["i18n", "check", "--lang", "zh-CN"], cwd);

    expect(missing.code).toBe(1);
    expect(missing.stdout).toContain("Missing i18n mirror");
    expect(missing.stdout).toContain(".context/i18n/zh-CN/MAP.md");
    expect(missing.stdout).toContain(".context/i18n/zh-CN/modules/view.md");

    await runCmap(["i18n", "export", "--lang", "zh-CN"], cwd);
    const complete = await runCmap(["i18n", "check", "--lang", "zh-CN"], cwd);

    expect(complete).toMatchObject({ code: 0 });
    expect(complete.stdout).toContain("i18n mirror complete for zh-CN");
  });

  test("i18n export rejects output paths that would overwrite canonical context", async () => {
    const cwd = await createProjectWithContext("i18n-out-safety");
    const canonicalBefore = await readFile(path.join(cwd, ".context", "MAP.md"), "utf8");

    const canonicalOut = await runCmap(["i18n", "export", "--lang", "zh-CN", "--out", ".context"], cwd);
    const escapingOut = await runCmap(["i18n", "export", "--lang", "zh-CN", "--out", "../outside-i18n"], cwd);

    expect(canonicalOut.code).toBe(2);
    expect(canonicalOut.stderr).toContain("must not overlap canonical .context");
    expect(escapingOut.code).toBe(1);
    expect(escapingOut.stderr).toContain("Path escapes project root");
    await expect(readFile(path.join(cwd, ".context", "MAP.md"), "utf8")).resolves.toBe(canonicalBefore);
  });

  test("i18n export rejects canonical context subtrees as output", async () => {
    const cwd = await createProjectWithContext("i18n-canonical-subtree");

    const result = await runCmap(["i18n", "export", "--lang", "zh-CN", "--out", ".context/modules"], cwd);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("must not overlap canonical .context");
  });

  test("i18n export rejects output paths that escape through symlink ancestors", async () => {
    const cwd = await createProjectWithContext("i18n-symlink-out");
    const outside = await mkdtemp(path.join(tmpdir(), "cmap-i18n-outside-"));
    await symlink(outside, path.join(cwd, ".context", "i18n-link"));

    const result = await runCmap(["i18n", "export", "--lang", "zh-CN", "--out", ".context/i18n-link/zh-CN"], cwd);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Symlink escapes project root");
  });

  test("i18n export does not overwrite an existing translated mirror file", async () => {
    const cwd = await createProjectWithContext("i18n-preserve");
    await runCmap(["i18n", "export", "--lang", "zh-CN"], cwd);
    const mirrorPath = path.join(cwd, ".context", "i18n", "zh-CN", "modules", "view.md");
    await writeFile(mirrorPath, "human translation stays\n", "utf8");

    const result = await runCmap(["i18n", "export", "--lang", "zh-CN"], cwd);

    expect(result).toMatchObject({ code: 0 });
    await expect(readFile(mirrorPath, "utf8")).resolves.toBe("human translation stays\n");
  });

  test("config set/get persists the locale in .context/config.yml", async () => {
    const cwd = await createTempProject("config-locale");
    await runCmap(["init", "--auto"], cwd);

    const set = await runCmap(["config", "set", "locale", "zh-CN"], cwd);
    const get = await runCmap(["config", "get", "locale"], cwd);

    expect(set).toMatchObject({ code: 0 });
    expect(set.stdout).toContain("locale: zh-CN");
    expect(get).toMatchObject({ code: 0 });
    expect(get.stdout.trim()).toBe("zh-CN");

    const config = await expectFile(path.join(cwd, ".context", "config.yml"));
    expect(config).toContain("locale: zh-CN");
    expect(config).toContain("fallback_locale: en");
  });

  test("init --auto --lang writes locale config while keeping canonical templates in English", async () => {
    const cwd = await createTempProject("init-lang");

    const result = await runCmap(["init", "--auto", "--lang", "zh-CN"], cwd);

    expect(result).toMatchObject({ code: 0 });
    const config = await expectFile(path.join(cwd, ".context", "config.yml"));
    expect(config).toContain("locale: zh-CN");
    expect(config).toContain("fallback_locale: en");

    const map = await expectFile(path.join(cwd, ".context", "MAP.md"));
    expect(map).toContain("# Project Map");
    expect(map).toContain("TODO(ai-fill)");

    const get = await runCmap(["config", "get", "locale"], cwd);
    expect(get).toMatchObject({ code: 0 });
    expect(get.stdout.trim()).toBe("zh-CN");
  });
});
