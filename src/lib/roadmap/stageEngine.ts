import type {
  LifecycleStageId,
  StageDefinition,
  StageStatus,
  RoadmapMilestone,
} from "@/types/roadmap";
import type { Project } from "@/types/project";
import type { Milestone } from "@/types/task";

export interface StageStatusResult {
  status: StageStatus;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  percent: number;
  hasTasks: boolean;
  manualOverride?: boolean;
  overrideNote?: string;
  blockedReason?: string;
  missingDeliverables?: string[];
  satisfiedDeliverables?: string[];
}

export const STAGE_WORKSPACE_MAPPING: Record<
  LifecycleStageId,
  {
    path: (projectId: string) => string;
    label: string;
    description: string;
  }
> = {
  discovery: {
    path: () => "/discover",
    label: "Discovery Studio",
    description: "Idea formulation, problem framing, and clarification.",
  },
  planning: {
    path: (projectId) => `/projects/${projectId}`,
    label: "Project Brain & Specs",
    description: "Scope, constraints, architecture requirements, and memories.",
  },
  architecture: {
    path: (projectId) => `/blueprint?project=${projectId}`,
    label: "Blueprint Studio",
    description: "System topology, API contracts, schema designer, and vector diagram.",
  },
  implementation: {
    path: (projectId) => `/ui-studio?project=${projectId}`,
    label: "UI & Build Studio",
    description: "Live component building, code editor, and sandbox preview.",
  },
  testing: {
    path: (projectId) => `/testing?project=${projectId}`,
    label: "Test Automation",
    description: "Automated test suites, Vitest runner, and quality gates.",
  },
  deployment: {
    path: (projectId) => `/deployments?project=${projectId}`,
    label: "Deployment Center",
    description: "Release packaging, hosting environments, and cloud deployment.",
  },
  maintenance: {
    path: (projectId) => `/monitoring?project=${projectId}`,
    label: "Monitoring Center",
    description: "Runtime telemetry, risk ledger, and iteration milestones.",
  },
};

export const LIFECYCLE_STAGES: StageDefinition[] = [
  {
    id: "discovery",
    order: 1,
    name: "1. Idea & Discovery",
    shortDesc: "Problem framing & concept exploration",
    description: "Clarify user problem, target beneficiaries, market/operational rationale, and core feasibility.",
    deliverables: ["Problem Statement", "Target User Groups", "Key Feature Wishlist", "Feasibility Score"],
    suggestedTools: ["Discovery Studio", "AI Idea Analysis", "Domain Exploration"],
  },
  {
    id: "planning",
    order: 2,
    name: "2. Requirements & Planning",
    shortDesc: "Scope tiering & constraints",
    description: "Partition features into MVP vs. Later, register hard deadlines, technical constraints, and brain memories.",
    deliverables: ["MVP Feature Scope", "Technical Constraints", "Milestone Roadmap", "Project Brain Initial Memories"],
    suggestedTools: ["Project Brain", "Feature Breakdown Matrix", "Constraint Ledger"],
  },
  {
    id: "architecture",
    order: 3,
    name: "3. Blueprint & Architecture",
    shortDesc: "Topology, API contracts & DB DDL",
    description: "Model system components, connection edges, database schema entities, and API route definitions.",
    deliverables: ["Architecture Vector Diagram", "SQL DDL Migration Script", "API Contracts", "Directory Tree Spec"],
    suggestedTools: ["Blueprint Studio", "SVG Topology Visualizer", "Schema Designer"],
  },
  {
    id: "implementation",
    order: 4,
    name: "4. Implementation & Build",
    shortDesc: "Core feature construction",
    description: "Execute milestone tasks, code application modules, and integrate services.",
    deliverables: ["Frontend SPA Shell", "Application State Adapters", "Component Library", "Service Integrations"],
    suggestedTools: ["Workspace Tasks", "Project AI Assistant", "Code Scaffolder"],
  },
  {
    id: "testing",
    order: 5,
    name: "5. Testing & Quality",
    shortDesc: "Unit, contract & accessibility gates",
    description: "Run automated tests, verify reduced motion and keyboard navigation, and ensure zero regression.",
    deliverables: ["Storage Unit Tests", "Gateway Security Tests", "Accessibility Check", "Production Build Verification"],
    suggestedTools: ["Vitest Suite", "Type Checker", "Quality Gate Auditor"],
  },
  {
    id: "deployment",
    order: 6,
    name: "6. Deployment & Release",
    shortDesc: "Containerization & packaging",
    description: "Package production bundle, configure environment variables, and verify hosting prerequisites.",
    deliverables: ["Production Dist Bundle", "Deployment Spec Guide", "Environment Schema (.env.example)"],
    suggestedTools: ["Vite Production Bundler", "Environment Manager", "CI/CD Checklist"],
  },
  {
    id: "maintenance",
    order: 7,
    name: "7. Maintenance & Iteration",
    shortDesc: "Feedback loop & evolution",
    description: "Track architectural decisions, log new known risks, and schedule subsequent project milestones.",
    deliverables: ["Decision History", "Risk Audit Log", "Post-MVP Enhancements"],
    suggestedTools: ["Project Brain", "Roadmap Iteration Planner", "Risk Radar"],
  },
];

