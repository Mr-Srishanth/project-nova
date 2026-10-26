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

/** The plain local adapter, exported for Supabase adapters / migration
 *  so they can fall back to (or read) local data without going through
 *  the proxy below — using the proxy there would recurse. */
export const localProjectStorage = new LocalBrowserStorageAdapter();

/**
 * Active-storage resolution (Supabase Auth + per-user isolation).
 *
 * Signed in + Supabase configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY):
 * the Supabase adapter is used, and it only ever touches rows owned by the
 * signed-in user (owner_id filter on every query, no local merging).
 * Signed out / unconfigured: the local browser adapter, exactly as before.
 *
 * The Supabase adapter is loaded lazily (dynamic import) so this module
 * does not statically depend on it — the adapter itself imports the local
 * adapter above, and a static cycle would break module initialisation.
 * getCorruptedBackup() is synchronous and local-only by definition.
 */
async function resolveProjectStorage(): Promise<IProjectStorageAdapter> {
  try {
    const { getSupabaseClient } = await import("@/lib/supabase/supabaseClient");
    const supabase = getSupabaseClient();
    if (!supabase) return localProjectStorage;
    // getSignedInUserId: getUser with cached-session fallback. A
    // transient getUser error (offline) must NOT route a signed-in user
    // to local storage — the Supabase adapter's own read/delete paths
    // return empty/false on remote failure, never local data.
    const { getSignedInUserId } = await import("@/lib/supabase/auth");
    if (!(await getSignedInUserId())) return localProjectStorage;
    const { supabaseProjectStorage } = await import(
      "@/lib/supabase/supabaseProjectStorage"
    );
    return supabaseProjectStorage;
  } catch {
    return localProjectStorage;
  }
}

// Export singleton instance. All existing consumers keep importing
// `projectStorage`; the proxy below routes each call to the Supabase
// adapter when a user is signed in, and to local storage otherwise.
export const projectStorage: IProjectStorageAdapter = {
  async list() {
    return (await resolveProjectStorage()).list();
  },
  async getById(id: string) {
    return (await resolveProjectStorage()).getById(id);
  },
  async create(input: CreateProjectInput) {
    return (await resolveProjectStorage()).create(input);
  },
  async update(id: string, patch: UpdateProjectInput) {
    return (await resolveProjectStorage()).update(id, patch);
  },
  async delete(id: string) {
    return (await resolveProjectStorage()).delete(id);
  },
  getCorruptedBackup() {
    return localProjectStorage.getCorruptedBackup();
  },
};
