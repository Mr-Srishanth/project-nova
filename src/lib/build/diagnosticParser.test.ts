import { describe, it, expect } from "vitest";
import { parseCompilerDiagnostics } from "./diagnosticParser";

describe("Diagnostic Parser", () => {
  it("correctly parses standard TypeScript compiler error lines", () => {
    const logs = [
      "src/api/routes.ts(1,57): error TS2307: Cannot find module 'express' or its corresponding type declarations.",
      "src/app/App.tsx(100,37): error TS2345: Argument of type 'CanvasGradient' is not assignable to parameter of type 'string'.",
      "src/utils/math.ts(12,5): warning TS6133: 'unusedVar' is declared but its value is never read.",
    ];

    const problems = parseCompilerDiagnostics(logs);
    expect(problems).toHaveLength(3);

    expect(problems[0].file).toBe("src/api/routes.ts");
    expect(problems[0].line).toBe(1);
    expect(problems[0].column).toBe(57);
    expect(problems[0].severity).toBe("error");
    expect(problems[0].message).toContain("TS2307: Cannot find module 'express'");
    expect(problems[0].source).toBe("TypeScript Compiler (tsc)");

    expect(problems[1].file).toBe("src/app/App.tsx");
    expect(problems[1].line).toBe(100);
    expect(problems[1].column).toBe(37);
    expect(problems[1].severity).toBe("error");

    expect(problems[2].file).toBe("src/utils/math.ts");
    expect(problems[2].line).toBe(12);
    expect(problems[2].column).toBe(5);
    expect(problems[2].severity).toBe("warning");
  });

  it("handles multi-line chunks and non-diagnostic logs cleanly", () => {
    const logs = [
      "$ tsc -b\nsrc/main.tsx(4,17): error TS2307: Cannot find module './App' or its corresponding type declarations.\nDone in 0.42s",
      "Building targets...",
    ];

    const problems = parseCompilerDiagnostics(logs);
    expect(problems).toHaveLength(1);
    expect(problems[0].file).toBe("src/main.tsx");
    expect(problems[0].line).toBe(4);
    expect(problems[0].column).toBe(17);
  });
});
