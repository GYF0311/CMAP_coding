import { readFile } from "node:fs/promises";

type PackageJson = {
  version?: string;
};

export async function readPackageVersion(): Promise<string> {
  const packageUrl = new URL("../package.json", import.meta.url);
  const raw = await readFile(packageUrl, "utf8");
  const parsed = JSON.parse(raw) as PackageJson;
  return parsed.version ?? "0.0.0";
}
