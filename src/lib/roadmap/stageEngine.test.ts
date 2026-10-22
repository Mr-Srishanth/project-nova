import { describe, it, expect } from "vitest";
import { calculateStageStatuses, migrateLegacyMilestones, LIFECYCLE_STAGES } from "./stageEngine";
import type { Project } from "@/types/project";
import type { Milestone } from "@/types/task";

describe("Stage Engine - Lifecycle Rules & Progress Calculations", () => {
  const dummyProject: Project = {
    id: "proj_flow_test",
    name: "Autonomous Engine",
    description: "Flow test project",
    objective: "Verify 7 lifecycle stages and task progress",
    category: "Developer Tool",
    technologies: ["React", "TypeScript"],
    status: "active",
    discoveryMode: "custom",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [
      {
        id: "m_impl",
        projectId: "proj_flow_test",
        order: 1,
        phase: "Implementation Core",
        goal: "Build frontend components",
        estimatedDuration: "1 week",
        dependencies: [],
        skillsOrTech: ["React"],
        tasks: [
          { id: "t1", milestoneId: "m_impl", title: "Shell UI", status: "done" },
          { id: "t2", milestoneId: "m_impl", title: "Stage Pipeline", status: "done" },
          { id: "t3", milestoneId: "m_impl", title: "Roadmap View", status: "todo" },
        ],
      },
    ],
  };

  it("should have 7 defined lifecycle stages in correct order", () => {
    expect(LIFECYCLE_STAGES.length).toBe(7);
    expect(LIFECYCLE_STAGES[0].id).toBe("discovery");
    expect(LIFECYCLE_STAGES[6].id).toBe("maintenance");
  });

  it("should auto-complete discovery stage when project has valid name and objective", () => {
    const statuses = calculateStageStatuses(dummyProject);
    expect(statuses.discovery.status).toBe("completed");
    expect(statuses.discovery.percent).toBe(100);
  });

  it("should calculate implementation progress accurately from actual tasks without inventing data", () => {
    const statuses = calculateStageStatuses(dummyProject);
    // 2 done out of 3 total -> 67%
    expect(statuses.implementation.totalTasks).toBe(3);
    expect(statuses.implementation.completedTasks).toBe(2);
    expect(statuses.implementation.percent).toBe(67);
    expect(statuses.implementation.status).toBe("in_progress");
  });

  it("should mark architecture stage complete if blueprint spec exists", () => {
    const projectWithBp: Project = {
      ...dummyProject,
      blueprint: {
        id: "bp_1",
        projectId: "proj_flow_test",
        title: "Test Blueprint",
        overview: "Overview",
        problemStatement: "Problem",
        targetUsers: [],
        realWorldUseCase: "",
        features: { mvp: [], important: [], advanced: [], optional: [] },
        techStack: [],
        architecture: {
          summary: "Topology",
          nodes: [{ id: "n1", label: "Client", kind: "frontend", detail: "SPA" }],
          edges: [],
        },
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

    const statuses = calculateStageStatuses(projectWithBp);
    expect(statuses.architecture.status).toBe("completed");
  });

  it("should seamlessly migrate legacy Project.milestones into Phase 4 RoadmapMilestones", () => {
    const legacy: Milestone[] = [
      {
        id: "leg_1",
        projectId: "proj_legacy",
        order: 1,
        phase: "Testing and Quality Verification",
        goal: "Verify test suite",
        estimatedDuration: "3 days",
        dependencies: [],
        skillsOrTech: ["Vitest"],
        tasks: [{ id: "t_leg", milestoneId: "leg_1", title: "Run checks", status: "done" }],
      },
    ];

    const migrated = migrateLegacyMilestones(legacy);
    expect(migrated.length).toBe(1);
    expect(migrated[0].stageId).toBe("testing");
    expect(migrated[0].tasks[0].status).toBe("done");
    expect(migrated[0].tasks[0].stageId).toBe("testing");
  });
});
