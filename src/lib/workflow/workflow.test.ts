import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workflowGraphValidator } from './workflowGraphValidator';
import { workflowExecutionEngine } from './workflowExecutionEngine';
import { workflowStorage } from '../storage/workflowStorage';
import { createPreReleasePipelineTemplate } from './workflowTemplates';
import type { WorkflowDefinition } from '../../types/workflow';

describe('Phase 18: Visual Workflow Builder & Automation Pipelines', () => {
  const projectId = 'proj-wf-phase18';

  beforeEach(() => {
    vi.restoreAllMocks();
    workflowStorage.clearRuns(projectId);
  });

  describe('1. Graph Topology & DAG Validation', () => {
    it('validates a correct linear DAG template', () => {
      const template = createPreReleasePipelineTemplate(projectId);
      const report = workflowGraphValidator.validate(template);

      expect(report.isValid).toBe(true);
      expect(report.canPublish).toBe(true);
      expect(report.diagnostics.length).toBe(0);
      expect(report.topologicalOrder.length).toBe(template.nodes.length);
      expect(report.topologicalOrder[0]).toBe('node-start');
    });

    it('rejects circular dependencies with clear error diagnostics', () => {
      const cyclicWorkflow: WorkflowDefinition = {
        id: 'wf-cycle',
        projectId,
        name: 'Cyclic Workflow',
        description: 'Contains a loop',
        tags: [],
        version: 1,
        definitionHash: 'h1',
        state: 'draft',
        nodes: [
          {
            id: 'n1',
            category: 'trigger',
            operationId: 'trigger_manual',
            label: 'Start',
            position: { x: 0, y: 0 },
            config: {}
          },
          {
            id: 'n2',
            category: 'action',
            operationId: 'action_validate_blueprint',
            label: 'Action 1',
            position: { x: 100, y: 0 },
            config: {}
          },
          {
            id: 'n3',
            category: 'action',
            operationId: 'action_inspect_artifacts',
            label: 'Action 2',
            position: { x: 200, y: 0 },
            config: {}
          }
        ],
        edges: [
          { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' },
          { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3' },
          { id: 'e3', fromNodeId: 'n3', toNodeId: 'n2' } // Cycle between n2 and n3
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const report = workflowGraphValidator.validate(cyclicWorkflow);
      expect(report.isValid).toBe(false);
      expect(report.diagnostics.some(d => d.message.includes('Circular dependency'))).toBe(true);
    });

    it('flags workflows missing a trigger node', () => {
      const noTriggerWorkflow: WorkflowDefinition = {
        id: 'wf-no-trigger',
        projectId,
        name: 'No Trigger',
        description: 'Missing trigger',
        tags: [],
        version: 1,
        definitionHash: 'h2',
        state: 'draft',
        nodes: [
          {
            id: 'n1',
            category: 'action',
            operationId: 'action_validate_blueprint',
            label: 'Action',
            position: { x: 0, y: 0 },
            config: {}
          }
        ],
        edges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const report = workflowGraphValidator.validate(noTriggerWorkflow);
      expect(report.isValid).toBe(false);
      expect(report.diagnostics.some(d => d.message.includes('trigger node'))).toBe(true);
    });
  });

  describe('2. Workflow Execution Engine', () => {
    it('executes linear pipeline nodes in topological order', async () => {
      const workflow: WorkflowDefinition = {
        id: 'wf-exec-test',
        projectId,
        name: 'Simple Pipeline',
        description: 'Test run',
        tags: [],
        version: 1,
        definitionHash: 'h_test',
        state: 'published',
        nodes: [
          {
            id: 'start-1',
            category: 'trigger',
            operationId: 'trigger_manual',
            label: 'Start',
            position: { x: 0, y: 0 },
            config: {}
          },
          {
            id: 'brain-2',
            category: 'action',
            operationId: 'action_retrieve_brain_context',
            label: 'Brain',
            position: { x: 100, y: 0 },
            config: {}
          },
          {
            id: 'end-3',
            category: 'terminal',
            operationId: 'terminal_success',
            label: 'End',
            position: { x: 200, y: 0 },
            config: {}
          }
        ],
        edges: [
          { id: 'e1', fromNodeId: 'start-1', toNodeId: 'brain-2' },
          { id: 'e2', fromNodeId: 'brain-2', toNodeId: 'end-3' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await workflowExecutionEngine.executeWorkflow(workflow);
      if (run.status !== 'succeeded') {
        console.error('TEST RUN FAILURE ERROR:', run.errorMessage, run.nodeExecutions);
      }
      expect(run.status).toBe('succeeded');
      expect(run.nodeExecutions['start-1'].status).toBe('succeeded');
      expect(run.nodeExecutions['brain-2'].status).toBe('succeeded');
      expect(run.nodeExecutions['end-3'].status).toBe('succeeded');

      // Verify execution record in storage
      const storedRuns = workflowStorage.listRuns(projectId);
      expect(storedRuns.length).toBe(1);
    });

    it('halts and enters awaiting_approval when reaching a human approval node', async () => {
      const approvalWorkflow: WorkflowDefinition = {
        id: 'wf-approval-test',
        projectId,
        name: 'Approval Pipeline',
        description: 'Test approval gate',
        tags: [],
        version: 1,
        definitionHash: 'h_appr',
        state: 'published',
        nodes: [
          {
            id: 'n-start',
            category: 'trigger',
            operationId: 'trigger_manual',
            label: 'Start',
            position: { x: 0, y: 0 },
            config: {}
          },
          {
            id: 'n-approval',
            category: 'approval',
            operationId: 'approval_human_gate',
            label: 'Human Signoff',
            position: { x: 100, y: 0 },
            config: { prompt: 'Please approve' },
            isApprovalRequired: true
          },
          {
            id: 'n-terminal',
            category: 'terminal',
            operationId: 'terminal_success',
            label: 'Success',
            position: { x: 200, y: 0 },
            config: {}
          }
        ],
        edges: [
          { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-approval' },
          { id: 'e2', fromNodeId: 'n-approval', toNodeId: 'n-terminal' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const run = await workflowExecutionEngine.executeWorkflow(approvalWorkflow);

      expect(run.status).toBe('awaiting_approval');
      expect(run.activeNodeId).toBe('n-approval');
      expect(run.nodeExecutions['n-approval'].status).toBe('awaiting_approval');
    });

    it('resumes from approval checkpoint after signoff is granted', async () => {
      const approvalWorkflow: WorkflowDefinition = {
        id: 'wf-approval-resume',
        projectId,
        name: 'Approval Pipeline Resume',
        description: 'Test approval resume',
        tags: [],
        version: 1,
        definitionHash: 'h_appr_res',
        state: 'published',
        nodes: [
          {
            id: 'n-start',
            category: 'trigger',
            operationId: 'trigger_manual',
            label: 'Start',
            position: { x: 0, y: 0 },
            config: {}
          },
          {
            id: 'n-approval',
            category: 'approval',
            operationId: 'approval_human_gate',
            label: 'Human Signoff',
            position: { x: 100, y: 0 },
            config: { prompt: 'Please approve' },
            isApprovalRequired: true
          },
          {
            id: 'n-terminal',
            category: 'terminal',
            operationId: 'terminal_success',
            label: 'Success',
            position: { x: 200, y: 0 },
            config: {}
          }
        ],
        edges: [
          { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-approval' },
          { id: 'e2', fromNodeId: 'n-approval', toNodeId: 'n-terminal' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const initialRun = await workflowExecutionEngine.executeWorkflow(approvalWorkflow);
      expect(initialRun.status).toBe('awaiting_approval');

      // Resume with approved node ID
      const resumedRun = await workflowExecutionEngine.executeWorkflow(approvalWorkflow, {
        resumeExecutionId: initialRun.id,
        approvedNodeId: 'n-approval'
      });

      expect(resumedRun.status).toBe('succeeded');
      expect(resumedRun.nodeExecutions['n-terminal'].status).toBe('succeeded');
    });
  });
});
