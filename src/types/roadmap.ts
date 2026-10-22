export type LifecycleStageId =
  | "discovery"
  | "planning"
  | "architecture"
  | "implementation"
  | "testing"
  | "deployment"
  | "maintenance";

export type StageStatus = "not_started" | "in_progress" | "blocked" | "completed";

export interface StageDefinition {
  id: LifecycleStageId;
  order: number;
  name: string;
  shortDesc: string;
  description: string;
  deliverables: string[];
  suggestedTools: string[];
}

export interface StageState {
  id: LifecycleStageId;
  status: StageStatus;
  manualOverride?: boolean;
  notes?: string;
  updatedAt?: string;
}

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskWorkflowStatus = "todo" | "in_progress" | "blocked" | "done";

export interface WorkflowTask {
  id: string;
  milestoneId: string;
  stageId?: LifecycleStageId;
  title: string;
  description?: string;
  status: TaskWorkflowStatus;
  priority: TaskPriority;
  estimatedHours?: number;
  startDate?: string;
  dueDate?: string;
  dependencies: string[]; // List of task IDs that must be completed before this task can start
  associatedMemoryIds?: string[]; // Project Brain linkage
  completedAt?: string;
}

export interface RoadmapMilestone {
  id: string;
  projectId: string;
  stageId?: LifecycleStageId;
  order: number;
  phase: string;
  goal: string;
  startDate?: string;
  targetDate?: string;
  estimatedDuration: string;
  dependencies: string[]; // List of milestone IDs
  skillsOrTech: string[];
  tasks: WorkflowTask[];
}
