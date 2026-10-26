/**
 * ProjectNova AI — Supabase Database Adapter for Project Brain memories.
 *
 * Same isolation rules as the project adapter: when a user is signed in and
 * Supabase is configured, every query filters by owner_id = the signed-in
 * user's id AND by project_id, and results are never merged with local
 * memories. Signed out / unconfigured: local browser storage only.
 * Remote failure on a signed-in READ or DELETE returns empty / false,
 * never local memories (same reason as the project adapter: local
 * memories may belong to a different browser session). Remote failure
 * on a WRITE still falls back to local — see the project adapter's
 * KNOWN TRAP note; tightening writes needs caller-level error UI first.
 *
 * Mapping notes (full fidelity, after supabase-schema-fix.sql):
 * - confidence is stored as NUMERIC(3,2) in Supabase (0.00–1.00) and as
 *   0–100 in the app, so it is divided by 100 on write and multiplied
 *   by 100 on read. Supabase may return NUMERIC as a string, so read
 *   handles both number and numeric-string forms.
 * - verificationState, version, rationale, relatedMemoryIds,
 *   relatedEntityRef and supersededBy round-trip through the
 *   verification_state, version, rationale, related_memory_ids,
 *   related_entity_ref (JSONB) and superseded_by columns added by
 *   supabase-schema-fix.sql. Only for old rows where verification_state
 *   is NULL is verificationState derived from source/status as a
 *   fallback (user → user_confirmed, ai → ai_proposed, otherwise
 *   unverified). NOTE: if the schema fix has NOT been run, PostgREST
 *   does NOT silently ignore the extra columns — it errors (PGRST204,
 *   column not found in schema cache) and the insert/update then falls
 *   back to local storage, telling the caller success while the memory
 *   stays local-only. Run the schema fix first; do not rely on drops.
 * - status is passed through as-is (active / superseded / resolved /
 *   archived), matching the migration utility's behaviour.
 */

import type {
  ProjectMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  ProjectMemoryType,
} from "@/types/memory";
import { IProjectBrainStorageAdapter, localBrainStorage } from "../storage/brainStorage";
import { getSupabaseClient } from "./supabaseClient";
import { getSignedInUserId } from "./auth";
import { generateId } from "@/lib/utils";

function deriveVerificationState(source: string): ProjectMemory["verificationState"] {
  if (source === "user") return "user_confirmed";
  if (source === "ai") return "ai_proposed";
  return "unverified";
}

export class SupabaseBrainStorageAdapter implements IProjectBrainStorageAdapter {
  private localFallback: IProjectBrainStorageAdapter = localBrainStorage;

