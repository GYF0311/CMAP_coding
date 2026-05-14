import { checkI18nMirror, exportI18nMirror } from "../i18n/context-mirror.js";
import { parseLocale } from "../i18n/locale.js";

type I18nOptions = {
  lang?: string;
  out?: string;
};

export async function runI18nExport(cwd: string, options: I18nOptions): Promise<void> {
  const lang = parseLocale(options.lang, "lang");
  const result = await exportI18nMirror(cwd, { lang, out: options.out });
  process.stdout.write(`Exported ${lang} i18n scaffold (${result.written.length} files written)\n`);
  if (result.missing.length > 0) {
    process.stdout.write(`Skipped missing source files:\n${result.missing.map((item) => `- ${item}`).join("\n")}\n`);
  }
}

export async function runI18nCheck(cwd: string, options: I18nOptions): Promise<number> {
  const lang = parseLocale(options.lang, "lang");
  const result = await checkI18nMirror(cwd, { lang, out: options.out });
  if (result.missing.length > 0) {
    process.stdout.write(`Missing i18n mirror files for ${lang}:\n${result.missing.map((item) => `- ${item}`).join("\n")}\n`);
    return 1;
  }
  process.stdout.write(`i18n mirror complete for ${lang}\n`);
  return 0;
}
