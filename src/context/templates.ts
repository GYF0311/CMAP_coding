import path from "node:path";

export type TemplateInput = {
  projectName: string;
  updatedAt: string;
  sourceCommit: string;
  verifyCommands: VerifyCommand[];
};

export type VerifyCommand = {
  purpose: string;
  command: string;
  expected: string;
  when: string;
};

function frontmatter(input: TemplateInput, contextType: string, confidence = "ai-drafted"): string {
  return [
    "---",
    "cmap_version: 0.1",
    `context_type: ${contextType}`,
    `project: ${input.projectName}`,
    `source_commit: ${input.sourceCommit}`,
    `updated_at: ${input.updatedAt}`,
    `confidence: ${confidence}`,
    "---"
  ].join("\n");
}

export function contextTemplates(input: TemplateInput): Map<string, string> {
  const commands = input.verifyCommands.length
    ? input.verifyCommands
        .map((command) => `| ${command.purpose} | \`${command.command}\` | ${command.expected} | ${command.when} |`)
        .join("\n")
    : "| TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) | before claiming done |";

  return new Map([
    [
      "BRIEF.md",
      `${frontmatter(input, "brief")}
# Project Brief

## One-liner
TODO(ai-fill)

## Target Users
TODO(ai-fill)

## Core Use Cases
TODO(ai-fill)

## MVP Scope
TODO(ai-fill)

## Non-goals
TODO(ai-fill)

## Product Constraints
TODO(ai-fill)

## Current Stage
TODO(ai-fill)

## Notes for AI
TODO(ai-fill)
`
    ],
    [
      "MAP.md",
      `${frontmatter(input, "map")}
# Project Map

## Purpose
TODO(ai-fill)

## Tech Stack & Runtime
TODO(ai-fill)

## Entry Points
TODO(ai-fill)

## Module Map
| Module | Purpose | Paths | Doc | Aliases |
|---|---|---|---|---|
| TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) |

## Natural Language Route
| User Words | Module | Read First |
|---|---|---|
| TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) |

## Module Relationships
TODO(ai-fill)

## Data Flow
TODO(ai-fill)

## State / Storage
TODO(ai-fill)

## External Integrations
TODO(ai-fill)

## Risk Areas
TODO(ai-fill)

## Verification Summary
TODO(ai-fill)

## Handoff Notes
TODO(ai-fill)
`
    ],
    [
      "STATUS.md",
      `${frontmatter(input, "status")}
# Status

## Active Goal
TODO(ai-fill)

## Done Recently
TODO(ai-fill)

## Left Off
TODO(ai-fill)

## Next Steps
TODO(ai-fill)

## Changed Files
TODO(ai-fill)

## Risks
TODO(ai-fill)

## Last Verified
TODO(ai-fill)
`
    ],
    [
      "DECISIONS.md",
      `${frontmatter(input, "decision", "high")}
# Decisions

## YYYY-MM-DD — <title>

**Context:** TODO(ai-fill)
**Decision:** TODO(ai-fill)
**Why:** TODO(ai-fill)
**Impact:** TODO(ai-fill)
**Revisit if:** TODO(ai-fill)
`
    ],
    [
      "VERIFY.md",
      `${frontmatter(input, "verify")}
# Verification

## Required Commands
| Purpose | Command | Expected | When |
|---|---|---|---|
${commands}

## Module-specific Checks
| Module | Command | Manual Check |
|---|---|---|
| TODO(ai-fill) | TODO(ai-fill) | TODO(ai-fill) |

## Optional Commands
TODO(ai-fill)

## Manual Verification
TODO(ai-fill)

## Known Flaky Checks
TODO(ai-fill)

## Environment Assumptions
TODO(ai-fill)
`
    ],
    [
      path.join("logs", "_index.md"),
      `${frontmatter(input, "log", "medium")}
# Work Log Index

Recent work lives in \`.context/logs/current.md\`.
`
    ],
    [
      path.join("logs", "current.md"),
      `${frontmatter(input, "log", "medium")}
# Current Work Log

## YYYY-MM-DD — <task title>

**Goal:** TODO(ai-fill)
**Changed:** TODO(ai-fill)
**Tried:** TODO(ai-fill)
**Result:** TODO(ai-fill)
**Verification:** TODO(ai-fill)
**Memory Impact:** TODO(ai-fill)
**Next:** TODO(ai-fill)
`
    ],
    [
      path.join("ideas", "_inbox.md"),
      `${frontmatter(input, "idea", "low")}
# Idea Inbox

## YYYY-MM-DD — <idea title>

**Idea:** TODO(ai-fill)
**Status:** raw
**Source:** TODO(ai-fill)
**Why interesting:** TODO(ai-fill)
**Why not now:** TODO(ai-fill)
**Revisit if:** TODO(ai-fill)
`
    ],
    [
      path.join("ideas", "parking-lot.md"),
      `${frontmatter(input, "idea", "low")}
# Idea Parking Lot
`
    ],
    [
      path.join("ideas", "rejected.md"),
      `${frontmatter(input, "idea", "low")}
# Rejected Ideas
`
    ],
    [
      path.join("refs", "glossary.md"),
      `${frontmatter(input, "ref", "medium")}
# Glossary

| Term | Meaning |
|---|---|
| TODO(ai-fill) | TODO(ai-fill) |
`
    ]
  ]);
}

export const contextDirectories = ["modules", "logs", "ideas", "pending", "traps", "refs"];