  private async currentUserId(): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    // getSignedInUserId: getUser with cached-session fallback, so a
    // transient getUser failure does not route to local storage.
    return getSignedInUserId();
  }

  async list(projectId: string): Promise<ProjectMemory[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.list(projectId);
    const userId = await this.currentUserId();
    if (!userId) return this.localFallback.list(projectId);
    try {
      const { data, error } = await supabase
        .from("project_memories")
        .select("*")
        .eq("project_id", projectId)
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("[Supabase Brain] List failed:", error.message);
        return [];
      }
      return (data ?? []).map(this.mapRowToMemory);
    } catch (err) {
      console.warn("[Supabase Brain] Network error, returning empty (never local):", err);
      return [];
    }
  }

  async getById(id: string): Promise<ProjectMemory | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.getById(id);
    const userId = await this.currentUserId();
    if (!userId) return this.localFallback.getById(id);
    try {
      const { data, error } = await supabase
        .from("project_memories")
        .select("*")
        .eq("id", id)
        .eq("owner_id", userId)
        .maybeSingle();
      if (error || !data) return null;
      return this.mapRowToMemory(data);
    } catch {
      // Network throw: a miss, never a local lookup (see list()).
      return null;
    }
  }

  async create(input: CreateMemoryInput): Promise<ProjectMemory> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.create(input);
    const userId = await this.currentUserId();
    if (!userId) return this.localFallback.create(input);

    const now = new Date().toISOString();
    const source = input.source;
    const newEntry: ProjectMemory = {
      id: generateId("mem"),
      projectId: input.projectId,
      type: input.type,
      title: input.title.trim(),
      content: input.content.trim(),
      source,
      status: input.status || "active",
      verificationState:
        input.verificationState || deriveVerificationState(source),
      confidence: input.confidence ?? (source === "user" ? 100 : 80),
      tags: input.tags || [],
      rationale: input.rationale?.trim(),
      relatedMemoryIds: input.relatedMemoryIds || [],
      relatedEntityRef: input.relatedEntityRef,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const { error } = await supabase
        .from("project_memories")
        .insert(this.mapMemoryToRow(newEntry, userId));
      if (error) {
        console.warn("[Supabase Brain] Insert failed, offline fallback:", error.message);
        return this.localFallback.create(input);
      }
      return newEntry;
    } catch (err) {
      console.warn("[Supabase Brain] Exception on insert, offline fallback:", err);
      return this.localFallback.create(input);
    }
  }

  async update(id: string, patch: UpdateMemoryInput): Promise<ProjectMemory> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.update(id, patch);
    const userId = await this.currentUserId();
    if (!userId) return this.localFallback.update(id, patch);

    try {
      const { data: existing, error: fetchError } = await supabase
        .from("project_memories")
        .select("*")
        .eq("id", id)
        .eq("owner_id", userId)
        .maybeSingle();
      if (fetchError || !existing) {
        throw new Error(`Memory ${id} not found for this user.`);
      }
      const current = this.mapRowToMemory(existing);
      const updated: ProjectMemory = {
        ...current,
        ...patch,
        title: patch.title !== undefined ? patch.title.trim() : current.title,
        content: patch.content !== undefined ? patch.content.trim() : current.content,
        version: (current.version || 1) + 1,
        updatedAt: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("project_memories")
        .update(this.mapMemoryToRow(updated, existing.owner_id as string))
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return updated;
    } catch (err) {
      const local = await this.localFallback.getById(id).catch(() => null);
      if (local) {
        console.warn("[Supabase Brain] Update failed on remote, updating local copy:", err);
        return this.localFallback.update(id, patch);
      }
      throw err;
    }
  }

  async delete(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.delete(id);
    const userId = await this.currentUserId();
    if (!userId) return this.localFallback.delete(id);
    try {
      const { error } = await supabase
        .from("project_memories")
        .delete()
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) {
        console.warn("[Supabase Brain] Remote delete failed:", error.message);
        return false;
      }
      await this.localFallback.delete(id).catch(() => null);
      return true;
    } catch {
      // Network throw: report failure, do NOT delete the local copy
      // and report it as a cloud deletion (remote row still exists).
      return false;
    }
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

  async supersede(
    oldMemoryId: string,
    newMemoryInput: CreateMemoryInput
  ): Promise<{ superseded: ProjectMemory; created: ProjectMemory }> {
    const created = await this.create({
      ...newMemoryInput,
      relatedMemoryIds: [...(newMemoryInput.relatedMemoryIds || []), oldMemoryId],
    });
    const superseded = await this.update(oldMemoryId, {
      status: "superseded",
      supersededBy: created.id,
    });
    return { superseded, created };
  }

  async confirmProposal(id: string): Promise<ProjectMemory> {
    return this.update(id, { verificationState: "user_confirmed" });
  }

  async rejectProposal(id: string): Promise<ProjectMemory> {
    return this.update(id, { verificationState: "rejected", status: "archived" });
  }

  async resolveQuestion(id: string, resolutionNote?: string): Promise<ProjectMemory> {
    const memory = await this.getById(id);
    if (!memory) throw new Error(`Memory "${id}" not found.`);
    return this.update(id, {
      status: "resolved",
      rationale: resolutionNote ? resolutionNote.trim() : memory.rationale,
    });
  }

  private mapRowToMemory(row: any): ProjectMemory {
    const confidenceRaw =
      typeof row.confidence === "string"
        ? parseFloat(row.confidence)
        : row.confidence;
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      title: row.title || "Untitled Memory",
      content: row.content || "",
      source: row.source || "user",
      status: row.status || "active",
      // Read the stored value when present; derive only for old rows
      // whose verification_state is NULL (pre-schema-fix rows).
      verificationState:
        row.verification_state ||
        deriveVerificationState(row.source || "user"),
      confidence:
        typeof confidenceRaw === "number" && !Number.isNaN(confidenceRaw)
          ? Math.round(confidenceRaw * 100)
          : 100,
      tags: Array.isArray(row.tags) ? row.tags : [],
      rationale: row.rationale || undefined,
      supersededBy: row.superseded_by || undefined,
      relatedMemoryIds: Array.isArray(row.related_memory_ids)
        ? row.related_memory_ids
        : [],
      relatedEntityRef: row.related_entity_ref || undefined,
      version:
        typeof row.version === "number" && !Number.isNaN(row.version)
          ? row.version
          : 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMemoryToRow(memory: ProjectMemory, ownerId: string): any {
    return {
      id: memory.id,
      project_id: memory.projectId,
      owner_id: ownerId,
      type: memory.type,
      category: memory.type,
      title: memory.title,
      content: memory.content,
      confidence: (memory.confidence ?? 100) / 100,
      source: memory.source,
      status: memory.status,
      tags: memory.tags || [],
      verification_state: memory.verificationState,
      version: memory.version ?? 1,
      rationale: memory.rationale || null,
      related_memory_ids: memory.relatedMemoryIds || [],
      related_entity_ref: memory.relatedEntityRef || null,
      superseded_by: memory.supersededBy || null,
      created_at: memory.createdAt,
      updated_at: memory.updatedAt,
    };
  }
}

export const supabaseBrainStorage = new SupabaseBrainStorageAdapter();
