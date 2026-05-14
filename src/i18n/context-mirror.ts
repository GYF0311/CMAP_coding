import { lstat, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";
import type { Locale } from "./locale.js";

export type I18nMirrorOptions = {
  lang: Locale;
  out?: string;
};

export type I18nMirrorResult = {
  targetRoot: string;
  written: string[];
  missing: string[];
};

const canonicalFiles = ["MAP.md", "STATUS.md", "CHECKPOINT.md", "DECISIONS.md", "VERIFY.md"];

async function i18nTargetRoot(cwd: string, options: I18nMirrorOptions): Promise<string> {
  const targetRoot = await resolveInsideRoot(cwd, options.out ?? path.join(".context", "i18n", options.lang));
  assertDoesNotOverlapCanonicalContext(cwd, targetRoot, options.out);
  await assertNoSymlinkAncestorEscape(cwd, targetRoot, options.out);
  return targetRoot;
}

function mirrorContent(raw: string, sourcePath: string, lang: Locale): string {
  const parsed = matter(raw);
  const body = parsed.content.trimEnd();
  return matter.stringify(
    [
      `> TODO(ai-translate): translate prose for ${lang}. Preserve facts and machine-readable identifiers.`,
      "",
      "## Original",
      body,
      "",
      "## Translation",
      "TODO(ai-translate)",
      ""
    ].join("\n"),
    {
      ...parsed.data,
      i18n_locale: lang,
      i18n_status: "pending-review",
      source_path: sourcePath
    }
  );
}

function translationRules(lang: Locale): string {
  return `# Translation Rules (${lang})

- Only translate prose.
- Do not change facts.
- Do not translate file paths, commands, module ids, code identifiers, schema names, or operation names.
- Keep frontmatter and relations unchanged.
- Do not overwrite canonical .context files.
- Write localized reading-layer content only under this i18n mirror directory.
- When a source section is unclear, keep the original text and leave TODO(ai-translate).
`;
}

async function sourceMirrorPairs(cwd: string, targetRoot: string): Promise<Array<[string, string]>> {
  const pairs: Array<[string, string]> = [];
  for (const filename of canonicalFiles) {
    pairs.push([path.join(cwd, ".context", filename), path.join(targetRoot, filename)]);
  }

  const modulesRoot = path.join(cwd, ".context", "modules");
  if (await fileExists(modulesRoot)) {
    const moduleFiles = (await readdir(modulesRoot))
      .filter((entry) => entry.endsWith(".md"))
      .sort((a, b) => a.localeCompare(b));
    for (const filename of moduleFiles) {
      pairs.push([path.join(modulesRoot, filename), path.join(targetRoot, "modules", filename)]);
    }
  }

  return pairs;
}

export async function exportI18nMirror(cwd: string, options: I18nMirrorOptions): Promise<I18nMirrorResult> {
  const targetRoot = await i18nTargetRoot(cwd, options);
  const pairs = await sourceMirrorPairs(cwd, targetRoot);
  const written: string[] = [];
  const missing: string[] = [];

  await mkdir(targetRoot, { recursive: true });
  await mkdir(path.join(targetRoot, "modules"), { recursive: true });

  for (const [source, target] of pairs) {
    if (!(await fileExists(source))) {
      missing.push(projectRelative(cwd, source));
      continue;
    }
    if (await fileExists(target)) {
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    const sourcePath = projectRelative(cwd, source);
    await writeFile(target, mirrorContent(await readFile(source, "utf8"), sourcePath, options.lang), "utf8");
    written.push(projectRelative(cwd, target));
  }

  const rulesPath = path.join(targetRoot, "TRANSLATION_RULES.md");
  await writeFile(rulesPath, translationRules(options.lang), "utf8");
  written.push(projectRelative(cwd, rulesPath));

  return { targetRoot, written, missing };
}

export async function checkI18nMirror(cwd: string, options: I18nMirrorOptions): Promise<I18nMirrorResult> {
  const targetRoot = await i18nTargetRoot(cwd, options);
  const pairs = await sourceMirrorPairs(cwd, targetRoot);
  const missing: string[] = [];

  for (const [source, target] of pairs) {
    if ((await fileExists(source)) && !(await fileExists(target))) {
      missing.push(projectRelative(cwd, target));
    }
  }

  const rulesPath = path.join(targetRoot, "TRANSLATION_RULES.md");
  if (!(await fileExists(rulesPath))) {
    missing.push(projectRelative(cwd, rulesPath));
  }

  return { targetRoot, written: [], missing };
}

function assertDoesNotOverlapCanonicalContext(cwd: string, targetRoot: string, rawOut: string | undefined): void {
  const contextRoot = path.resolve(cwd, ".context");
  const trustedRoots = [
    path.join(contextRoot, "modules"),
    path.join(contextRoot, "generated"),
    path.join(contextRoot, "graph"),
    path.join(contextRoot, "inbox"),
    path.join(contextRoot, "logs"),
    path.join(contextRoot, "refs")
  ];
  const trustedFiles = canonicalFiles.map((filename) => path.join(contextRoot, filename));
  if (
    targetRoot === contextRoot ||
    trustedRoots.some((trustedRoot) => isSameOrInside(targetRoot, trustedRoot)) ||
    trustedFiles.some((trustedFile) => isSameOrInside(targetRoot, trustedFile))
  ) {
    throw new CmapCommandError(
      `i18n output must not overlap canonical .context files: ${rawOut ?? projectRelative(cwd, targetRoot)}`,
      2
    );
  }
}

async function assertNoSymlinkAncestorEscape(cwd: string, targetRoot: string, rawOut: string | undefined): Promise<void> {
  let current = targetRoot;
  const root = path.resolve(cwd);
  const ancestors: string[] = [];
  while (isSameOrInside(current, root)) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  for (const ancestor of ancestors.reverse()) {
    try {
      const info = await lstat(ancestor);
      if (!info.isSymbolicLink()) {
        continue;
      }
      const resolved = await realpath(ancestor);
      if (!isSameOrInside(resolved, root)) {
        throw new CmapCommandError(
          `Symlink escapes project root: ${rawOut ?? projectRelative(cwd, targetRoot)} -> ${resolved}. The link target must also stay inside ${root}.`,
          2
        );
      }
    } catch (error) {
      if (error instanceof CmapCommandError) {
        throw error;
      }
      // Missing ancestors are about to be created and cannot already be escaping symlinks.
    }
  }
}

function isSameOrInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
