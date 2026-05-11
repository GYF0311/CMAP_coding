import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

type CheckpointOptions = {
  fromStdin?: boolean;
  task?: string;
  hypothesis?: string;
  goal?: string;
  done?: string;
  leftOff?: string;
  next?: string;
  files?: string;
  risks?: string;
  verified?: string;
  failed?: string;
  doNotRedo?: string;
  status?: string;
};

export async function runCheckpoint(cwd: string, action: string | undefined, options: CheckpointOptions): Promise<void> {
  if (action === "read") {
    await readCheckpoint(cwd);
    return;
  }
  if (action === "write") {
    await writeCheckpoint(cwd, options);
    return;
  }
  if (action === "close") {
    await closeCheckpoint(cwd);
    return;
  }
  if (action === "clear") {
    await clearCheckpoint(cwd);
    return;
  }
  if (action) {
    throw new Error(`unknown checkpoint action: ${action}`);
  }

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

async function readCheckpoint(cwd: string): Promise<void> {
  const checkpointPath = path.join(cwd, ".context", "CHECKPOINT.md");
  try {
    const checkpoint = await readFile(checkpointPath, "utf8");
    process.stdout.write(checkpoint.endsWith("\n") ? checkpoint : `${checkpoint}\n`);
  } catch {
    const status = await readFile(path.join(cwd, ".context", "STATUS.md"), "utf8");
    process.stdout.write(status.endsWith("\n") ? status : `${status}\n`);
  }
}

async function writeCheckpoint(cwd: string, options: CheckpointOptions): Promise<void> {
  const checkpointPath = path.join(cwd, ".context", "CHECKPOINT.md");
  const current = await readOptional(checkpointPath);
  const parsed = current ? matter(current) : { data: {}, content: "" };
  const data = {
    ...parsed.data,
    context_type: "checkpoint",
    status: options.status?.trim() || "active",
    updated_at: new Date().toISOString()
  };

  const body = `# Current Checkpoint

## Current Task
${requiredValue(options.task, "task")}

## Current Hypothesis
${options.hypothesis?.trim() || "None recorded."}

## Changed Files
${formatFiles(options.files)}

## Verified
${options.verified?.trim() || "Not recorded."}

## Failed / Pending
${options.failed?.trim() || "None recorded."}

## Next Step
${requiredValue(options.next, "next")}

## Do Not Redo
${options.doNotRedo?.trim() || "None recorded."}
`;

  await writeFile(checkpointPath, ensureTrailingNewline(matter.stringify(body, data)), "utf8");
  process.stdout.write("Updated .context/CHECKPOINT.md\n");
}

async function closeCheckpoint(cwd: string): Promise<void> {
  const checkpointPath = path.join(cwd, ".context", "CHECKPOINT.md");
  const current = await readFile(checkpointPath, "utf8");
  const parsed = matter(current);
  const updated = matter.stringify(parsed.content, {
    ...parsed.data,
    status: "closed",
    updated_at: new Date().toISOString()
  });
  await writeFile(checkpointPath, ensureTrailingNewline(updated), "utf8");
  process.stdout.write("Closed .context/CHECKPOINT.md\n");
}

async function clearCheckpoint(cwd: string): Promise<void> {
  const checkpointPath = path.join(cwd, ".context", "CHECKPOINT.md");
  const data = {
    context_type: "checkpoint",
    status: "cleared",
    updated_at: new Date().toISOString()
  };
  const body = `# Current Checkpoint

## Current Task
None.

## Current Hypothesis
None.

## Changed Files
None.

## Verified
None.

## Failed / Pending
None.

## Next Step
None.

## Do Not Redo
None.
`;
  await writeFile(checkpointPath, ensureTrailingNewline(matter.stringify(body, data)), "utf8");
  process.stdout.write("Cleared .context/CHECKPOINT.md\n");
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

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}
