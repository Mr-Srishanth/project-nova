/**
 * ProjectNova AI - Preflight & Release Gates Evaluator
 * Phase 16: Deployment Integrations & Release Orchestration
 *
 * Verifies that code, tests, build artifacts, and configurations satisfy
 * all strict release gates before allowing a deployment to be requested or approved.
 */

import {
  PreflightEvaluationReport,
  PreflightGateItem,
  DeploymentConfiguration
} from '../../types/deployment';
import { testStorage } from '../storage/testStorage';
import { artifactStorage } from '../storage/artifactStorage';
import { deploymentStorage } from '../storage/deploymentStorage';
import type { Project } from '../../types/project';

export interface PreflightGateInput {
  project: Project;
  configuration: DeploymentConfiguration;
  targetRevision: string;
}

export class PreflightGateEvaluator {
  /**
   * Evaluates all deployment release gates deterministically without fabricating success.
   */
  public async evaluatePreflight(input: PreflightGateInput): Promise<PreflightEvaluationReport> {
    const { project, configuration, targetRevision } = input;
    const evaluatedAt = new Date().toISOString();
    const gates: PreflightGateItem[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Gate 1: Project Blueprint completeness
    if (project.blueprint && project.blueprint.title) {
      gates.push({
        id: 'gate-blueprint',
        name: 'Architecture Blueprint Specification',
        category: 'artifacts',
        status: 'passed',
        explanation: `Blueprint '${project.blueprint.title}' is defined and active.`,
        evaluatedAt
      });
    } else {
      blockers.push('Project architecture blueprint is missing or undefined.');
      gates.push({
        id: 'gate-blueprint',
        name: 'Architecture Blueprint Specification',
        category: 'artifacts',
        status: 'failed',
        explanation: 'Missing architecture blueprint.',
        remediation: 'Define and approve a project blueprint in Blueprint Studio.',
        evaluatedAt
      });
    }

    // Gate 2: Artifact Existence & Approval
    const artifacts = await artifactStorage.list(project.id);
    if (artifacts.length === 0) {
      blockers.push('Zero build artifacts exist for this project.');
      gates.push({
        id: 'gate-artifacts',
        name: 'Source Build Artifacts',
        category: 'artifacts',
        status: 'failed',
        explanation: 'Workspace contains zero stored artifacts.',
        remediation: 'Author or generate code artifacts in Build Studio.',
        evaluatedAt
      });
    } else {
      const unapproved = artifacts.filter(a => a.status !== 'approved');
      if (unapproved.length > 0) {
        if (configuration.targetEnvironment === 'production') {
          blockers.push(`${unapproved.length} of ${artifacts.length} artifacts are unapproved. Production deployments strictly require 100% approved artifacts.`);
          gates.push({
            id: 'gate-artifacts',
            name: 'Source Build Artifacts',
            category: 'artifacts',
            status: 'failed',
            explanation: `${unapproved.length} unapproved artifacts detected for production release.`,
            remediation: 'Review and approve all artifacts in Build Studio or Code Review before production release.',
            evaluatedAt
          });
        } else {
          warnings.push(`${unapproved.length} of ${artifacts.length} artifacts are not marked 'approved'.`);
          gates.push({
            id: 'gate-artifacts',
            name: 'Source Build Artifacts',
            category: 'artifacts',
            status: 'passed',
            explanation: `${artifacts.length} artifacts present (${unapproved.length} unapproved). Allowed for preview.`,
            evaluatedAt
          });
        }
      } else {
        gates.push({
          id: 'gate-artifacts',
          name: 'Source Build Artifacts',
          category: 'artifacts',
          status: 'passed',
          explanation: `All ${artifacts.length} artifacts verified and approved.`,
          evaluatedAt
        });
      }
    }

    // Gate 3: Test Automation & Verification Gate
    const testPlans = testStorage.listPlans(project.id);
    if (testPlans.length === 0) {
      blockers.push('No Test Automation Plan has been created or verified.');
      gates.push({
        id: 'gate-tests',
        name: 'Test Automation Verification',
        category: 'tests',
        status: 'failed',
        explanation: 'No test plan found in Test Automation Engine.',
        remediation: 'Run tests in Test Automation (/testing).',
        evaluatedAt
      });
    } else {
      const activePlan = testPlans[0];
      const failed = activePlan.testCases.filter(c => c.status === 'failed');
      const unverified = activePlan.testCases.filter(c => c.status !== 'passed' && c.status !== 'skipped');

      if (failed.length > 0) {
        blockers.push(`${failed.length} test case(s) failed execution.`);
        gates.push({
          id: 'gate-tests',
          name: 'Test Automation Verification',
          category: 'tests',
          status: 'failed',
          explanation: `${failed.length} test case(s) failed assertions.`,
          remediation: 'Resolve test failures before attempting deployment.',
          evaluatedAt
        });
      } else if (unverified.length > 0) {
        if (configuration.targetEnvironment === 'production') {
          blockers.push(`${unverified.length} test(s) unverified. Production requires 100% verified test passes.`);
          gates.push({
            id: 'gate-tests',
            name: 'Test Automation Verification',
            category: 'tests',
            status: 'failed',
            explanation: `${unverified.length} unverified test cases detected for production target.`,
            evaluatedAt
          });
        } else {
          warnings.push(`${unverified.length} test(s) have not run yet.`);
          gates.push({
            id: 'gate-tests',
            name: 'Test Automation Verification',
            category: 'tests',
            status: 'passed',
            explanation: `0 failed tests. ${unverified.length} unverified for preview.`,
            evaluatedAt
          });
        }
      } else {
        gates.push({
          id: 'gate-tests',
          name: 'Test Automation Verification',
          category: 'tests',
          status: 'passed',
          explanation: `All ${activePlan.testCases.length} tests verified passed cleanly.`,
          evaluatedAt
        });
      }
    }

    // Gate 4: Stale Evidence & Revision Binding
    if (!targetRevision || targetRevision.trim() === '') {
      blockers.push('Source revision hash is missing.');
      gates.push({
        id: 'gate-revision',
        name: 'Source Revision Identity',
        category: 'stale_evidence',
        status: 'failed',
        explanation: 'Target source revision hash is empty or indeterminate.',
        remediation: 'Specify an explicit git revision or artifact hash snapshot.',
        evaluatedAt
      });
    } else {
      gates.push({
        id: 'gate-revision',
        name: 'Source Revision Identity',
        category: 'stale_evidence',
        status: 'passed',
        explanation: `Source revision is identified: ${targetRevision.slice(0, 8)}`,
        evaluatedAt
      });
    }

    // Gate 5: Provider Configuration Validation
    if (!configuration.providerProjectId || configuration.providerProjectId.trim() === '') {
      blockers.push(`Provider project identifier is missing for ${configuration.providerId}.`);
      gates.push({
        id: 'gate-provider-config',
        name: 'Deployment Target Configuration',
        category: 'environment',
        status: 'failed',
        explanation: `Provider project identifier unset.`,
        remediation: 'Configure the provider project or repository name.',
        evaluatedAt
      });
    } else {
      gates.push({
        id: 'gate-provider-config',
        name: 'Deployment Target Configuration',
        category: 'environment',
        status: 'passed',
        explanation: `Target project identifier: ${configuration.providerProjectId}`,
        evaluatedAt
      });
    }

    const overallStatus = blockers.length > 0 ? 'failed' : 'passed';
    const report: PreflightEvaluationReport = {
      id: `preflight-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId: project.id,
      configurationId: configuration.id,
      targetEnvironment: configuration.targetEnvironment,
      sourceRevision: targetRevision,
      overallStatus,
      canProceedToApproval: overallStatus === 'passed',
      blockers,
      warnings,
      gates,
      evaluatedAt
    };

    deploymentStorage.savePreflight(report);
    return report;
  }
}

export const preflightGateEvaluator = new PreflightGateEvaluator();
