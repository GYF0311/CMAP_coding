import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";
import { projectRelative, resolveInsideRoot } from "../fs/safe-path.js";

type ReconcileOptions = {
  adapter?: string;
  from?: string;
  dryRun?: boolean;
  writeInbox?: boolean;
};

type CandidateKind = "module_fact" | "decision" | "verification" | "phase_note" | "conflict";

type ReconcileCandidate = {
  kind: CandidateKind;
  summary: string;
  sourcePath: string;
  confidence: "low" | "medium";
};

export async function runReconcile(cwd: string, options: ReconcileOptions): Promise<void> {
  const adapter = normalizeAdapter(options.adapter);
  const from = options.from || (adapter === "gsd-v2" ? ".gsd" : ".planning");
  const sourceRoot = await resolveInsideRoot(cwd, from);
  if (!(await fileExists(sourceRoot))) {
    process.stdout.write(`No ${adapter} source found at ${projectRelative(cwd, sourceRoot)}\n`);
    return;
  }

  const candidates = await collectCandidates(cwd, sourceRoot);
  const report = renderReconcileReport(adapter, projectRelative(cwd, sourceRoot), candidates);
  if (options.writeInbox && candidates.length > 0) {
    const inboxRoot = path.join(cwd, ".context", "inbox");
    await mkdir(inboxRoot, { recursive: true });
    const target = path.join(inboxRoot, `${adapter}-${dateStamp()}.md`);
    await writeFile(target, report, "utf8");
    process.stdout.write(`Wrote ${projectRelative(cwd, target)}\n`);
    return;
  }

  process.stdout.write(report);
}

async function collectCandidates(cwd: string, sourceRoot: string): Promise<ReconcileCandidate[]> {
  const files = await listMarkdownFiles(sourceRoot);
  const candidates: ReconcileCandidate[] = [];

  for (const file of files) {
    const raw = await readFile(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const summary = normalizeCandidateLine(line);
      if (!summary) {
        continue;
      }
      const kind = classify(summary);
      if (!kind) {
        continue;
      }
      candidates.push({
        kind,
        summary,
        sourcePath: projectRelative(cwd, file),
        confidence: summary.startsWith("#") ? "medium" : "low"
      });
      if (candidates.length >= 80) {
        return candidates;
      }
    }
  }

  return candidates;
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const info = await stat(root);
  if (info.isFile()) {
    return root.endsWith(".md") ? [root] : [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function normalizeCandidateLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 8) {
    return "";
  }
  if (/^[-*]\s+\[[ x]\]\s*$/i.test(trimmed)) {
    return "";
  }
  return trimmed.replace(/^[-*]\s+/, "").slice(0, 240);
}

function classify(value: string): CandidateKind | undefined {
  if (/(conflict|contradict|冲突|矛盾)/i.test(value)) {
    return "conflict";
  }
  if (/(decision|decided|choose|chose|adr|决定|决策|取舍)/i.test(value)) {
    return "decision";
  }
  if (/(verified|verification|test passed|npm run|pnpm|yarn|验证|测试|通过)/i.test(value)) {
    return "verification";
  }
  if (/(module|responsibilit|owns|owner|path|模块|职责|路径|归属)/i.test(value)) {
    return "module_fact";
  }
  if (/(phase|milestone|sprint|progress|阶段|里程碑|进度)/i.test(value)) {
    return "phase_note";
  }
  return undefined;
}

function renderReconcileReport(adapter: string, sourceRoot: string, candidates: ReconcileCandidate[]): string {
  const lines = [
    `# ${adapter} Reconcile Dry Run`,
    "",
    `Source: \`${sourceRoot}\``,
    "",
    "This report is candidate input only. It does not modify canonical `.context` facts.",
    ""
  ];

  for (const kind of ["module_fact", "decision", "verification", "phase_note", "conflict"] as CandidateKind[]) {
    const group = candidates.filter((candidate) => candidate.kind === kind);
    lines.push(`## ${kind}`);
    lines.push("");
    if (group.length === 0) {
      lines.push("- None");
    } else {
      for (const candidate of group) {
        lines.push(`- ${candidate.summary}`);
        lines.push(`  - source: \`${candidate.sourcePath}\``);
        lines.push(`  - confidence: ${candidate.confidence}`);
      }
    }
    lines.push("");
  }

  lines.push(
    "## Suggested Action",
    "",
    "- Review candidates manually.",
    "- Promote only durable facts into `.context/modules/*.md`, `.context/DECISIONS.md`, or `.context/VERIFY.md`.",
    "- Treat phase notes as temporary unless they should become checkpoint or verification evidence.",
    ""
  );

  return lines.join("\n");
}

function normalizeAdapter(value: string | undefined): "gsd-v1" | "gsd-v2" {
  return value === "gsd-v2" ? "gsd-v2" : "gsd-v1";
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
