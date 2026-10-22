import { describe, it, expect } from "vitest";
import { assembleProjectStateSnapshot } from "./stateAssembler";
import { evaluateNextBestActions } from "./recommendationEngine";
import { canTransition, transitionActionState } from "./workflowStateMachine";
import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type { OrchestrationAction } from "@/types/orchestrator";

describe("Orchestration Engine, State Assembly & Workflow Transitions", () => {
  const baseProject: Project = {
    id: "proj-orch",
    name: "Autonomous Platform",
    description: "Cloud agent coordinator",
    objective: "Orchestrate workflows",
    category: "Developer Tool",
    technologies: ["TypeScript", "Vite"],
    status: "active",
    discoveryMode: "custom",
    milestones: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("prioritizes blueprint creation when no blueprint exists", () => {
    const snapshot = assembleProjectStateSnapshot({
      project: baseProject,
      artifacts: [],
    });

    const actions = evaluateNextBestActions(snapshot);
    expect(actions.length).toBe(1);
    expect(actions[0].actionType).toBe("create_blueprint");
    expect(actions[0].requiresApproval).toBe(true);
  });

  it("prioritizes critical quality defect resolution before release", () => {
    const projectWithBp: Project = {
      ...baseProject,
      blueprint: {
        id: "bp-1",
        projectId: "proj-orch",
        title: "Platform Spec",
        overview: "Overview",
        problemStatement: "Problem",
        targetUsers: [],
        realWorldUseCase: "Case",
        features: { mvp: [], important: [], advanced: [], optional: [] },
        techStack: [],
        architecture: { summary: "3-tier", nodes: [], edges: [] },
        database: { entities: [], relationships: [], sql: "" },
        api: [],
        uiScreens: [],
        folderStructure: "",
        testingStrategy: [],
        deploymentStrategy: [],
        futureImprovements: [],
        updatedAt: new Date().toISOString(),
      },
    };

    const artifacts: BuildArtifact[] = [
      {
        id: "art-1",
        projectId: "proj-orch",
        path: "package.json",
        type: "config",
        purpose: "Pkg",
        status: "approved",
        content: "{}",
        language: "json",
        dependencies: [],
        versions: [],
      },
    ];

    const snapshot = assembleProjectStateSnapshot({
      project: projectWithBp,
      artifacts,
      assessment: {
        id: "qa-1",
        projectId: "proj-orch",
        assessedAt: new Date().toISOString(),
        checksPerformed: [],
        totalArtifactsChecked: 1,
        findings: [
          {
            id: "f-1",
            projectId: "proj-orch",
            assessmentId: "qa-1",
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
          healthGrade: "D",
          errorCount: 1,
          warningCount: 0,
          infoCount: 0,
          resolvedCount: 0,
        },
      },
    });

    const actions = evaluateNextBestActions(snapshot);
    expect(actions.some((a) => a.actionType === "resolve_quality_defect")).toBe(true);
    expect(actions[0].riskLevel).toBe("critical");
  });

  it("validates and executes state transitions correctly", () => {
    const action: OrchestrationAction = {
      id: "act-test",
      projectId: "proj-orch",
      title: "Approve Artifacts",
      description: "Approve code",
      targetModule: "build",
      actionType: "approve_artifact",
      riskLevel: "medium",
      requiresApproval: true,
      sourceEvidence: "1 unapproved",
      expectedOutcome: "Approved",
      targetRoute: "/build",
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(canTransition("proposed", "approved")).toBe(true);
    expect(canTransition("completed", "running")).toBe(false);

    const approved = transitionActionState(action, "approved", { actor: "Senior Dev" });
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe("Senior Dev");

    const running = transitionActionState(approved, "running");
    expect(running.status).toBe("running");

    const completed = transitionActionState(running, "completed");
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeDefined();
  });

  it("throws error when attempting invalid state transitions", () => {
    const completedAction: OrchestrationAction = {
      id: "act-done",
      projectId: "proj-orch",
      title: "Done Action",
      description: "Done",
      targetModule: "docs",
      actionType: "sync_documentation",
      riskLevel: "low",
      requiresApproval: false,
      sourceEvidence: "None",
      expectedOutcome: "Done",
      targetRoute: "/docs",
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(() => transitionActionState(completedAction, "running")).toThrow();
  });
});
