import { describe, it, expect } from "vitest";
import { runSecurityAnalysis, redactSecretSnippet } from "./securityAnalysis";
import type { BuildArtifact } from "@/types/artifact";

describe("Security and Dependency Analysis Engine", () => {
  it("redacts secret keys and tokens from displayed snippets", () => {
    const rawSnippet = 'const apiKey = "AIzaSyD-fake-gemini-test-secret-key-123";';
    const redacted = redactSecretSnippet(rawSnippet);

    expect(redacted).not.toContain("AIzaSyD-fake-gemini-test-secret-key-123");
    expect(redacted).toContain("[REDACTED");
  });

  it("detects hardcoded API keys and tokens in artifacts", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-sec-1",
        projectId: "proj-sec",
        path: "src/api/auth.ts",
        type: "backend",
        purpose: "Auth",
        status: "generated",
        content: `export const secret = "supersecrettokenvalue12345";\nexport const getSecret = () => secret;`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runSecurityAnalysis({
      projectId: "proj-sec",
      assessmentId: "assess-sec-1",
      artifacts,
    });

    const secretFindings = findings.filter((f) => f.ruleId === "SEC001_HARDCODED_SECRET");
    expect(secretFindings.length).toBe(1);
    expect(secretFindings[0].severity).toBe("error");
    // Ensure the secret is redacted from finding snippet
    expect(secretFindings[0].snippet).not.toContain("supersecrettokenvalue12345");
  });

  it("detects dangerous eval and dynamic Function compilation", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-eval",
        projectId: "proj-sec",
        path: "src/utils/calc.ts",
        type: "backend",
        purpose: "Calculator",
        status: "generated",
        content: `export function calculate(expr: string) {\n  return eval(expr);\n}`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runSecurityAnalysis({
      projectId: "proj-sec",
      assessmentId: "assess-sec-1",
      artifacts,
    });

    const evalFindings = findings.filter((f) => f.ruleId === "SEC002_DYNAMIC_EVAL");
    expect(evalFindings.length).toBe(1);
    expect(evalFindings[0].severity).toBe("error");
  });

  it("detects unvalidated filesystem path parameter traversal", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-fs",
        projectId: "proj-sec",
        path: "src/server/handler.ts",
        type: "backend",
        purpose: "File reader",
        status: "generated",
        content: `import fs from 'fs';\nexport function readFile(req: any) {\n  return fs.readFileSync(req.query.path);\n}`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runSecurityAnalysis({
      projectId: "proj-sec",
      assessmentId: "assess-sec-1",
      artifacts,
    });

    const pathFindings = findings.filter((f) => f.ruleId === "SEC005_PATH_TRAVERSAL_RISK");
    expect(pathFindings.length).toBe(1);
    expect(pathFindings[0].severity).toBe("error");
  });

  it("detects unescaped HTML injection via dangerouslySetInnerHTML", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-xss",
        projectId: "proj-sec",
        path: "src/components/RawView.tsx",
        type: "frontend",
        purpose: "Raw UI",
        status: "generated",
        content: `export const Raw = ({ html }: any) => <div dangerouslySetInnerHTML={{ __html: html }} />;`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runSecurityAnalysis({
      projectId: "proj-sec",
      assessmentId: "assess-sec-1",
      artifacts,
    });

    const xssFindings = findings.filter((f) => f.ruleId === "SEC004_RAW_HTML_XSS");
    expect(xssFindings.length).toBe(1);
    expect(xssFindings[0].severity).toBe("warning");
  });
});
