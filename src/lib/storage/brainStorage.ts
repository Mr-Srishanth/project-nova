import type {
  ProjectMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  ProjectMemoryType,
} from "@/types/memory";
import { generateId } from "@/lib/utils";
import { activityLogger } from "@/lib/observability/activityLogger";

const MEMORY_STORAGE_KEY = "projectnova_brain_memories_v1";
const CORRUPTED_MEMORY_BACKUP_KEY = "projectnova_brain_memories_corrupted_backup";

export interface IProjectBrainStorageAdapter {
  list(projectId: string): Promise<ProjectMemory[]>;
  getById(id: string): Promise<ProjectMemory | null>;
  create(input: CreateMemoryInput): Promise<ProjectMemory>;
  update(id: string, patch: UpdateMemoryInput): Promise<ProjectMemory>;
  delete(id: string): Promise<boolean>;
  search(projectId: string, query: string, type?: ProjectMemoryType): Promise<ProjectMemory[]>;
  supersede(oldMemoryId: string, newMemoryInput: CreateMemoryInput): Promise<{ superseded: ProjectMemory; created: ProjectMemory }>;
  confirmProposal(id: string): Promise<ProjectMemory>;
  rejectProposal(id: string): Promise<ProjectMemory>;
  resolveQuestion(id: string, resolutionNote?: string): Promise<ProjectMemory>;
}

