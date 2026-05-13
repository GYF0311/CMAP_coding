import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type HookProfile = "none" | "reminder" | "maintain" | "observe" | "assist" | "strict";
export type HookHost = "claude" | "codex" | "both";
export type HookMode = "observe" | "assist" | "strict";

export async function writeHookTemplates(cwd: string, host: HookHost, profile: Exclude<HookProfile, "none">): Promise<string[]> {
  const hooksRoot = path.join(cwd, ".context", "hooks");
  await mkdir(hooksRoot, { recursive: true });
  const targets = host === "both" ? ["claude", "codex"] : [host];
  const written: string[] = [];

  for (const target of targets) {
    const filename = `${target}-${profile}.json`;
    const content = target === "claude" ? claudeHook(profile) : codexHook(profile);
    await writeFile(path.join(hooksRoot, filename), `${JSON.stringify(content, null, 2)}\n`, "utf8");
    written.push(`.context/hooks/${filename}`);
  }

  return written;
}

function claudeHook(profile: Exclude<HookProfile, "none">): object {
  return {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [{ type: "command", command: `cmap hooks session-start --profile ${profile}` }]
        }
      ],
      Stop: [{ hooks: [{ type: "command", command: `cmap hooks stop --profile ${profile}` }] }]
    }
  };
}

export function claudeLifecycleSettings(mode: HookMode): object {
  return {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [{ type: "command", command: `cmap hooks ingest --host claude --event SessionStart --mode ${mode}` }]
        }
      ],
      UserPromptSubmit: [
        {
          hooks: [{ type: "command", command: `cmap hooks ingest --host claude --event UserPromptSubmit --mode ${mode}` }]
        }
      ],
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit|Bash",
          hooks: [{ type: "command", command: `cmap hooks ingest --host claude --event PreToolUse --mode ${mode}` }]
        }
      ],
      PostToolUse: [
        {
          matcher: "Read|Write|Edit|MultiEdit|Bash",
          hooks: [{ type: "command", command: `cmap hooks ingest --host claude --event PostToolUse --mode ${mode}` }]
        }
      ],
      Stop: [{ hooks: [{ type: "command", command: `cmap hooks ingest --host claude --event Stop --mode ${mode}` }] }]
    }
  };
}

export function codexLifecycleSettings(mode: HookMode): object {
  return {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume|clear",
          hooks: [
            {
              type: "command",
              command: `cmap hooks ingest --host codex --event SessionStart --mode ${mode}`,
              statusMessage: "Loading cmap project map"
            }
          ]
        }
      ],
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `cmap hooks ingest --host codex --event UserPromptSubmit --mode ${mode}`,
              statusMessage: "Preparing cmap session brief"
            }
          ]
        }
      ],
      PreToolUse: [
        {
          matcher: "Bash|apply_patch|Edit|Write",
          hooks: [
            {
              type: "command",
              command: `cmap hooks ingest --host codex --event PreToolUse --mode ${mode}`,
              statusMessage: "Checking cmap context write policy"
            }
          ]
        }
      ],
      PostToolUse: [
        {
          matcher: "Bash|apply_patch|Edit|Write|Read",
          hooks: [
            {
              type: "command",
              command: `cmap hooks ingest --host codex --event PostToolUse --mode ${mode}`,
              statusMessage: "Recording cmap hook observation"
            }
          ]
        }
      ],
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: `cmap hooks ingest --host codex --event Stop --mode ${mode}`,
              timeout: 30,
              statusMessage: "Checking cmap closeout"
            }
          ]
        }
      ]
    }
  };
}

function codexHook(profile: Exclude<HookProfile, "none">): object {
  return {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [
            {
              type: "command",
              command: `cmap hooks session-start --profile ${profile}`,
              statusMessage: "Loading cmap project map reminder"
            }
          ]
        }
      ],
      Stop: [{ hooks: [{ type: "command", command: `cmap hooks stop --profile ${profile}`, timeout: 30 }] }]
    }
  };
}
