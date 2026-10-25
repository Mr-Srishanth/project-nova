import { describe, it, expect, vi } from "vitest";
import { aiClient } from "@/lib/ai/client";
import { sanitizeString } from "@/lib/observability/sanitizer";
import type { CodeExplanationResult } from "@/types/codeExplainer";

describe("AI Code Explainer Service Contract & Security", () => {
  it("sanitizes API keys, secrets, and bearer tokens before payload transmission", () => {
    const rawSnippet = `
      const GEMINI_KEY = "AIzaSyABC123456789012345678901234567";
      const bearer = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz123";
      export function fetchSecret() {
        return fetch("/api/data", { headers: { Authorization: bearer } });
      }
    `;

    const sanitized = sanitizeString(rawSnippet);

    expect(sanitized).not.toContain("AIzaSyABC123456789012345678901234567");
    expect(sanitized).toContain("[REDACTED_SECRET]");
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz123");
  });

  it("calls /explain-code endpoint with valid payload for ELI5 mode", async () => {
    const mockResult: CodeExplanationResult = {
      mode: "eli5",
      fileName: "App.tsx",
      atAGlance: "This file is like the conductor of an orchestra.",
      howItWorks: [
        {
          step: 1,
          title: "Starting Up",
          explanation: "Loads user settings and sets up the screen.",
          lines: "1-10",
        },
      ],
      breakdown: [
        {
          name: "App",
          kind: "component",
          lines: "5-25",
          simpleExplanation: "The main toy box holding all the buttons.",
          analogy: "Like the master frame of a dollhouse.",
        },
      ],
      example: {
        scenario: "When the user clicks the button",
        walkthrough: "The counter goes up from 0 to 1.",
      },
      connections: [
        {
          target: "react",
          relationship: "Borrowed tool to build interactive blocks",
        },
      ],
      thingsToNotice: ["Make sure the counter does not go below zero."],
    };

    const spy = vi.spyOn(aiClient, "explainCode").mockResolvedValueOnce(mockResult);

    const res = await aiClient.explainCode({
      projectName: "Test Project",
      filePath: "src/App.tsx",
      language: "typescript",
      fileContent: "export const App = () => <div>Hello</div>;",
      mode: "eli5",
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "eli5",
        filePath: "src/App.tsx",
        projectName: "Test Project",
      })
    );
    expect(res.mode).toBe("eli5");
    expect(res.atAGlance).toContain("conductor of an orchestra");
    expect(res.breakdown[0].name).toBe("App");

    spy.mockRestore();
  });

  it("calls /explain-code endpoint with valid payload for Normal mode", async () => {
    const mockResult: CodeExplanationResult = {
      mode: "normal",
      fileName: "apiService.ts",
      atAGlance: "Handles HTTP client communication with error boundaries and exponential backoff.",
      howItWorks: [
        {
          step: 1,
          title: "Request interceptor",
          explanation: "Appends authentication headers to outgoing requests.",
          lines: "5-15",
        },
      ],
      breakdown: [
        {
          name: "requestWithRetry",
          kind: "function",
          lines: "20-45",
          summary: "Asynchronous fetch wrapper with exponential backoff on 5xx codes.",
          details: "Catches AbortController signals on unmount.",
        },
      ],
      connections: [
        {
          target: "fetch",
          relationship: "Native web runtime HTTP standard",
        },
      ],
      thingsToNotice: ["Timeout defaults to 8000ms if not specified."],
    };

    const spy = vi.spyOn(aiClient, "explainCode").mockResolvedValueOnce(mockResult);

    const res = await aiClient.explainCode({
      projectName: "Test Project",
      filePath: "src/apiService.ts",
      language: "typescript",
      fileContent: "export async function requestWithRetry() {}",
      mode: "normal",
      selectedCode: "export async function requestWithRetry() {}",
      selectionRange: {
        startLineNumber: 20,
        startColumn: 1,
        endLineNumber: 45,
        endColumn: 2,
      },
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "normal",
        selectedCode: "export async function requestWithRetry() {}",
      })
    );
    expect(res.mode).toBe("normal");
    expect(res.breakdown[0].name).toBe("requestWithRetry");

    spy.mockRestore();
  });
});
