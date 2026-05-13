import { readFile } from "node:fs/promises";
import { stdin } from "node:process";
import { CmapCommandError } from "../errors.js";
import { restoreBackup } from "../fs/backup.js";
import { resolveInsideRoot } from "../fs/safe-path.js";
import {
  applyRoutineMapPatch,
  evaluateMapPatch,
  parseMapPatch,
  renderMapPatchApplyReport,
  renderMapPatchDryRun,
  writeMapPatchInbox
} from "../core/map-patch.js";
import { verifyContext } from "./verify.js";

type UpdateOptions = {
  agent?: boolean;
  from?: string;
  dryRun?: boolean;
  applyRoutine?: boolean;
  writeInbox?: boolean;
};

export async function runUpdate(cwd: string, options: UpdateOptions): Promise<void> {
  if (!options.agent) {
    throw new CmapCommandError("update currently requires --agent");
  }

  const patch = parseMapPatch(await readPatchInput(cwd, options.from));
  const evaluations = await evaluateMapPatch(cwd, patch);

  if (options.applyRoutine) {
    const before = await verifyContext(cwd);
    const result = await applyRoutineMapPatch(cwd, patch, evaluations);
    const after = await verifyContext(cwd);
    const newErrors = findNewErrors(before.issues, after.issues);
    if (newErrors.length > 0) {
      if (result.backupId) {
        await restoreBackup(cwd, result.backupId);
      }
      throw new CmapCommandError(
        [
          result.backupId
            ? `Post-verify found new errors; rolled back backup ${result.backupId}.`
            : "Post-verify found new errors; no backup was created for generated-only operations.",
          ...newErrors.map((message) => `- ${message}`)
        ].join("\n")
      );
    }
    process.stdout.write(renderMapPatchApplyReport(result));
    process.stdout.write("\nPost-verify: no new errors\n");
    return;
  }

  if (options.writeInbox) {
    const target = await writeMapPatchInbox(cwd, patch, evaluations);
    process.stdout.write(`Wrote ${target}\n`);
    return;
  }

  process.stdout.write(renderMapPatchDryRun(patch, evaluations));
}

export async function runUpdateRollback(cwd: string, backupId: string): Promise<void> {
  const restored = await restoreBackup(cwd, backupId);
  process.stdout.write(`Restored ${restored} files from backup ${backupId}\n`);
}

async function readPatchInput(cwd: string, from: string | undefined): Promise<string> {
  if (!from || from === "-") {
    return readStdin();
  }
  const source = await resolveInsideRoot(cwd, from);
  return readFile(source, "utf8");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body.trim()) {
    throw new CmapCommandError("update --agent requires --from <file> or JSON on stdin");
  }
  return body;
}

function findNewErrors(
  before: Array<{ level: "error" | "warning"; message: string }>,
  after: Array<{ level: "error" | "warning"; message: string }>
): string[] {
  const beforeErrors = new Set(before.filter((issue) => issue.level === "error").map((issue) => issue.message));
  return after
    .filter((issue) => issue.level === "error")
    .map((issue) => issue.message)
    .filter((message) => !beforeErrors.has(message));
}
