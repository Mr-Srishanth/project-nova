/**
 * ProjectNova AI - Deployment & Release Orchestration Domain Types
 * Phase 16: Deployment Integrations & Release Orchestration
 */

export type DeploymentProviderId = 'vercel' | 'netlify' | 'github_actions' | 'custom_webhook';

export type DeploymentEnvironment = 'preview' | 'staging' | 'production';

export type DeploymentStatus =
  | 'draft'               // Configuration authored, not validated
  | 'preflight'           // Evaluating release gates
  | 'awaiting_approval'   // Preflight passed, awaiting human signoff (mandatory for prod)
  | 'ready'               // Approved & ready to dispatch
  | 'requested'           // Dispatched to adapter
  | 'queued'              // Provider accepted and placed in build queue
  | 'building'            // Provider building application
  | 'deploying'           // Provider deploying bundle
  | 'succeeded'           // Provider verified successful release
  | 'failed'              // Preflight or provider failed
  | 'cancelled'           // Cancelled before/during build
  | 'unknown';            // Provider state indeterminate or network timeout

export type PreflightGateStatus =
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'unknown'
  | 'not_applicable';

export interface PreflightGateItem {
  id: string;
  name: string;
  category: 'tests' | 'quality' | 'artifacts' | 'environment' | 'credentials' | 'stale_evidence';
  status: PreflightGateStatus;
  explanation: string;
  evidenceRef?: string;
  remediation?: string;
  evaluatedAt: string;
}

export interface PreflightEvaluationReport {
  id: string;
  projectId: string;
  configurationId: string;
  targetEnvironment: DeploymentEnvironment;
  sourceRevision: string;
  overallStatus: PreflightGateStatus;
  canProceedToApproval: boolean;
  blockers: string[];
  warnings: string[];
  gates: PreflightGateItem[];
  evaluatedAt: string;
}

export interface DeploymentApproval {
  id: string;
  projectId: string;
  configurationId: string;
  targetEnvironment: DeploymentEnvironment;
  boundSourceRevision: string;
  boundPreflightReportId: string;
  approvedBy: string; // e.g. "lead_developer"
  approvedAt: string;
  approvalToken: string;
  revoked: boolean;
  revocationReason?: string;
}

export interface DeploymentConfiguration {
  id: string;
  projectId: string;
  providerId: DeploymentProviderId;
  name: string;
  targetEnvironment: DeploymentEnvironment;
  sourceBranch: string;
  sourceRevision?: string;
  providerProjectId?: string; // e.g. Vercel project ID or GitHub repo "owner/repo"
  workflowFileName?: string;  // e.g. "deploy.yml" for GitHub Actions
  requiredEnvVarNames: string[]; // Variable names only - NO VALUES
  isConfigured: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConnectionStatus {
  providerId: DeploymentProviderId;
  name: string;
  version: string;
  isConfigured: boolean;
  isLiveVerified: boolean;
  supportedEnvironments: DeploymentEnvironment[];
  supportedOperations: ('deploy_preview' | 'deploy_production' | 'poll_status' | 'cancel' | 'rollback')[];
  authMechanism: 'server_env_token' | 'server_webhook_secret';
  credentialStatus: 'configured' | 'missing' | 'server_restricted';
  diagnosticMessage: string;
}

export interface DeploymentExecutionRecord {
  id: string;
  projectId: string;
  configurationId: string;
  providerId: DeploymentProviderId;
  targetEnvironment: DeploymentEnvironment;
  sourceRevision: string;
  status: DeploymentStatus;
  preflightReportId?: string;
  approvalId?: string;
  providerDeploymentId?: string;
  providerStatusRaw?: string;
  deploymentUrl?: string; // Provided directly by provider, never fabricated
  safeErrorMessage?: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  idempotencyKey: string;
  verificationResult?: {
    checkedAt: string;
    healthy: boolean;
    statusCode?: number;
    details: string;
  };
}

export interface DeploymentDispatchOptions {
  projectId: string;
  configuration: DeploymentConfiguration;
  sourceRevision: string;
  approval?: DeploymentApproval;
  idempotencyKey?: string;
}
