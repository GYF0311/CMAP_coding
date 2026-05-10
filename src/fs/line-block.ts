export type TextDocument = {
  lines: string[];
  newline: string;
  trailingNewline: boolean;
};

export type LineRange = {
  start: number;
  end: number;
};

export function parseDocument(text: string): TextDocument {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const normalized = text.replace(/\r\n/g, "\n");
  const trailingNewline = normalized.endsWith("\n");
  const lines = normalized.split("\n");
  if (trailingNewline) {
    lines.pop();
  }
  return { lines, newline, trailingNewline };
}

export function serializeDocument(document: TextDocument): string {
  const text = document.lines.join(document.newline);
  return document.trailingNewline ? `${text}${document.newline}` : text;
}

export function parseLineRange(raw: string): LineRange {
  const match = /^(\d+)-(\d+)$/.exec(raw);
  if (!match) {
    throw new Error(`Invalid line range "${raw}". Expected start-end.`);
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new Error(`Invalid line range "${raw}". Expected positive start-end.`);
  }

  return { start, end };
}

export function selectLines(document: TextDocument, range: LineRange): string[] {
  ensureRangeWithinDocument(document, range);
  return document.lines.slice(range.start - 1, range.end);
}

export function removeLines(document: TextDocument, range: LineRange): TextDocument {
  ensureRangeWithinDocument(document, range);
  return {
    ...document,
    lines: [...document.lines.slice(0, range.start - 1), ...document.lines.slice(range.end)]
  };
}

export function insertLines(document: TextDocument, position: string, linesToInsert: string[]): TextDocument {
  const index = insertionIndex(document, position);
  return {
    ...document,
    lines: [...document.lines.slice(0, index), ...linesToInsert, ...document.lines.slice(index)]
  };
}

function insertionIndex(document: TextDocument, position: string): number {
  if (position === "start") {
    return 0;
  }
  if (position === "end") {
    return document.lines.length;
  }

  const line = Number(position);
  if (!Number.isInteger(line) || line < 1 || line > document.lines.length + 1) {
    throw new Error(`Invalid target position "${position}". Expected start, end, or line number.`);
  }
  return line - 1;
}

function ensureRangeWithinDocument(document: TextDocument, range: LineRange): void {
  if (range.end > document.lines.length) {
    throw new Error(`Line range ${range.start}-${range.end} exceeds document length ${document.lines.length}.`);
  }
}
