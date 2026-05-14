import { CmapCommandError } from "../errors.js";

export type Locale = "en" | "zh-CN";

export const supportedLocales: Locale[] = ["en", "zh-CN"];

export function parseLocale(value: string | undefined, label = "locale"): Locale {
  if (value === "en" || value === "zh-CN") {
    return value;
  }
  throw new CmapCommandError(`Unsupported ${label}: ${value ?? ""}. Expected one of: ${supportedLocales.join(", ")}`, 2);
}
