/**
 * ProjectNova AI — Supabase Database Adapter for Projects (per-user isolated)
 *
 * Plugs into the existing IProjectStorageAdapter interface.
 *
 * Isolation rules (do not weaken these):
 * - Signed in + Supabase configured: Supabase is the source of truth.
 *   EVERY remote query filters by owner_id = the signed-in user's id, so a
 *   user can only list / get / update / delete their own rows. Row Level
 *   Security on the server (see supabase-rls.sql) enforces the same rule
 *   even if a client query forgot the filter.
 * - Remote results are NEVER merged with local browser projects. A signed-in
 *   user with zero Supabase rows sees zero projects, not the local list.
 * - create() sets owner_id = the signed-in user's id and never accepts an
 *   owner from input (CreateProjectInput has no owner field). update()
 *   preserves the row's existing owner_id — it is never overwritten.
 * - Signed out / Supabase unconfigured: local browser storage only.
 * - Remote failure (offline / network error): that single call falls back
 *   to local storage so the app keeps working offline. It is never merged
 *   with remote results, and a remote row that exists is never shadowed
 *   by a local copy.
 *
 * Mapping: initialPrompt / generationStatus round-trip through the
 * initial_prompt / generation_status columns added by
 * supabase-schema-fix.sql (null on old rows, which maps back to
 * undefined in the app).
 */

import type { Project, CreateProjectInput, UpdateProjectInput } from '@/types/project';
import { IProjectStorageAdapter, localProjectStorage } from '../storage/projectStorage';
import { getSupabaseClient } from './supabaseClient';
import { getCurrentUser } from './auth';
import { generateId } from '@/lib/utils';

export class SupabaseProjectStorageAdapter implements IProjectStorageAdapter {
  private localFallback: IProjectStorageAdapter = localProjectStorage;

  /** Signed-in user id, or null when signed out / unconfigured. */
  private async currentUserId(): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    return (await getCurrentUser())?.id ?? null;
  }

  async list(): Promise<Project[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.list();
    const userId = await this.currentUserId();
    // Signed out: local only. Never show another user's remote rows.
    if (!userId) return this.localFallback.list();

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[Supabase Storage] List failed:', error.message);
        return [];
      }
      // No local merge, even when remote is empty.
      return (data ?? []).map(this.mapRowToProject);
    } catch (err) {
      // Offline: local fallback for this call only, never merged.
      console.warn('[Supabase Storage] Network error listing projects, using offline fallback:', err);
      return this.localFallback.list();
    }
  }

  async getById(id: string): Promise<Project | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.getById(id);
    const userId = await this.currentUserId();
    if (!userId) return this.localFallback.getById(id);

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('owner_id', userId)
        .maybeSingle();
      // Remote miss (including another user's id) is a miss — do not check local.
      if (error || !data) return null;
      return this.mapRowToProject(data);
    } catch {
      return this.localFallback.getById(id);
    }
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.create(input);
    const userId = await this.currentUserId();
    if (!userId) return this.localFallback.create(input);

    const id = generateId('proj');
    const now = new Date().toISOString();
    const newProject: Project = {
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      objective: input.objective.trim(),
      category: input.category,
      technologies: input.technologies || [],
      status: 'active',
      discoveryMode: input.discoveryMode || 'custom',
      targetDeadline: input.targetDeadline?.trim() || undefined,
      constraints: input.constraints?.trim() || undefined,
      initialPrompt: input.initialPrompt?.trim() || undefined,
      generationStatus: input.generationStatus || (input.initialPrompt?.trim() ? 'not_generated' : undefined),
      createdAt: now,
      updatedAt: now,
      milestones: [],
    };

    try {
      const row = this.mapProjectToRow(newProject, userId);
      const { error } = await supabase.from('projects').insert(row);
      if (error) {
        console.warn('[Supabase Storage] Insert failed, storing locally (offline fallback):', error.message);
        return this.localFallback.create(input);
      }
      return newProject;
    } catch (err) {
      console.warn('[Supabase Storage] Exception on insert, saving locally (offline fallback):', err);
      return this.localFallback.create(input);
    }
  }

  async update(id: string, patch: UpdateProjectInput): Promise<Project> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.localFallback.update(id, patch);
    const userId = await this.currentUserId();
    if (!userId) return this.localFallback.update(id, patch);

    try {
      // Fetch the owned row first: both verifies ownership and preserves owner_id.
      const { data: existing, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('owner_id', userId)
        .maybeSingle();
      if (fetchError || !existing) {
        throw new Error(`Project ${id} not found for this user.`);
      }
      const current = this.mapRowToProject(existing);
      const updated: Project = { ...current, ...patch, updatedAt: new Date().toISOString() };
      // mapProjectToRow with the existing owner_id: owner is never overwritten.
      const row = this.mapProjectToRow(updated, existing.owner_id as string);
      const { error } = await supabase
        .from('projects')
        .update(row)
        .eq('id', id)
        .eq('owner_id', userId);
      if (error) throw new Error(error.message);
      return updated;
    } catch (err) {
      // Only fall back to local if a local copy of this project exists;
      // otherwise surface the failure instead of silently creating one.
      const local = await this.localFallback.getById(id).catch(() => null);
      if (local) {
        console.warn('[Supabase Storage] Update failed on remote, updating local copy:', err);
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
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId);
      if (error) {
        console.warn('[Supabase Storage] Remote delete failed:', error.message);
        return false;
      }
      // Best-effort local cleanup of the same id (never a merge).
      await this.localFallback.delete(id).catch(() => null);
      return true;
    } catch {
      return this.localFallback.delete(id);
    }
  }

  getCorruptedBackup(): string | null {
    return this.localFallback.getCorruptedBackup();
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      objective: row.objective,
      category: row.category,
      technologies: row.technologies || [],
      status: row.status,
      discoveryMode: row.discovery_mode,
      targetDeadline: row.target_deadline || undefined,
      constraints: row.constraints || undefined,
      blueprint: row.blueprint || undefined,
      milestones: row.milestones || [],
      stageStates: row.stage_states || [],
      roadmapMilestones: row.roadmap_milestones || [],
      initialPrompt: row.initial_prompt || undefined,
      generationStatus: row.generation_status || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapProjectToRow(project: Project, ownerId: string): any {
    return {
      id: project.id,
      owner_id: ownerId,
      name: project.name,
      description: project.description,
      objective: project.objective,
      category: project.category,
      technologies: project.technologies,
      status: project.status,
      discovery_mode: project.discoveryMode,
      target_deadline: project.targetDeadline || null,
      constraints: project.constraints || null,
      blueprint: project.blueprint || null,
      milestones: project.milestones,
      stage_states: project.stageStates || [],
      roadmap_milestones: project.roadmapMilestones || [],
      initial_prompt: project.initialPrompt || null,
      generation_status: project.generationStatus || null,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    };
  }
}

export const supabaseProjectStorage = new SupabaseProjectStorageAdapter();