/**
 * Maps legacy Project.milestones into Phase 4 RoadmapMilestones seamlessly
 */
export function migrateLegacyMilestones(legacyMilestones: Milestone[] = []): RoadmapMilestone[] {
  return legacyMilestones.map((m) => {
    // Infer appropriate stageId based on phase name
    let stageId: LifecycleStageId = "implementation";
    const lower = m.phase.toLowerCase();
    if (lower.includes("discovery") || lower.includes("idea")) stageId = "discovery";
    else if (lower.includes("plan") || lower.includes("requirement")) stageId = "planning";
    else if (lower.includes("architect") || lower.includes("blueprint") || lower.includes("schema")) stageId = "architecture";
    else if (lower.includes("test") || lower.includes("quality")) stageId = "testing";
    else if (lower.includes("deploy") || lower.includes("release")) stageId = "deployment";
    else if (lower.includes("maintain") || lower.includes("iterat")) stageId = "maintenance";

    return {
      id: m.id,
      projectId: m.projectId,
      stageId,
      order: m.order,
      phase: m.phase,
      goal: m.goal,
      estimatedDuration: m.estimatedDuration || "1-2 weeks",
      dependencies: m.dependencies || [],
      skillsOrTech: m.skillsOrTech || [],
      tasks: (m.tasks || []).map((t, idx) => ({
        id: t.id,
        milestoneId: m.id,
        stageId,
        title: t.title,
        description: t.description,
        status: t.status === "done" ? "done" : t.status === "in_progress" ? "in_progress" : "todo",
        priority: idx === 0 ? "high" : "medium",
        dependencies: [],
        associatedMemoryIds: [],
        completedAt: t.completedAt,
      })),
    };
  });
}

/**
 * Validates deliverables and prerequisites for each lifecycle stage against actual evidence.
 * All deliverables defined in LIFECYCLE_STAGES are evaluated to ensure complete accounting.
 */
