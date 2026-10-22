/**
 * ProjectNova AI - Test Storage Adapter
 * Phase 15: Test Automation & Verification Engine
 *
 * Provides persistent local browser storage for Test Plans and Execution Records
 * with project isolation and graceful fallback.
 */

import { TestPlan, TestExecutionRecord } from '../../types/testing';

const PLANS_STORAGE_KEY = 'projectnova_test_plans_v1';
const RUNS_STORAGE_KEY = 'projectnova_test_runs_v1';

export class LocalBrowserTestStorageAdapter {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  // --- Test Plans ---

  public listPlans(projectId: string): TestPlan[] {
    const storage = this.getStorage();
    if (!storage) return [];

    try {
      const raw = storage.getItem(PLANS_STORAGE_KEY);
      if (!raw) return [];
      const allPlans: any[] = JSON.parse(raw);
      if (!Array.isArray(allPlans)) return [];

      return allPlans
        .filter(p => p && typeof p === 'object' && p.projectId === projectId)
        .map(p => this.sanitizePlan(p));
    } catch (e) {
      console.error('[TestStorage] Error parsing test plans:', e);
      return [];
    }
  }

  public sanitizePlan(plan: any): TestPlan {
    const testCases: any[] = Array.isArray(plan.testCases) ? plan.testCases : [];
    const suites: any[] = Array.isArray(plan.suites) ? plan.suites : [];

    const total = testCases.length;
    const passed = testCases.filter(c => c && c.status === 'passed').length;
    const failed = testCases.filter(c => c && c.status === 'failed').length;
    const blocked = testCases.filter(c => c && c.status === 'blocked').length;
    const skipped = testCases.filter(c => c && c.status === 'skipped').length;
    const unknown = testCases.filter(c => !c || !['passed', 'failed', 'blocked', 'skipped'].includes(c.status)).length;

    const summary = plan.summary && typeof plan.summary === 'object'
      ? {
          total: typeof plan.summary.total === 'number' ? plan.summary.total : total,
          passed: typeof plan.summary.passed === 'number' ? plan.summary.passed : passed,
          failed: typeof plan.summary.failed === 'number' ? plan.summary.failed : failed,
          blocked: typeof plan.summary.blocked === 'number' ? plan.summary.blocked : blocked,
          skipped: typeof plan.summary.skipped === 'number' ? plan.summary.skipped : skipped,
          unknown: typeof plan.summary.unknown === 'number' ? plan.summary.unknown : unknown,
          lastRunAt: plan.summary.lastRunAt || undefined,
        }
      : {
          total,
          passed,
          failed,
          blocked,
          skipped,
          unknown,
          lastRunAt: undefined,
        };

    return {
      ...plan,
      testCases,
      suites,
      summary,
    };
  }

  public getPlan(projectId: string, planId: string): TestPlan | null {
    const plans = this.listPlans(projectId);
    return plans.find(p => p.id === planId) || null;
  }

  public savePlan(plan: TestPlan): void {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(PLANS_STORAGE_KEY);
      const allPlans: TestPlan[] = raw ? JSON.parse(raw) : [];
      const existingIdx = allPlans.findIndex(p => p.id === plan.id);

      if (existingIdx >= 0) {
        allPlans[existingIdx] = plan;
      } else {
        allPlans.push(plan);
      }

      storage.setItem(PLANS_STORAGE_KEY, JSON.stringify(allPlans));
    } catch (e) {
      console.error('[TestStorage] Error saving test plan:', e);
    }
  }

  public deletePlan(projectId: string, planId: string): boolean {
    const storage = this.getStorage();
    if (!storage) return false;

    try {
      const raw = storage.getItem(PLANS_STORAGE_KEY);
      if (!raw) return false;
      let allPlans: TestPlan[] = JSON.parse(raw);
      const filtered = allPlans.filter(p => !(p.projectId === projectId && p.id === planId));
      storage.setItem(PLANS_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error('[TestStorage] Error deleting test plan:', e);
      return false;
    }
  }

  // --- Test Execution Records ---

  public listRuns(projectId: string, planId?: string): TestExecutionRecord[] {
    const storage = this.getStorage();
    if (!storage) return [];

    try {
      const raw = storage.getItem(RUNS_STORAGE_KEY);
      if (!raw) return [];
      const allRuns: TestExecutionRecord[] = JSON.parse(raw);
      return allRuns.filter(r => r.projectId === projectId && (!planId || r.planId === planId));
    } catch (e) {
      console.error('[TestStorage] Error parsing execution runs:', e);
      return [];
    }
  }

  public saveRun(run: TestExecutionRecord): void {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(RUNS_STORAGE_KEY);
      const allRuns: TestExecutionRecord[] = raw ? JSON.parse(raw) : [];
      // Keep most recent 500 records across projects to prevent quota overflow
      allRuns.unshift(run);
      if (allRuns.length > 500) {
        allRuns.length = 500;
      }
      storage.setItem(RUNS_STORAGE_KEY, JSON.stringify(allRuns));
    } catch (e) {
      console.error('[TestStorage] Error saving execution record:', e);
    }
  }

  public clearRuns(projectId: string): void {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(RUNS_STORAGE_KEY);
      if (!raw) return;
      const allRuns: TestExecutionRecord[] = JSON.parse(raw);
      const remaining = allRuns.filter(r => r.projectId !== projectId);
      storage.setItem(RUNS_STORAGE_KEY, JSON.stringify(remaining));
    } catch (e) {
      console.error('[TestStorage] Error clearing runs:', e);
    }
  }
}

export const testStorage = new LocalBrowserTestStorageAdapter();
