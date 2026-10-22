/**
 * ProjectNova AI - Multi-Agent Teaming & Collaborative AI Workspaces
 * Phase 19: Multi-Agent Teaming & Collaborative AI Workspaces
 */

export type AgentRole =
  | 'project_architect'
  | 'builder_agent'
  | 'qa_agent'
  | 'security_reviewer'
  | 'release_manager'
  | 'project_coordinator';

export type AgentCapabilityPermission =
  | 'read_project_blueprint'
  | 'read_repository_intelligence'
  | 'read_project_brain'
  | 'propose_architecture_changes'
  | 'propose_file_generation'
  | 'read_test_evidence'
  | 'propose_test_plan'
  | 'read_security_findings'
  | 'propose_code_repair'
  | 'evaluate_release_readiness'
  | 'propose_deployment'
  | 'coordinate_delegation'
  | 'resolve_task_board'
  | 'synthesize_consensus';

export interface AgentDefinition {
  id: string;
  role: AgentRole;
  name: string;
  title: string;
  description: string;
  avatar: string;
  color: string;
  allowedCapabilities: AgentCapabilityPermission[];
  requiresApprovalForSideEffects: boolean;
  canApproveOwnProposals: false; // Always false by architectural mandate
  systemInstruction: string;
}

export type CollaborationMessageType =
  | 'task_assignment'
  | 'finding'
  | 'recommendation'
  | 'evidence_reference'
  | 'conflict_report'
  | 'review_request'
  | 'completion_report';

export interface EvidenceReference {
  sourceType: 'brain_memory' | 'artifact' | 'repository_file' | 'test_run' | 'security_finding' | 'deployment_target';
  idOrPath: string;
  snippet?: string;
  confidence: number; // 0.0 - 1.0
}

export interface TeamMessage {
  id: string;
  projectId: string;
  runId: string;
  fromAgentRole: AgentRole;
  toAgentRole?: AgentRole | 'all';
  type: CollaborationMessageType;
  title: string;
  content: string;
  evidenceReferences: EvidenceReference[];
  timestamp: string;
  inReplyToId?: string;
}

export type TeamTaskStatus =
  | 'backlog'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'blocked';

export interface TeamTask {
  id: string;
  projectId: string;
  runId: string;
  title: string;
  description: string;
  assignedRole: AgentRole;
  status: TeamTaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[]; // Task IDs that must be completed first
  evidenceRequired: string[];
  outputSummary?: string;
  requiresReview: boolean;
  reviewedByRole?: AgentRole;
  reviewApproved?: boolean;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalReview {
  id: string;
  projectId: string;
  runId: string;
  taskId: string;
  proposalTitle: string;
  proposingRole: AgentRole;
  reviewerRole: AgentRole;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  verdictReason: string;
  evidenceAudited: EvidenceReference[];
  humanSignoffRequired: boolean;
  humanSignoffStatus?: 'pending' | 'granted' | 'denied';
  humanSignoffNotes?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface ConflictReport {
  id: string;
  projectId: string;
  runId: string;
  title: string;
  agentRolesInvolved: AgentRole[];
  conflictDescription: string;
  competingClaims: {
    agentRole: AgentRole;
    claim: string;
    evidenceReference?: EvidenceReference;
  }[];
  resolutionStrategy: 'human_escalation' | 'strict_evidence_priority' | 'conservative_fail_safe';
  isResolved: boolean;
  resolutionSummary?: string;
  resolvedAt?: string;
}

export interface TeamSynthesis {
  runId: string;
  projectId: string;
  objective: string;
  consensusSummary: string;
  unresolvedConflictsCount: number;
  completedTasksCount: number;
  totalTasksCount: number;
  actionableProposals: {
    role: AgentRole;
    proposal: string;
    requiresHumanApproval: boolean;
  }[];
  synthesizedAt: string;
}

export type TeamRunStatus =
  | 'planning'
  | 'coordinating'
  | 'awaiting_reviews'
  | 'awaiting_human_approval'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'aborted';

export interface CoordinationPlan {
  runId: string;
  projectId: string;
  objective: string;
  tasks: TeamTask[];
  suggestedLeadRole: AgentRole;
  maxRounds: number;
  currentRound: number;
}

export interface TeamCoordinationRun {
  id: string;
  projectId: string;
  objective: string;
  status: TeamRunStatus;
  leadRole: AgentRole;
  participatingRoles: AgentRole[];
  tasks: TeamTask[];
  messages: TeamMessage[];
  reviews: ProposalReview[];
  conflicts: ConflictReport[];
  synthesis?: TeamSynthesis;
  activeRound: number;
  maxRounds: number;
  isAiGatewayConnected: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
}
