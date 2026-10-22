import { describe, it, expect, beforeEach } from "vitest";
import { orchestrationStorage } from "./orchestrationStorage";
import type { OrchestrationAssessment } from "@/types/orchestrator";

describe("Orchestration Storage Adapter & Project Isolation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleAssessmentA: OrchestrationAssessment = {
    id: "run-alpha-1",
    projectId: "proj-alpha",
    assessedAt: new Date().toISOString(),
    overallHealth: "healthy",
    snapshot: {
      projectId: "proj-alpha",
      projectName: "Project Alpha",
      capturedAt: new Date().toISOString(),
      blueprint: { defined: true, endpointCount: 2, entityCount: 1 },
      roadmap: { totalMilestones: 3, completedMilestones: 1, currentStage: "build", blockedTasksCount: 0 },
      artifacts: { total: 4, approved: 4, unapproved: 0, planned: 0 },
      quality: { assessed: true, openErrors: 0, openWarnings: 0, unrunTests: 0, failedTests: 0, passedTests: 2 },
      release: { isReady: true, blockersCount: 0, readinessPassCount: 4, unverifiedCount: 0 },
      docs: { totalDocs: 2, openDriftFindings: 0 },
      brain: { risksCount: 0, decisionsCount: 1, constraintsCount: 0 },
    },
    actions: [
      {
        id: "act-1",
        projectId: "proj-alpha",
        title: "Audit Release Gate",
        description: "Ready for release sign-off",
        targetModule: "release",
        actionType: "signoff_release",
        riskLevel: "high",
        requiresApproval: true,
        sourceEvidence: "Artifacts approved and tests passed",
        expectedOutcome: "Release signed off",
        targetRoute: "/release",
        status: "proposed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  it("should initialize empty for any project", async () => {
    const list = await orchestrationStorage.list("proj-alpha");
    expect(list).toEqual([]);
    const latest = await orchestrationStorage.getLatest("proj-alpha");
    expect(latest).toBeNull();
  });

  it("should save and retrieve orchestration runs strictly isolated by project", async () => {
    await orchestrationStorage.save(sampleAssessmentA);

    const alphaRuns = await orchestrationStorage.list("proj-alpha");
    const betaRuns = await orchestrationStorage.list("proj-beta");

    expect(alphaRuns.length).toBe(1);
    expect(alphaRuns[0].id).toBe("run-alpha-1");
    expect(betaRuns.length).toBe(0);
  });

  it("should update action states within persisted assessment runs", async () => {
    await orchestrationStorage.save(sampleAssessmentA);

    const updatedAction = {
      ...sampleAssessmentA.actions[0],
      status: "approved" as const,
      approvedBy: "Lead Architect",
      approvedAt: new Date().toISOString(),
    };

    const updatedRun = await orchestrationStorage.updateActionState(
      "proj-alpha",
      "act-1",
      updatedAction
    );

    expect(updatedRun).not.toBeNull();
    expect(updatedRun?.actions[0].status).toBe("approved");
    expect(updatedRun?.actions[0].approvedBy).toBe("Lead Architect");
  });
});
