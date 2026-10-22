import type { ReleaseRecord, ReleaseStatus } from "@/types/release";

const RELEASES_STORAGE_KEY = "projectnova_releases_v1";

export interface IReleaseStorageAdapter {
  list(projectId: string): Promise<ReleaseRecord[]>;
  getLatest(projectId: string): Promise<ReleaseRecord | null>;
  save(release: ReleaseRecord): Promise<ReleaseRecord>;
  updateStatus(projectId: string, releaseId: string, status: ReleaseStatus, approvedBy?: string): Promise<ReleaseRecord | null>;
  updateChecklist(projectId: string, releaseId: string, checklistItemId: string, completed: boolean): Promise<ReleaseRecord | null>;
}

class LocalBrowserReleaseStorageAdapter implements IReleaseStorageAdapter {
  private getRaw(): ReleaseRecord[] {
    try {
      const data = localStorage.getItem(RELEASES_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter((r) => r && typeof r === "object" && typeof r.id === "string" && typeof r.projectId === "string");
      }
      return [];
    } catch (err) {
      console.error("[Release Storage] Failed to parse releases:", err);
      return [];
    }
  }

  private saveRaw(releases: ReleaseRecord[]): void {
    try {
      localStorage.setItem(RELEASES_STORAGE_KEY, JSON.stringify(releases));
    } catch (err) {
      console.error("[Release Storage] Failed to write releases:", err);
      throw new Error("Local storage quota exceeded or unavailable. Release changes could not be saved.");
    }
  }

  async list(projectId: string): Promise<ReleaseRecord[]> {
    const all = this.getRaw();
    return all
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getLatest(projectId: string): Promise<ReleaseRecord | null> {
    const list = await this.list(projectId);
    return list.length > 0 ? list[0] : null;
  }

  async save(release: ReleaseRecord): Promise<ReleaseRecord> {
    const all = this.getRaw();
    const idx = all.findIndex((r) => r.id === release.id);
    const updated = {
      ...release,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    this.saveRaw(all);
    return updated;
  }

  async updateStatus(
    projectId: string,
    releaseId: string,
    status: ReleaseStatus,
    approvedBy?: string
  ): Promise<ReleaseRecord | null> {
    const all = this.getRaw();
    const target = all.find((r) => r.projectId === projectId && r.id === releaseId);
    if (!target) return null;

    target.status = status;
    target.updatedAt = new Date().toISOString();

    if (status === "approved") {
      target.approvedAt = new Date().toISOString();
      target.approvedBy = approvedBy || "Authorized User";
    } else if (status === "released") {
      target.releasedAt = new Date().toISOString();
    }

    this.saveRaw(all);
    return target;
  }

  async updateChecklist(
    projectId: string,
    releaseId: string,
    checklistItemId: string,
    completed: boolean
  ): Promise<ReleaseRecord | null> {
    const all = this.getRaw();
    const target = all.find((r) => r.projectId === projectId && r.id === releaseId);
    if (!target) return null;

    const item = target.checklist.find((c) => c.id === checklistItemId);
    if (item) {
      item.completed = completed;
      if (completed) {
        item.completedAt = new Date().toISOString();
      } else {
        item.completedAt = undefined;
      }
    }

    target.updatedAt = new Date().toISOString();
    this.saveRaw(all);
    return target;
  }
}

export const releaseStorage: IReleaseStorageAdapter = new LocalBrowserReleaseStorageAdapter();
