import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiClient } from "@/lib/ai/client";

describe("AI Continue Code Service Contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct prefix, suffix, and file context to /api/ai/continue-code", async () => {
    const mockResponse = {
      continuation: "  return a * b;\n}",
      summary: "Completed multiply function implementation",
      intent: "continuation" as const,
    };

    const spy = vi.spyOn(aiClient as any, "request").mockResolvedValue(mockResponse);

    const result = await aiClient.continueCode({
      projectName: "Demo App",
      filePath: "src/math.ts",
      language: "typescript",
      prefixContent: "export function multiply(a: number, b: number): number {\n",
      suffixContent: "\nexport function add(a: number, b: number) { return a + b; }",
      selectedCode: "",
      contextFiles: [{ path: "src/types.ts", content: "export type Num = number;" }],
    });

    expect(spy).toHaveBeenCalledWith("/continue-code", {
      method: "POST",
      body: JSON.stringify({
        projectName: "Demo App",
        filePath: "src/math.ts",
        language: "typescript",
        prefixContent: "export function multiply(a: number, b: number): number {\n",
        suffixContent: "\nexport function add(a: number, b: number) { return a + b; }",
        selectedCode: "",
        contextFiles: [{ path: "src/types.ts", content: "export type Num = number;" }],
      }),
    });

    expect(result.continuation).toBe("  return a * b;\n}");
    expect(result.summary).toBe("Completed multiply function implementation");
    expect(result.intent).toBe("continuation");
  });

  it("handles replacement of selected incomplete code", async () => {
    const mockResponse = {
      continuation: "<button onClick={handleClick} className=\"px-4 py-2 bg-blue-600 text-white rounded\">Click Me</button>",
      summary: "Replaced partial button JSX with complete Tailwind button",
      intent: "continuation" as const,
    };

    vi.spyOn(aiClient as any, "request").mockResolvedValue(mockResponse);

    const result = await aiClient.continueCode({
      projectName: "UI App",
      filePath: "src/Button.tsx",
      language: "typescript",
      prefixContent: "export const Button = () => {\n  return (\n    ",
      suffixContent: "\n  );\n};",
      selectedCode: "<button onCli",
    });

    expect(result.continuation).toContain("<button onClick={handleClick}");
  });
});
