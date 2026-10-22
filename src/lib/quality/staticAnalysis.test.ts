import { describe, it, expect } from "vitest";
import { runStaticAnalysis } from "./staticAnalysis";
import type { BuildArtifact, FilePlan } from "@/types/artifact";

describe("Static Analysis Engine", () => {
  const filePlan: FilePlan = {
    projectId: "proj-1",
    generatedAt: new Date().toISOString(),
    files: [
      {
        path: "package.json",
        type: "config",
        purpose: "Dependencies",
        language: "json",
        dependencies: [],
      },
      {
        path: "src/api/routes.ts",
        type: "api",
        purpose: "API Endpoints",
        language: "typescript",
        dependencies: [],
      },
      {
        path: "src/core/service.ts",
        type: "backend",
        purpose: "Core Logic",
        language: "typescript",
        dependencies: [],
      },
    ],
  };

  it("detects missing artifacts required by the file plan", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-1",
        projectId: "proj-1",
        path: "package.json",
        type: "config",
        purpose: "Dependencies",
        status: "generated",
        content: JSON.stringify({ name: "my-app", version: "1.0.0" }),
        language: "json",
        dependencies: [],
        versions: [],
      },
      // Missing src/api/routes.ts and src/core/service.ts
    ];

    const findings = runStaticAnalysis({
      projectId: "proj-1",
      assessmentId: "assess-1",
      artifacts,
      filePlan,
    });

    const missingFindings = findings.filter((f) => f.ruleId === "SA001_MISSING_PLANNED_ARTIFACT");
    expect(missingFindings.length).toBe(2);
    expect(missingFindings.some((f) => f.filePath === "src/api/routes.ts")).toBe(true);
    expect(missingFindings.some((f) => f.filePath === "src/core/service.ts")).toBe(true);
  });

  it("detects empty artifacts as critical defects", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-empty",
        projectId: "proj-1",
        path: "src/empty.ts",
        type: "backend",
        purpose: "Empty",
        status: "generated",
        content: "   \n  ",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runStaticAnalysis({
      projectId: "proj-1",
      assessmentId: "assess-1",
      artifacts,
    });

    const emptyFindings = findings.filter((f) => f.ruleId === "SA002_EMPTY_ARTIFACT");
    expect(emptyFindings.length).toBe(1);
    expect(emptyFindings[0].severity).toBe("error");
  });

  it("detects scaffold stubs and unworked placeholders", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-stub",
        projectId: "proj-1",
        path: "src/stub.ts",
        type: "backend",
        purpose: "Stub",
        status: "planned",
        content: "// Planned from blueprint\n// Generated placeholder for src/stub.ts\n",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runStaticAnalysis({
      projectId: "proj-1",
      assessmentId: "assess-1",
      artifacts,
    });

    expect(findings.some((f) => f.ruleId === "SA003_SCAFFOLD_STUB")).toBe(true);
  });

  it("classifies TODO comments as info suggestions without marking as defect", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-todo",
        projectId: "proj-1",
        path: "src/app.ts",
        type: "frontend",
        purpose: "App",
        status: "generated",
        content: "export function run() {\n  // TODO: add analytics integration\n  return true;\n}",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runStaticAnalysis({
      projectId: "proj-1",
      assessmentId: "assess-1",
      artifacts,
    });

    const todoFindings = findings.filter((f) => f.ruleId === "SA004_TODO_FIXME_ANNOTATION");
    expect(todoFindings.length).toBe(1);
    expect(todoFindings[0].severity).toBe("info");
  });

  it("detects broken relative imports between known artifacts", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-main",
        projectId: "proj-1",
        path: "src/main.ts",
        type: "backend",
        purpose: "Main entry",
        status: "generated",
        content: `import { helper } from "./nonExistentHelper";\nexport const ok = helper();`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runStaticAnalysis({
      projectId: "proj-1",
      assessmentId: "assess-1",
      artifacts,
    });

    const brokenImports = findings.filter((f) => f.ruleId === "SA006_BROKEN_RELATIVE_IMPORT");
    expect(brokenImports.length).toBe(1);
    expect(brokenImports[0].severity).toBe("error");
    expect(brokenImports[0].message).toContain("./nonExistentHelper");
  });

  it("does not flag valid relative imports when target artifact is present", () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art-main",
        projectId: "proj-1",
        path: "src/main.ts",
        type: "backend",
        purpose: "Main entry",
        status: "generated",
        content: `import { helper } from "./existingHelper";\nexport const ok = helper();`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      {
        id: "art-helper",
        projectId: "proj-1",
        path: "src/existingHelper.ts",
        type: "backend",
        purpose: "Helper",
        status: "generated",
        content: `export const helper = () => true;`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const findings = runStaticAnalysis({
      projectId: "proj-1",
      assessmentId: "assess-1",
      artifacts,
    });

    const brokenImports = findings.filter((f) => f.ruleId === "SA006_BROKEN_RELATIVE_IMPORT");
    expect(brokenImports.length).toBe(0);
  });
});
