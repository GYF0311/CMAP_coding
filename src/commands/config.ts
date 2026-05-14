import { readCmapConfig, setConfigLocale } from "../i18n/config.js";
import { parseLocale } from "../i18n/locale.js";
import { CmapCommandError } from "../errors.js";

export async function runConfigGet(cwd: string, key: string): Promise<void> {
  if (key !== "locale") {
    throw new CmapCommandError(`Unsupported config key: ${key}`, 2);
  }
  const config = await readCmapConfig(cwd);
  process.stdout.write(`${config.locale}\n`);
}

export async function runConfigSet(cwd: string, key: string, value: string): Promise<void> {
  if (key !== "locale") {
    throw new CmapCommandError(`Unsupported config key: ${key}`, 2);
  }
  const locale = parseLocale(value);
  const config = await setConfigLocale(cwd, locale);
  process.stdout.write(`locale: ${config.locale}\n`);
}
