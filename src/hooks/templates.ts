import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type HookProfile = "none" | "reminder" | "maintain" | "observe" | "assist";
export type HookHost = "claude" | "codex" | "both";

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
