/**
 * ProjectNova AI - Deployment Storage Adapter
 * Phase 16: Deployment Integrations & Release Orchestration
 *
 * Isolated persistent local browser storage for:
 * - Deployment Configurations (metadata only - NO SECRETS)
 * - Preflight Reports
 * - Deployment Approvals
 * - Deployment Execution Records
 */

import {
  DeploymentConfiguration,
  DeploymentExecutionRecord,
  PreflightEvaluationReport,
  DeploymentApproval
} from '../../types/deployment';

const CONFIGS_KEY = 'projectnova_deploy_configs_v1';
const RUNS_KEY = 'projectnova_deploy_records_v1';
const APPROVALS_KEY = 'projectnova_deploy_approvals_v1';
const PREFLIGHTS_KEY = 'projectnova_deploy_preflights_v1';

export class LocalBrowserDeploymentStorageAdapter {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  // --- Configurations ---
  public listConfigurations(projectId: string): DeploymentConfiguration[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(CONFIGS_KEY);
      if (!raw) return [];
      const all: DeploymentConfiguration[] = JSON.parse(raw);
      return all.filter(c => c.projectId === projectId);
    } catch {
      return [];
    }
  }

  public saveConfiguration(config: DeploymentConfiguration): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(CONFIGS_KEY);
      const all: DeploymentConfiguration[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(c => c.id === config.id);
      if (idx >= 0) all[idx] = config;
      else all.push(config);
      storage.setItem(CONFIGS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[DeploymentStorage] Failed to save configuration:', e);
    }
  }

  // --- Preflights ---
  public savePreflight(report: PreflightEvaluationReport): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(PREFLIGHTS_KEY);
      const all: PreflightEvaluationReport[] = raw ? JSON.parse(raw) : [];
      all.unshift(report);
      if (all.length > 200) all.length = 200;
      storage.setItem(PREFLIGHTS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[DeploymentStorage] Failed to save preflight report:', e);
    }
  }

  public getPreflight(reportId: string): PreflightEvaluationReport | null {
    const storage = this.getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(PREFLIGHTS_KEY);
      if (!raw) return null;
      const all: PreflightEvaluationReport[] = JSON.parse(raw);
      return all.find(r => r.id === reportId) || null;
    } catch {
      return null;
    }
  }

  // --- Approvals ---
  public saveApproval(approval: DeploymentApproval): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(APPROVALS_KEY);
      const all: DeploymentApproval[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(a => a.id === approval.id);
      if (idx >= 0) all[idx] = approval;
      else all.unshift(approval);
      storage.setItem(APPROVALS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[DeploymentStorage] Failed to save approval:', e);
    }
  }

  public getApproval(approvalId: string): DeploymentApproval | null {
    const storage = this.getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(APPROVALS_KEY);
      if (!raw) return null;
      const all: DeploymentApproval[] = JSON.parse(raw);
      return all.find(a => a.id === approvalId) || null;
    } catch {
      return null;
    }
  }

  public listApprovals(projectId?: string): DeploymentApproval[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(APPROVALS_KEY);
      if (!raw) return [];
      const all: DeploymentApproval[] = JSON.parse(raw);
      if (projectId) {
        return all.filter(a => a.projectId === projectId);
      }
      return all;
    } catch {
      return [];
    }
  }

  // --- Execution Records ---
  public listRecords(projectId: string): DeploymentExecutionRecord[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(RUNS_KEY);
      if (!raw) return [];
      const all: DeploymentExecutionRecord[] = JSON.parse(raw);
      return all.filter(r => r.projectId === projectId);
    } catch {
      return [];
    }
  }

  public saveRecord(record: DeploymentExecutionRecord): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(RUNS_KEY);
      const all: DeploymentExecutionRecord[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(r => r.id === record.id);
      if (idx >= 0) all[idx] = record;
      else all.unshift(record);
      if (all.length > 500) all.length = 500;
      storage.setItem(RUNS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[DeploymentStorage] Failed to save execution record:', e);
    }
  }

  public clearRecords(projectId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(RUNS_KEY);
      if (!raw) return;
      const all: DeploymentExecutionRecord[] = JSON.parse(raw);
      const filtered = all.filter(r => r.projectId !== projectId);
      storage.setItem(RUNS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('[DeploymentStorage] Failed to clear execution records:', e);
    }
  }
}

export const deploymentStorage = new LocalBrowserDeploymentStorageAdapter();
