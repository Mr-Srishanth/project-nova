/**
 * ProjectNova AI — Supabase Database Adapter for Projects
 * Phase 20 Post-Roadmap Infrastructure Integration
 *
 * Plugs directly into existing IProjectStorageAdapter interface.
 * Implements transparent cloud sync with LocalStorage offline fallback.
 */

import type { Project, CreateProjectInput, UpdateProjectInput } from '@/types/project';
import { IProjectStorageAdapter, projectStorage as localProjectStorage } from '../storage/projectStorage';
import { getSupabaseClient } from './supabaseClient';
import { generateId } from '@/lib/utils';

export class SupabaseProjectStorageAdapter implements IProjectStorageAdapter {
  private localFallback: IProjectStorageAdapter = localProjectStorage;

  async list(): Promise<Project[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.list();
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        // If remote returns 0 items or RLS unauthenticated error, merge with local projects
        const localItems = await this.localFallback.list();
        if (data && data.length > 0) {
          const remoteMapped = data.map(this.mapRowToProject);
          const remoteIds = new Set(remoteMapped.map((p) => p.id));
          return [...remoteMapped, ...localItems.filter((l) => !remoteIds.has(l.id))];
        }
        return localItems;
      }

      return data.map(this.mapRowToProject);
    } catch (err) {
      console.warn('[Supabase Storage] Network error listing projects:', err);
      return this.localFallback.list();
    }
  }

  async getById(id: string): Promise<Project | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.getById(id);
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        return this.localFallback.getById(id);
      }

      return this.mapRowToProject(data);
    } catch {
      return this.localFallback.getById(id);
    }
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.create(input);
    }

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
      createdAt: now,
      updatedAt: now,
      milestones: [],
    };

    try {
      const user = (await supabase.auth.getUser()).data.user;
      const row = this.mapProjectToRow(newProject, user?.id);

      const { error } = await supabase.from('projects').insert(row);
      if (error) {
        console.warn('[Supabase Storage] Insert failed, storing locally:', error.message);
        // Save to local fallback using the exact generated newProject so the ID matches
        return await this.localFallback.create({
          ...input,
          name: newProject.name,
        }).then((saved) => ({
          ...newProject,
          id: saved.id
        }));
      }
      // Keep local in sync
      await this.localFallback.create({
        ...input,
        name: newProject.name
      }).catch(() => null);
      return newProject;
    } catch (err) {
      console.warn('[Supabase Storage] Exception on insert, saving locally:', err);
      return this.localFallback.create(input);
    }
  }

  async update(id: string, patch: UpdateProjectInput): Promise<Project> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.update(id, patch);
    }

    try {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`Project ${id} not found.`);
      }

      const updated: Project = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      const row = this.mapProjectToRow(updated);
      const { error } = await supabase.from('projects').update(row).eq('id', id);

      if (error) {
        console.warn('[Supabase Storage] Update failed on remote:', error.message);
      }
      // Keep local in sync
      await this.localFallback.update(id, patch).catch(() => null);
      return updated;
    } catch {
      return this.localFallback.update(id, patch);
    }
  }

  async delete(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.localFallback.delete(id);
    }

    try {
      await supabase.from('projects').delete().eq('id', id);
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapProjectToRow(project: Project, ownerId?: string): any {
    return {
      id: project.id,
      owner_id: ownerId || null,
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
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    };
  }
}

export const supabaseProjectStorage = new SupabaseProjectStorageAdapter();
