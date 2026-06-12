import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./scanner.js";

export type ContextPolicy = {
  version: 2;
  autoApply: {
    checkpointWrite: boolean;
    checkpointClose: boolean;
    evidenceAppend: boolean;
    verificationEvidence: boolean;
    statsUpdate: boolean;
  };
  candidateOnly: Record<string, boolean>;
  blocked: Record<string, boolean>;
  inbox: {
    maxPending: number;
    maxHighRisk: number;
  };
  thresholds: {
    routineConfidence: number;
    evidenceConfidence: number;
    maxInboxPending: number;
    maxHighRisk: number;
    generatedEvidenceMaxEntries: number;
  };
  generatedEvidence: {
    maxEntries: number;
  };
  drift: {
    enabled: boolean;
    threshold: number;
    writeSignals: boolean;
    testWeight: number;
    excludeGlobs: string;
  };
};

export type PolicyValidation = {
  policy: ContextPolicy;
  warnings: string[];
  errors: string[];
};

export const defaultContextPolicy: ContextPolicy = {
  version: 2,
  autoApply: {
    checkpointWrite: true,
    checkpointClose: true,
    evidenceAppend: true,
    verificationEvidence: true,
    statsUpdate: true,
  },
  candidateOnly: {
    "status.update": true,
    "module.alias.add": true,
    "module.path.add": true,
    "module.semantic.update": true,
    "decision.record": true,
    "verify.policy.update": true
  },
  blocked: {
    "code.write": true,
    "shell.run": true,
    "module.delete": true,
    "module.rename": true,
    "map.semantic.overwrite": true
  },
  inbox: {
    maxPending: 0,
    maxHighRisk: 0
  },
  thresholds: {
    routineConfidence: 0.75,
    evidenceConfidence: 0.70,
    maxInboxPending: 0,
    maxHighRisk: 0,
    generatedEvidenceMaxEntries: 50
  },
  generatedEvidence: {
    maxEntries: 50
  },
  drift: {
    enabled: true,
    threshold: 0.3,
    writeSignals: false,
    testWeight: 0.05,
    excludeGlobs: ".context/generated/**,dist/**,node_modules/**"
  }
};

export async function loadContextPolicy(cwd: string): Promise<ContextPolicy> {
  return (await validateContextPolicy(cwd)).policy;
}

export async function validateContextPolicy(cwd: string): Promise<PolicyValidation> {
  const policyPath = path.join(cwd, ".context", "policy.yml");
  const policy = cloneDefaultPolicy();
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!(await fileExists(policyPath))) {
    return { policy, warnings, errors };
  }

  const raw = await readFile(policyPath, "utf8");
  let section = "";
  const seenTopLevel = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (!line.startsWith(" ") && trimmed.endsWith(":")) {
      section = trimmed.slice(0, -1);
      seenTopLevel.add(section);
      if (!["auto_apply", "candidate_only", "blocked", "thresholds", "inbox", "generated_evidence", "drift"].includes(section)) {
        warnings.push(`unknown policy section ${section}`);
      }
      continue;
    }
    const match = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (!match) {
      continue;
    }
    if (!section && match[1].trim() === "version") {
      const value = parseScalar(match[2].trim());
      if (value !== 2) {
        warnings.push(`unsupported policy version ${String(value)}; using v2 defaults for missing keys`);
      }
      continue;
    }
    assignPolicyValue(policy, section, match[1].trim(), parseScalar(match[2].trim()), warnings, errors);
  }
  if (seenTopLevel.size === 0 && raw.trim()) {
    warnings.push("policy file has no recognized sections");
  }
  return { policy, warnings, errors };
}

export function renderDefaultPolicy(): string {
  return [
    "# cmap deterministic maintenance policy",
    "# AI can propose semantics; cmap only auto-applies bounded routine/generated updates.",
    "version: 2",
    "",
    "auto_apply:",
    "  checkpoint.write: true",
    "  checkpoint.close: true",
    "  evidence.append: true",
    "  verification.evidence: true",
    "  stats.update: true",
    "",
    "candidate_only:",
    "  status.update: true",
    "  module.alias.add: true",
    "  module.path.add: true",
    "  module.semantic.update: true",
    "  decision.record: true",
    "  verify.policy.update: true",
    "",
    "blocked:",
    "  code.write: true",
    "  shell.run: true",
    "  module.delete: true",
    "  module.rename: true",
    "  map.semantic.overwrite: true",
    "",
    "thresholds:",
    "  routine_confidence: 0.75",
    "  evidence_confidence: 0.70",
    "  max_inbox_pending: 0",
    "  max_high_risk: 0",
    "  generated_evidence_max_entries: 50",
    "",
    "drift:",
    "  enabled: true",
    "  threshold: 0.3",
    "  write_signals: false",
    "  test_weight: 0.05",
    "  exclude_globs: \".context/generated/**,dist/**,node_modules/**\"",
    ""
  ].join("\n");
}

