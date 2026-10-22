/**
 * ProjectNova AI - Workflow Graph Validation Engine
 * Phase 18: Visual Workflow Builder & Reusable Automation Pipelines
 *
 * Deterministically checks:
 * - Start & terminal node existence
 * - Cycle detection via DFS
 * - Unreachable nodes
 * - Unsupported operations
 * - Broken or dangling edges
 * - Computes topological execution order
 */

import {
  WorkflowDefinition,
  WorkflowValidationReport,
  WorkflowValidationDiagnostic
} from '../../types/workflow';
import { WORKFLOW_OPERATIONS } from './workflowOperationRegistry';

export class WorkflowGraphValidator {
  public validate(workflow: WorkflowDefinition): WorkflowValidationReport {
    const diagnostics: WorkflowValidationDiagnostic[] = [];
    const nodeIds = new Set(workflow.nodes.map(n => n.id));

    // 1. Check duplicate node IDs
    if (nodeIds.size !== workflow.nodes.length) {
      diagnostics.push({
        type: 'error',
        message: 'Duplicate node IDs detected in workflow definition.'
      });
    }

    // 2. Start node check (at least one trigger node)
    const triggerNodes = workflow.nodes.filter(n => n.category === 'trigger');
    if (triggerNodes.length === 0) {
      diagnostics.push({
        type: 'error',
        message: 'Workflow must have at least one trigger node (e.g. Manual Run).'
      });
    }

    // 3. Terminal node check
    const terminalNodes = workflow.nodes.filter(n => n.category === 'terminal');
    if (terminalNodes.length === 0) {
      diagnostics.push({
        type: 'warning',
        message: 'Workflow does not declare a terminal success or failure node.'
      });
    }

    // 4. Broken edges check
    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.fromNodeId)) {
        diagnostics.push({
          type: 'error',
          message: `Edge ${edge.id} references non-existent source node: ${edge.fromNodeId}`
        });
      }
      if (!nodeIds.has(edge.toNodeId)) {
        diagnostics.push({
          type: 'error',
          message: `Edge ${edge.id} references non-existent target node: ${edge.toNodeId}`
        });
      }
    }

    // 5. Unsupported operation check
    for (const node of workflow.nodes) {
      if (!WORKFLOW_OPERATIONS[node.operationId]) {
        diagnostics.push({
          type: 'error',
          nodeId: node.id,
          message: `Node ${node.label} references unsupported operation '${node.operationId}'`
        });
      }
    }

    // 6. Build adjacency map & check for cycles (DFS)
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    for (const n of workflow.nodes) {
      adj[n.id] = [];
      inDegree[n.id] = 0;
    }

    for (const edge of workflow.edges) {
      if (adj[edge.fromNodeId] && inDegree[edge.toNodeId] !== undefined) {
        adj[edge.fromNodeId].push(edge.toNodeId);
        inDegree[edge.toNodeId]++;
      }
    }

    // Cycle detection & Topological Sort via Kahn's algorithm
    const queue: string[] = [];
    for (const nodeId of Object.keys(inDegree)) {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
      }
    }

    const topologicalOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      topologicalOrder.push(u);

      for (const v of adj[u] || []) {
        inDegree[v]--;
        if (inDegree[v] === 0) {
          queue.push(v);
        }
      }
    }

    const hasCycle = topologicalOrder.length !== workflow.nodes.length;
    if (hasCycle) {
      diagnostics.push({
        type: 'error',
        message: 'Circular dependency detected. Workflows must be directed acyclic graphs (DAGs).'
      });
    }

    // 7. Unreachable nodes check
    const unreachableNodes = workflow.nodes.filter(n => n.category !== 'trigger' && !workflow.edges.some(e => e.toNodeId === n.id));
    for (const u of unreachableNodes) {
      diagnostics.push({
        type: 'warning',
        nodeId: u.id,
        message: `Node '${u.label}' has no incoming edges and may be unreachable.`
      });
    }

    const hasErrors = diagnostics.some(d => d.type === 'error');
    return {
      isValid: !hasErrors,
      canPublish: !hasErrors && triggerNodes.length > 0,
      diagnostics,
      topologicalOrder: hasCycle ? [] : topologicalOrder,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const workflowGraphValidator = new WorkflowGraphValidator();
