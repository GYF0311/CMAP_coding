import { loadContextPolicy, validateContextPolicy } from "../context/policy.js";

export async function runPolicyShow(cwd: string): Promise<void> {
  const policy = await loadContextPolicy(cwd);
  process.stdout.write(`${JSON.stringify(policy, null, 2)}\n`);
}

export async function runPolicyValidate(cwd: string): Promise<number> {
  const result = await validateContextPolicy(cwd);
  const lines = [
    "# Policy Validate",
    "",
    `Errors: ${result.errors.length}`,
    `Warnings: ${result.warnings.length}`,
    "",
    "## Issues",
    ""
  ];
  const issues = [...result.errors.map((item) => `error: ${item}`), ...result.warnings.map((item) => `warning: ${item}`)];
  lines.push(...(issues.length > 0 ? issues.map((item) => `- ${item}`) : ["- None"]));
  lines.push("");
  process.stdout.write(lines.join("\n"));
  return result.errors.length > 0 ? 1 : 0;
}
