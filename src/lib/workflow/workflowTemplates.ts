/**
 * ProjectNova AI - Reusable Workflow Templates
 * Phase 18: Visual Workflow Builder & Reusable Automation Pipelines
 *
 * Grounded templates backed by registered capabilities from Phases 2-17.
 */

import { WorkflowDefinition } from '../../types/workflow';

export function createPreReleasePipelineTemplate(projectId: string): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: `wf-pre-release-${Date.now()}`,
    projectId,
    name: 'Pre-Release Quality & Verification Pipeline',
    description: 'Inspects artifacts, executes test automation, and audits release gate before deployment signoff.',
    tags: ['release', 'quality', 'verification'],
    version: 1,
    definitionHash: 'hash_prerelease_v1',
    state: 'published',
    nodes: [
      {
        id: 'node-start',
        category: 'trigger',
        operationId: 'trigger_manual',
        label: 'Manual Trigger',
        position: { x: 50, y: 150 },
        config: {}
      },
      {
        id: 'node-artifacts',
        category: 'action',
        operationId: 'action_inspect_artifacts',
        label: 'Inspect Build Artifacts',
        position: { x: 260, y: 150 },
        config: {}
      },
      {
        id: 'node-static',
        category: 'action',
        operationId: 'action_run_static_analysis',
        label: 'Static & Security Scan',
        position: { x: 480, y: 150 },
        config: {}
      },
      {
        id: 'node-tests',
        category: 'action',
        operationId: 'action_run_test_suite',
        label: 'Execute Test Plan',
        position: { x: 700, y: 150 },
        config: {}
      },
      {
        id: 'node-release-gate',
        category: 'action',
        operationId: 'action_audit_release_gate',
        label: 'Audit Release Gate',
        position: { x: 920, y: 150 },
        config: {}
      },
      {
        id: 'node-end',
        category: 'terminal',
        operationId: 'terminal_success',
        label: 'Release Qualified',
        position: { x: 1140, y: 150 },
        config: {}
      }
    ],
    edges: [
      { id: 'e1', fromNodeId: 'node-start', toNodeId: 'node-artifacts' },
      { id: 'e2', fromNodeId: 'node-artifacts', toNodeId: 'node-static' },
      { id: 'e3', fromNodeId: 'node-static', toNodeId: 'node-tests' },
      { id: 'e4', fromNodeId: 'node-tests', toNodeId: 'node-release-gate' },
      { id: 'e5', fromNodeId: 'node-release-gate', toNodeId: 'node-end' }
    ],
    createdAt: now,
    updatedAt: now
  };
}

export function createDeploymentReadinessTemplate(projectId: string): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: `wf-deploy-readiness-${Date.now()}`,
    projectId,
    name: 'Deployment Readiness & Preflight Pipeline',
    description: 'Validates blueprint, evaluates deployment preflight, and halts for human signoff.',
    tags: ['deployment', 'preflight', 'approval'],
    version: 1,
    definitionHash: 'hash_deploy_readiness_v1',
    state: 'published',
    nodes: [
      {
        id: 'node-start',
        category: 'trigger',
        operationId: 'trigger_manual',
        label: 'Manual Trigger',
        position: { x: 50, y: 150 },
        config: {}
      },
      {
        id: 'node-blueprint',
        category: 'action',
        operationId: 'action_validate_blueprint',
        label: 'Validate Blueprint',
        position: { x: 260, y: 150 },
        config: {}
      },
      {
        id: 'node-preflight',
        category: 'action',
        operationId: 'action_evaluate_deployment_preflight',
        label: 'Deployment Preflight',
        position: { x: 500, y: 150 },
        config: {}
      },
      {
        id: 'node-approval',
        category: 'approval',
        operationId: 'approval_human_gate',
        label: 'Human Deployment Signoff',
        position: { x: 740, y: 150 },
        config: { prompt: 'Verify release preflight and authorize deployment.' },
        isApprovalRequired: true
      },
      {
        id: 'node-terminal',
        category: 'terminal',
        operationId: 'terminal_success',
        label: 'Ready for Dispatch',
        position: { x: 980, y: 150 },
        config: {}
      }
    ],
    edges: [
      { id: 'e1', fromNodeId: 'node-start', toNodeId: 'node-blueprint' },
      { id: 'e2', fromNodeId: 'node-blueprint', toNodeId: 'node-preflight' },
      { id: 'e3', fromNodeId: 'node-preflight', toNodeId: 'node-approval' },
      { id: 'e4', fromNodeId: 'node-approval', toNodeId: 'node-terminal' }
    ],
    createdAt: now,
    updatedAt: now
  };
}

export function createIncidentInvestigationTemplate(projectId: string): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: `wf-incident-inv-${Date.now()}`,
    projectId,
    name: 'Incident Investigation & Target Health Audit',
    description: 'Polls target health endpoints and queries Project Brain architecture constraints.',
    tags: ['monitoring', 'incident', 'investigation'],
    version: 1,
    definitionHash: 'hash_incident_inv_v1',
    state: 'published',
    nodes: [
      {
        id: 'node-start',
        category: 'trigger',
        operationId: 'trigger_manual',
        label: 'Trigger Investigation',
        position: { x: 50, y: 150 },
        config: {}
      },
      {
        id: 'node-poll',
        category: 'action',
        operationId: 'action_poll_target_health',
        label: 'Poll Health Targets',
        position: { x: 280, y: 150 },
        config: {}
      },
      {
        id: 'node-brain',
        category: 'action',
        operationId: 'action_retrieve_brain_context',
        label: 'Retrieve Brain Context',
        position: { x: 520, y: 150 },
        config: {}
      },
      {
        id: 'node-terminal',
        category: 'terminal',
        operationId: 'terminal_success',
        label: 'Investigation Complete',
        position: { x: 760, y: 150 },
        config: {}
      }
    ],
    edges: [
      { id: 'e1', fromNodeId: 'node-start', toNodeId: 'node-poll' },
      { id: 'e2', fromNodeId: 'node-poll', toNodeId: 'node-brain' },
      { id: 'e3', fromNodeId: 'node-brain', toNodeId: 'node-terminal' }
    ],
    createdAt: now,
    updatedAt: now
  };
}
