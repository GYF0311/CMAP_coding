import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./scanner.js";

export type ContextPolicy = {
  autoApply: {
    checkpointWrite: boolean;
    checkpointClose: boolean;
    verificationRecord: boolean;
    evidenceAppend: boolean;
    statsUpdate: boolean;
    semanticUpdate: boolean;
    decisionAppend: boolean;
  };
  inbox: {
    maxPending: number;
    maxHighRisk: number;
  };
  generatedEvidence: {
    maxEntries: number;
  };
};

export const defaultContextPolicy: ContextPolicy = {
  autoApply: {
    checkpointWrite: true,
    checkpointClose: true,
    verificationRecord: true,
    evidenceAppend: true,
    statsUpdate: true,
    semanticUpdate: false,
    decisionAppend: false
  },
  inbox: {
    maxPending: 0,
    maxHighRisk: 0
  },
  generatedEvidence: {
    maxEntries: 10
  }
};

export async function loadContextPolicy(cwd: string): Promise<ContextPolicy> {
  const policyPath = path.join(cwd, ".context", "policy.yml");
  const policy = cloneDefaultPolicy();
  if (!(await fileExists(policyPath))) {
    return policy;
  }

  const raw = await readFile(policyPath, "utf8");
  let section = "";
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (!line.startsWith(" ") && trimmed.endsWith(":")) {
      section = trimmed.slice(0, -1);
      continue;
    }
    const match = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (!match) {
      continue;
    }
    assignPolicyValue(policy, section, match[1].trim(), parseScalar(match[2].trim()));
  }
  return policy;
}

export function renderDefaultPolicy(): string {
  return [
    "# cmap deterministic maintenance policy",
    "# AI can propose semantics; cmap only auto-applies bounded routine/generated updates.",
    "auto_apply:",
    "  checkpoint.write: true",
    "  checkpoint.close: true",
    "  verification.record: true",
    "  evidence.append: true",
    "  stats.update: true",
    "  semantic.update: false",
    "  decision.append: false",
    "inbox:",
    "  max_pending: 0",
    "  max_high_risk: 0",
    "generated_evidence:",
    "  max_entries: 10",
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

function assignPolicyValue(policy: ContextPolicy, section: string, key: string, value: string | number | boolean): void {
  if (section === "auto_apply" && typeof value === "boolean") {
    const mapped = autoApplyKey(key);
    if (mapped) {
      policy.autoApply[mapped] = value;
    }
  }
  if (section === "inbox" && typeof value === "number") {
    if (key === "max_pending") {
      policy.inbox.maxPending = value;
    }
    if (key === "max_high_risk") {
      policy.inbox.maxHighRisk = value;
    }
  }
  if (section === "generated_evidence" && typeof value === "number") {
    if (key === "max_entries") {
      policy.generatedEvidence.maxEntries = value;
    }
  }
}

function autoApplyKey(key: string): keyof ContextPolicy["autoApply"] | undefined {
  const map: Record<string, keyof ContextPolicy["autoApply"]> = {
    "checkpoint.write": "checkpointWrite",
    "checkpoint.close": "checkpointClose",
    "verification.record": "verificationRecord",
    "evidence.append": "evidenceAppend",
    "stats.update": "statsUpdate",
    "semantic.update": "semanticUpdate",
    "decision.append": "decisionAppend"
  };
  return map[key];
}
