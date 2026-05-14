import { describe, expect, test } from "vitest";
import { redactViewData } from "../../src/view/render.js";
import type { CmapViewData } from "../../src/view/schema.js";

function withSummary(summary: string): CmapViewData {
  return {
    schema: "cmap.view_data.v1",
    generatedAt: "2026-05-14T00:00:00Z",
    projectRootName: "test",
    included: { generated: false, inbox: false, freshness: false },
    project: { id: "test", name: "test" },
    overview: { currentTask: summary, lastVerified: "" },
    verify: { requiredCommands: [], manualChecks: [] },
    summary: { moduleCount: 0, evidenceCount: 0, candidateCount: 0, warningCount: 0 },
    modules: [],
    evidence: [],
    candidates: [],
    relationCandidates: [],
    warnings: []
  };
}

function extractSummary(redacted: CmapViewData): string {
  return redacted.overview.currentTask ?? "";
}

describe("view redaction", () => {
  test("redacts api_key/token/secret/password (baseline)", () => {
    const result = extractSummary(redactViewData(withSummary("api_key=AKIA1234567890ABCDEF and token: secret-token-value")));
    expect(result).toContain("api_key=[REDACTED]");
    expect(result).toContain("token: [REDACTED]");
  });

  test("redacts Authorization header values", () => {
    const result = extractSummary(redactViewData(withSummary("Authorization: my-app-token-value-here")));
    expect(result).toContain("Authorization: [REDACTED]");
    expect(result).not.toContain("my-app-token-value-here");
  });

  test("redacts x-api-key header values", () => {
    const result = extractSummary(redactViewData(withSummary("x-api-key: hunter2-token-abc")));
    expect(result).toContain("x-api-key: [REDACTED]");
    expect(result).not.toContain("hunter2-token-abc");
  });

  test("redacts client_secret / access_key / refresh_token / private_key cloud SDK idioms", () => {
    const result = extractSummary(redactViewData(withSummary("client_secret=CS-VALUE access_key=AK-VALUE refresh_token=RT-VALUE private_key=PK-VALUE")));
    expect(result).toContain("client_secret=[REDACTED]");
    expect(result).toContain("access_key=[REDACTED]");
    expect(result).toContain("refresh_token=[REDACTED]");
    expect(result).toContain("private_key=[REDACTED]");
    expect(result).not.toContain("CS-VALUE");
    expect(result).not.toContain("AK-VALUE");
    expect(result).not.toContain("RT-VALUE");
    expect(result).not.toContain("PK-VALUE");
  });

  test("redacts PEM private key blocks (RSA / OPENSSH / EC)", () => {
    const block = "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Q\n-----END RSA PRIVATE KEY-----";
    const result = extractSummary(redactViewData(withSummary(block)));
    expect(result).toContain("[REDACTED PRIVATE KEY]");
    expect(result).not.toContain("MIIBOgIBAAJBAKj");
  });

  test("retains Bearer redaction (baseline regression)", () => {
    const result = extractSummary(redactViewData(withSummary("Authorization header uses Bearer aaaaaaaaaaaaaaaa1234567890")));
    expect(result).toContain("Bearer [REDACTED]");
  });

  test("does not over-redact innocent identifiers", () => {
    const result = extractSummary(redactViewData(withSummary("This module handles user-tokenization in src/lib/tokens.ts")));
    // 'tokenization' or 'tokens.ts' should not be redacted because they aren't field=value patterns
    expect(result).toContain("tokenization");
    expect(result).toContain("tokens.ts");
  });
});