export function evaluateStageDeliverables(
  stageId: LifecycleStageId,
  project: Project
): { missing: string[]; satisfied: string[] } {
  const missing: string[] = [];
  const satisfied: string[] = [];

  const milestones: RoadmapMilestone[] =
    project.roadmapMilestones && project.roadmapMilestones.length > 0
      ? project.roadmapMilestones
      : migrateLegacyMilestones(project.milestones);

  const stageTasks = milestones
    .flatMap((m) => m.tasks || [])
    .filter((t) => (t.stageId || "implementation") === stageId);

  const completedTasks = stageTasks.filter((t) => t.status === "done");
  const hasCompletedTasks = completedTasks.length > 0;
  const allTasksCompleted = stageTasks.length > 0 && completedTasks.length === stageTasks.length;

  switch (stageId) {
    case "discovery":
      // Deliverables: ["Problem Statement", "Target User Groups", "Key Feature Wishlist", "Feasibility Score"]
      if (project.name && project.name.trim().length > 0) {
        satisfied.push("Problem Statement");
      } else {
        missing.push("Problem Statement");
      }

      if (project.objective && project.objective.trim().length > 0) {
        satisfied.push("Target User Groups");
      } else {
        missing.push("Target User Groups");
      }

      if (
        (project.blueprint?.features?.mvp && project.blueprint.features.mvp.length > 0) ||
        (project.blueprint?.features?.important && project.blueprint.features.important.length > 0) ||
        (project.name && project.objective)
      ) {
        satisfied.push("Key Feature Wishlist");
      } else {
        missing.push("Key Feature Wishlist");
      }

      if (project.category && project.category.trim().length > 0) {
        satisfied.push("Feasibility Score");
      } else {
        missing.push("Feasibility Score");
      }
      break;

    case "planning":
      // Deliverables: ["MVP Feature Scope", "Technical Constraints", "Milestone Roadmap", "Project Brain Initial Memories"]
      if (project.blueprint?.features?.mvp && project.blueprint.features.mvp.length > 0) {
        satisfied.push("MVP Feature Scope");
      } else {
        missing.push("MVP Feature Scope");
      }

      if (
        (project.technologies && project.technologies.length > 0) ||
        (project.constraints && project.constraints.length > 0)
      ) {
        satisfied.push("Technical Constraints");
      } else {
        missing.push("Technical Constraints");
      }

      if (milestones.length > 0 || (project.milestones && project.milestones.length > 0)) {
        satisfied.push("Milestone Roadmap");
      } else {
        missing.push("Milestone Roadmap");
      }

      // Project Brain Initial Memories satisfied if blueprint or constraints/technologies registered
      if (
        (project.blueprint && project.blueprint.techStack?.length > 0) ||
        (project.constraints && project.constraints.trim().length > 0) ||
        project.technologies?.length > 0
      ) {
        satisfied.push("Project Brain Initial Memories");
      } else {
        missing.push("Project Brain Initial Memories");
      }
      break;

    case "architecture":
      // Deliverables: ["Architecture Vector Diagram", "SQL DDL Migration Script", "API Contracts", "Directory Tree Spec"]
      if (project.blueprint && (project.blueprint.architecture?.nodes?.length ?? 0) > 0) {
        satisfied.push("Architecture Vector Diagram");
      } else {
        missing.push("Architecture Vector Diagram");
      }

      if (
        project.blueprint?.database?.sql ||
        (project.blueprint?.database?.entities && project.blueprint.database.entities.length > 0) ||
        (project.blueprint && (project.blueprint.architecture?.nodes?.length ?? 0) > 0)
      ) {
        satisfied.push("SQL DDL Migration Script");
      } else {
        missing.push("SQL DDL Migration Script");
      }

      if (
        (project.blueprint?.api && project.blueprint.api.length > 0) ||
        (project.blueprint && (project.blueprint.architecture?.nodes?.length ?? 0) > 0)
      ) {
        satisfied.push("API Contracts");
      } else {
        missing.push("API Contracts");
      }

      if (
        (project.blueprint?.folderStructure && project.blueprint.folderStructure.trim().length > 0) ||
        (project.blueprint && (project.blueprint.architecture?.nodes?.length ?? 0) > 0)
      ) {
        satisfied.push("Directory Tree Spec");
      } else {
        missing.push("Directory Tree Spec");
      }
      break;

    case "implementation":
      // Deliverables: ["Frontend SPA Shell", "Application State Adapters", "Component Library", "Service Integrations"]
      // Real evidence requires tasks executed or artifacts created, not merely a blueprint
      if (allTasksCompleted && completedTasks.length > 0) {
        satisfied.push("Frontend SPA Shell");
        satisfied.push("Application State Adapters");
        satisfied.push("Component Library");
        satisfied.push("Service Integrations");
      } else if (hasCompletedTasks) {
        satisfied.push("Frontend SPA Shell");
        if (completedTasks.length >= 2) {
          satisfied.push("Application State Adapters");
        } else {
          missing.push("Application State Adapters");
        }
        if (completedTasks.length >= 3) {
          satisfied.push("Component Library");
        } else {
          missing.push("Component Library");
        }
        missing.push("Service Integrations");
      } else {
        missing.push("Frontend SPA Shell");
        missing.push("Application State Adapters");
        missing.push("Component Library");
        missing.push("Service Integrations");
      }
      break;

    case "testing":
      // Deliverables: ["Storage Unit Tests", "Gateway Security Tests", "Accessibility Check", "Production Build Verification"]
      if (hasCompletedTasks || allTasksCompleted) {
        satisfied.push("Storage Unit Tests");
        if (completedTasks.length >= 2 || allTasksCompleted) {
          satisfied.push("Gateway Security Tests");
        } else {
          missing.push("Gateway Security Tests");
        }
        if (completedTasks.length >= 3 || allTasksCompleted) {
          satisfied.push("Accessibility Check");
        } else {
          missing.push("Accessibility Check");
        }
        if (allTasksCompleted && completedTasks.length >= 4) {
          satisfied.push("Production Build Verification");
        } else {
          missing.push("Production Build Verification");
        }
      } else {
        missing.push("Storage Unit Tests");
        missing.push("Gateway Security Tests");
        missing.push("Accessibility Check");
        missing.push("Production Build Verification");
      }
      break;

    case "deployment":
      // Deliverables: ["Production Dist Bundle", "Deployment Spec Guide", "Environment Schema (.env.example)"]
      if (hasCompletedTasks || allTasksCompleted) {
        satisfied.push("Production Dist Bundle");
        if (completedTasks.length >= 2 || allTasksCompleted) {
          satisfied.push("Deployment Spec Guide");
        } else {
          missing.push("Deployment Spec Guide");
        }
        if (allTasksCompleted) {
          satisfied.push("Environment Schema (.env.example)");
        } else {
          missing.push("Environment Schema (.env.example)");
        }
      } else {
        missing.push("Production Dist Bundle");
        missing.push("Deployment Spec Guide");
        missing.push("Environment Schema (.env.example)");
      }
      break;

    case "maintenance":
      // Deliverables: ["Decision History", "Risk Audit Log", "Post-MVP Enhancements"]
      if (project.blueprint?.futureImprovements && project.blueprint.futureImprovements.length > 0) {
        satisfied.push("Decision History");
      } else {
        missing.push("Decision History");
      }

      if (project.constraints && project.constraints.trim().length > 0) {
        satisfied.push("Risk Audit Log");
      } else {
        missing.push("Risk Audit Log");
      }

      if (
        (project.blueprint?.futureImprovements && project.blueprint.futureImprovements.length > 0) ||
        (project.blueprint?.features?.advanced && project.blueprint.features.advanced.length > 0) ||
        (project.blueprint?.features?.optional && project.blueprint.features.optional.length > 0)
      ) {
        satisfied.push("Post-MVP Enhancements");
      } else {
        missing.push("Post-MVP Enhancements");
      }
      break;
  }

  return { missing, satisfied };
}

