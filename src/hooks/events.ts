import { stdin } from "node:process";
import { CmapCommandError } from "../errors.js";

export type HookHost = "codex" | "claude" | "generic";
export type HookEventName = "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "Stop";
export type HookMode = "observe" | "assist" | "strict";

export type NormalizedHookEvent = {
  host: HookHost;
  event: HookEventName;
  mode: HookMode;
  cwd: string;
  sessionId?: string;
  turnId?: string;
  transcriptPath?: string;
  model?: string;
  source?: string;
  prompt?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResponse?: unknown;
  file?: string;
  command?: string;
  raw: unknown;
  receivedAt: string;
};

export async function readHookPayload(): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new CmapCommandError(`Invalid hook JSON payload: ${error instanceof Error ? error.message : String(error)}`, 2);
  }
}

export function normalizeHookPayload(input: {
  host: HookHost;
  event: HookEventName;
  mode: HookMode;
  cwd: string;
  raw: unknown;
}): NormalizedHookEvent {
  const raw = asRecord(input.raw) ?? {};
  const toolInput = raw.tool_input ?? raw.toolInput ?? asRecord(raw.tool)?.input;
  const toolResponse = raw.tool_response ?? raw.toolResponse ?? asRecord(raw.tool)?.output;
  const command = firstString([
    asRecord(toolInput)?.command,
    asRecord(toolInput)?.cmd,
    raw.command
  ]);
  return {
    host: input.host,
    event: input.event,
    mode: input.mode,
    cwd: firstString([raw.cwd]) ?? input.cwd,
    sessionId: firstString([raw.session_id, raw.sessionId]),
    turnId: firstString([raw.turn_id, raw.turnId]),
    transcriptPath: firstString([raw.transcript_path, raw.transcriptPath]),
    model: firstString([raw.model]),
    source: firstString([raw.source]),
    prompt: firstString([raw.prompt, raw.user_prompt, raw.userPrompt, raw.message, asRecord(raw.input)?.prompt]),
    toolName: firstString([raw.tool_name, raw.toolName, asRecord(raw.tool)?.name]),
    toolInput,
    toolResponse,
    file: firstString([
      raw.file,
      raw.file_path,
      raw.filePath,
      asRecord(toolInput)?.file_path,
      asRecord(toolInput)?.filePath,
      asRecord(toolInput)?.path,
      asRecord(toolInput)?.filename,
      firstPatchTarget(command)
    ]),
    command,
    raw: input.raw,
    receivedAt: new Date().toISOString()
  };
}

export function parseHookHost(value: string | undefined): HookHost {
  if (value === undefined || value === "codex") {
    return "codex";
  }
  if (value === "claude" || value === "generic") {
    return value;
  }
  throw new CmapCommandError(`Invalid hook host "${value}". Expected codex, claude, or generic.`, 2);
}

export function parseHookEventName(value: string | undefined): HookEventName {
  if (
    value === "SessionStart" ||
    value === "UserPromptSubmit" ||
    value === "PreToolUse" ||
    value === "PostToolUse" ||
    value === "Stop"
  ) {
    return value;
  }
  throw new CmapCommandError(`Invalid hook event "${value}". Expected SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, or Stop.`, 2);
}

function firstPatchTarget(command: string | undefined): string | undefined {
  if (!command) {
    return undefined;
  }
  const match = command.match(/^\*\*\* (?:Update|Delete) File: ([^\n\r]+)$/m) ?? command.match(/^\*\*\* Add File: ([^\n\r]+)$/m);
  return match?.[1]?.trim();
}

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}
