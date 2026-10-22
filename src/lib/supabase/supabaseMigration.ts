/**
 * ProjectNova AI — Supabase Data Migration Utility
 * Phase 20 Post-Roadmap Infrastructure Integration
 *
 * Safely migrates existing browser LocalStorage projects and memories
 * to Supabase PostgreSQL without data loss or duplicate collisions.
 */

import { projectStorage } from '../storage/projectStorage';
import { brainStorage } from '../storage/brainStorage';
import { getSupabaseClient } from './supabaseClient';

export interface MigrationSummary {
  timestamp: string;
  projectsMigrated: number;
  projectsSkipped: number;
  memoriesMigrated: number;
  errors: string[];
}

export async function migrateLocalStorageToSupabase(): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    timestamp: new Date().toISOString(),
    projectsMigrated: 0,
    projectsSkipped: 0,
    memoriesMigrated: 0,
    errors: [],
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    summary.errors.push('Supabase client is unconfigured. Migration aborted.');
    return summary;
  }

  try {
    const user = (await supabase.auth.getUser()).data.user;
    const localProjects = await projectStorage.list();

    for (const project of localProjects) {
      // Check if project already exists in Supabase
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('id', project.id)
        .maybeSingle();

      if (existing) {
        summary.projectsSkipped++;
      } else {
        const { error: insertError } = await supabase.from('projects').insert({
          id: project.id,
          owner_id: user?.id || null,
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
        });

        if (insertError) {
          summary.errors.push(`Failed to migrate project ${project.id}: ${insertError.message}`);
        } else {
          summary.projectsMigrated++;

          // Migrate associated Project Brain memories
          const memories = await brainStorage.list(project.id);
          for (const mem of memories) {
            const { error: memErr } = await supabase.from('project_memories').insert({
              id: mem.id,
              project_id: project.id,
              owner_id: user?.id || null,
              type: mem.type,
              category: mem.type,
              title: mem.title,
              content: mem.content,
              confidence: (mem.confidence || 100) / 100,
              source: mem.source,
              status: mem.status,
              tags: mem.tags || [],
              created_at: mem.createdAt,
              updated_at: mem.updatedAt,
            });

            if (!memErr) {
              summary.memoriesMigrated++;
            }
          }
        }
      }
    }
  } catch (err: any) {
    summary.errors.push(`Unexpected migration exception: ${err?.message || err}`);
  }

  return summary;
}
