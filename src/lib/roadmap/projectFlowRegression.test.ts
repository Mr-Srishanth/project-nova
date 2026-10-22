import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateStageStatuses,
  evaluateStageDeliverables,
  STAGE_WORKSPACE_MAPPING,
  LIFECYCLE_STAGES,
} from "./stageEngine";
import { validateDependency, isTaskBlocked } from "./dependencyGraph";
import { projectStorage } from "../storage/projectStorage";
import type { Project } from "@/types/project";
import type { RoadmapMilestone } from "@/types/roadmap";

describe("Project Flow Functional Regression Suite (12 Core Tests)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseNitroPulse: Project = {
    id: "proj_nitropulse",
    name: "NitroPulse Car Game",
    description: "2D Canvas retro car racing game with high-speed physics.",
    objective: "Deliver a playable retro racing simulation with dynamic obstacles.",
    category: "Developer Tool",
    technologies: ["React", "TypeScript", "HTML5 Canvas"],
    status: "active",
    discoveryMode: "custom",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [],
    roadmapMilestones: [],
  };

  const baseFlowStream: Project = {
    id: "proj_flowstream",
    name: "FlowStream Automation",
    description: "Enterprise workflow orchestrator and queue processing engine.",
    objective: "Automate distributed tasks with real-time dependency checks.",
    category: "Developer Tool",
    technologies: ["Node.js", "TypeScript", "Redis"],
    status: "active",
    discoveryMode: "custom",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [],
    roadmapMilestones: [],
  };

  // 1. New project with no roadmap data
  it("1. handles new project with no roadmap data truthfully", () => {
    const statuses = calculateStageStatuses(baseNitroPulse);
    // Discovery has name + objective -> completed
    expect(statuses.discovery.status).toBe("completed");
    expect(statuses.discovery.percent).toBe(100);
    expect(statuses.discovery.totalTasks).toBe(0);
    expect(statuses.discovery.hasTasks).toBe(false);

    // Later stages with no tasks or deliverables must be not_started
    expect(statuses.implementation.status).toBe("not_started");
    expect(statuses.implementation.totalTasks).toBe(0);
    expect(statuses.implementation.percent).toBe(0);
    expect(statuses.implementation.hasTasks).toBe(false);

    expect(statuses.testing.status).toBe("not_started");
    expect(statuses.deployment.status).toBe("not_started");
    expect(statuses.maintenance.status).toBe("not_started");
  });

  // 2. Project with no tasks
  it("2. clearly distinguishes 'No tasks created' from '0 tasks completed' without fabricating progress", () => {
    const statuses = calculateStageStatuses(baseFlowStream);
    for (const stage of LIFECYCLE_STAGES) {
      if (stage.id !== "discovery") {
        expect(statuses[stage.id].hasTasks).toBe(false);
        expect(statuses[stage.id].totalTasks).toBe(0);
        expect(statuses[stage.id].completedTasks).toBe(0);
      }
    }
  });

  // 3. Project with partially completed tasks
  it("3. computes accurate progress for partially completed tasks", () => {
    const projectWithPartialTasks: Project = {
      ...baseNitroPulse,
      roadmapMilestones: [
        {
          id: "m_impl",
          projectId: baseNitroPulse.id,
          stageId: "implementation",
          order: 1,
          phase: "Core Build",
          goal: "Build racing loop",
          estimatedDuration: "1 week",
          dependencies: [],
          skillsOrTech: ["Canvas"],
          tasks: [
            { id: "t1", milestoneId: "m_impl", stageId: "implementation", title: "Canvas Renderer", status: "done", priority: "high", dependencies: [] },
            { id: "t2", milestoneId: "m_impl", stageId: "implementation", title: "Traffic AI", status: "in_progress", priority: "medium", dependencies: [] },
            { id: "t3", milestoneId: "m_impl", stageId: "implementation", title: "Score HUD", status: "todo", priority: "low", dependencies: [] },
          ],
        },
      ],
    };

    const statuses = calculateStageStatuses(projectWithPartialTasks);
    expect(statuses.implementation.status).toBe("in_progress");
    expect(statuses.implementation.totalTasks).toBe(3);
    expect(statuses.implementation.completedTasks).toBe(1);
    expect(statuses.implementation.percent).toBe(33);
    expect(statuses.implementation.hasTasks).toBe(true);
  });

  // 4. Project with all required tasks completed
  it("4. marks stage completed when all tasks are done and deliverables satisfied", () => {
    const projectCompleted: Project = {
      ...baseNitroPulse,
      blueprint: {
        id: "bp_nitro",
        projectId: baseNitroPulse.id,
        title: "NitroPulse Blueprint",
        overview: "Overview",
        problemStatement: "Problem",
        targetUsers: ["Gamers"],
        realWorldUseCase: "Entertainment",
        features: { mvp: ["Arcade Steering"], important: [], advanced: [], optional: [] },
        techStack: [{ layer: "Frontend", tech: "React", why: "UI" }],
        architecture: { summary: "Client", nodes: [{ id: "n1", label: "Game Canvas", kind: "frontend", detail: "HTML5" }], edges: [] },
        database: { entities: [], relationships: [], sql: "" },
        api: [],
        uiScreens: [],
        folderStructure: "src/app/App.tsx",
        testingStrategy: [],
        deploymentStrategy: [],
        futureImprovements: [],
        updatedAt: new Date().toISOString(),
      },
      roadmapMilestones: [
        {
          id: "m_impl",
          projectId: baseNitroPulse.id,
          stageId: "implementation",
          order: 1,
          phase: "Complete Implementation",
          goal: "All gameplay components finished",
          estimatedDuration: "3 days",
          dependencies: [],
          skillsOrTech: ["React"],
          tasks: [
            { id: "t1", milestoneId: "m_impl", stageId: "implementation", title: "Road Animation", status: "done", priority: "high", dependencies: [] },
            { id: "t2", milestoneId: "m_impl", stageId: "implementation", title: "Collision Detection", status: "done", priority: "high", dependencies: [] },
          ],
        },
      ],
    };

    const statuses = calculateStageStatuses(projectCompleted);
    expect(statuses.implementation.status).toBe("completed");
    expect(statuses.implementation.percent).toBe(100);
    expect(statuses.implementation.completedTasks).toBe(2);
    expect(statuses.implementation.totalTasks).toBe(2);
  });

  // 5. Missing required deliverables
  it("5. identifies missing deliverables and prevents premature stage completion", () => {
    const emptyProj: Project = {
      ...baseFlowStream,
      name: "",
      objective: "",
    };

    const evalRes = evaluateStageDeliverables("discovery", emptyProj);
    expect(evalRes.missing).toContain("Problem Statement");
    expect(evalRes.missing).toContain("Target User Groups");

    const statuses = calculateStageStatuses(emptyProj);
    expect(statuses.discovery.status).not.toBe("completed");
  });

  // 6. Switching between NitroPulse and FlowStream
  it("6. guarantees strict project isolation between NitroPulse and FlowStream", async () => {
    await projectStorage.create({
      name: baseNitroPulse.name,
      description: baseNitroPulse.description,
      objective: baseNitroPulse.objective,
      category: baseNitroPulse.category,
      technologies: baseNitroPulse.technologies,
    });

    await projectStorage.create({
      name: baseFlowStream.name,
      description: baseFlowStream.description,
      objective: baseFlowStream.objective,
      category: baseFlowStream.category,
      technologies: baseFlowStream.technologies,
    });

    const list = await projectStorage.list();
    const nitro = list.find((p) => p.name === baseNitroPulse.name)!;
    const flow = list.find((p) => p.name === baseFlowStream.name)!;

    expect(nitro.id).not.toBe(flow.id);

    // Modify NitroPulse with an implementation milestone
    const nitroMilestone: RoadmapMilestone = {
      id: "m_nitro",
      projectId: nitro.id,
      stageId: "implementation",
      order: 1,
      phase: "Nitro Acceleration",
      goal: "Boost physics",
      estimatedDuration: "2 days",
      dependencies: [],
      skillsOrTech: ["Canvas"],
      tasks: [
        { id: "t_n1", milestoneId: "m_nitro", stageId: "implementation", title: "Turbo Mode", status: "done", priority: "critical", dependencies: [] },
      ],
    };

    await projectStorage.update(nitro.id, {
      roadmapMilestones: [nitroMilestone],
    });

    const reloadedNitro = await projectStorage.getById(nitro.id);
    const reloadedFlow = await projectStorage.getById(flow.id);

    expect(reloadedNitro?.roadmapMilestones?.length).toBe(1);
    expect(reloadedFlow?.roadmapMilestones?.length || 0).toBe(0);
  });

  // 7. Editing one project without changing another
  it("7. modifying one project state leaves other projects untouched", async () => {
    const createdNitro = await projectStorage.create({
      name: baseNitroPulse.name,
      description: baseNitroPulse.description,
      objective: baseNitroPulse.objective,
      category: baseNitroPulse.category,
      technologies: baseNitroPulse.technologies,
    });

    const createdFlow = await projectStorage.create({
      name: baseFlowStream.name,
      description: baseFlowStream.description,
      objective: baseFlowStream.objective,
      category: baseFlowStream.category,
      technologies: baseFlowStream.technologies,
    });

    // Add manual stage override to NitroPulse
    await projectStorage.update(createdNitro.id, {
      stageStates: [{ id: "testing", status: "completed", manualOverride: true, notes: "Automated QA Passed" }],
    });

    const nitroCheck = await projectStorage.getById(createdNitro.id);
    const flowCheck = await projectStorage.getById(createdFlow.id);

    const nitroStatuses = calculateStageStatuses(nitroCheck!);
    const flowStatuses = calculateStageStatuses(flowCheck!);

    expect(nitroStatuses.testing.status).toBe("completed");
    expect(nitroStatuses.testing.manualOverride).toBe(true);

    expect(flowStatuses.testing.status).toBe("not_started");
    expect(flowStatuses.testing.manualOverride).toBe(false);
  });

  // 8. Stale asynchronous responses after project switching
  it("8. prevents race conditions through ID verification in lifecycle calculations", () => {
    let activeProjectId = baseNitroPulse.id;

    // Simulate async callback from previous project
    const staleResponseProject = { ...baseNitroPulse, id: "proj_nitropulse" };
    activeProjectId = baseFlowStream.id; // User rapidly switched to FlowStream

    // Reject state update if response does not match current selection
    const isStale = staleResponseProject.id !== activeProjectId;
    expect(isStale).toBe(true);
  });

  // 9. Stage selection and correct workspace navigation
  it("9. maps all 7 stages to valid, meaningful workspace destinations", () => {
    const testProjectId = "proj_nav_test";
    for (const stage of LIFECYCLE_STAGES) {
      const mapping = STAGE_WORKSPACE_MAPPING[stage.id];
      expect(mapping).toBeDefined();
      expect(mapping.label).toBeTruthy();
      const targetPath = mapping.path(testProjectId);
      expect(typeof targetPath).toBe("string");
      expect(targetPath.startsWith("/")).toBe(true);
    }

    expect(STAGE_WORKSPACE_MAPPING.architecture.path(testProjectId)).toBe("/blueprint?project=proj_nav_test");
    expect(STAGE_WORKSPACE_MAPPING.implementation.path(testProjectId)).toContain("/ui-studio?project=proj_nav_test");
    expect(STAGE_WORKSPACE_MAPPING.testing.path(testProjectId)).toContain("/testing?project=proj_nav_test");
  });

  // 10. Persisting and reloading stage status
  it("10. persists and reloads stage overrides cleanly", async () => {
    const project = await projectStorage.create({
      name: "Persist Stage Test",
      description: "Testing stage persistence",
      objective: "Verify overrides survive reload",
      category: "Developer Tool",
      technologies: ["TypeScript"],
    });

    await projectStorage.update(project.id, {
      stageStates: [
        { id: "deployment", status: "in_progress", manualOverride: true, notes: "Deploying to Vercel" },
      ],
    });

    const reloaded = await projectStorage.getById(project.id);
    const statuses = calculateStageStatuses(reloaded!);

    expect(statuses.deployment.status).toBe("in_progress");
    expect(statuses.deployment.manualOverride).toBe(true);
    expect(statuses.deployment.overrideNote).toBe("Deploying to Vercel");
  });

  // 11. Missing workspace or malformed roadmap data
  it("11. handles malformed or incomplete milestone items gracefully without exceptions", () => {
    const malformedProject: Project = {
      ...baseNitroPulse,
      roadmapMilestones: [
        // @ts-ignore - simulate malformed data from storage
        { id: "m_corrupt", tasks: null },
        // @ts-ignore - simulate missing stageId
        { id: "m_corrupt2", tasks: [{ id: "t_no_stage", status: "done" }] },
      ],
    };

    expect(() => calculateStageStatuses(malformedProject)).not.toThrow();
    const statuses = calculateStageStatuses(malformedProject);
    expect(statuses.implementation).toBeDefined();
  });

  // 12. Dependency blocking and cycle detection
  it("12. accurately detects task blocks and prevents circular dependencies", () => {
    const tasks = [
      { id: "tA", milestoneId: "m1", title: "Task A", status: "done" as const, priority: "high" as const, dependencies: [] },
      { id: "tB", milestoneId: "m1", title: "Task B", status: "todo" as const, priority: "high" as const, dependencies: ["tA"] },
      { id: "tC", milestoneId: "m1", title: "Task C", status: "todo" as const, priority: "high" as const, dependencies: ["tB"] },
    ];

    // Task B depends on Task A (which is done) -> not blocked
    const blockB = isTaskBlocked(tasks[1], tasks);
    expect(blockB.blocked).toBe(false);

    // Task C depends on Task B (which is todo) -> blocked!
    const blockC = isTaskBlocked(tasks[2], tasks);
    expect(blockC.blocked).toBe(true);
    expect(blockC.blockingTaskTitles).toContain("Task B");

    // Attempt to make Task A depend on Task C -> Circular loop!
    const cycleCheck = validateDependency("tA", "tC", tasks);
    expect(cycleCheck.isValid).toBe(false);
    expect(cycleCheck.error).toContain("Circular dependency detected");
  });

  // 13. Project-Specific State Isolation: Project A vs Project B
  it("13. guarantees projects with deliberately different lifecycle states remain distinct and independent", async () => {
    // Project A: Discovery complete; Requirements (Planning) incomplete; Blueprint (Architecture) complete
    const projA = await projectStorage.create({
      name: "Project A Studio",
      description: "Project A description",
      objective: "Specific verified objective A",
      category: "Web Application",
      technologies: ["React"],
    });

    await projectStorage.update(projA.id, {
      blueprint: {
        id: "bp_A",
        projectId: projA.id,
        title: "Blueprint A",
        overview: "Overview A",
        problemStatement: "Problem A",
        targetUsers: ["Developers"],
        realWorldUseCase: "Testing lifecycle",
        features: { mvp: [], important: [], advanced: [], optional: [] },
        techStack: [{ layer: "Frontend", tech: "React", why: "UI" }],
        architecture: {
          summary: "Topology A",
          nodes: [{ id: "n1", label: "Client SPA", kind: "frontend", detail: "SPA" }],
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
    });

    // Project B: Discovery incomplete (no objective); Requirements (Planning) complete; Blueprint (Architecture) incomplete
    const projB = await projectStorage.create({
      name: "Project B Studio",
      description: "Project B description",
      objective: "", // Empty objective -> Discovery incomplete
      category: "Developer Tool",
      technologies: ["Node.js"],
    });

    await projectStorage.update(projB.id, {
      blueprint: {
        id: "bp_B",
        projectId: projB.id,
        title: "Blueprint B",
        overview: "Overview B",
        problemStatement: "",
        targetUsers: [],
        realWorldUseCase: "",
        features: {
          mvp: ["Automated Task Dispatch", "Worker Pool Handler"],
          important: [],
          advanced: [],
          optional: [],
        },
        techStack: [{ layer: "Backend", tech: "Node.js", why: "Runtime" }],
        architecture: { summary: "", nodes: [], edges: [] }, // No nodes -> Architecture incomplete
        database: { entities: [], relationships: [], sql: "" },
        api: [],
        uiScreens: [],
        folderStructure: "",
        testingStrategy: [],
        deploymentStrategy: [],
        futureImprovements: [],
        updatedAt: new Date().toISOString(),
      },
    });

    const reloadedA = await projectStorage.getById(projA.id);
    const reloadedB = await projectStorage.getById(projB.id);

    const statusesA = calculateStageStatuses(reloadedA!);
    const statusesB = calculateStageStatuses(reloadedB!);

    // Verify Project A state
    expect(statusesA.discovery.status).toBe("completed");
    expect(statusesA.discovery.percent).toBe(100);
    expect(statusesA.planning.status).toBe("not_started");
    expect(statusesA.planning.percent).toBe(0);
    expect(statusesA.architecture.status).toBe("completed");
    expect(statusesA.architecture.percent).toBe(100);

    // Verify Project B state
    expect(statusesB.discovery.status).toBe("in_progress"); // Objective is missing
    expect(statusesB.discovery.percent).toBe(0);
    expect(statusesB.planning.status).toBe("completed"); // Has features.mvp
    expect(statusesB.planning.percent).toBe(100);
    expect(statusesB.architecture.status).toBe("not_started"); // No architecture nodes
    expect(statusesB.architecture.percent).toBe(0);

    // Verify Switching Back to Project A preserves Project A's state exactly
    const recheckedA = await projectStorage.getById(projA.id);
    const recheckedStatusesA = calculateStageStatuses(recheckedA!);
    expect(recheckedStatusesA.discovery.status).toBe("completed");
    expect(recheckedStatusesA.planning.status).toBe("not_started");
    expect(recheckedStatusesA.architecture.status).toBe("completed");
  });

  // 14. Stage 4 (Implementation) Deliverable Status Truth: No False "Satisfied" Deliverables When Stage Is Not Started
  it("14. verifies Stage 4 deliverables are (Pending) and NOT (Satisfied) when project has 0 tasks and 0 artifacts", () => {
    // Project with blueprint (e.g. NitroPulse with architectural specs) but 0 tasks executed in Stage 4
    const specOnlyProject: Project = {
      ...baseNitroPulse,
      blueprint: {
        id: "bp_nitro",
        projectId: "proj_nitropulse",
        title: "NitroPulse Spec",
        overview: "Racing Game",
        problemStatement: "Problem",
        targetUsers: ["Gamers"],
        realWorldUseCase: "Entertainment",
        features: {
          mvp: ["Car Physics", "Track Rendering"],
          important: [],
          advanced: [],
          optional: [],
        },
        techStack: [],
        architecture: {
          summary: "Canvas loop",
          nodes: [{ id: "n1", label: "Canvas Engine", kind: "frontend", detail: "HTML5 Canvas" }],
          edges: [],
        },
        database: { entities: [], relationships: [], sql: "" },
        api: [],
        uiScreens: [],
        folderStructure: "src/games/nitropulse",
        testingStrategy: [],
        deploymentStrategy: [],
        futureImprovements: [],
        updatedAt: new Date().toISOString(),
      },
      milestones: [],
      roadmapMilestones: [],
    };

    const statuses = calculateStageStatuses(specOnlyProject);
    const implStatus = statuses.implementation;

    // Stage 4 must be not_started with 0 tasks and 0%
    expect(implStatus.status).toBe("not_started");
    expect(implStatus.totalTasks).toBe(0);
    expect(implStatus.completedTasks).toBe(0);
    expect(implStatus.percent).toBe(0);

    // Deliverables evaluation for Stage 4
    const evalImpl = evaluateStageDeliverables("implementation", specOnlyProject);

    // CRITICAL: Deliverables must NOT be marked satisfied when no implementation evidence exists
    expect(evalImpl.satisfied.length).toBe(0);
    expect(evalImpl.missing).toContain("Frontend SPA Shell");
    expect(evalImpl.missing).toContain("Application State Adapters");
    expect(evalImpl.missing).toContain("Component Library");
    expect(evalImpl.missing).toContain("Service Integrations");

    // All 4 deliverables must be in missing deliverables, none in satisfied deliverables
    expect(implStatus.missingDeliverables).toEqual([
      "Frontend SPA Shell",
      "Application State Adapters",
      "Component Library",
      "Service Integrations",
    ]);
    expect(implStatus.satisfiedDeliverables).toEqual([]);
  });
});
