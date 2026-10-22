import type { RepositoryIndex } from "@/types/repository";

const REPOSITORY_STORAGE_KEY = "projectnova_repo_indexes_v1";

export interface IRepositoryStorageAdapter {
  getIndex(projectId: string): Promise<RepositoryIndex | null>;
  saveIndex(index: RepositoryIndex): Promise<RepositoryIndex>;
  deleteIndex(projectId: string): Promise<boolean>;
}

class LocalBrowserRepositoryStorageAdapter implements IRepositoryStorageAdapter {
  private getRaw(): RepositoryIndex[] {
    try {
      const data = localStorage.getItem(REPOSITORY_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (idx) => idx && typeof idx === "object" && typeof idx.id === "string" && typeof idx.projectId === "string"
        );
      }
      return [];
    } catch (err) {
      console.warn("[Repository Storage] Error reading repository index from local storage:", err);
      return [];
    }
  }

  private saveRaw(indexes: RepositoryIndex[]): void {
    try {
      localStorage.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(indexes));
    } catch (err) {
      console.warn("[Repository Storage] Storage quota exceeded while writing repository index:", err);
      // Attempt quota recovery: strip internal structure AST tokens and retain summary nodes
      try {
        const lightweight = indexes.map((idx) => ({
          ...idx,
          files: idx.files.map((f) => ({
            id: f.id,
            path: f.path,
            language: f.language,
            sizeBytes: f.sizeBytes,
            isExcluded: f.isExcluded,
            parseStatus: f.parseStatus,
            exclusionReason: f.exclusionReason,
          })),
        }));
        localStorage.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(lightweight));
      } catch {
        throw new Error("Local storage quota exceeded. Repository index could not be persisted.");
      }
    }
  }

  async getIndex(projectId: string): Promise<RepositoryIndex | null> {
    const all = this.getRaw();
    return all.find((idx) => idx.projectId === projectId) || null;
  }

  async saveIndex(index: RepositoryIndex): Promise<RepositoryIndex> {
    const all = this.getRaw();
    const existingIdx = all.findIndex((idx) => idx.projectId === index.projectId);

    if (existingIdx !== -1) {
      all[existingIdx] = index;
    } else {
      all.push(index);
    }

    this.saveRaw(all);
    return index;
  }

  async deleteIndex(projectId: string): Promise<boolean> {
    const all = this.getRaw();
    const filtered = all.filter((idx) => idx.projectId !== projectId);
    if (filtered.length === all.length) return false;
    this.saveRaw(filtered);
    return true;
  }
}

export const repositoryStorage: IRepositoryStorageAdapter = new LocalBrowserRepositoryStorageAdapter();
