import { z } from "zod";

export const viewDataSchemaId = "cmap.view_data.v1";

export const CmapViewDataSchema = z.object({
  schema: z.literal(viewDataSchemaId),
  generatedAt: z.string(),
  sourceCommit: z.string().optional(),
  projectRootName: z.string(),
  included: z.object({
    generated: z.boolean(),
    inbox: z.boolean(),
    freshness: z.boolean()
  }),
  project: z.object({
    id: z.string(),
    name: z.string()
  }),
  overview: z.object({
    purpose: z.string().optional(),
    activeGoal: z.string().optional(),
    currentTask: z.string().optional(),
    nextStep: z.string().optional(),
    verified: z.string().optional(),
    lastVerified: z.string().optional()
  }),
  verify: z.object({
    requiredCommands: z.array(z.object({
      purpose: z.string(),
      command: z.string(),
      expected: z.string().optional(),
      when: z.string().optional()
    })),
    manualChecks: z.array(z.string())
  }),
  contextFiles: z.array(z.object({
    path: z.string(),
    title: z.string(),
    body: z.string(),
    sections: z.array(z.object({
      heading: z.string(),
      body: z.string()
    }))
  })),
  summary: z.object({
    moduleCount: z.number().int().nonnegative(),
    evidenceCount: z.number().int().nonnegative(),
    candidateCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative()
  }),
  sourceEvidence: z.object({
    included: z.boolean(),
    available: z.boolean(),
    generated: z.literal(true),
    canonical: z.literal(false),
    label: z.string(),
    index: z.object({
      generatedAt: z.string().optional(),
      gitHead: z.string().optional(),
      files: z.number().int().nonnegative(),
      symbols: z.number().int().nonnegative(),
      edges: z.number().int().nonnegative(),
      unresolvedRefs: z.number().int().nonnegative(),
      parseErrors: z.number().int().nonnegative()
    }).optional(),
    freshness: z.object({
      status: z.string(),
      indexedAt: z.string().optional(),
      gitHead: z.string().optional(),
      fresh: z.number().int().nonnegative(),
      stale: z.number().int().nonnegative(),
      missing: z.number().int().nonnegative(),
      error: z.number().int().nonnegative(),
      staleFiles: z.array(z.string()),
      missingFiles: z.array(z.string()),
      notes: z.array(z.string())
    }).optional(),
    records: z.array(z.object({
      id: z.string(),
      createdAt: z.string(),
      kind: z.string(),
      summary: z.string(),
      files: z.array(z.string()),
      confidence: z.number(),
      freshnessStatus: z.string(),
      truncated: z.boolean()
    })),
    omittedRecords: z.number().int().nonnegative(),
    unreadableRecords: z.array(z.string())
  }).optional(),
  modules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    docPath: z.string(),
    status: z.string(),
    layer: z.string(),
    risk: z.string(),
    aliases: z.array(z.string()),
    paths: z.array(z.string()),
    description: z.string().optional(),
    responsibilities: z.array(z.string()),
    keyContracts: z.array(z.string()),
    readNext: z.array(z.string()),
    sections: z.array(z.object({
      heading: z.string(),
      body: z.string()
    })),
    relations: z.array(z.object({
      type: z.string(),
      target: z.string(),
      why: z.string().optional(),
      produces: z.string().optional(),
      impact: z.string().optional()
    })),
    incomingRelations: z.array(z.object({
      type: z.string(),
      source: z.string(),
      why: z.string().optional(),
      produces: z.string().optional(),
      impact: z.string().optional()
    })),
    verifyCommands: z.array(z.string()),
    relatedCandidates: z.array(z.object({
      id: z.string(),
      file: z.string(),
      type: z.string(),
      risk: z.string(),
      summary: z.string()
    })),
    freshness: z.object({
      state: z.string(),
      lastReviewedAt: z.string(),
      newestGeneratedEvidenceAt: z.string(),
      pendingInboxCandidates: z.array(z.string())
    }),
    suggestedCommands: z.array(z.object({
      label: z.string(),
      command: z.string()
    })).default([])
  })),
  evidence: z.array(z.object({
    moduleId: z.string(),
    createdAt: z.string(),
    source: z.string(),
    summary: z.string(),
    files: z.array(z.string()),
    commands: z.array(z.string())
  })),
  candidates: z.array(z.object({
    id: z.string(),
    file: z.string(),
    type: z.string(),
    risk: z.string(),
    moduleId: z.string(),
    summary: z.string(),
    suggestedCommands: z.array(z.object({
      label: z.string(),
      command: z.string()
    })).default([])
  })),
  relationCandidates: z.array(z.object({
    id: z.string(),
    file: z.string(),
    from: z.string(),
    to: z.string(),
    relation: z.string(),
    summary: z.string(),
    suggestedCommands: z.array(z.object({
      label: z.string(),
      command: z.string()
    })).default([])
  })),
  warnings: z.array(z.string())
});

export type CmapViewData = z.infer<typeof CmapViewDataSchema>;
