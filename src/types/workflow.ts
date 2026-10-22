/**
 * ProjectNova AI - Visual Workflow Builder & Reusable Automation Domain Types
 * Phase 18: Visual Workflow Builder & Reusable Automation Pipelines
 */

export type WorkflowState = 'draft' | 'validated' | 'published' | 'archived';

export type WorkflowNodeCategory =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'approval'
  | 'terminal';

export type WorkflowExecutionStatus =
  | 'queued'
  | 'validating'
  | 'running'
  | 'awaiting_approval'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'unknown';

export type SupportedWorkflowOperation =
  | 'trigger_manual'
  | 'trigger_scheduled'
  | 'trigger_event'
  | 'action_validate_blueprint'
  | 'action_inspect_artifacts'
  | 'action_run_static_analysis'
  | 'action_run_test_suite'
  | 'action_audit_release_gate'
  | 'action_evaluate_deployment_preflight'
  | 'action_poll_target_health'
  | 'action_retrieve_brain_context'
  | 'action_assign_agent_task'
  | 'action_run_team_coordination'
  | 'action_synthesize_findings'
  | 'condition_evaluate'
  | 'approval_human_gate'
  | 'terminal_success'
  | 'terminal_failure';

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  category: WorkflowNodeCategory;
  operationId: SupportedWorkflowOperation;
  label: string;
  description?: string;
  position: WorkflowNodePosition;
  config: Record<string, any>;
  inputMappings?: Record<string, string>; // targetParam -> sourceNodeId.outputParam
  retryLimit?: number;
  timeoutMs?: number;
  isApprovalRequired?: boolean;
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  conditionBranch?: 'true' | 'false' | 'always'; // Used for condition splits
}

export interface WorkflowDefinition {
  id: string;
  projectId: string;
  name: string;
  description: string;
  tags: string[];
  version: number;
  definitionHash: string;
  state: WorkflowState;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
}

export interface NodeExecutionRecord {
  nodeId: string;
  operationId: SupportedWorkflowOperation;
  status: WorkflowExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  sanitizedOutput?: Record<string, any>;
  errorMessage?: string;
  retryAttempts: number;
}

export interface WorkflowExecutionRecord {
  id: string;
  workflowId: string;
  workflowVersion: number;
  projectId: string;
  triggerSource: 'manual' | 'scheduled' | 'event';
  status: WorkflowExecutionStatus;
  activeNodeId?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  nodeExecutions: Record<string, NodeExecutionRecord>;
  sanitizedOutputs: Record<string, any>;
  errorMessage?: string;
  approvalRequestId?: string;
  isCancelled: boolean;
}

export interface WorkflowValidationDiagnostic {
  type: 'error' | 'warning';
  nodeId?: string;
  message: string;
}

export interface WorkflowValidationReport {
  isValid: boolean;
  canPublish: boolean;
  diagnostics: WorkflowValidationDiagnostic[];
  topologicalOrder: string[]; // Order of node execution
  evaluatedAt: string;
}
