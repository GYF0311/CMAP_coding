export const CMAP_BLOCK_START = "<!-- cmap:start -->";
export const CMAP_BLOCK_END = "<!-- cmap:end -->";

const cmapBlockPattern = /<!-- cmap:start -->[\s\S]*?<!-- cmap:end -->/;

export type EntrypointMergeResult = {
  content: string;
  action: "merged" | "updated" | "appended";
};

export function mergeCmapBlock(existing: string, block: string): EntrypointMergeResult {
  const normalizedBlock = block.trimEnd();
  if (cmapBlockPattern.test(existing)) {
    return {
      content: ensureTrailingNewline(existing.replace(cmapBlockPattern, normalizedBlock)),
      action: "updated"
    };
  }

  return {
    content: appendCmapBlock(existing, block),
    action: "merged"
  };
}

export function appendCmapBlock(existing: string, block: string): string {
  return `${existing.trimEnd()}\n\n${block.trimEnd()}\n`;
}

export function hasCmapBlock(existing: string): boolean {
  return cmapBlockPattern.test(existing);
}

function ensureTrailingNewline(raw: string): string {
  return raw.endsWith("\n") ? raw : `${raw}\n`;
}
