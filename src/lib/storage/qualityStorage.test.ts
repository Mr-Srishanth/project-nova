import { describe, it, expect, beforeEach } from "vitest";
import { qualityStorage } from "./qualityStorage";
import type { QualityAssessment, TestPlan } from "@/types/quality";

describe("Quality Storage & Project Isolation Adapter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleAssessmentA: QualityAssessment = {
    id: "qa-assess-1",
    projectId: "proj-alpha",
    assessedAt: new Date().toISOString(),
    checksPerformed: ["static_analysis", "security"],
    totalArtifactsChecked: 5,
    findings: [
      {
        id: "find-1",
        projectId: "proj-alpha",
        assessmentId: "qa-assess-1",
        category: "security",
        severity: "error",
        title: "Hardcoded key",
        message: "Key in file",
        ruleId: "SEC001",
        status: "open",
        isAiGenerated: false,
        createdAt: new Date().toISOString(),
      },
    ],
    score: {
      healthGrade: "B",
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
      resolvedCount: 0,
    },
  };

  const sampleAssessmentB: QualityAssessment = {
    id: "qa-assess-2",
    projectId: "proj-beta",
    assessedAt: new Date().toISOString(),
    checksPerformed: ["static_analysis"],
    totalArtifactsChecked: 2,
    findings: [],
    score: {
      healthGrade: "A",
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      resolvedCount: 0,
    },
  };

  it("should initialize empty for any project", async () => {
    const list = await qualityStorage.listAssessments("proj-alpha");
    expect(list).toEqual([]);
    const latest = await qualityStorage.getLatestAssessment("proj-alpha");
    expect(latest).toBeNull();
  });

  it("should save and retrieve assessments while isolating between projects", async () => {
    await qualityStorage.saveAssessment(sampleAssessmentA);
    await qualityStorage.saveAssessment(sampleAssessmentB);

    const alphaAssessments = await qualityStorage.listAssessments("proj-alpha");
    const betaAssessments = await qualityStorage.listAssessments("proj-beta");

    expect(alphaAssessments.length).toBe(1);
    expect(alphaAssessments[0].id).toBe("qa-assess-1");

    expect(betaAssessments.length).toBe(1);
    expect(betaAssessments[0].id).toBe("qa-assess-2");
  });

  it("should update finding status with resolution timestamp", async () => {
    await qualityStorage.saveAssessment(sampleAssessmentA);

    const updated = await qualityStorage.updateFindingStatus(
      "proj-alpha",
      "find-1",
      "resolved",
      "Secret removed into environment variable"
    );

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("resolved");
    expect(updated?.notes).toContain("Secret removed");
    expect(updated?.resolvedAt).toBeDefined();

    const latest = await qualityStorage.getLatestAssessment("proj-alpha");
    expect(latest?.score.resolvedCount).toBe(1);
  });

  it("should persist test plans and update test case execution states", async () => {
    const samplePlan: TestPlan = {
      id: "plan-1",
      projectId: "proj-alpha",
      title: "Core Regression Suite",
      description: "Verifies core authentication flows",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAiProposed: false,
      testCases: [
        {
          id: "tc-1",
          testPlanId: "plan-1",
          projectId: "proj-alpha",
          title: "Login with valid credentials",
          description: "Expect 200 OK and JWT token",
          type: "manual",
          preconditions: ["User is registered"],
          steps: ["Submit email and password", "Inspect response"],
          expectedOutcome: "Token saved in session",
          status: "not_run",
          isAiProposed: false,
        },
      ],
    };

    await qualityStorage.saveTestPlan(samplePlan);
    const plans = await qualityStorage.listTestPlans("proj-alpha");
    expect(plans.length).toBe(1);
    expect(plans[0].testCases[0].status).toBe("not_run");

    // Execute test manually
    const executed = await qualityStorage.updateTestCaseStatus(
      "proj-alpha",
      "tc-1",
      "passed",
      "Tested in local Chrome, received token"
    );

    expect(executed).not.toBeNull();
    expect(executed?.status).toBe("passed");
    expect(executed?.executedAt).toBeDefined();
    expect(executed?.executionNotes).toContain("received token");
  });
});
