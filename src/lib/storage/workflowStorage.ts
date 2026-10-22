/**
 * ProjectNova AI - Workflow Storage Adapter
 * Phase 18: Visual Workflow Builder & Reusable Automation Pipelines
 *
 * Isolated, versioned browser-local storage for:
 * - Workflow Definitions (`projectnova_workflows_v1`)
 * - Workflow Execution Records (`projectnova_wf_runs_v1`)
 *
 * Project isolation, corrupt JSON fallback, and retention bounds.
 */

import { WorkflowDefinition, WorkflowExecutionRecord } from '../../types/workflow';

const WORKFLOWS_KEY = 'projectnova_workflows_v1';
const WF_RUNS_KEY = 'projectnova_wf_runs_v1';

export class LocalBrowserWorkflowStorageAdapter {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  // --- Workflows ---
  public listWorkflows(projectId: string): WorkflowDefinition[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(WORKFLOWS_KEY);
      if (!raw) return [];
      const all: WorkflowDefinition[] = JSON.parse(raw);
      return all.filter(w => w.projectId === projectId);
    } catch {
      return [];
    }
  }

  public getWorkflow(projectId: string, workflowId: string): WorkflowDefinition | null {
    const list = this.listWorkflows(projectId);
    return list.find(w => w.id === workflowId) || null;
  }

  public saveWorkflow(workflow: WorkflowDefinition): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(WORKFLOWS_KEY);
      const all: WorkflowDefinition[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(w => w.id === workflow.id);
      if (idx >= 0) all[idx] = workflow;
      else all.push(workflow);
      storage.setItem(WORKFLOWS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[WorkflowStorage] Failed to save workflow:', e);
    }
  }

  public deleteWorkflow(projectId: string, workflowId: string): boolean {
    const storage = this.getStorage();
    if (!storage) return false;
    try {
      const raw = storage.getItem(WORKFLOWS_KEY);
      if (!raw) return false;
      const all: WorkflowDefinition[] = JSON.parse(raw);
      const filtered = all.filter(w => !(w.projectId === projectId && w.id === workflowId));
      storage.setItem(WORKFLOWS_KEY, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }

  // --- Execution Records ---
  public listRuns(projectId: string, workflowId?: string): WorkflowExecutionRecord[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(WF_RUNS_KEY);
      if (!raw) return [];
      const all: WorkflowExecutionRecord[] = JSON.parse(raw);
      return all.filter(r => r.projectId === projectId && (!workflowId || r.workflowId === workflowId));
    } catch {
      return [];
    }
  }

  public saveRun(run: WorkflowExecutionRecord): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(WF_RUNS_KEY);
      const all: WorkflowExecutionRecord[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(r => r.id === run.id);
      if (idx >= 0) all[idx] = run;
      else all.unshift(run);
      if (all.length > 300) all.length = 300;
      storage.setItem(WF_RUNS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[WorkflowStorage] Failed to save execution run:', e);
    }
  }

  public clearRuns(projectId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(WF_RUNS_KEY);
      if (!raw) return;
      const all: WorkflowExecutionRecord[] = JSON.parse(raw);
      const remaining = all.filter(r => r.projectId !== projectId);
      storage.setItem(WF_RUNS_KEY, JSON.stringify(remaining));
    } catch (e) {
      console.warn('[WorkflowStorage] Failed to clear runs:', e);
    }
  }
}

export const workflowStorage = new LocalBrowserWorkflowStorageAdapter();
