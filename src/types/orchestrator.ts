export type ActionRiskLevel = "low" | "medium" | "high" | "critical";

export type OperationState =
  | "proposed"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked";

export interface OrchestrationAction {
  id: string;
  projectId: string;
  title: string;
  description: string;
  targetModule: "blueprint" | "flow" | "build" | "quality" | "release" | "docs" | "brain";
  actionType:
    | "create_blueprint"
    | "resolve_task_blocker"
    | "synthesize_artifact"
    | "approve_artifact"
    | "resolve_quality_defect"
    | "run_test_case"
    | "configure_environment"
    | "signoff_release"
    | "sync_documentation"
    | "system_refresh";
  riskLevel: ActionRiskLevel;
  requiresApproval: boolean;
  sourceEvidence: string;
  expectedOutcome: string;
  targetEntityId?: string;
  targetRoute: string;
  status: OperationState;
  stateReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  completedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStateSnapshot {
  projectId: string;
  projectName: string;
  capturedAt: string;
  blueprint: {
    defined: boolean;
    title?: string;
    endpointCount: number;
    entityCount: number;
  };
  roadmap: {
    totalMilestones: number;
    completedMilestones: number;
    currentStage: string;
    blockedTasksCount: number;
  };
  artifacts: {
    total: number;
    approved: number;
    unapproved: number;
    planned: number;
  };
  quality: {
    assessed: boolean;
    healthGrade?: "A" | "B" | "C" | "D" | "F";
    openErrors: number;
    openWarnings: number;
    unrunTests: number;
    failedTests: number;
    passedTests: number;
  };
  release: {
    status?: string;
    readinessPassCount: number;
    blockersCount: number;
    unverifiedCount: number;
    isReady: boolean;
  };
  docs: {
    totalDocs: number;
    openDriftFindings: number;
  };
  brain: {
    risksCount: number;
    decisionsCount: number;
    constraintsCount: number;
  };
}

export interface OrchestrationAssessment {
  id: string;
  projectId: string;
  assessedAt: string;
  snapshot: ProjectStateSnapshot;
  actions: OrchestrationAction[];
  overallHealth: "healthy" | "needs_attention" | "blocked";
  primaryBlockerSummary?: string;
}
