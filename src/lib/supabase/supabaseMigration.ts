/**
 * ProjectNova AI — Supabase Data Migration Utility
 * Phase 20 Post-Roadmap Infrastructure Integration
 *
 * Safely migrates existing browser LocalStorage projects and memories
 * to Supabase PostgreSQL without data loss or duplicate collisions.
 *
 * Audit fixes (2026-10-26, local only — no behaviour change to auth):
 * - Abort when there is no signed-in user instead of inserting rows
 *   with owner_id = null (those inserts fail RLS anyway, and a null
 *   owner must never be written in the hope a policy allows it).
 * - The project existence check is scoped by owner_id, like every other
 *   Supabase query: an id owned by another user must not count as
 *   "already migrated" for this user (RLS would hide it anyway, and
 *   the old unscoped check then produced a confusing PK-conflict
 *   error instead of a clean insert attempt).
 * - Memories are migrated whenever the project exists in Supabase —
 *   whether it was just inserted OR was already there (skipped). The
 *   old code only migrated memories inside the "just inserted" branch,
 *   so a first run that inserted the project but failed on memories
 *   could never be repaired: every later run skipped the project and
 *   its memories stayed local forever (0 memories moved, no error).
 * - Memory inserts are deduplicated by (id, owner_id) and their
 *   failures are RECORDED in summary.errors. The old code silently
 *   dropped memErr (`if (!memErr) count++` with no else), so the UI
 *   reported "Moved N projects and M memories" with no hint that
 *   memories had failed.
 */

// NOTE: migration must read LOCAL data, not the proxy exports (which route
// to Supabase when signed in) — otherwise it would migrate nothing.
import { localProjectStorage as projectStorage } from '../storage/projectStorage';
import { localBrainStorage as brainStorage } from '../storage/brainStorage';
import { getSupabaseClient } from './supabaseClient';

export interface MigrationSummary {
  timestamp: string;
  projectsMigrated: number;
  projectsSkipped: number;
  memoriesMigrated: number;
  memoriesSkipped: number;
  errors: string[];
}

export async function migrateLocalStorageToSupabase(): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    timestamp: new Date().toISOString(),
    projectsMigrated: 0,
    projectsSkipped: 0,
    memoriesMigrated: 0,
    memoriesSkipped: 0,
    errors: [],
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    summary.errors.push('Supabase client is unconfigured. Migration aborted.');
    return summary;
  }

  // Abort without a user: never insert owner_id = null.
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    summary.errors.push('No signed-in user. Sign in first, then run migration again. Migration aborted.');
    return summary;
  }

  // Migrate one project's memories. Runs for newly-inserted AND for
  // already-present (skipped) projects, so a partial earlier run can
  // be repaired by running migration again. Idempotent: an existing
  // (id, owner_id) memory is counted as skipped, never re-inserted.
  const migrateMemoriesForProject = async (projectId: string): Promise<void> => {
    const memories = await brainStorage.list(projectId);
    for (const mem of memories) {
      const { data: existingMem } = await supabase
        .from('project_memories')
        .select('id')
        .eq('id', mem.id)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (existingMem) {
        summary.memoriesSkipped++;
        continue;
      }
      const { error: memErr } = await supabase.from('project_memories').insert({
        id: mem.id,
        project_id: projectId,
        owner_id: user.id,
        type: mem.type,
        category: mem.type,
        title: mem.title,
        content: mem.content,
        confidence: (mem.confidence || 100) / 100,
        source: mem.source,
        status: mem.status,
        tags: mem.tags || [],
        verification_state: mem.verificationState || null,
        version: mem.version ?? 1,
        rationale: mem.rationale || null,
        related_memory_ids: mem.relatedMemoryIds || [],
        related_entity_ref: mem.relatedEntityRef || null,
        superseded_by: mem.supersededBy || null,
        created_at: mem.createdAt,
        updated_at: mem.updatedAt,
      });
      if (memErr) {
        summary.errors.push(`Failed to migrate memory ${mem.id} (project ${projectId}): ${memErr.message}`);
      } else {
        summary.memoriesMigrated++;
      }
    }
  };

  try {
    const localProjects = await projectStorage.list();

    for (const project of localProjects) {
      // Owner-scoped existence check (see header note).
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('id', project.id)
        .eq('owner_id', user.id)
        .maybeSingle();

      let projectInCloud = Boolean(existing);
      if (existing) {
        summary.projectsSkipped++;
      } else {
        const { error: insertError } = await supabase.from('projects').insert({
          id: project.id,
          owner_id: user.id,
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
        });

        if (insertError) {
          summary.errors.push(`Failed to migrate project ${project.id}: ${insertError.message}`);
        } else {
          summary.projectsMigrated++;
          projectInCloud = true;
        }
      }

      // Only migrate memories when the project is actually in Supabase;
      // otherwise every memory insert would fail on the FK to projects
      // and flood errors for a problem already reported above.
      if (projectInCloud) {
        await migrateMemoriesForProject(project.id);
      }
    }
  } catch (err: any) {
    summary.errors.push(`Unexpected migration exception: ${err?.message || err}`);
  }

  return summary;
}
