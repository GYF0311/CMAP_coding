import { describe, expect, test } from "vitest";
import { createTempProject, runCmap } from "../helpers.js";

describe("CLI error boundary", () => {
  test("unknown commands are usage errors with exit code 2 and no duplicate message", async () => {
    const cwd = await createTempProject("cli-error-unknown");

    const result = await runCmap(["not-a-command"], cwd);

    expect(result.code).toBe(2);
    expect(result.stderr.match(/unknown command/g)).toHaveLength(1);
  });
});