function cloneDefaultPolicy(): ContextPolicy {
  return JSON.parse(JSON.stringify(defaultContextPolicy)) as ContextPolicy;
}

function parseScalar(value: string): string | number | boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && value !== "" ? numeric : value;
}

function assignPolicyValue(
  policy: ContextPolicy,
  section: string,
  key: string,
  value: string | number | boolean,
  warnings: string[],
  errors: string[]
): void {
  if (section === "auto_apply") {
    if (typeof value !== "boolean") {
      errors.push(`invalid policy type auto_apply.${key}: expected boolean`);
      return;
    }
    const mapped = autoApplyKey(key);
    if (mapped) {
      policy.autoApply[mapped] = value;
      return;
    }
    warnings.push(`unknown policy key auto_apply.${key}`);
    return;
  }
  if (section === "candidate_only") {
    if (typeof value !== "boolean") {
      errors.push(`invalid policy type candidate_only.${key}: expected boolean`);
      return;
    }
    if (key in policy.candidateOnly) {
      policy.candidateOnly[key] = value;
    } else {
      warnings.push(`unknown policy key candidate_only.${key}`);
    }
    return;
  }
  if (section === "blocked") {
    if (typeof value !== "boolean") {
      errors.push(`invalid policy type blocked.${key}: expected boolean`);
      return;
    }
    if (key in policy.blocked) {
      policy.blocked[key] = value;
    } else {
      warnings.push(`unknown policy key blocked.${key}`);
    }
    return;
  }
  if (section === "thresholds") {
    if (typeof value !== "number") {
      errors.push(`invalid policy type thresholds.${key}: expected number`);
      return;
    }
    if (key === "routine_confidence") {
      policy.thresholds.routineConfidence = value;
      return;
    }
    if (key === "evidence_confidence") {
      policy.thresholds.evidenceConfidence = value;
      return;
    }
    if (key === "max_inbox_pending") {
      policy.thresholds.maxInboxPending = value;
      policy.inbox.maxPending = value;
      return;
    }
    if (key === "max_high_risk") {
      policy.thresholds.maxHighRisk = value;
      policy.inbox.maxHighRisk = value;
      return;
    }
    if (key === "generated_evidence_max_entries") {
      policy.thresholds.generatedEvidenceMaxEntries = value;
      policy.generatedEvidence.maxEntries = value;
      return;
    }
    warnings.push(`unknown policy key thresholds.${key}`);
    return;
  }
  if (section === "inbox") {
    if (typeof value !== "number") {
      errors.push(`invalid policy type inbox.${key}: expected number`);
      return;
    }
    if (key === "max_pending") {
      policy.inbox.maxPending = value;
      policy.thresholds.maxInboxPending = value;
      return;
    }
    if (key === "max_high_risk") {
      policy.inbox.maxHighRisk = value;
      policy.thresholds.maxHighRisk = value;
      return;
    }
    warnings.push(`unknown policy key inbox.${key}`);
    return;
  }
  if (section === "generated_evidence") {
    if (typeof value !== "number") {
      errors.push(`invalid policy type generated_evidence.${key}: expected number`);
      return;
    }
    if (key === "max_entries") {
      policy.generatedEvidence.maxEntries = value;
      policy.thresholds.generatedEvidenceMaxEntries = value;
      return;
    }
    warnings.push(`unknown policy key generated_evidence.${key}`);
    return;
  }
  if (section === "drift") {
    if (key === "enabled") {
      if (typeof value !== "boolean") {
        errors.push("invalid policy type drift.enabled: expected boolean");
        return;
      }
      policy.drift.enabled = value;
      return;
    }
    if (key === "threshold") {
      if (typeof value !== "number") {
        errors.push("invalid policy type drift.threshold: expected number");
        return;
      }
      policy.drift.threshold = value;
      return;
    }
    if (key === "write_signals") {
      if (typeof value !== "boolean") {
        errors.push("invalid policy type drift.write_signals: expected boolean");
        return;
      }
      policy.drift.writeSignals = value;
      return;
    }
    if (key === "test_weight") {
      if (typeof value !== "number") {
        errors.push("invalid policy type drift.test_weight: expected number");
        return;
      }
      policy.drift.testWeight = value;
      return;
    }
    if (key === "exclude_globs") {
      if (typeof value !== "string") {
        errors.push("invalid policy type drift.exclude_globs: expected string");
        return;
      }
      policy.drift.excludeGlobs = value;
      return;
    }
    warnings.push(`unknown policy key drift.${key}`);
  }
}

function autoApplyKey(key: string): keyof ContextPolicy["autoApply"] | undefined {
  const map: Record<string, keyof ContextPolicy["autoApply"]> = {
    "checkpoint.write": "checkpointWrite",
    "checkpoint.close": "checkpointClose",
    "evidence.append": "evidenceAppend",
    "verification.record": "verificationEvidence",
    "verification.evidence": "verificationEvidence",
    "stats.update": "statsUpdate"
  };
  return map[key];
}
