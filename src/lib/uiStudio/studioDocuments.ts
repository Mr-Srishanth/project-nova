/**
 * StudioDocumentManager
 *
 * The single edit -> save pipeline for UI Studio, layered on top of the
 * existing artifactStorage adapter (the app's one source of truth for
 * project files). Every mutation — manual editor saves, AI-applied plans,
 * inspector saves, design-token saves, file create/rename/delete, and
 * undo/redo themselves — flows through this manager, so dirty tracking,
 * save status, revision numbering and history can never diverge.
 *
 * Guarantees:
 * - A file's "Saved" status is reported only after the storage adapter has
 *   confirmed the write. A failed write keeps the draft, keeps the file
 *   dirty, records the error and can be retried.
 * - Each confirmed write increments the project's revision counter and
 *   records an undoable operation snapshot.
 * - Buffers, undo stacks and revisions are keyed by projectId. Writes always
 *   carry the projectId they were opened under, so switching projects can
 *   never leak one project's changes into another.
 * - The preview pipeline builds exclusively from `getSavedArtifacts()`,
 *   i.e. the last confirmed revision — never from unsaved drafts.
 */

import type { BuildArtifact } from "@/types/artifact";
import type { IArtifactStorageAdapter } from "@/lib/storage/artifactStorage";

export type FileSaveStatus = "saved" | "unsaved" | "saving" | "failed";

export interface StudioFileState {
  path: string;
  /** Content of the last confirmed persisted revision. */
  savedContent: string;
  /** Current in-editor draft (equals savedContent when clean). */
  draftContent: string;
  status: FileSaveStatus;
  /** Last persistence error, retained while status is "failed". */
  error: string | null;
  /** ISO timestamp of the last confirmed save, when known. */
  lastSavedAt: string | null;
}

export interface FileMutation {
  path: string;
  /** Content before the operation; null means the file did not exist. */
  before: string | null;
  /** Content after the operation; null means the file was deleted. */
  after: string | null;
}

export interface StudioOperation {
  id: string;
  label: string;
  author: "user" | "ai";
  mutations: FileMutation[];
  timestamp: string;
}

export interface StudioProjectState {
  projectId: string;
  files: Map<string, StudioFileState>;
  revision: number;
  undoStack: StudioOperation[];
  redoStack: StudioOperation[];
  lastSavedAt: string | null;
}

const ARTIFACT_DEFAULTS = {
  type: "frontend" as const,
  purpose: "Project file",
  status: "approved" as const,
  language: "text",
};

function inferLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md")) return "markdown";
  return "text";
}

function inferType(path: string): BuildArtifact["type"] {
  if (path.endsWith(".css") || path.endsWith(".tsx") || path.endsWith(".ts") || path.endsWith(".html")) {
    return "frontend";
  }
  return "config";
}

export class StudioDocumentManager {
  private storage: IArtifactStorageAdapter;
  private projects = new Map<string, StudioProjectState>();
  private artifactMeta = new Map<string, Map<string, BuildArtifact>>();
  private listeners = new Set<() => void>();
  private opSeq = 0;

