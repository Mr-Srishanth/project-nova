import type { QualityAssessment, QualityFinding, TestPlan, TestCase, FindingStatus } from "@/types/quality";

const ASSESSMENTS_STORAGE_KEY = "projectnova_quality_assessments_v1";
const TEST_PLANS_STORAGE_KEY = "projectnova_test_plans_v1";

export interface IQualityStorageAdapter {
  listAssessments(projectId: string): Promise<QualityAssessment[]>;
  getLatestAssessment(projectId: string): Promise<QualityAssessment | null>;
  saveAssessment(assessment: QualityAssessment): Promise<QualityAssessment>;
  updateFindingStatus(
    projectId: string,
    findingId: string,
    status: FindingStatus,
    notes?: string
  ): Promise<QualityFinding | null>;

  listTestPlans(projectId: string): Promise<TestPlan[]>;
  saveTestPlan(testPlan: TestPlan): Promise<TestPlan>;
  updateTestCaseStatus(
    projectId: string,
    testCaseId: string,
    status: TestCase["status"],
    executionNotes?: string
  ): Promise<TestCase | null>;
  deleteTestPlan(projectId: string, testPlanId: string): Promise<boolean>;
}

class LocalBrowserQualityStorageAdapter implements IQualityStorageAdapter {
  private getAssessmentsRaw(): QualityAssessment[] {
    try {
      const data = localStorage.getItem(ASSESSMENTS_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (a) => a && typeof a === "object" && typeof a.id === "string" && typeof a.projectId === "string"
        );
      }
      return [];
    } catch (err) {
      console.error("[Quality Storage] Failed to parse assessments:", err);
      return [];
    }
  }

  private saveAssessmentsRaw(assessments: QualityAssessment[]): void {
    try {
      localStorage.setItem(ASSESSMENTS_STORAGE_KEY, JSON.stringify(assessments));
    } catch (err) {
      console.error("[Quality Storage] Failed to write assessments:", err);
      throw new Error("Local storage quota exceeded or unavailable. Quality assessments could not be saved.");
    }
  }

  private getTestPlansRaw(): TestPlan[] {
    try {
      const data = localStorage.getItem(TEST_PLANS_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (tp) => tp && typeof tp === "object" && typeof tp.id === "string" && typeof tp.projectId === "string"
        );
      }
      return [];
    } catch (err) {
      console.error("[Quality Storage] Failed to parse test plans:", err);
      return [];
    }
  }

  private saveTestPlansRaw(testPlans: TestPlan[]): void {
    try {
      localStorage.setItem(TEST_PLANS_STORAGE_KEY, JSON.stringify(testPlans));
    } catch (err) {
      console.error("[Quality Storage] Failed to write test plans:", err);
      throw new Error("Local storage quota exceeded or unavailable. Test plans could not be saved.");
    }
  }

  async listAssessments(projectId: string): Promise<QualityAssessment[]> {
    const all = this.getAssessmentsRaw();
    return all
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
  }

  async getLatestAssessment(projectId: string): Promise<QualityAssessment | null> {
    const list = await this.listAssessments(projectId);
    return list.length > 0 ? list[0] : null;
  }

  async saveAssessment(assessment: QualityAssessment): Promise<QualityAssessment> {
    const all = this.getAssessmentsRaw();
    const existingIdx = all.findIndex((a) => a.id === assessment.id);
    if (existingIdx >= 0) {
      all[existingIdx] = assessment;
    } else {
      all.unshift(assessment);
    }
    this.saveAssessmentsRaw(all);
    return assessment;
  }

  async updateFindingStatus(
    projectId: string,
    findingId: string,
    status: FindingStatus,
    notes?: string
  ): Promise<QualityFinding | null> {
    const all = this.getAssessmentsRaw();
    let updatedFinding: QualityFinding | null = null;

    for (const assessment of all) {
      if (assessment.projectId === projectId) {
        const f = assessment.findings.find((item) => item.id === findingId);
        if (f) {
          f.status = status;
          if (status === "resolved") {
            f.resolvedAt = new Date().toISOString();
          } else if (status === "dismissed") {
            f.dismissedAt = new Date().toISOString();
          }
          if (notes) {
            f.notes = notes;
          }
          // Recalculate summary counts
          const resolved = assessment.findings.filter((item) => item.status === "resolved").length;
          assessment.score.resolvedCount = resolved;
          updatedFinding = { ...f };
          break;
        }
      }
    }

    if (updatedFinding) {
      this.saveAssessmentsRaw(all);
    }
    return updatedFinding;
  }

  async listTestPlans(projectId: string): Promise<TestPlan[]> {
    const all = this.getTestPlansRaw();
    return all
      .filter((tp) => tp.projectId === projectId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async saveTestPlan(testPlan: TestPlan): Promise<TestPlan> {
    const all = this.getTestPlansRaw();
    const idx = all.findIndex((tp) => tp.id === testPlan.id);
    const updated = {
      ...testPlan,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    this.saveTestPlansRaw(all);
    return updated;
  }

  async updateTestCaseStatus(
    projectId: string,
    testCaseId: string,
    status: TestCase["status"],
    executionNotes?: string
  ): Promise<TestCase | null> {
    const all = this.getTestPlansRaw();
    let updatedCase: TestCase | null = null;

    for (const plan of all) {
      if (plan.projectId === projectId) {
        const tc = plan.testCases.find((c) => c.id === testCaseId);
        if (tc) {
          tc.status = status;
          tc.executedAt = new Date().toISOString();
          if (executionNotes !== undefined) {
            tc.executionNotes = executionNotes;
          }
          plan.updatedAt = new Date().toISOString();
          updatedCase = { ...tc };
          break;
        }
      }
    }

    if (updatedCase) {
      this.saveTestPlansRaw(all);
    }
    return updatedCase;
  }

  async deleteTestPlan(projectId: string, testPlanId: string): Promise<boolean> {
    const all = this.getTestPlansRaw();
    const filtered = all.filter((tp) => !(tp.projectId === projectId && tp.id === testPlanId));
    if (filtered.length !== all.length) {
      this.saveTestPlansRaw(filtered);
      return true;
    }
    return false;
  }
}

export const qualityStorage: IQualityStorageAdapter = new LocalBrowserQualityStorageAdapter();
