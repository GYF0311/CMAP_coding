import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { fileExists } from "../context/scanner.js";
import { isBaseRelationType, type BaseRelationType } from "../context/relation-schema.js";
import { loadModuleIndex } from "./module-index.js";

const relationOperationSchema = z.object({
  op: z.literal("relation.candidate.add"),
  relation: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1).optional(),
  risk: z.string().optional()
});

const aliasOperationSchema = z.object({
  op: z.literal("alias.candidate.add"),
  target_module: z.string().min(1),
  alias: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1).optional(),
  risk: z.string().optional()
});

const pathOperationSchema = z.object({
  op: z.literal("path.candidate.add"),
  target_module: z.string().min(1),
  path: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1).optional(),
  risk: z.string().optional()
});

const patchSchema = z.object({
  schema: z.literal("cmap.relation_patch.v1"),
  agent: z.string().optional(),
  task: z.string().optional(),
  summary: z.string().optional(),
  operations: z.array(z.union([relationOperationSchema, aliasOperationSchema, pathOperationSchema])).min(1)
});

type ParsedRelationPatch = z.infer<typeof patchSchema>;
type RelationOperation = z.infer<typeof relationOperationSchema>;
type AliasOperation = z.infer<typeof aliasOperationSchema> & { relation?: undefined };
type PathOperation = z.infer<typeof pathOperationSchema> & { relation?: undefined };

export type RelationPatchOperation = RelationOperation | AliasOperation | PathOperation;
export type RelationPatch = Omit<ParsedRelationPatch, "operations"> & {
  operations: RelationPatchOperation[];
};

export type RelationCandidate = {
  schema: "cmap.relation_candidate.v1";
  id: string;
  fingerprint: string;
  createdAt: string;
  operation: RelationPatchOperation["op"];
  relation?: BaseRelationType;
  from: string;
  to: string;
  summary: string;
  evidence: string[];
  confidence: number;
  risk: string;
  canonical: false;
};

export type RelationPatchEvaluation = {
  action: "inbox" | "reject" | "duplicate";
  reason?: string;
  fingerprint: string;
  candidate?: RelationCandidate;
  operation: RelationPatchOperation;
};

export function parseRelationPatch(raw: string): RelationPatch {
  const parsed = patchSchema.parse(JSON.parse(raw)) as RelationPatch;
  for (const operation of parsed.operations) {
    if (operation.op === "relation.candidate.add" && !isBaseRelationType(operation.relation)) {
      throw new Error(`Unknown relation type: ${operation.relation}. Add it to the relation schema first.`);
    }
  }
  return parsed;
}

export async function readRelationPatch(cwd: string, from: string): Promise<RelationPatch> {
  const target = path.resolve(cwd, from);
  return parseRelationPatch(await readFile(target, "utf8"));
}

export async function evaluateRelationPatch(cwd: string, patch: RelationPatch): Promise<RelationPatchEvaluation[]> {
  const modules = await loadModuleIndex(cwd);
  const moduleIds = new Set(modules.map((module) => module.id));
  const duplicateFingerprints = await existingRelationFingerprints(cwd);
  const timestamp = timestampForId(new Date());
  const evaluations: RelationPatchEvaluation[] = [];

  for (const operation of patch.operations) {
    const fingerprint = candidateFingerprint(operation);
    const candidate = toCandidate(operation, fingerprint, timestamp);
    const rejection = await validateOperation(cwd, operation, moduleIds);
    if (rejection) {
      evaluations.push({ action: "reject", reason: rejection, fingerprint, operation });
      continue;
    }
    if (duplicateFingerprints.has(fingerprint)) {
      evaluations.push({ action: "duplicate", reason: "duplicate fingerprint", fingerprint, candidate, operation });
      continue;
    }
    evaluations.push({ action: "inbox", fingerprint, candidate, operation });
  }

  return evaluations;
}

export async function existingRelationFingerprints(cwd: string): Promise<Set<string>> {
  const root = path.join(cwd, ".context", "inbox", "relations");
  const result = new Set<string>();
  if (!(await fileExists(root))) {
    return result;
  }
  for (const entry of await readdir(root)) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    try {
      const parsed = JSON.parse(await readFile(path.join(root, entry), "utf8")) as { fingerprint?: unknown };
      if (typeof parsed.fingerprint === "string") {
        result.add(parsed.fingerprint);
      }
    } catch {
      // Ignore malformed candidate files; verify can surface inbox hygiene separately.
    }
  }
  return result;
}

export function candidateFingerprint(operation: RelationPatchOperation): string {
  const stable = operation.op === "relation.candidate.add"
    ? {
        op: operation.op,
        from: operation.from,
        relation: operation.relation,
        to: operation.to,
        summary: operation.summary,
        evidence: [...operation.evidence].sort()
      }
    : operation.op === "alias.candidate.add"
      ? {
          op: operation.op,
          target_module: operation.target_module,
          alias: operation.alias,
          summary: operation.summary,
          evidence: [...operation.evidence].sort()
        }
      : {
          op: operation.op,
          target_module: operation.target_module,
          path: operation.path,
          summary: operation.summary,
          evidence: [...operation.evidence].sort()
        };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function toCandidate(operation: RelationPatchOperation, fingerprint: string, timestamp: string): RelationCandidate {
  if (operation.op === "relation.candidate.add") {
    if (!isBaseRelationType(operation.relation)) {
      throw new Error(`Unknown relation type: ${operation.relation}. Add it to the relation schema first.`);
    }
    return {
      schema: "cmap.relation_candidate.v1",
      id: `relation-${timestamp}-${fingerprint.slice(0, 10)}`,
      fingerprint,
      createdAt: new Date().toISOString(),
      operation: operation.op,
      relation: operation.relation,
      from: operation.from,
      to: operation.to,
      summary: operation.summary,
      evidence: operation.evidence,
      confidence: operation.confidence ?? 0.5,
      risk: operation.risk ?? "medium",
      canonical: false
    };
  }

  const target = operation.target_module;
  return {
    schema: "cmap.relation_candidate.v1",
    id: `relation-${timestamp}-${fingerprint.slice(0, 10)}`,
    fingerprint,
    createdAt: new Date().toISOString(),
    operation: operation.op,
    from: target,
    to: target,
    summary: operation.summary,
    evidence: operation.evidence,
    confidence: operation.confidence ?? 0.5,
    risk: operation.risk ?? "routine",
    canonical: false
  };
}

async function validateOperation(cwd: string, operation: RelationPatchOperation, moduleIds: Set<string>): Promise<string | undefined> {
  const modules = operation.op === "relation.candidate.add"
    ? [operation.from, operation.to]
    : [operation.target_module];
  for (const moduleId of modules) {
    if (!moduleIds.has(moduleId)) {
      return `missing module: ${moduleId}`;
    }
  }
  for (const evidence of operation.evidence) {
    if (!(await fileExists(path.join(cwd, evidence)))) {
      return `missing evidence: ${evidence}`;
    }
  }
  return undefined;
}

function timestampForId(value: Date): string {
  return value.toISOString().replace(/\.\d{3}z$/i, "").replace(/:/g, "-").toLowerCase();
}
