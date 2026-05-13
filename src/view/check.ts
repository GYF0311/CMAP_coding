import { readFile } from "node:fs/promises";
import { type CmapViewData, CmapViewDataSchema } from "./schema.js";

const VOLATILE_KEYS = new Set(["generatedAt"]);

export function normalizeViewData(value: CmapViewData): unknown {
  return sortValue(stripVolatile(value));
}

export async function readEmbeddedViewData(htmlPath: string): Promise<CmapViewData | undefined> {
  const html = await readFile(htmlPath, "utf8");
  const match = html.match(/<script\s+type="application\/json"\s+id="cmap-view-data">([\s\S]*?)<\/script>/);
  if (!match) {
    return undefined;
  }
  return CmapViewDataSchema.parse(JSON.parse(match[1]));
}

export function viewDataMatches(left: CmapViewData, right: CmapViewData): boolean {
  return JSON.stringify(normalizeViewData(left)) === JSON.stringify(normalizeViewData(right));
}

function stripVolatile(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripVolatile);
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (!VOLATILE_KEYS.has(key)) {
        result[key] = stripVolatile(child);
      }
    }
    return result;
  }
  return value;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)])
    );
  }
  return value;
}
