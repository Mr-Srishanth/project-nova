export type ExecutionStepStatus =
  | "draft"
  | "awaiting_approval"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

export type ExecutionPlanStatus =
  | "draft"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SupportedActionType =
  | "refresh_state_assessment"
  | "recalculate_roadmap_progress"
  | "recompute_recommendations"
  | "run_static_analysis"
  | "recalculate_doc_drift"
  | "audit_release_readiness";

export interface ExecutionStep {
  id: string;
  planId: string;
  order: number;
  title: string;
  description: string;
  actionType: SupportedActionType | string; // registry checked
  parameters: Record<string, unknown>;
  dependencies: string[]; // step IDs that must be completed first
  requiresApproval: boolean;
  status: ExecutionStepStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvalToken?: string; // hash/signature of actionType + parameters
  retryCount: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
  resultSummary?: string;
  failureReason?: string;
}

export interface ExecutionPlan {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: ExecutionPlanStatus;
  steps: ExecutionStep[];
  scheduleId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScheduleRecurrence = "none" | "hourly" | "daily" | "weekly";

export interface AutomationSchedule {
  id: string;
  projectId: string;
  planId: string;
  title: string;
  recurrence: ScheduleRecurrence;
  enabled: boolean;
  timezone: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus?: ExecutionPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionRunRecord {
  id: string;
  projectId: string;
  planId: string;
  stepId?: string;
  actionType: string;
  status: ExecutionStepStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  resultSummary: string;
  failureReason?: string;
  retryAttempt: number;
  scheduleId?: string;
  approvedBy?: string;
}
