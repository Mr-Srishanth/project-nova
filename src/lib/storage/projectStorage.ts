import type { Project, CreateProjectInput, UpdateProjectInput } from "@/types/project";
import { generateId } from "@/lib/utils";

const STORAGE_KEY = "projectnova_projects_v1";
const CORRUPTED_BACKUP_KEY = "projectnova_projects_corrupted_backup";

export interface IProjectStorageAdapter {
  list(): Promise<Project[]>;
  getById(id: string): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(id: string, patch: UpdateProjectInput): Promise<Project>;
  delete(id: string): Promise<boolean>;
  getCorruptedBackup(): string | null;
}

class LocalBrowserStorageAdapter implements IProjectStorageAdapter {
  private getRaw(): Project[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Validate each item has at least an id and name before accepting
        const valid = parsed.filter(
          (item) => item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string"
        );
        return valid as Project[];
      }
      // If it parsed but is not an array, back it up
      this.backupCorruptedData(data);
      return [];
    } catch (err) {
      console.error("[ProjectNova Storage] Local storage data is corrupted JSON. Preserving backup:", err);
      const rawCorrupted = localStorage.getItem(STORAGE_KEY);
      if (rawCorrupted) {
        this.backupCorruptedData(rawCorrupted);
      }
      return [];
    }
  }

  private backupCorruptedData(raw: string): void {
    try {
      localStorage.setItem(`${CORRUPTED_BACKUP_KEY}_${Date.now()}`, raw);
    } catch (e) {
      console.warn("[ProjectNova Storage] Unable to write corrupted backup key:", e);
    }
  }

  getCorruptedBackup(): string | null {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(CORRUPTED_BACKUP_KEY));
      if (keys.length === 0) return null;
      return localStorage.getItem(keys[keys.length - 1]);
    } catch {
      return null;
    }
  }

  private saveRaw(projects: Project[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (err) {
      console.error("[ProjectNova Storage] Failed to write to local storage:", err);
      throw new Error("Local storage quota exceeded or unavailable. Project changes could not be saved.");
    }
  }

  async list(): Promise<Project[]> {
    const list = this.getRaw();
    // sort by updatedAt descending
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getById(id: string): Promise<Project | null> {
    const list = this.getRaw();
    return list.find((p) => p.id === id) || null;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const now = new Date().toISOString();
    const newProject: Project = {
      id: generateId("proj"),
      name: input.name.trim(),
      description: input.description.trim(),
      objective: input.objective.trim(),
      category: input.category,
      technologies: input.technologies || [],
      status: "active",
      discoveryMode: input.discoveryMode || "custom",
      targetDeadline: input.targetDeadline?.trim() || undefined,
      constraints: input.constraints?.trim() || undefined,
      initialPrompt: input.initialPrompt?.trim() || undefined,
      generationStatus: input.generationStatus || (input.initialPrompt?.trim() ? "not_generated" : undefined),
      createdAt: now,
      updatedAt: now,
      milestones: [],
    };

    const list = this.getRaw();
    list.unshift(newProject);
    this.saveRaw(list);
    return newProject;
  }

  async update(id: string, patch: UpdateProjectInput): Promise<Project> {
    const list = this.getRaw();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new Error(`Project with ID "${id}" was not found.`);
    }

    const updated: Project = {
      ...list[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    this.saveRaw(list);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const list = this.getRaw();
    const filtered = list.filter((p) => p.id !== id);
    if (filtered.length === list.length) {
      return false;
    }
    this.saveRaw(filtered);
    return true;
  }
}

// Export singleton instance. Can be swapped for Supabase/Postgres adapter in subsequent phases without changing consumer components.
export const projectStorage: IProjectStorageAdapter = new LocalBrowserStorageAdapter();
