import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { CmapCommandError } from "../errors.js";
import { projectRelative } from "../fs/safe-path.js";
import { runInit } from "./init.js";
import { runInstall } from "./install.js";
import { runSkillExport } from "./skill.js";

type BootstrapOptions = {
  host?: string;
  lang?: string;
  skill?: boolean;
};

const validHosts = new Set(["claude", "codex", "both"]);
const validLocales = new Set(["en", "zh-CN"]);

export async function runBootstrap(cwd: string, options: BootstrapOptions): Promise<void> {
  const host = options.host ?? "both";
  if (!validHosts.has(host)) {
    throw new CmapCommandError(`Invalid bootstrap host "${host}". Expected claude, codex, or both.`, 2);
  }
  const lang = options.lang ?? "en";
  if (!validLocales.has(lang)) {
    throw new CmapCommandError(`Invalid bootstrap language "${lang}". Expected en or zh-CN.`, 2);
  }

  if (!(await fileExists(path.join(cwd, ".context")))) {
    await runInit(cwd, { auto: true, lang });
  }

  await runInstall(cwd, {
    host,
    hooks: "none",
    mode: "merge"
  });

  if (options.skill ?? true) {
    await runSkillExport(cwd, {
      host: skillHostForInstallHost(host),
      lang
    });
  }

  const startHerePath = path.join(cwd, ".context", "out", "start-here.md");
  await mkdir(path.dirname(startHerePath), { recursive: true });
  await writeFile(startHerePath, renderStartHere(lang), "utf8");
  process.stdout.write(`Wrote ${projectRelative(cwd, startHerePath)}\n`);
}

function skillHostForInstallHost(host: string): string {
  if (host === "codex" || host === "claude") {
    return host;
  }
  return "generic";
}

function renderStartHere(lang: string): string {
  if (lang === "zh-CN") {
    return `# Start Here with CMAP

这个项目使用 CMAP 项目地图。

给 AI agent：
1. 读取 \`.context/CHECKPOINT.md\`。
2. 读取 \`.context/MAP.md\`。
3. 运行 \`cmap route "<task>"\`。
4. 阅读 route 指向的模块文档。
5. 收尾前运行 \`cmap finish\` 和 \`cmap verify --changed\`。

给人类：
- 运行 \`cmap view export --lang zh-CN --out _cmap-view\`
- 打开 \`_cmap-view/index.html\`
`;
  }

  return `# Start Here with CMAP

This project uses the CMAP project map.

For AI agents:
1. Read \`.context/CHECKPOINT.md\`.
2. Read \`.context/MAP.md\`.
3. Run \`cmap route "<task>"\`.
4. Read routed module docs.
5. Run \`cmap finish\` and \`cmap verify --changed\` before done.

For humans:
- Run \`cmap view export --out _cmap-view\`
- Open \`_cmap-view/index.html\`
`;
}