class LocalBrowserBrainStorageAdapter implements IProjectBrainStorageAdapter {
  private getRaw(): ProjectMemory[] {
    try {
      const data = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((m) => m && typeof m === "object" && typeof m.id === "string" && typeof m.projectId === "string")
          .map((m) => this.migrateLegacyMemory(m));
      }
      this.backupCorrupted(data);
      return [];
    } catch (err) {
      console.error("[ProjectBrain Storage] Corrupted JSON in brain memory storage. Backing up:", err);
      const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (raw) this.backupCorrupted(raw);
      return [];
    }
  }

  /**
   * Non-destructive migration from Phase 3 legacy memory models to Phase 12 Intelligent Memory.
   */
  private migrateLegacyMemory(legacy: any): ProjectMemory {
    const status = legacy.status || "active";
    let verificationState = legacy.verificationState;

    if (!verificationState) {
      if (legacy.source === "user") {
        verificationState = "user_confirmed";
      } else if (legacy.source === "ai") {
        verificationState = "ai_proposed";
      } else {
        verificationState = "unverified";
      }
    }

    return {
      id: legacy.id,
      projectId: legacy.projectId,
      type: legacy.type || "fact",
      title: legacy.title || "Untitled Memory",
      content: legacy.content || "",
      source: legacy.source || "user",
      status,
      verificationState,
      confidence: typeof legacy.confidence === "number" ? legacy.confidence : 100,
      tags: Array.isArray(legacy.tags) ? legacy.tags : [],
      rationale: legacy.rationale,
      supersededBy: legacy.supersededBy,
      relatedMemoryIds: Array.isArray(legacy.relatedMemoryIds) ? legacy.relatedMemoryIds : [],
      relatedEntityRef: legacy.relatedEntityRef,
      version: legacy.version || 1,
      createdAt: legacy.createdAt || new Date().toISOString(),
      updatedAt: legacy.updatedAt || legacy.createdAt || new Date().toISOString(),
    };
  }

  private backupCorrupted(raw: string): void {
    try {
      localStorage.setItem(`${CORRUPTED_MEMORY_BACKUP_KEY}_${Date.now()}`, raw);
    } catch (e) {
      console.warn("[ProjectBrain Storage] Failed to write corrupted backup key:", e);
    }
  }

  private saveRaw(memories: ProjectMemory[]): void {
    try {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
    } catch (err) {
      console.error("[ProjectBrain Storage] Failed to write memories to storage:", err);
      throw new Error("Local storage quota exceeded or unavailable. Brain memory could not be saved.");
    }
  }

  async list(projectId: string): Promise<ProjectMemory[]> {
    const all = this.getRaw();
    return all
      .filter((m) => m.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getById(id: string): Promise<ProjectMemory | null> {
    const all = this.getRaw();
    return all.find((m) => m.id === id) || null;
  }

  async create(input: CreateMemoryInput): Promise<ProjectMemory> {
    const now = new Date().toISOString();
    const source = input.source;
    const defaultVerification =
      input.verificationState ||
      (source === "user" ? "user_confirmed" : source === "ai" ? "ai_proposed" : "unverified");

    const newEntry: ProjectMemory = {
      id: generateId("mem"),
      projectId: input.projectId,
      type: input.type,
      title: input.title.trim(),
      content: input.content.trim(),
      source,
      status: input.status || "active",
      verificationState: defaultVerification,
      confidence: input.confidence ?? (source === "user" ? 100 : 80),
      tags: input.tags || [],
      rationale: input.rationale?.trim(),
      relatedMemoryIds: input.relatedMemoryIds || [],
      relatedEntityRef: input.relatedEntityRef,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const all = this.getRaw();

    // Deduplication check: active memory with exact title & type
    const duplicate = all.find(
      (m) =>
        m.projectId === input.projectId &&
        m.type === input.type &&
        m.status === "active" &&
        m.title.toLowerCase() === input.title.trim().toLowerCase()
    );

    if (duplicate) {
      return this.update(duplicate.id, {
        content: input.content.trim(),
        confidence: input.confidence,
        tags: input.tags,
        rationale: input.rationale,
      });
    }

    all.unshift(newEntry);
    this.saveRaw(all);

    await activityLogger.log({
      projectId: input.projectId,
      category: "orchestration",
      eventType: "memory_created",
      severity: "info",
      outcome: "succeeded",
      sourceSubsystem: "orchestrator",
      summary: `Created ${newEntry.type} memory: "${newEntry.title}"`,
      entityLink: {
        entityType: "project",
        entityId: input.projectId,
        route: `/projects/${input.projectId}`,
      },
    });

    return newEntry;
  }

  async update(id: string, patch: UpdateMemoryInput): Promise<ProjectMemory> {
    const all = this.getRaw();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) {
      throw new Error(`ProjectMemory with ID "${id}" was not found.`);
    }

    const prev = all[idx];
    const updated: ProjectMemory = {
      ...prev,
      ...patch,
      title: patch.title !== undefined ? patch.title.trim() : prev.title,
      content: patch.content !== undefined ? patch.content.trim() : prev.content,
      rationale: patch.rationale !== undefined ? patch.rationale.trim() : prev.rationale,
      version: (prev.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };

    all[idx] = updated;
    this.saveRaw(all);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const all = this.getRaw();
    const filtered = all.filter((m) => m.id !== id);
    if (filtered.length === all.length) return false;
    this.saveRaw(filtered);
    return true;
  }

  async search(projectId: string, query: string, type?: ProjectMemoryType): Promise<ProjectMemory[]> {
    const scoped = await this.list(projectId);
    const q = query.trim().toLowerCase();
    return scoped.filter((m) => {
      const matchesType = type ? m.type === type : true;
      const matchesQuery = !q
        ? true
        : m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)));
      return matchesType && matchesQuery;
    });
  }

  async supersede(oldMemoryId: string, newMemoryInput: CreateMemoryInput): Promise<{ superseded: ProjectMemory; created: ProjectMemory }> {
    const created = await this.create({
      ...newMemoryInput,
      relatedMemoryIds: [...(newMemoryInput.relatedMemoryIds || []), oldMemoryId],
    });

    const superseded = await this.update(oldMemoryId, {
      status: "superseded",
      supersededBy: created.id,
    });

    await activityLogger.log({
      projectId: created.projectId,
      category: "orchestration",
      eventType: "memory_superseded",
      severity: "info",
      outcome: "succeeded",
      sourceSubsystem: "orchestrator",
      summary: `Superseded memory "${superseded.title}" with new revision "${created.title}"`,
    });

    return { superseded, created };
  }

  async confirmProposal(id: string): Promise<ProjectMemory> {
    const updated = await this.update(id, {
      verificationState: "user_confirmed",
    });

    await activityLogger.log({
      projectId: updated.projectId,
      category: "orchestration",
      eventType: "memory_confirmed",
      severity: "info",
      outcome: "succeeded",
      sourceSubsystem: "orchestrator",
      summary: `Confirmed memory proposal: "${updated.title}"`,
    });

    return updated;
  }

  async rejectProposal(id: string): Promise<ProjectMemory> {
    const updated = await this.update(id, {
      verificationState: "rejected",
      status: "archived",
    });

    await activityLogger.log({
      projectId: updated.projectId,
      category: "orchestration",
      eventType: "memory_rejected",
      severity: "info",
      outcome: "cancelled",
      sourceSubsystem: "orchestrator",
      summary: `Rejected memory proposal: "${updated.title}"`,
    });

    return updated;
  }

  async resolveQuestion(id: string, resolutionNote?: string): Promise<ProjectMemory> {
    const memory = await this.getById(id);
    if (!memory) throw new Error(`Memory "${id}" not found.`);

    const patch: UpdateMemoryInput = {
      status: "resolved",
      rationale: resolutionNote ? resolutionNote.trim() : memory.rationale,
    };

    const updated = await this.update(id, patch);

    await activityLogger.log({
      projectId: updated.projectId,
      category: "orchestration",
      eventType: "question_resolved",
      severity: "info",
      outcome: "succeeded",
      sourceSubsystem: "orchestrator",
      summary: `Resolved open question: "${updated.title}"`,
    });

    return updated;
  }
}

