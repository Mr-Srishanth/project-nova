/**
 * ProjectNova AI - Deployment Orchestrator Engine
 * Phase 16: Deployment Integrations & Release Orchestration
 *
 * Coordinates:
 * - Preflight evaluation
 * - Approval validation & strict parameter binding
 * - Secure dispatch to registered provider adapters
 * - Real status polling
 * - Post-deployment health verification (with SSRF protection)
 * - Observability audit logging
 */

import {
  DeploymentConfiguration,
  DeploymentExecutionRecord,
  DeploymentApproval
} from '../../types/deployment';
import { deploymentStorage } from '../storage/deploymentStorage';
import { preflightGateEvaluator } from './preflightGateEvaluator';
import { deploymentProviderRegistry, validateSafeDeploymentUrl } from './deploymentProviderRegistry';
import { activityLogger } from '../observability/activityLogger';
import type { Project } from '../../types/project';

export interface DispatchRequestOptions {
  project: Project;
  configuration: DeploymentConfiguration;
  sourceRevision: string;
  approvalToken?: string;
  executedBy?: string;
  authToken?: string; // Secure token injected by test or server bridge
}

export class DeploymentOrchestrator {
  /**
   * Generates a project approval bound strictly to exact project, target, revision, and preflight ID.
   */
  public createApproval(
    projectId: string,
    configurationId: string,
    targetEnvironment: 'preview' | 'staging' | 'production',
    boundSourceRevision: string,
    boundPreflightReportId: string,
    approvedBy: string = 'authorized_engineer'
  ): DeploymentApproval {
    const approval: DeploymentApproval = {
      id: `appr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      configurationId,
      targetEnvironment,
      boundSourceRevision,
      boundPreflightReportId,
      approvedBy,
      approvedAt: new Date().toISOString(),
      approvalToken: `tok_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`,
      revoked: false
    };

    deploymentStorage.saveApproval(approval);

    activityLogger.log({
      projectId,
      category: 'release_readiness',
      eventType: 'deployment_approved',
      severity: 'info',
      outcome: 'succeeded',
      sourceSubsystem: 'release_center',
      summary: `Deployment approved for ${targetEnvironment} (${boundSourceRevision.slice(0, 8)})`,
      safeDetails: {
        configurationId,
        targetEnvironment,
        approvedBy
      }
    });

    return approval;
  }

  /**
   * Validates whether an approval remains valid or was invalidated by input changes.
   */
  public validateApproval(
    approval: DeploymentApproval | null,
    currentRevision: string,
    currentConfig: DeploymentConfiguration
  ): { valid: boolean; reason?: string } {
    if (!approval) {
      return { valid: false, reason: 'No approval record provided.' };
    }
    if (approval.revoked) {
      return { valid: false, reason: `Approval was explicitly revoked: ${approval.revocationReason || 'No reason'}` };
    }
    if (approval.projectId !== currentConfig.projectId) {
      return { valid: false, reason: 'Approval bound to different project.' };
    }
    if (approval.configurationId !== currentConfig.id) {
      return { valid: false, reason: 'Approval bound to different configuration.' };
    }
    if (approval.targetEnvironment !== currentConfig.targetEnvironment) {
      return { valid: false, reason: 'Approval bound to different environment.' };
    }
    if (approval.boundSourceRevision !== currentRevision) {
      return {
        valid: false,
        reason: `Source revision changed since approval (${approval.boundSourceRevision.slice(0, 8)} vs ${currentRevision.slice(0, 8)}). Approval invalidated.`
      };
    }
    return { valid: true };
  }

  /**
   * Dispatches a deployment to the chosen provider adapter with complete gate enforcement.
   */
  public async requestDeployment(options: DispatchRequestOptions): Promise<DeploymentExecutionRecord> {
    const { project, configuration, sourceRevision, approvalToken, authToken } = options;
    const requestedAt = new Date().toISOString();
    const idempotencyKey = `dep_req_${configuration.id}_${sourceRevision}_${Date.now()}`;

    // 1. Run Preflight Gates
    const preflight = await preflightGateEvaluator.evaluatePreflight({
      project,
      configuration,
      targetRevision: sourceRevision
    });

    if (preflight.overallStatus !== 'passed') {
      const record: DeploymentExecutionRecord = {
        id: `dep-${Date.now()}`,
        projectId: project.id,
        configurationId: configuration.id,
        providerId: configuration.providerId,
        targetEnvironment: configuration.targetEnvironment,
        sourceRevision,
        status: 'failed',
        preflightReportId: preflight.id,
        safeErrorMessage: `Preflight checks failed: ${preflight.blockers.join('; ')}`,
        requestedAt,
        idempotencyKey
      };
      deploymentStorage.saveRecord(record);
      return record;
    }

    // 2. Validate Production Approval (Mandatory for production)
    let approval: DeploymentApproval | undefined;
    if (configuration.targetEnvironment === 'production') {
      if (!approvalToken) {
        const record: DeploymentExecutionRecord = {
          id: `dep-${Date.now()}`,
          projectId: project.id,
          configurationId: configuration.id,
          providerId: configuration.providerId,
          targetEnvironment: configuration.targetEnvironment,
          sourceRevision,
          status: 'awaiting_approval',
          preflightReportId: preflight.id,
          safeErrorMessage: 'Production deployments require explicit human signoff and valid approval token.',
          requestedAt,
          idempotencyKey
        };
        deploymentStorage.saveRecord(record);
        return record;
      }

      // Look up and validate approval
      const approvals = (await deploymentStorage.getApproval(approvalToken)) || null;
      const approvalCheck = this.validateApproval(approvals, sourceRevision, configuration);
      if (!approvalCheck.valid) {
        const record: DeploymentExecutionRecord = {
          id: `dep-${Date.now()}`,
          projectId: project.id,
          configurationId: configuration.id,
          providerId: configuration.providerId,
          targetEnvironment: configuration.targetEnvironment,
          sourceRevision,
          status: 'failed',
          preflightReportId: preflight.id,
          safeErrorMessage: `Production approval invalid: ${approvalCheck.reason}`,
          requestedAt,
          idempotencyKey
        };
        deploymentStorage.saveRecord(record);
        return record;
      }
      approval = approvals!;
    }

    // 3. Resolve Provider Adapter
    const adapter = deploymentProviderRegistry.get(configuration.providerId);
    if (!adapter) {
      const record: DeploymentExecutionRecord = {
        id: `dep-${Date.now()}`,
        projectId: project.id,
        configurationId: configuration.id,
        providerId: configuration.providerId,
        targetEnvironment: configuration.targetEnvironment,
        sourceRevision,
        status: 'failed',
        preflightReportId: preflight.id,
        safeErrorMessage: `Unrecognized deployment provider: ${configuration.providerId}`,
        requestedAt,
        idempotencyKey
      };
      deploymentStorage.saveRecord(record);
      return record;
    }

    // 4. Dispatch to Provider
    const startedAt = new Date().toISOString();
    const result = await adapter.dispatchDeployment({
      projectId: project.id,
      configuration,
      sourceRevision,
      approval,
      idempotencyKey,
      authToken
    });

    const completedAt = result.status === 'succeeded' || result.status === 'failed' ? new Date().toISOString() : undefined;

    const record: DeploymentExecutionRecord = {
      id: `dep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId: project.id,
      configurationId: configuration.id,
      providerId: configuration.providerId,
      targetEnvironment: configuration.targetEnvironment,
      sourceRevision,
      status: result.status,
      preflightReportId: preflight.id,
      approvalId: approval?.id,
      providerDeploymentId: result.providerDeploymentId,
      deploymentUrl: result.deploymentUrl,
      safeErrorMessage: result.errorMessage,
      requestedAt,
      startedAt,
      completedAt,
      idempotencyKey
    };

    deploymentStorage.saveRecord(record);

    activityLogger.log({
      projectId: project.id,
      category: 'release_readiness',
      eventType: 'deployment_dispatched',
      severity: result.status === 'failed' ? 'error' : 'info',
      outcome: result.status === 'failed' ? 'failed' : 'succeeded',
      sourceSubsystem: 'release_center',
      summary: `Deployment dispatched to ${configuration.providerId} (${result.status})`,
      safeDetails: {
        providerId: configuration.providerId,
        targetEnvironment: configuration.targetEnvironment,
        providerDeploymentId: result.providerDeploymentId
      }
    });

    return record;
  }

