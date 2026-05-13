import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";
import { collectViewData } from "../view/collect.js";
import { readEmbeddedViewData, viewDataMatches } from "../view/check.js";
import { renderViewHtml } from "../view/render.js";

type ViewExportOptions = {
  out?: string;
  check?: boolean;
  singleFile?: boolean;
  includeGenerated?: boolean;
  includeInbox?: boolean;
  includeFreshness?: boolean;
};

type ViewOpenOptions = {
  out?: string;
};

const DEFAULT_VIEW_PATH = path.join(".context", "out", "cmap-view.html");
const DEFAULT_VIEW_DIR = "_cmap-view";

export async function runViewExport(cwd: string, options: ViewExportOptions): Promise<number> {
  const target = await resolveInsideRoot(cwd, outputPath(options));
  const data = await collectViewData(cwd);
  if (options.check) {
    if (!(await fileExists(target))) {
      process.stdout.write(`View output missing. Run cmap view export --out ${options.out ?? DEFAULT_VIEW_DIR}.\n`);
      return 1;
    }
    const current = await readEmbeddedViewData(target);
    if (!current || !viewDataMatches(current, data)) {
      process.stdout.write("View output is stale.\n");
      return 1;
    }
    process.stdout.write("View output is up to date.\n");
    return 0;
  }

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, renderViewHtml(data), "utf8");
  process.stdout.write(`Exported cmap view to ${projectRelative(cwd, target)}\n`);
  return 0;
}

export async function runViewOpen(cwd: string, options: ViewOpenOptions): Promise<void> {
  const target = await resolveInsideRoot(cwd, normalizeOutputPath(options.out ?? DEFAULT_VIEW_DIR, false));
  if (!(await fileExists(target))) {
    throw new CmapCommandError(`View export not found: ${projectRelative(cwd, target)}. Run cmap view export first.`, 2);
  }
  process.stdout.write(`${pathToFileURL(target).href}\n`);
}

function outputPath(options: ViewExportOptions): string {
  if (!options.out) {
    return options.singleFile ? DEFAULT_VIEW_PATH : path.join(DEFAULT_VIEW_DIR, "index.html");
  }
  return normalizeOutputPath(options.out, Boolean(options.singleFile));
}

function normalizeOutputPath(raw: string, singleFile: boolean): string {
  if (singleFile || raw.endsWith(".html")) {
    return raw;
  }
  return path.join(raw, "index.html");
}
