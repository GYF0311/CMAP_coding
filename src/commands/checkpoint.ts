import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

type CheckpointOptions = {
  fromStdin?: boolean;
  goal?: string;
  done?: string;
  leftOff?: string;
  next?: string;
  files?: string;
  risks?: string;
  verified?: string;
};

export async function runCheckpoint(cwd: string, options: CheckpointOptions): Promise<void> {
  const statusPath = path.join(cwd, ".context", "STATUS.md");

  if (options.fromStdin) {
    const stdin = await readStdin();
    if (!stdin.trim()) {
      throw new Error("checkpoint --from-stdin received empty input");
    }
    await writeFile(statusPath, ensureTrailingNewline(stdin), "utf8");
    process.stdout.write("Updated .context/STATUS.md\n");
    return;
  }

  const current = await readFile(statusPath, "utf8");
  const parsed = matter(current);
  const data = {
    ...parsed.data,
    updated_at: new Date().toISOString()
  };

  const body = `# Status

## Active Goal
${requiredValue(options.goal, "goal")}

## Done Recently
${requiredValue(options.done, "done")}

## Left Off
${requiredValue(options.leftOff, "left-off")}

## Next Steps
${requiredValue(options.next, "next")}

## Changed Files
${formatFiles(options.files)}

## Risks
${options.risks?.trim() || "None recorded."}

## Last Verified
${options.verified?.trim() || "Not recorded."}
`;

  const updated = matter.stringify(body, data);
  await writeFile(statusPath, ensureTrailingNewline(updated), "utf8");
  process.stdout.write("Updated .context/STATUS.md\n");
}

function requiredValue(value: string | undefined, optionName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`checkpoint requires --${optionName}`);
  }
  return trimmed;
}

function formatFiles(files: string | undefined): string {
  const parsed = (files ?? "")
    .split(",")
    .map((file) => file.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    return "None recorded.";
  }

  return parsed.map((file) => `- ${file}`).join("\n");
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