  constructor(storage: IArtifactStorageAdapter) {
    this.storage = storage;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  getProjectState(projectId: string): StudioProjectState | null {
    return this.projects.get(projectId) || null;
  }

  /**
   * Loads (or reloads) a project's files from storage into buffers.
   * Existing in-memory drafts for the project are discarded in favour of the
   * persisted state — callers use this on project open, not after edits.
   */
  async openProject(projectId: string): Promise<StudioProjectState> {
    const artifacts = await this.storage.list(projectId);
    const files = new Map<string, StudioFileState>();
    const meta = new Map<string, BuildArtifact>();
    let lastSavedAt: string | null = null;
    for (const art of artifacts) {
      const path = art.path.replace(/\\/g, "/");
      files.set(path, {
        path,
        savedContent: art.content || "",
        draftContent: art.content || "",
        status: "saved",
        error: null,
        lastSavedAt: art.lastModifiedAt || null,
      });
      meta.set(path, art);
      if (art.lastModifiedAt && (!lastSavedAt || art.lastModifiedAt > lastSavedAt)) {
        lastSavedAt = art.lastModifiedAt;
      }
    }
    const state: StudioProjectState = {
      projectId,
      files,
      revision: 0,
      undoStack: [],
      redoStack: [],
      lastSavedAt,
    };
    this.projects.set(projectId, state);
    this.artifactMeta.set(projectId, meta);
    this.emit();
    return state;
  }

  /**
   * Seeds files that do not exist yet (e.g. generated baselines) directly
   * into storage and buffers. Seeding is not an undoable user operation.
   */
  async seedFiles(projectId: string, artifacts: BuildArtifact[]): Promise<void> {
    const state = this.requireState(projectId);
    const meta = this.artifactMeta.get(projectId)!;
    for (const art of artifacts) {
      const path = art.path.replace(/\\/g, "/");
      if (state.files.has(path)) continue;
      const saved = await this.storage.save({ ...art, path });
      state.files.set(path, {
        path,
        savedContent: saved.content || "",
        draftContent: saved.content || "",
        status: "saved",
        error: null,
        lastSavedAt: saved.lastModifiedAt || null,
      });
      meta.set(path, saved);
    }
    this.emit();
  }

  /** Updates the in-memory draft for a file. Never touches storage. */
  edit(projectId: string, path: string, draft: string): void {
    const state = this.requireState(projectId);
    const file = state.files.get(path);
    if (!file) throw new Error(`Cannot edit unknown file "${path}" in project "${projectId}".`);
    file.draftContent = draft;
    if (file.status !== "saving") {
      file.status = draft === file.savedContent ? "saved" : "unsaved";
      if (file.status === "unsaved") file.error = null;
    }
    this.emit();
  }

  isDirty(projectId: string, path?: string): boolean {
    const state = this.projects.get(projectId);
    if (!state) return false;
    if (path) {
      const f = state.files.get(path);
      return Boolean(f && f.draftContent !== f.savedContent);
    }
    for (const f of state.files.values()) {
      if (f.draftContent !== f.savedContent) return true;
    }
    return false;
  }

  /**
   * Persists one file's draft through the shared write path.
   * Resolves true only after storage confirmed the write.
   */
  async saveFile(projectId: string, path: string, label = "Edit file"): Promise<boolean> {
    const state = this.requireState(projectId);
    const file = state.files.get(path);
    if (!file) return false;
    if (file.draftContent === file.savedContent && file.status !== "failed") return true;
    const before = file.savedContent;
    const after = file.draftContent;
    const ok = await this.persistMutation(state, { path, before, after }, "user");
    if (ok) {
      this.pushOperation(state, { label: `${label}: ${path}`, author: "user", mutations: [{ path, before, after }] });
    }
    return ok;
  }

  /** Retries the last failed save for a file (draft is still intact). */
  async retrySave(projectId: string, path: string): Promise<boolean> {
    return this.saveFile(projectId, path, "Retry save");
  }

  /** Saves every dirty file in the project. Returns per-file results. */
  async saveAllDirty(projectId: string): Promise<{ saved: string[]; failed: string[] }> {
    const state = this.requireState(projectId);
    const saved: string[] = [];
    const failed: string[] = [];
    for (const file of [...state.files.values()]) {
      if (file.draftContent !== file.savedContent || file.status === "failed") {
        const ok = await this.saveFile(projectId, file.path);
        (ok ? saved : failed).push(file.path);
      }
    }
    return { saved, failed };
  }

  /**
   * Applies an externally produced change (AI plan, inspector, tokens)
   * through the same confirmed-write path, as one undoable operation.
   * All mutations are written; if any write fails the operation stops and
   * the failure is surfaced — earlier mutations in the batch stay applied
   * (and are recorded so they can be undone), never silently hidden.
   */
  async applyExternalChanges(
    projectId: string,
    changes: Array<{ path: string; content: string }>,
    opts: { label: string; author: "user" | "ai" }
  ): Promise<{ applied: string[]; failedPath: string | null; error: string | null }> {
    const state = this.requireState(projectId);
    const mutations: FileMutation[] = [];
    const applied: string[] = [];
    for (const change of changes) {
      const path = change.path.replace(/\\/g, "/");
      const existing = state.files.get(path);
      const before = existing ? existing.savedContent : null;
      if (before === change.content) continue;
      const ok = await this.persistMutation(state, { path, before, after: change.content }, opts.author);
      if (!ok) {
        if (mutations.length > 0) {
          this.pushOperation(state, { label: opts.label, author: opts.author, mutations });
        }
        const fileState = state.files.get(path);
        return { applied, failedPath: path, error: fileState?.error || "Save failed" };
      }
      mutations.push({ path, before, after: change.content });
      applied.push(path);
    }
    if (mutations.length > 0) {
      this.pushOperation(state, { label: opts.label, author: opts.author, mutations });
    }
    return { applied, failedPath: null, error: null };
  }

  /** Creates a new file with the given content (default empty). Undoable. */
  async createFile(projectId: string, path: string, content = ""): Promise<boolean> {
    const state = this.requireState(projectId);
    const normalized = path.replace(/\\/g, "/");
    if (state.files.has(normalized)) return false;
    const ok = await this.persistMutation(state, { path: normalized, before: null, after: content }, "user");
    if (ok) {
      this.pushOperation(state, {
        label: `Create file: ${normalized}`,
        author: "user",
        mutations: [{ path: normalized, before: null, after: content }],
      });
    }
    return ok;
  }

  /** Deletes a file. Undoable (the snapshot restores it). */
  async deleteFile(projectId: string, path: string): Promise<boolean> {
    const state = this.requireState(projectId);
    const file = state.files.get(path);
    if (!file) return false;
    const before = file.savedContent;
    const ok = await this.persistMutation(state, { path, before, after: null }, "user");
    if (ok) {
      this.pushOperation(state, {
        label: `Delete file: ${path}`,
        author: "user",
        mutations: [{ path, before, after: null }],
      });
    }
    return ok;
  }

  /** Renames a file (create new + delete old) as one undoable operation. */
  async renameFile(projectId: string, oldPath: string, newPath: string): Promise<boolean> {
    const state = this.requireState(projectId);
    const normalizedNew = newPath.replace(/\\/g, "/");
    const file = state.files.get(oldPath);
    if (!file || state.files.has(normalizedNew)) return false;
    const content = file.draftContent;
    const created = await this.persistMutation(state, { path: normalizedNew, before: null, after: content }, "user");
    if (!created) return false;
    const removed = await this.persistMutation(state, { path: oldPath, before: file.savedContent, after: null }, "user");
    if (!removed) return false;
    this.pushOperation(state, {
      label: `Rename file: ${oldPath} -> ${normalizedNew}`,
      author: "user",
      mutations: [
        { path: normalizedNew, before: null, after: content },
        { path: oldPath, before: file.savedContent, after: null },
      ],
    });
    return true;
  }

  canUndo(projectId: string): boolean {
    return (this.projects.get(projectId)?.undoStack.length || 0) > 0;
  }

  canRedo(projectId: string): boolean {
    return (this.projects.get(projectId)?.redoStack.length || 0) > 0;
  }

  /** Undoes the most recent operation. Returns affected paths, or null. */
  async undo(projectId: string): Promise<string[] | null> {
    const state = this.requireState(projectId);
    const op = state.undoStack[state.undoStack.length - 1];
    if (!op) return null;
    const affected: string[] = [];
    // Apply in reverse so multi-file operations unwind cleanly.
    for (const mutation of [...op.mutations].reverse()) {
      const ok = await this.persistMutation(
        state,
        { path: mutation.path, before: mutation.after, after: mutation.before },
        op.author
      );
      if (!ok) return null;
      affected.push(mutation.path);
    }
    state.undoStack.pop();
    state.redoStack.push(op);
    this.emit();
    return affected;
  }

  /** Redoes the most recently undone operation. Returns affected paths. */
  async redo(projectId: string): Promise<string[] | null> {
    const state = this.requireState(projectId);
    const op = state.redoStack[state.redoStack.length - 1];
    if (!op) return null;
    const affected: string[] = [];
    for (const mutation of op.mutations) {
      const ok = await this.persistMutation(
        state,
        { path: mutation.path, before: mutation.before, after: mutation.after },
        op.author
      );
      if (!ok) return null;
      affected.push(mutation.path);
    }
    state.redoStack.pop();
    state.undoStack.push(op);
    this.emit();
    return affected;
  }

  /**
   * The artifacts of the last confirmed revision — the ONLY input the
   * preview pipeline is allowed to build from.
   */
  getSavedArtifacts(projectId: string): BuildArtifact[] {
    const state = this.projects.get(projectId);
    const meta = this.artifactMeta.get(projectId);
    if (!state || !meta) return [];
    const result: BuildArtifact[] = [];
    for (const file of state.files.values()) {
      const base = meta.get(file.path);
      result.push({
        ...(base || {
          id: `art_${projectId}_${file.path.replace(/[^a-zA-Z0-9]/g, "_")}`,
          projectId,
          path: file.path,
          type: inferType(file.path),
          purpose: ARTIFACT_DEFAULTS.purpose,
          status: ARTIFACT_DEFAULTS.status,
          language: inferLanguage(file.path),
          dependencies: [],
          versions: [],
        }),
        path: file.path,
        content: file.savedContent,
      });
    }
    return result.sort((a, b) => a.path.localeCompare(b.path));
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private requireState(projectId: string): StudioProjectState {
    const state = this.projects.get(projectId);
    if (!state) throw new Error(`Project "${projectId}" has not been opened in the document manager.`);
    return state;
  }

  private pushOperation(
    state: StudioProjectState,
    op: { label: string; author: "user" | "ai"; mutations: FileMutation[] }
  ): void {
    this.opSeq += 1;
    state.undoStack.push({
      id: `studio_op_${Date.now()}_${this.opSeq}`,
      label: op.label,
      author: op.author,
      mutations: op.mutations,
      timestamp: new Date().toISOString(),
    });
    if (state.undoStack.length > 100) state.undoStack.splice(0, state.undoStack.length - 100);
    state.redoStack = [];
    this.emit();
  }

  /**
   * The one write path. Persists a single mutation through the storage
   * adapter and updates the buffer ONLY on confirmed success.
   * Returns false (with the file left dirty + error recorded) on failure.
   */
  private async persistMutation(
    state: StudioProjectState,
    mutation: FileMutation,
    author: "user" | "ai"
  ): Promise<boolean> {
    const { path, after } = mutation;
    const meta = this.artifactMeta.get(state.projectId)!;
    let file = state.files.get(path);
    if (!file) {
      file = {
        path,
        savedContent: mutation.before ?? "",
        draftContent: mutation.before ?? "",
        status: "unsaved",
        error: null,
        lastSavedAt: null,
      };
      state.files.set(path, file);
    }
    file.status = "saving";
    file.error = null;
    this.emit();
    try {
      if (after === null) {
        await this.storage.delete(state.projectId, path);
        state.files.delete(path);
        meta.delete(path);
      } else if (mutation.before === null && !meta.has(path)) {
        const created = await this.storage.save({
          id: `art_${state.projectId}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
          projectId: state.projectId,
          path,
          type: inferType(path),
          purpose: ARTIFACT_DEFAULTS.purpose,
          status: ARTIFACT_DEFAULTS.status,
          content: after,
          language: inferLanguage(path),
          dependencies: [],
          versions: [],
        });
        meta.set(path, created);
        file.savedContent = after;
        file.draftContent = after;
        file.lastSavedAt = created.lastModifiedAt || new Date().toISOString();
      } else {
        const updated = await this.storage.recordVersion(state.projectId, path, after, "UI Studio save", author);
        meta.set(path, updated);
        file.savedContent = after;
        // Preserve any newer draft typed while the save was in flight.
        if (file.draftContent === mutation.before || file.draftContent === after) {
          file.draftContent = after;
        }
        file.lastSavedAt = updated.lastModifiedAt || new Date().toISOString();
      }
      file.status = file.draftContent === file.savedContent ? "saved" : "unsaved";
      file.error = null;
      state.revision += 1;
      state.lastSavedAt = file.lastSavedAt;
      this.emit();
      return true;
    } catch (err: any) {
      file.status = "failed";
      file.error = err?.message || "Failed to save file";
      this.emit();
      return false;
    }
  }
}
