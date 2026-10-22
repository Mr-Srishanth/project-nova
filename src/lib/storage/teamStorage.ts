/**
 * ProjectNova AI - Multi-Agent Team Persistence Storage Adapter
 * Phase 19: Multi-Agent Teaming & Collaborative AI Workspaces
 */

import { TeamCoordinationRun, TeamMessage, TeamTask, ProposalReview, ConflictReport } from '../../types/team';

const RUNS_KEY_PREFIX = 'projectnova_team_runs_';
const TASKS_KEY_PREFIX = 'projectnova_team_tasks_';
const MESSAGES_KEY_PREFIX = 'projectnova_team_messages_';
const REVIEWS_KEY_PREFIX = 'projectnova_team_reviews_';
const CONFLICTS_KEY_PREFIX = 'projectnova_team_conflicts_';

const MAX_ITEMS = 300;

export class TeamStorageAdapter {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  // --- RUNS ---
  public getRuns(projectId: string): TeamCoordinationRun[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(`${RUNS_KEY_PREFIX}${projectId}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Failed to parse team runs from storage', e);
      return [];
    }
  }

  public getRunById(projectId: string, runId: string): TeamCoordinationRun | null {
    const runs = this.getRuns(projectId);
    return runs.find((r) => r.id === runId) || null;
  }

  public saveRun(run: TeamCoordinationRun): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      let runs = this.getRuns(run.projectId);
      const existingIdx = runs.findIndex((r) => r.id === run.id);
      if (existingIdx >= 0) {
        runs[existingIdx] = run;
      } else {
        runs.unshift(run);
      }
      if (runs.length > MAX_ITEMS) {
        runs = runs.slice(0, MAX_ITEMS);
      }
      storage.setItem(`${RUNS_KEY_PREFIX}${run.projectId}`, JSON.stringify(runs));
    } catch (e) {
      console.warn('Failed to save team run', e);
    }
  }

  // --- TASKS ---
  public getTasks(projectId: string, runId?: string): TeamTask[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(`${TASKS_KEY_PREFIX}${projectId}`);
      const tasks: TeamTask[] = raw ? JSON.parse(raw) : [];
      if (runId) {
        return tasks.filter((t) => t.runId === runId);
      }
      return tasks;
    } catch (e) {
      console.warn('Failed to parse team tasks from storage', e);
      return [];
    }
  }

  public saveTask(task: TeamTask): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      let tasks = this.getTasks(task.projectId);
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        tasks[idx] = task;
      } else {
        tasks.unshift(task);
      }
      if (tasks.length > MAX_ITEMS) {
        tasks = tasks.slice(0, MAX_ITEMS);
      }
      storage.setItem(`${TASKS_KEY_PREFIX}${task.projectId}`, JSON.stringify(tasks));
    } catch (e) {
      console.warn('Failed to save team task', e);
    }
  }

  public saveTasks(tasks: TeamTask[]): void {
    tasks.forEach((t) => this.saveTask(t));
  }

  // --- MESSAGES ---
  public getMessages(projectId: string, runId?: string): TeamMessage[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(`${MESSAGES_KEY_PREFIX}${projectId}`);
      const messages: TeamMessage[] = raw ? JSON.parse(raw) : [];
      if (runId) {
        return messages.filter((m) => m.runId === runId);
      }
      return messages;
    } catch (e) {
      console.warn('Failed to parse team messages', e);
      return [];
    }
  }

  public saveMessage(message: TeamMessage): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      let messages = this.getMessages(message.projectId);
      const idx = messages.findIndex((m) => m.id === message.id);
      if (idx >= 0) {
        messages[idx] = message;
      } else {
        messages.push(message);
      }
      if (messages.length > MAX_ITEMS) {
        messages = messages.slice(-MAX_ITEMS);
      }
      storage.setItem(`${MESSAGES_KEY_PREFIX}${message.projectId}`, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save team message', e);
    }
  }

  // --- REVIEWS ---
  public getReviews(projectId: string, runId?: string): ProposalReview[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(`${REVIEWS_KEY_PREFIX}${projectId}`);
      const reviews: ProposalReview[] = raw ? JSON.parse(raw) : [];
      if (runId) {
        return reviews.filter((r) => r.runId === runId);
      }
      return reviews;
    } catch (e) {
      return [];
    }
  }

  public saveReview(review: ProposalReview): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      let reviews = this.getReviews(review.projectId);
      const idx = reviews.findIndex((r) => r.id === review.id);
      if (idx >= 0) {
        reviews[idx] = review;
      } else {
        reviews.unshift(review);
      }
      if (reviews.length > MAX_ITEMS) {
        reviews = reviews.slice(0, MAX_ITEMS);
      }
      storage.setItem(`${REVIEWS_KEY_PREFIX}${review.projectId}`, JSON.stringify(reviews));
    } catch (e) {
      console.warn('Failed to save proposal review', e);
    }
  }

  // --- CONFLICTS ---
  public getConflicts(projectId: string, runId?: string): ConflictReport[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(`${CONFLICTS_KEY_PREFIX}${projectId}`);
      const conflicts: ConflictReport[] = raw ? JSON.parse(raw) : [];
      if (runId) {
        return conflicts.filter((c) => c.runId === runId);
      }
      return conflicts;
    } catch (e) {
      return [];
    }
  }

  public saveConflict(conflict: ConflictReport): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      let conflicts = this.getConflicts(conflict.projectId);
      const idx = conflicts.findIndex((c) => c.id === conflict.id);
      if (idx >= 0) {
        conflicts[idx] = conflict;
      } else {
        conflicts.unshift(conflict);
      }
      if (conflicts.length > MAX_ITEMS) {
        conflicts = conflicts.slice(0, MAX_ITEMS);
      }
      storage.setItem(`${CONFLICTS_KEY_PREFIX}${conflict.projectId}`, JSON.stringify(conflicts));
    } catch (e) {
      console.warn('Failed to save conflict report', e);
    }
  }
}

export const teamStorage = new TeamStorageAdapter();
