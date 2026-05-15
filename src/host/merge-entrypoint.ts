export const CMAP_BLOCK_START = "<!-- cmap:start -->";
export const CMAP_BLOCK_END = "<!-- cmap:end -->";

const cmapBlockPattern = /<!-- cmap:start -->[\s\S]*?<!-- cmap:end -->/;

export type EntrypointMergeResult = {
  content: string;
  action: "merged" | "updated";
};

export function mergeEntrypoint(existing: string, block: string): string {
  return mergeCmapBlock(existing, block).content;
}

export function mergeCmapBlock(existing: string, block: string): EntrypointMergeResult {
  const wrapped = block.trimEnd();
  if (!existing.trim()) {
    return {
      content: ensureTrailingNewline(wrapped),
      action: "merged"
    };
  }

  if (cmapBlockPattern.test(existing)) {
    return {
      content: ensureTrailingNewline(existing.replace(cmapBlockPattern, wrapped)),
      action: "updated"
    };
  }

  return {
    content: `${existing.trimEnd()}\n\n${wrapped}\n`,
    action: "merged"
  };
}

function ensureTrailingNewline(raw: string): string {
  return raw.endsWith("\n") ? raw : `${raw}\n`;
}