  /**
   * Refreshes real deployment status from the provider.
   */
  public async pollStatus(record: DeploymentExecutionRecord, config: DeploymentConfiguration, authToken?: string): Promise<DeploymentExecutionRecord> {
    if (!record.providerDeploymentId) {
      return record;
    }

    const adapter = deploymentProviderRegistry.get(record.providerId);
    if (!adapter) {
      return record;
    }

    const poll = await adapter.pollDeploymentStatus(record.providerDeploymentId, config, authToken);
    const updated: DeploymentExecutionRecord = {
      ...record,
      status: poll.status,
      providerStatusRaw: poll.providerStatusRaw,
      deploymentUrl: poll.deploymentUrl || record.deploymentUrl,
      safeErrorMessage: poll.errorMessage || record.safeErrorMessage,
      completedAt: poll.status === 'succeeded' || poll.status === 'failed' ? new Date().toISOString() : record.completedAt
    };

    deploymentStorage.saveRecord(updated);
    return updated;
  }

  /**
   * Performs an SSRF-safe post-deployment HTTP health check against the returned deployment URL.
   */
  public async verifyDeploymentHealth(record: DeploymentExecutionRecord): Promise<DeploymentExecutionRecord> {
    if (!record.deploymentUrl) {
      return {
        ...record,
        verificationResult: {
          checkedAt: new Date().toISOString(),
          healthy: false,
          details: 'No deployment URL provided by adapter'
        }
      };
    }

    const safety = validateSafeDeploymentUrl(record.deploymentUrl);
    if (!safety.safe) {
      const updated: DeploymentExecutionRecord = {
        ...record,
        verificationResult: {
          checkedAt: new Date().toISOString(),
          healthy: false,
          details: `Verification blocked: ${safety.reason}`
        }
      };
      deploymentStorage.saveRecord(updated);
      return updated;
    }

    try {
      const res = await fetch(record.deploymentUrl, { method: 'GET' });
      const healthy = res.status >= 200 && res.status < 400;
      const updated: DeploymentExecutionRecord = {
        ...record,
        verificationResult: {
          checkedAt: new Date().toISOString(),
          healthy,
          statusCode: res.status,
          details: healthy ? `Endpoint verified HTTP ${res.status}` : `Health check failed with HTTP ${res.status}`
        }
      };
      deploymentStorage.saveRecord(updated);
      return updated;
    } catch (e: any) {
      const updated: DeploymentExecutionRecord = {
        ...record,
        verificationResult: {
          checkedAt: new Date().toISOString(),
          healthy: false,
          details: `Health check request failed: ${e?.message || String(e)}`
        }
      };
      deploymentStorage.saveRecord(updated);
      return updated;
    }
  }
}

export const deploymentOrchestrator = new DeploymentOrchestrator();
