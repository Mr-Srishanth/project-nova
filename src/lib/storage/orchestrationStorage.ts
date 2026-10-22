import type { OrchestrationAssessment, OrchestrationAction } from "@/types/orchestrator";

const ORCHESTRATION_STORAGE_KEY = "projectnova_orchestration_runs_v1";

export interface IOrchestrationStorageAdapter {
  list(projectId: string): Promise<OrchestrationAssessment[]>;
  getLatest(projectId: string): Promise<OrchestrationAssessment | null>;
  save(assessment: OrchestrationAssessment): Promise<OrchestrationAssessment>;
  updateActionState(
    projectId: string,
    actionId: string,
    updatedAction: OrchestrationAction
  ): Promise<OrchestrationAssessment | null>;
}

class LocalBrowserOrchestrationStorageAdapter implements IOrchestrationStorageAdapter {
  private getRaw(): OrchestrationAssessment[] {
    try {
      const data = localStorage.getItem(ORCHESTRATION_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (o) => o && typeof o === "object" && typeof o.id === "string" && typeof o.projectId === "string"
        );
      }
      return [];
    } catch (err) {
      console.error("[Orchestrator Storage] Failed to parse runs:", err);
      return [];
    }
  }

  private saveRaw(assessments: OrchestrationAssessment[]): void {
    try {
      localStorage.setItem(ORCHESTRATION_STORAGE_KEY, JSON.stringify(assessments));
    } catch (err) {
      console.error("[Orchestrator Storage] Failed to write runs:", err);
      throw new Error("Local storage quota exceeded or unavailable. Orchestration run could not be saved.");
    }
  }

  async list(projectId: string): Promise<OrchestrationAssessment[]> {
    const all = this.getRaw();
    return all
      .filter((o) => o.projectId === projectId)
      .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
  }

  async getLatest(projectId: string): Promise<OrchestrationAssessment | null> {
    const list = await this.list(projectId);
    return list.length > 0 ? list[0] : null;
  }

  async save(assessment: OrchestrationAssessment): Promise<OrchestrationAssessment> {
    const all = this.getRaw();
    const idx = all.findIndex((o) => o.id === assessment.id);
    if (idx >= 0) {
      all[idx] = assessment;
    } else {
      all.unshift(assessment);
    }
    this.saveRaw(all);
    return assessment;
  }

  async updateActionState(
    projectId: string,
    actionId: string,
    updatedAction: OrchestrationAction
  ): Promise<OrchestrationAssessment | null> {
    const all = this.getRaw();
    let targetAssessment: OrchestrationAssessment | null = null;

    for (const assess of all) {
      if (assess.projectId === projectId) {
        const actionIdx = assess.actions.findIndex((a) => a.id === actionId);
        if (actionIdx >= 0) {
          assess.actions[actionIdx] = updatedAction;
          targetAssessment = assess;
          break;
        }
      }
    }

    if (targetAssessment) {
      this.saveRaw(all);
    }
    return targetAssessment;
  }
}

export const orchestrationStorage: IOrchestrationStorageAdapter = new LocalBrowserOrchestrationStorageAdapter();
