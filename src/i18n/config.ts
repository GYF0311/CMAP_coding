import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import type { Locale } from "./locale.js";

export type CmapConfig = {
  locale: Locale;
  fallback_locale: Locale;
};

const defaultConfig: CmapConfig = {
  locale: "en",
  fallback_locale: "en"
};

export function configPath(cwd: string): string {
  return path.join(cwd, ".context", "config.yml");
}

export async function readCmapConfig(cwd: string): Promise<CmapConfig> {
  const target = configPath(cwd);
  if (!(await fileExists(target))) {
    return { ...defaultConfig };
  }

  const parsed = { ...defaultConfig };
  const raw = await readFile(target, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_]+):\s*(.+?)\s*$/);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    if ((key === "locale" || key === "fallback_locale") && (value === "en" || value === "zh-CN")) {
      parsed[key] = value;
    }
  }
  return parsed;
}

export function renderCmapConfig(config: CmapConfig): string {
  return [`locale: ${config.locale}`, `fallback_locale: ${config.fallback_locale}`, ""].join("\n");
}

export async function writeCmapConfig(cwd: string, config: CmapConfig): Promise<void> {
  await mkdir(path.join(cwd, ".context"), { recursive: true });
  await writeFile(configPath(cwd), renderCmapConfig(config), "utf8");
}

export async function setConfigLocale(cwd: string, locale: Locale): Promise<CmapConfig> {
  const current = await readCmapConfig(cwd);
  const next = { ...current, locale, fallback_locale: current.fallback_locale ?? "en" };
  await writeCmapConfig(cwd, next);
  return next;
}
