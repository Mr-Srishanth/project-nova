/**
 * ProjectNova AI - Workflow Execution Engine
 * Phase 18: Visual Workflow Builder & Reusable Automation Pipelines
 *
 * Coordinates:
 * - Topological DAG execution order
 * - Deterministic operation dispatch via WORKFLOW_OPERATIONS
 * - Per-node duration, outputs, and failure records
 * - Human signoff halting and resuming
 * - Observability activityLogger events
 */

import {
  WorkflowDefinition,
  WorkflowExecutionRecord,
  NodeExecutionRecord,
  WorkflowExecutionStatus
} from '../../types/workflow';
import { workflowGraphValidator } from './workflowGraphValidator';
import { WORKFLOW_OPERATIONS } from './workflowOperationRegistry';
import { workflowStorage } from '../storage/workflowStorage';
import { activityLogger } from '../observability/activityLogger';

export interface ExecuteWorkflowOptions {
  triggerSource?: 'manual' | 'scheduled' | 'event';
  inputs?: Record<string, any>;
  resumeExecutionId?: string;
  approvedNodeId?: string;
  onNodeStateChange?: (nodeId: string, status: WorkflowExecutionStatus) => void;
}

export class WorkflowExecutionEngine {
  /**
   * Executes a published workflow definition following topological DAG order.
   */
  public async executeWorkflow(
    workflow: WorkflowDefinition,
    options: ExecuteWorkflowOptions = {}
  ): Promise<WorkflowExecutionRecord> {
    const startedAt = new Date().toISOString();
    const triggerSource = options.triggerSource || 'manual';

    // 1. Validate graph structure before execution
    const validation = workflowGraphValidator.validate(workflow);
    if (!validation.isValid) {
      const record: WorkflowExecutionRecord = {
        id: `wfr-${Date.now()}`,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        projectId: workflow.projectId,
        triggerSource,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        nodeExecutions: {},
        sanitizedOutputs: {},
        errorMessage: `Workflow validation failed: ${validation.diagnostics.map(d => d.message).join('; ')}`,
        isCancelled: false
      };
      workflowStorage.saveRun(record);
      return record;
    }

    // 2. Initialize or resume execution record
    let record: WorkflowExecutionRecord;
    if (options.resumeExecutionId) {
      const existing = workflowStorage.listRuns(workflow.projectId).find(r => r.id === options.resumeExecutionId);
      if (existing) {
        record = { ...existing, status: 'running' };
      } else {
        throw new Error(`Execution record ${options.resumeExecutionId} not found.`);
      }
    } else {
      record = {
        id: `wfr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        projectId: workflow.projectId,
        triggerSource,
        status: 'running',
        startedAt,
        nodeExecutions: {},
        sanitizedOutputs: {},
        isCancelled: false
      };
      workflowStorage.saveRun(record);
    }

    const nodeOutputs: Record<string, any> = { ...record.sanitizedOutputs };
    const startTime = Date.now();

    // 3. Step through topological order
    for (const nodeId of validation.topologicalOrder) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Skip already completed nodes if resuming
      if (record.nodeExecutions[nodeId]?.status === 'succeeded') {
        continue;
      }

      record.activeNodeId = nodeId;
      options.onNodeStateChange?.(nodeId, 'running');

      const nodeStart = Date.now();
      const nodeRec: NodeExecutionRecord = {
        nodeId,
        operationId: node.operationId,
        status: 'running',
        startedAt: new Date().toISOString(),
        retryAttempts: 0
      };
      record.nodeExecutions[nodeId] = nodeRec;
      workflowStorage.saveRun(record);

      // Handle Human Approval Checkpoint
      if (node.isApprovalRequired || node.category === 'approval') {
        const isNodeApproved = options.approvedNodeId === nodeId || node.config?.isApproved;
        if (!isNodeApproved) {
          nodeRec.status = 'awaiting_approval';
          nodeRec.completedAt = new Date().toISOString();
          record.status = 'awaiting_approval';
          record.approvalRequestId = `appr_${nodeId}_${Date.now()}`;
          workflowStorage.saveRun(record);
          options.onNodeStateChange?.(nodeId, 'awaiting_approval');
          return record;
        } else {
          nodeRec.status = 'succeeded';
          nodeRec.completedAt = new Date().toISOString();
          nodeRec.sanitizedOutput = { approved: true, approvedNodeId: nodeId };
          options.onNodeStateChange?.(nodeId, 'succeeded');
          continue;
        }
      }

      // Resolve Operation Descriptor
      const op = WORKFLOW_OPERATIONS[node.operationId];
      if (!op) {
        nodeRec.status = 'failed';
        nodeRec.completedAt = new Date().toISOString();
        nodeRec.errorMessage = `Unsupported operation '${node.operationId}'`;
        record.status = 'failed';
        record.errorMessage = nodeRec.errorMessage;
        record.completedAt = new Date().toISOString();
        record.durationMs = Date.now() - startTime;
        workflowStorage.saveRun(record);
        options.onNodeStateChange?.(nodeId, 'failed');
        return record;
      }

      // Execute Operation
      try {
        const result = await op.execute({
          projectId: workflow.projectId,
          nodeConfig: node.config,
          workflowInputs: options.inputs || {},
          nodeOutputs
        });

        nodeRec.durationMs = Date.now() - nodeStart;
        nodeRec.completedAt = new Date().toISOString();

        if (result.status === 'awaiting_approval') {
          nodeRec.status = 'awaiting_approval';
          record.status = 'awaiting_approval';
          record.approvalRequestId = `appr_${nodeId}_${Date.now()}`;
          workflowStorage.saveRun(record);
          options.onNodeStateChange?.(nodeId, 'awaiting_approval');
          return record;
        }

        if (result.success) {
          nodeRec.status = 'succeeded';
          nodeRec.sanitizedOutput = result.sanitizedOutput;
          if (result.sanitizedOutput) {
            nodeOutputs[nodeId] = result.sanitizedOutput;
          }
          options.onNodeStateChange?.(nodeId, 'succeeded');
        } else {
          nodeRec.status = 'failed';
          nodeRec.errorMessage = result.errorMessage || 'Operation failed';
          record.status = 'failed';
          record.errorMessage = `Step '${node.label}' failed: ${nodeRec.errorMessage}`;
          record.completedAt = new Date().toISOString();
          record.durationMs = Date.now() - startTime;
          workflowStorage.saveRun(record);
          options.onNodeStateChange?.(nodeId, 'failed');
          return record;
        }
      } catch (err: any) {
        nodeRec.status = 'failed';
        nodeRec.completedAt = new Date().toISOString();
        nodeRec.errorMessage = err?.message || String(err);
        record.status = 'failed';
        record.errorMessage = `Step '${node.label}' threw exception: ${nodeRec.errorMessage}`;
        record.completedAt = new Date().toISOString();
        record.durationMs = Date.now() - startTime;
        workflowStorage.saveRun(record);
        options.onNodeStateChange?.(nodeId, 'failed');
        return record;
      }

      workflowStorage.saveRun(record);
    }

    // All topological steps completed successfully
    record.status = 'succeeded';
    record.completedAt = new Date().toISOString();
    record.durationMs = Date.now() - startTime;
    record.sanitizedOutputs = nodeOutputs;
    workflow.lastExecutedAt = record.completedAt;
    workflowStorage.saveWorkflow(workflow);
    workflowStorage.saveRun(record);

    activityLogger.log({
      projectId: workflow.projectId,
      category: 'execution_plan',
      eventType: 'workflow_completed',
      severity: 'info',
      outcome: 'succeeded',
      sourceSubsystem: 'execution_engine',
      summary: `Workflow '${workflow.name}' completed successfully (${record.durationMs}ms)`,
      durationMs: record.durationMs,
      safeDetails: {
        workflowId: workflow.id,
        executionId: record.id,
        nodesExecuted: Object.keys(record.nodeExecutions).length
      }
    });

    return record;
  }
}

export const workflowExecutionEngine = new WorkflowExecutionEngine();
