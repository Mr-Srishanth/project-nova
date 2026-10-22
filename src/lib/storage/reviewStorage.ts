import type { CodeReviewSession } from "@/types/review";

const REVIEWS_STORAGE_KEY = "projectnova_code_reviews_v1";

export interface IReviewStorageAdapter {
  getLatestSession(projectId: string): Promise<CodeReviewSession | null>;
  saveSession(session: CodeReviewSession): Promise<CodeReviewSession>;
  deleteSession(projectId: string): Promise<boolean>;
}

class LocalBrowserReviewStorageAdapter implements IReviewStorageAdapter {
  private getRaw(): CodeReviewSession[] {
    try {
      const data = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (s) => s && typeof s === "object" && typeof s.id === "string" && typeof s.projectId === "string"
        );
      }
      return [];
    } catch (err) {
      console.warn("[Review Storage] Failed to parse review sessions:", err);
      return [];
    }
  }

  private saveRaw(sessions: CodeReviewSession[]): void {
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.warn("[Review Storage] Storage quota exceeded while writing code review session:", err);
      // Attempt quota recovery: prune old sessions keeping only the latest per project
      try {
        const uniqueByProject = new Map<string, CodeReviewSession>();
        for (const s of sessions) {
          uniqueByProject.set(s.projectId, s);
        }
        localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(Array.from(uniqueByProject.values())));
      } catch {
        throw new Error("Local storage quota exceeded. Code review session could not be saved.");
      }
    }
  }

  async getLatestSession(projectId: string): Promise<CodeReviewSession | null> {
    const all = this.getRaw();
    return all.find((s) => s.projectId === projectId) || null;
  }

  async saveSession(session: CodeReviewSession): Promise<CodeReviewSession> {
    const all = this.getRaw();
    const idx = all.findIndex((s) => s.projectId === session.projectId);

    if (idx !== -1) {
      all[idx] = session;
    } else {
      all.push(session);
    }

    this.saveRaw(all);
    return session;
  }

  async deleteSession(projectId: string): Promise<boolean> {
    const all = this.getRaw();
    const filtered = all.filter((s) => s.projectId !== projectId);
    if (filtered.length === all.length) return false;
    this.saveRaw(filtered);
    return true;
  }
}

export const reviewStorage: IReviewStorageAdapter = new LocalBrowserReviewStorageAdapter();