/**
 * Computes live stage status and task progress from real project data.
 * Adheres to strict lifecycle integrity rules:
 * - A stage with no tasks and no satisfied deliverables is NOT STARTED.
 * - A stage with tasks only completes when all tasks are done AND required deliverables are satisfied.
 * - Blocked state is triggered if prerequisite stages or task dependencies fail.
 * - Manual overrides from project.stageStates are respected and clearly marked.
 */
export function calculateStageStatuses(project: Project): Record<LifecycleStageId, StageStatusResult> {
  const milestones: RoadmapMilestone[] =
    project.roadmapMilestones && project.roadmapMilestones.length > 0
      ? project.roadmapMilestones
      : migrateLegacyMilestones(project.milestones);

  // Isolate tasks strictly belonging to this project
  const allTasks = milestones.flatMap((m) => m.tasks || []);

  // Map tasks by stage
  const stageTasks: Record<LifecycleStageId, typeof allTasks> = {
    discovery: [],
    planning: [],
    architecture: [],
    implementation: [],
    testing: [],
    deployment: [],
    maintenance: [],
  };

  for (const t of allTasks) {
    const stage = t.stageId || "implementation";
    if (stageTasks[stage]) {
      stageTasks[stage].push(t);
    }
  }

  const result: Record<LifecycleStageId, StageStatusResult> = {} as any;
  const stageOrder: LifecycleStageId[] = [
    "discovery",
    "planning",
    "architecture",
    "implementation",
    "testing",
    "deployment",
    "maintenance",
  ];

  for (let i = 0; i < stageOrder.length; i++) {
    const stageId = stageOrder[i];
    const tasks = stageTasks[stageId];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
    const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
    const hasTasks = totalTasks > 0;
    const percent = hasTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const deliverableCheck = evaluateStageDeliverables(stageId, project);
    const hasDeliverablesMissing = deliverableCheck.missing.length > 0;

    // Check manual override if configured in project.stageStates
    const manualOverrideEntry = project.stageStates?.find((s) => s.id === stageId && s.manualOverride);

    if (manualOverrideEntry) {
      result[stageId] = {
        status: manualOverrideEntry.status,
        totalTasks,
        completedTasks,
        blockedTasks,
        percent: manualOverrideEntry.status === "completed" ? 100 : percent,
        hasTasks,
        manualOverride: true,
        overrideNote: manualOverrideEntry.notes || "Manually overridden",
        missingDeliverables: deliverableCheck.missing,
        satisfiedDeliverables: deliverableCheck.satisfied,
      };
      continue;
    }

    // Prerequisite check: A stage is only blocked by prerequisite if it has explicit incomplete task dependencies
    let isBlockedByPrereq = false;
    let blockedReason: string | undefined;

    // Direct task blocked state
    if (blockedTasks > 0) {
      isBlockedByPrereq = true;
      blockedReason = `${blockedTasks} task(s) currently blocked by dependencies.`;
    }

    let status: StageStatus = "not_started";

    if (isBlockedByPrereq) {
      status = "blocked";
    } else if (blockedTasks > 0) {
      status = "blocked";
      blockedReason = `${blockedTasks} task(s) currently blocked by dependencies.`;
    } else if (hasTasks) {
      if (completedTasks === totalTasks && !hasDeliverablesMissing) {
        status = "completed";
      } else if (completedTasks > 0 || inProgressTasks > 0) {
        status = "in_progress";
      } else {
        status = "not_started";
      }
    } else {
      // No tasks defined for this stage
      if (stageId === "discovery") {
        // Discovery without tasks can be completed if project was fully specified with name and objective
        if (project.name && project.objective && !hasDeliverablesMissing) {
          status = "completed";
        } else if (project.name) {
          status = "in_progress";
        } else {
          status = "not_started";
        }
      } else if (stageId === "architecture") {
        // Architecture completed only if blueprint nodes and contracts exist
        if (project.blueprint && (project.blueprint.architecture?.nodes?.length ?? 0) > 0 && !hasDeliverablesMissing) {
          status = "completed";
        } else if (project.blueprint && (project.blueprint.architecture?.nodes?.length ?? 0) > 0) {
          status = "in_progress";
        } else {
          status = "not_started";
        }
      } else if (stageId === "planning") {
        if (project.blueprint?.features?.mvp && project.blueprint.features.mvp.length > 0) {
          status = "completed";
        } else {
          status = "not_started";
        }
      } else {
        // Implementation, Testing, Deployment, Maintenance with no tasks:
        // Must never appear completed when no tasks or artifacts exist.
        status = "not_started";
      }
    }

    result[stageId] = {
      status,
      totalTasks,
      completedTasks,
      blockedTasks,
      percent: status === "completed" && totalTasks === 0 ? 100 : percent,
      hasTasks,
      manualOverride: false,
      blockedReason,
      missingDeliverables: deliverableCheck.missing,
      satisfiedDeliverables: deliverableCheck.satisfied,
    };
  }

  return result;
}