/** Plain local adapter, exported for Supabase adapters / migration so they
 *  can use local data without going through the proxy below (which would
 *  recurse when a user is signed in). */
export const localBrainStorage = new LocalBrowserBrainStorageAdapter();

/**
 * Active-storage resolution, mirroring projectStorage: signed in +
 * Supabase configured → the Supabase Brain adapter (owner_id + project_id
 * filtered, never merged with local); signed out / unconfigured → local.
 * Loaded lazily to avoid a static cycle with the Supabase adapter.
 */
async function resolveBrainStorage(): Promise<IProjectBrainStorageAdapter> {
  try {
    const { getSupabaseClient } = await import("@/lib/supabase/supabaseClient");
    const supabase = getSupabaseClient();
    if (!supabase) return localBrainStorage;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return localBrainStorage;
    const { supabaseBrainStorage } = await import(
      "@/lib/supabase/supabaseBrainStorage"
    );
    return supabaseBrainStorage;
  } catch {
    return localBrainStorage;
  }
}

// All existing consumers keep importing `brainStorage`; the proxy routes
// each call to Supabase when a user is signed in, local otherwise.
export const brainStorage: IProjectBrainStorageAdapter = {
  async list(projectId: string) {
    return (await resolveBrainStorage()).list(projectId);
  },
  async getById(id: string) {
    return (await resolveBrainStorage()).getById(id);
  },
  async create(input: CreateMemoryInput) {
    return (await resolveBrainStorage()).create(input);
  },
  async update(id: string, patch: UpdateMemoryInput) {
    return (await resolveBrainStorage()).update(id, patch);
  },
  async delete(id: string) {
    return (await resolveBrainStorage()).delete(id);
  },
  async search(projectId: string, query: string, type?: ProjectMemoryType) {
    return (await resolveBrainStorage()).search(projectId, query, type);
  },
  async supersede(oldMemoryId: string, newMemoryInput: CreateMemoryInput) {
    return (await resolveBrainStorage()).supersede(oldMemoryId, newMemoryInput);
  },
  async confirmProposal(id: string) {
    return (await resolveBrainStorage()).confirmProposal(id);
  },
  async rejectProposal(id: string) {
    return (await resolveBrainStorage()).rejectProposal(id);
  },
  async resolveQuestion(id: string, resolutionNote?: string) {
    return (await resolveBrainStorage()).resolveQuestion(id, resolutionNote);
  },
};
