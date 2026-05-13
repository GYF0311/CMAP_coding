import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../context/scanner.js";

type DoctorOptions = {
  release?: boolean;
};

export async function runDoctor(cwd: string, options: DoctorOptions = {}): Promise<number> {
  if (options.release) {
    return runReleaseDoctor(cwd);
  }

  const lines = ["# cmap Doctor", ""];
  lines.push((await fileExists(path.join(cwd, ".context", "MAP.md"))) ? "✓ Context: present" : "✗ Context: missing");

  const agentsPath = path.join(cwd, "AGENTS.md");
  const claudePath = path.join(cwd, "CLAUDE.md");
  if ((await fileExists(agentsPath)) && (await fileExists(claudePath))) {
    const [agents, claude] = await Promise.all([readFile(agentsPath, "utf8"), readFile(claudePath, "utf8")]);
    lines.push(agents === claude ? "✓ Entrypoints: AGENTS.md and CLAUDE.md match" : "⚠ Entrypoints: AGENTS.md and CLAUDE.md differ");
  } else {
    lines.push("⚠ Entrypoints: missing AGENTS.md or CLAUDE.md");
  }

  const profiles = ["reminder", "maintain", "observe", "assist"];
  let foundProfile: string | undefined;
  for (const profile of profiles) {
    const templates = [
      path.join(cwd, ".context", "hooks", `claude-${profile}.json`),
      path.join(cwd, ".context", "hooks", `codex-${profile}.json`)
    ];
    if (await allExist(templates)) {
      foundProfile = profile;
      break;
    }
  }
  lines.push(foundProfile ? `✓ Hooks: ${foundProfile} templates present` : "ℹ Hooks: none installed");

  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

async function allExist(paths: string[]): Promise<boolean> {
  const results = await Promise.all(paths.map((item) => fileExists(item)));
  return results.every(Boolean);
}

async function runReleaseDoctor(cwd: string): Promise<number> {
  const report = {
    ok: [] as string[],
    warnings: [] as string[],
    errors: [] as string[]
  };
  const packagePath = path.join(cwd, "package.json");
  if (!(await fileExists(packagePath))) {
    report.errors.push("package.json is missing");
  } else {
    await checkPackageMetadata(packagePath, report);
  }

  for (const required of ["README.md", "LICENSE"]) {
    if (await fileExists(path.join(cwd, required))) {
      report.ok.push(`${required}: present`);
    } else {
      report.errors.push(`${required} is missing`);
    }
  }

  if (await fileExists(path.join(cwd, "dist", "cli.js"))) {
    report.ok.push("dist/cli.js: present");
  } else {
    report.errors.push("dist/cli.js is missing; run pnpm build");
  }

  if (await fileExists(path.join(cwd, ".github", "workflows"))) {
    report.ok.push("GitHub Actions workflow directory: present");
  } else {
    report.warnings.push("GitHub Actions workflow directory is missing");
  }

  const lines = [
    "# Release Doctor",
    "",
    `Errors: ${report.errors.length}`,
    `Warnings: ${report.warnings.length}`,
    "",
    "## Passing Checks",
    "",
    ...markdownList(report.ok),
    "",
    "## Issues",
    "",
    ...markdownList([
      ...report.errors.map((item) => `error: ${item}`),
      ...report.warnings.map((item) => `warning: ${item}`)
    ]),
    ""
  ];
  process.stdout.write(lines.join("\n"));
  return report.errors.length > 0 ? 1 : 0;
}

async function checkPackageMetadata(
  packagePath: string,
  report: { ok: string[]; warnings: string[]; errors: string[] }
): Promise<void> {
  const parsed = JSON.parse(await readFile(packagePath, "utf8")) as {
    description?: unknown;
    license?: unknown;
    repository?: unknown;
    engines?: { node?: unknown };
    files?: unknown;
    scripts?: Record<string, unknown>;
    dependencies?: Record<string, unknown>;
    devDependencies?: Record<string, unknown>;
  };
  if (typeof parsed.description === "string" && parsed.description.trim()) {
    report.ok.push("package description: present");
  } else {
    report.errors.push("package description is missing");
  }
  if (typeof parsed.license === "string" && parsed.license.trim()) {
    report.ok.push("package license: present");
  } else {
    report.errors.push("package license is missing");
  }
  if (parsed.repository && typeof parsed.repository === "object") {
    report.ok.push("package repository: present");
  } else {
    report.errors.push("package repository is missing");
  }
  if (typeof parsed.engines?.node === "string" && parsed.engines.node.trim()) {
    report.ok.push("package engines.node: present");
  } else {
    report.errors.push("package engines.node is missing");
  }
  if (Array.isArray(parsed.files) && parsed.files.includes("dist") && parsed.files.includes("README.md")) {
    report.ok.push("package files: present");
  } else {
    report.errors.push("package files must include dist and README.md");
  }
  if (typeof parsed.scripts?.prepack === "string" && parsed.scripts.prepack.trim()) {
    report.ok.push("prepack script: present");
  } else {
    report.warnings.push("prepack script is missing");
  }
  for (const [scope, deps] of [["dependencies", parsed.dependencies], ["devDependencies", parsed.devDependencies]] as const) {
    for (const [name, version] of Object.entries(deps ?? {})) {
      if (version === "latest") {
        report.errors.push(`${scope}.${name} uses latest`);
      }
    }
  }
}

function markdownList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- None"];
}
