import { describe, it, expect } from "vitest";
import { evaluateReleaseReadiness } from "./readinessEngine";
import { generateSafeEnvExample } from "./envConfigManager";
import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type { QualityAssessment, TestPlan } from "@/types/quality";
import type { EnvVariableSpec } from "@/types/release";

describe("Release Readiness Engine & Environment Safeguards", () => {
  const baseProject: Project = {
    id: "proj-1",
    name: "Fintech Platform",
    description: "Banking backend",
    objective: "Provide secure payment APIs",
    category: "Web Application",
    technologies: ["Node.js", "PostgreSQL"],
    status: "active",
    discoveryMode: "custom",
    milestones: [],
    blueprint: {
      id: "bp-1",
      projectId: "proj-1",
      title: "Fintech Architecture Blueprint",
      overview: "Secure microservice banking API",
      problemStatement: "Payment routing",
      targetUsers: ["Merchants"],
      realWorldUseCase: "Payments",
      features: { mvp: [], important: [], advanced: [], optional: [] },
      techStack: [{ layer: "Backend", tech: "Node", why: "Perf" }],
      architecture: { summary: "3-tier", nodes: [], edges: [] },
      database: { entities: [], relationships: [], sql: "CREATE TABLE accounts();" },
      api: [{ method: "GET", route: "/api/pay", purpose: "Process pay" }],
      uiScreens: [],
      folderStructure: "src/",
      testingStrategy: [],
      deploymentStrategy: [],
      futureImprovements: [],
      updatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleArtifacts: BuildArtifact[] = [
    {
      id: "art-1",
      projectId: "proj-1",
      path: "package.json",
      type: "config",
      purpose: "Package",
      status: "approved",
      content: "{}",
      language: "json",
      dependencies: [],
      versions: [],
    },
  ];

  const sampleAssessmentClean: QualityAssessment = {
    id: "qa-1",
    projectId: "proj-1",
    assessedAt: new Date().toISOString(),
    checksPerformed: ["static_analysis"],
    totalArtifactsChecked: 1,
    findings: [],
    score: {
      healthGrade: "A",
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      resolvedCount: 0,
    },
  };

  const sampleTestPlansPassed: TestPlan[] = [
    {
      id: "tp-1",
      projectId: "proj-1",
      title: "Auth tests",
      description: "Verify login",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAiProposed: false,
      testCases: [
        {
          id: "tc-1",
          testPlanId: "tp-1",
          projectId: "proj-1",
          title: "Payment transaction",
          description: "Verify charge",
          type: "manual",
          preconditions: [],
          steps: ["charge card"],
          expectedOutcome: "200 OK",
          status: "passed",
          isAiProposed: false,
        },
      ],
    },
  ];

  const sampleEnvVars: EnvVariableSpec[] = [
    {
      name: "DATABASE_URL",
      description: "Database connection",
      required: true,
      exampleValue: "postgres://user:pass@localhost:5432/db",
      status: "configured",
    },
  ];

  it("should evaluate a clean project as fully passed across all readiness categories", () => {
    const checks = evaluateReleaseReadiness({
      project: baseProject,
      artifacts: sampleArtifacts,
      assessment: sampleAssessmentClean,
      testPlans: sampleTestPlansPassed,
      envVariables: sampleEnvVars,
    });

    const failed = checks.filter((c) => c.state === "fail");
    expect(failed.length).toBe(0);
    expect(checks.every((c) => c.state === "pass")).toBe(true);
  });

  it("should flag a critical release blocker if quality assessment contains open defects", () => {
    const assessmentWithError: QualityAssessment = {
      ...sampleAssessmentClean,
      findings: [
        {
          id: "find-err-1",
          projectId: "proj-1",
          assessmentId: "qa-1",
          category: "security",
          severity: "error",
          title: "Hardcoded secret",
          message: "Secret in file",
          ruleId: "SEC001",
          status: "open",
          isAiGenerated: false,
          createdAt: new Date().toISOString(),
        },
      ],
      score: { ...sampleAssessmentClean.score, errorCount: 1 },
    };

    const checks = evaluateReleaseReadiness({
      project: baseProject,
      artifacts: sampleArtifacts,
      assessment: assessmentWithError,
      testPlans: sampleTestPlansPassed,
      envVariables: sampleEnvVars,
    });

    const qualityCheck = checks.find((c) => c.category === "quality");
    expect(qualityCheck?.state).toBe("fail");
    expect(qualityCheck?.explanation).toContain("1 unresolved critical error");
  });

  it("should report missing quality assessment as not_verified rather than guessing pass", () => {
    const checks = evaluateReleaseReadiness({
      project: baseProject,
      artifacts: sampleArtifacts,
      assessment: null,
      testPlans: sampleTestPlansPassed,
      envVariables: sampleEnvVars,
    });

    const qualityCheck = checks.find((c) => c.category === "quality");
    expect(qualityCheck?.state).toBe("not_verified");
  });

  it("should flag missing required environment parameters as blockers", () => {
    const missingEnv: EnvVariableSpec[] = [
      {
        name: "JWT_SECRET",
        description: "Token signing key",
        required: true,
        exampleValue: "placeholder_key",
        status: "missing",
      },
    ];

    const checks = evaluateReleaseReadiness({
      project: baseProject,
      artifacts: sampleArtifacts,
      assessment: sampleAssessmentClean,
      testPlans: sampleTestPlansPassed,
      envVariables: missingEnv,
    });

    const envCheck = checks.find((c) => c.category === "environment");
    expect(envCheck?.state).toBe("fail");
    expect(envCheck?.explanation).toContain("JWT_SECRET");
  });

  it("generates safe .env.example with zero real credentials", () => {
    const specs: EnvVariableSpec[] = [
      {
        name: "STRIPE_SECRET_KEY",
        description: "Stripe payment secret",
        required: true,
        format: "starts with sk_test_...",
        exampleValue: "sk_test_placeholder_key_min_32_chars",
        status: "configured",
      },
    ];

    const output = generateSafeEnvExample(specs);
    expect(output).toContain("STRIPE_SECRET_KEY=sk_test_placeholder_key_min_32_chars");
    expect(output).toContain("Required: YES");
    expect(output).not.toContain("sk_live_");
  });
});
