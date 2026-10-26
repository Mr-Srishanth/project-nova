/**
 * Tests for /api/ai/assist system-prompt selection (server/assistPrompt.ts).
 * The prompt itself lives in server/ (its only production caller is the
 * gateway); this file exists so it runs under the repo's normal Vitest
 * suite (vitest.config.ts includes src/** only).
 */
import { describe, expect, it } from "vitest";
import { buildAssistSystemPrompt, isSimpleAssistRequest } from "../../../server/assistPrompt";

describe("buildAssistSystemPrompt", () => {
  it("uses the plain-language prompt for the live student question", () => {
    const { system, simpleMode } = buildAssistSystemPrompt(
      "Hi, I am a student. Can you please explain in very simple words what this app does?",
    );
    expect(simpleMode).toBe(true);
    expect(system).toContain("simple words");
    expect(system).toContain("student");
    // The simple prompt must forbid the technical vocabulary, not demand it.
    expect(system).toMatch(/NEVER use/);
    expect(system).not.toContain("senior engineering lead");
  });

  it("uses the plain-language prompt for what-does-this-app-do", () => {
    expect(isSimpleAssistRequest("what does this app do?")).toBe(true);
    expect(buildAssistSystemPrompt("explain this website").simpleMode).toBe(true);
  });

  it("keeps the technical prompt for technical questions", () => {
    const { system, simpleMode } = buildAssistSystemPrompt(
      "What are the trade-offs of this architecture?",
    );
    expect(simpleMode).toBe(false);
    expect(system).toContain("senior engineering lead");
    expect(system).toContain("technical response");
  });
});
