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
          hooks: [{ type: "command", command: `cmap hooks test --event SessionStart --mode ${mode}` }]
        }
      ],
      UserPromptSubmit: [
        {
          hooks: [{ type: "command", command: `cmap hooks test --event UserPromptSubmit --mode ${mode}` }]
        }
      ],
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit|Bash",
          hooks: [{ type: "command", command: `cmap hooks test --event PreToolUse --mode ${mode}` }]
        }
      ],
      PostToolUse: [
        {
          matcher: "Read|Write|Edit|MultiEdit|Bash",
          hooks: [{ type: "command", command: `cmap hooks test --event PostToolUse --mode ${mode}` }]
        }
      ],
      Stop: [{ hooks: [{ type: "command", command: `cmap hooks test --event Stop --mode ${mode}` }] }]
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
