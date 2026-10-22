import type {
  ExecutionPlan,
  AutomationSchedule,
  ExecutionRunRecord,
} from "@/types/execution";

const PLANS_STORAGE_KEY = "projectnova_execution_plans_v1";
const SCHEDULES_STORAGE_KEY = "projectnova_automation_schedules_v1";
const RUNS_STORAGE_KEY = "projectnova_execution_runs_v1";

export interface IExecutionStorageAdapter {
  listPlans(projectId: string): Promise<ExecutionPlan[]>;
  getPlanById(projectId: string, planId: string): Promise<ExecutionPlan | null>;
  savePlan(plan: ExecutionPlan): Promise<ExecutionPlan>;
  deletePlan(projectId: string, planId: string): Promise<boolean>;

  listSchedules(projectId: string): Promise<AutomationSchedule[]>;
  saveSchedule(schedule: AutomationSchedule): Promise<AutomationSchedule>;
  deleteSchedule(projectId: string, scheduleId: string): Promise<boolean>;

  listRunRecords(projectId: string): Promise<ExecutionRunRecord[]>;
  saveRunRecord(run: ExecutionRunRecord): Promise<ExecutionRunRecord>;
}

class LocalBrowserExecutionStorageAdapter implements IExecutionStorageAdapter {
  private getRaw<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (err) {
      console.error(`[Execution Storage] Error reading ${key}:`, err);
      return [];
    }
  }

  private saveRaw<T>(key: string, items: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (err) {
      console.error(`[Execution Storage] Error writing ${key}:`, err);
      throw new Error(`Storage quota exceeded or storage unavailable for ${key}.`);
    }
  }

  // --- Plans ---
  async listPlans(projectId: string): Promise<ExecutionPlan[]> {
    const all = this.getRaw<ExecutionPlan>(PLANS_STORAGE_KEY);
    return all
      .filter((p) => p && p.projectId === projectId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getPlanById(projectId: string, planId: string): Promise<ExecutionPlan | null> {
    const all = this.getRaw<ExecutionPlan>(PLANS_STORAGE_KEY);
    return all.find((p) => p && p.projectId === projectId && p.id === planId) || null;
  }

  async savePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
    const all = this.getRaw<ExecutionPlan>(PLANS_STORAGE_KEY);
    const idx = all.findIndex((p) => p && p.projectId === plan.projectId && p.id === plan.id);
    const updated = { ...plan, updatedAt: new Date().toISOString() };

    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    this.saveRaw(PLANS_STORAGE_KEY, all);
    return updated;
  }

  async deletePlan(projectId: string, planId: string): Promise<boolean> {
    const all = this.getRaw<ExecutionPlan>(PLANS_STORAGE_KEY);
    const filtered = all.filter((p) => !(p.projectId === projectId && p.id === planId));
    if (filtered.length !== all.length) {
      this.saveRaw(PLANS_STORAGE_KEY, filtered);
      return true;
    }
    return false;
  }

  // --- Schedules ---
  async listSchedules(projectId: string): Promise<AutomationSchedule[]> {
    const all = this.getRaw<AutomationSchedule>(SCHEDULES_STORAGE_KEY);
    return all
      .filter((s) => s && s.projectId === projectId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async saveSchedule(schedule: AutomationSchedule): Promise<AutomationSchedule> {
    const all = this.getRaw<AutomationSchedule>(SCHEDULES_STORAGE_KEY);
    const idx = all.findIndex((s) => s && s.projectId === schedule.projectId && s.id === schedule.id);
    const updated = { ...schedule, updatedAt: new Date().toISOString() };

    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    this.saveRaw(SCHEDULES_STORAGE_KEY, all);
    return updated;
  }

  async deleteSchedule(projectId: string, scheduleId: string): Promise<boolean> {
    const all = this.getRaw<AutomationSchedule>(SCHEDULES_STORAGE_KEY);
    const filtered = all.filter((s) => !(s.projectId === projectId && s.id === scheduleId));
    if (filtered.length !== all.length) {
      this.saveRaw(SCHEDULES_STORAGE_KEY, filtered);
      return true;
    }
    return false;
  }

  // --- Runs ---
  async listRunRecords(projectId: string): Promise<ExecutionRunRecord[]> {
    const all = this.getRaw<ExecutionRunRecord>(RUNS_STORAGE_KEY);
    return all
      .filter((r) => r && r.projectId === projectId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async saveRunRecord(run: ExecutionRunRecord): Promise<ExecutionRunRecord> {
    const all = this.getRaw<ExecutionRunRecord>(RUNS_STORAGE_KEY);
    all.unshift(run);
    // Keep last 100 runs per browser storage
    const trimmed = all.slice(0, 100);
    this.saveRaw(RUNS_STORAGE_KEY, trimmed);
    return run;
  }
}

export const executionStorage: IExecutionStorageAdapter = new LocalBrowserExecutionStorageAdapter();
