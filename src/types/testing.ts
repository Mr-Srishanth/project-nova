/**
 * ProjectNova AI - Test Automation & Verification Domain Types
 * Phase 15: Test Automation & Verification Engine
 */

export type TestCategory =
  | 'unit'
  | 'integration'
  | 'contract'
  | 'security'
  | 'static_analysis'
  | 'drift_verification'
  | 'dependency_dag'
  | 'artifact_syntax'
  | 'regression';

export type TestExecutionStatus =
  | 'draft'               // Proposed or newly authored, not yet validated
  | 'configured'          // Configured and ready to execute
  | 'running'             // In-flight execution
  | 'passed'              // Explicitly verified and succeeded
  | 'failed'              // Explicitly executed and failed assertions
  | 'blocked'             // Missing prerequisites, target files, or capabilities
  | 'skipped'             // Intentionally skipped with recorded rationale
  | 'unknown';            // Unverified or indeterminate outcome

export type VerificationExecutionType =
  | 'machine_verified'    // Executed deterministically by verified local engine
  | 'imported_report'     // External report imported by user (e.g. CI/CD JUnit/JSON)
  | 'manually_recorded';  // Recorded by human reviewer

export interface TestCaseAssertion {
  id: string;
  description: string;
  target?: string;
  expected?: string | number | boolean;
  actual?: string | number | boolean;
  passed?: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  capabilityId: string; // Must match a registered VerificationCapability
  status: TestExecutionStatus;
  priority: 'critical' | 'high' | 'medium' | 'low';
  targetPaths: string[]; // Relative file paths tested
  parameters: Record<string, any>;
  assertions: TestCaseAssertion[];
  lastExecutedAt?: string;
  durationMs?: number;
  failureMessage?: string;
  relatedProposalId?: string; // Optional linkage to Phase 14 RepairProposal
  relatedFindingId?: string;  // Optional linkage to Phase 14 CodeFinding
  relatedRequirementId?: string; // Linkage to Blueprint requirement
  targetHashAtExecution?: string; // Hash of target file to detect stale regression passes
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  testCaseIds: string[];
}

export interface TestPlan {
  id: string;
  projectId: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  testCases: TestCase[];
  suites: TestSuite[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    unknown: number;
    lastRunAt?: string;
  };
}

export interface TestEvidenceItem {
  id: string;
  type: 'log_slice' | 'ast_metric' | 'security_alert' | 'diff_verification' | 'cycle_path' | 'syntax_error';
  title: string;
  detail: string;
  rawPayload?: Record<string, any>;
}

export interface TestExecutionRecord {
  id: string;
  planId: string;
  testCaseId: string;
  projectId: string;
  capabilityId: string;
  executionType: VerificationExecutionType;
  status: TestExecutionStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  assertionsPassed: number;
  assertionsTotal: number;
  outputSanitized: string;
  evidence: TestEvidenceItem[];
  errorMessage?: string;
  executedBy?: string; // 'system_engine' | user identity
  targetFilesSnapshot?: Record<string, string>; // path -> hash
}

export interface VerificationCapability {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  isRegistered: boolean;
  allowedTargetExtensions: string[];
  parameterSchema: Record<string, { type: 'string' | 'number' | 'boolean' | 'array'; required: boolean; description: string }>;
  maxTimeoutMs: number;
}

export interface VerificationGateResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  evaluatedAt: string;
  metrics: {
    totalTests: number;
    passed: number;
    failed: number;
    blocked: number;
    unknown: number;
    criticalPassingRate: number; // percentage
  };
}
