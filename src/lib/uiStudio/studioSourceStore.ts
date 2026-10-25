/**
 * studioSourceStore.ts — Reactive source-file store for UI Studio.
 *
 * Manages the in-memory virtual filesystem of editable component sources.
 * Provides persistence to localStorage, dirty-tracking, undo history,
 * and reactive subscriptions so the editor, explorer, and preview panels
 * stay synchronised without prop-drilling.
 *
 * Recent fixes preserved:
 *  - Debounced persistence avoids rapid writes.
 *  - `reloadProject` replaces the entire store atomically so stale
 *    subscriptions don't fire with partially-loaded state.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceFile {
  /** Stable id — path-like key e.g. "components/Hero.tsx" */
  id: string;
  /** Human-readable name shown in explorer */
  name: string;
  /** Full source code string */
  code: string;
  /** Language hint for the editor */
  language: "tsx" | "ts" | "css" | "json";
}

export interface StudioProject {
  /** Unique project id (used as localStorage namespace) */
  id: string;
  /** Display name */
  name: string;
  /** Map of file-id → SourceFile */
  files: Record<string, SourceFile>;
  /** ISO timestamp of last successful save */
  savedAt: string | null;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface StudioState {
  project: StudioProject | null;
  /** Currently selected file id */
  activeFileId: string | null;
  /** Files whose in-memory code differs from last saved snapshot */
  dirtyFileIds: Set<string>;
  /** Per-file undo stacks (limited depth) */
  undoStacks: Record<string, string[]>;
  /** Global save status indicator */
  saveStatus: SaveStatus;
  /** Last error message (save / load) */
  lastError: string | null;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "ui-studio-project-";
const MAX_UNDO_DEPTH = 50;
const PERSIST_DEBOUNCE_MS = 800;

/** Safe localStorage access — returns null on the server or if storage is unavailable */
function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // SecurityError, etc.
  }
  return null;
}

// ---------------------------------------------------------------------------
// Store singleton
// ---------------------------------------------------------------------------

let state: StudioState = {
  project: null,
  activeFileId: null,
  dirtyFileIds: new Set(),
  undoStacks: {},
  saveStatus: "idle",
  lastError: null,
};

const listeners = new Set<Listener>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// Snapshot of last-saved code per file — used for dirty detection.
let savedSnapshots: Record<string, string> = {};

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.error("[studioSourceStore] listener threw:", e);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API — subscriptions
// ---------------------------------------------------------------------------

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState(): Readonly<StudioState> {
  return state;
}

export function getProject(): StudioProject | null {
  return state.project;
}

export function getActiveFile(): SourceFile | null {
  if (!state.project || !state.activeFileId) return null;
  return state.project.files[state.activeFileId] ?? null;
}

export function getFileById(id: string): SourceFile | null {
  return state.project?.files[id] ?? null;
}

export function getFileList(): SourceFile[] {
  if (!state.project) return [];
  return Object.values(state.project.files);
}

export function isDirty(fileId?: string): boolean {
  if (fileId) return state.dirtyFileIds.has(fileId);
  return state.dirtyFileIds.size > 0;
}

export function getSaveStatus(): SaveStatus {
  return state.saveStatus;
}

export function getLastError(): string | null {
  return state.lastError;
}

// ---------------------------------------------------------------------------
// Public API — mutations
// ---------------------------------------------------------------------------

export function setActiveFile(fileId: string | null) {
  if (state.activeFileId === fileId) return;
  state = { ...state, activeFileId: fileId };
  emit();
}

/**
 * Update the source code of a file. Pushes old code onto the undo stack
 * and marks the file dirty if it differs from the saved snapshot.
 */
export function updateFileCode(fileId: string, newCode: string) {
  const project = state.project;
  if (!project) return;
  const file = project.files[fileId];
  if (!file) return;
  if (file.code === newCode) return;

  // Undo stack
  const stack = [...(state.undoStacks[fileId] ?? [])];
  stack.push(file.code);
  if (stack.length > MAX_UNDO_DEPTH) stack.shift();

  const updatedFile: SourceFile = { ...file, code: newCode };
  const updatedFiles = { ...project.files, [fileId]: updatedFile };
  const updatedProject: StudioProject = { ...project, files: updatedFiles };

  // Dirty tracking
  const dirtyFileIds = new Set(state.dirtyFileIds);
  const savedCode = savedSnapshots[fileId];
  if (newCode !== savedCode) {
    dirtyFileIds.add(fileId);
  } else {
    dirtyFileIds.delete(fileId);
  }

  state = {
    ...state,
    project: updatedProject,
    dirtyFileIds,
    undoStacks: { ...state.undoStacks, [fileId]: stack },
    saveStatus: "idle",
    lastError: null,
  };
  emit();
  schedulePersist();
}

/**
 * Undo the last edit for a file. Returns true if an undo was performed.
 */
export function undoFileEdit(fileId: string): boolean {
  const stack = state.undoStacks[fileId];
  if (!stack || stack.length === 0) return false;

  const previousCode = stack[stack.length - 1]!;
  const newStack = stack.slice(0, -1);

  const project = state.project;
  if (!project || !project.files[fileId]) return false;

  const updatedFile: SourceFile = { ...project.files[fileId]!, code: previousCode };
  const updatedFiles = { ...project.files, [fileId]: updatedFile };
  const updatedProject: StudioProject = { ...project, files: updatedFiles };

  const dirtyFileIds = new Set(state.dirtyFileIds);
  if (previousCode !== savedSnapshots[fileId]) {
    dirtyFileIds.add(fileId);
  } else {
    dirtyFileIds.delete(fileId);
  }

  state = {
    ...state,
    project: updatedProject,
    dirtyFileIds,
    undoStacks: { ...state.undoStacks, [fileId]: newStack },
  };
  emit();
  schedulePersist();
  return true;
}

/**
 * Add a new file to the project.
 */
export function addFile(file: SourceFile) {
  const project = state.project;
  if (!project) return;

  const updatedFiles = { ...project.files, [file.id]: file };
  const updatedProject: StudioProject = { ...project, files: updatedFiles };

  savedSnapshots[file.id] = file.code;
  const dirtyFileIds = new Set(state.dirtyFileIds);
  // New files start clean (they are part of the "save" once added)

  state = {
    ...state,
    project: updatedProject,
    dirtyFileIds,
    activeFileId: file.id,
  };
  emit();
  schedulePersist();
}

/**
 * Remove a file from the project.
 */
export function removeFile(fileId: string) {
  const project = state.project;
  if (!project || !project.files[fileId]) return;

  const updatedFiles = { ...project.files };
  delete updatedFiles[fileId];
  const updatedProject: StudioProject = { ...project, files: updatedFiles };

  const dirtyFileIds = new Set(state.dirtyFileIds);
  dirtyFileIds.delete(fileId);
  delete savedSnapshots[fileId];

  const newActiveId =
    state.activeFileId === fileId
      ? Object.keys(updatedFiles)[0] ?? null
      : state.activeFileId;

  state = {
    ...state,
    project: updatedProject,
    dirtyFileIds,
    activeFileId: newActiveId,
  };
  emit();
  schedulePersist();
}

/**
 * Rename a file (changes the display name only).
 */
export function renameFile(fileId: string, newName: string) {
  const project = state.project;
  if (!project || !project.files[fileId]) return;

  const updatedFile: SourceFile = { ...project.files[fileId]!, name: newName };
  const updatedFiles = { ...project.files, [fileId]: updatedFile };
  const updatedProject: StudioProject = { ...project, files: updatedFiles };

  state = { ...state, project: updatedProject };
  emit();
  schedulePersist();
}

// ---------------------------------------------------------------------------
// Public API — project lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialise or replace the entire project atomically.
 * Used both for creating a new project and for reloading from storage.
 */
export function loadProject(project: StudioProject) {
  // Take fresh saved snapshots
  savedSnapshots = {};
  for (const [id, file] of Object.entries(project.files)) {
    savedSnapshots[id] = file.code;
  }

  const firstFileId = Object.keys(project.files)[0] ?? null;

  state = {
    project: { ...project },
    activeFileId: firstFileId,
    dirtyFileIds: new Set(),
    undoStacks: {},
    saveStatus: "idle",
    lastError: null,
  };
  emit();
}

/**
 * Persist the current project to localStorage. Returns true on success.
 */
export function saveProject(): boolean {
  const project = state.project;
  if (!project) {
    state = { ...state, saveStatus: "error", lastError: "No project loaded" };
    emit();
    return false;
  }

  state = { ...state, saveStatus: "saving" };
  emit();

  try {
    const key = STORAGE_PREFIX + project.id;
    const payload: StudioProject = {
      ...project,
      savedAt: new Date().toISOString(),
    };
    const serialised = JSON.stringify(payload);

    const storage = getStorage();
    if (!storage) {
      throw new Error("localStorage is not available");
    }
    storage.setItem(key, serialised);

    // Verify the write actually persisted
    const readBack = storage.getItem(key);
    if (readBack !== serialised) {
      throw new Error("localStorage verification failed — data mismatch after write");
    }

    // Update snapshots — everything is now clean
    savedSnapshots = {};
    for (const [id, file] of Object.entries(project.files)) {
      savedSnapshots[id] = file.code;
    }

    state = {
      ...state,
      project: payload,
      dirtyFileIds: new Set(),
      saveStatus: "saved",
      lastError: null,
    };
    emit();
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    console.error("[studioSourceStore] save error:", err);
    state = { ...state, saveStatus: "error", lastError: message };
    emit();
    return false;
  }
}

/**
 * Load a project from localStorage by id.
 * Returns true if a project was found and loaded.
 */
export function reloadProject(projectId: string): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    const key = STORAGE_PREFIX + projectId;
    const raw = storage.getItem(key);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as StudioProject;
    if (!parsed.id || !parsed.files) return false;

    loadProject(parsed);
    return true;
  } catch (err) {
    console.error("[studioSourceStore] reload error:", err);
    state = {
      ...state,
      saveStatus: "error",
      lastError: err instanceof Error ? err.message : "Reload failed",
    };
    emit();
    return false;
  }
}

/**
 * List all saved project ids from localStorage.
 */
export function listSavedProjects(): Array<{ id: string; name: string; savedAt: string | null }> {
  const result: Array<{ id: string; name: string; savedAt: string | null }> = [];
  const storage = getStorage();
  if (!storage) return result;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StudioProject;
      result.push({ id: parsed.id, name: parsed.name, savedAt: parsed.savedAt });
    } catch {
      // skip corrupt entries
    }
  }
  return result;
}

/**
 * Delete a saved project from localStorage.
 */
export function deleteSavedProject(projectId: string) {
  getStorage()?.removeItem(STORAGE_PREFIX + projectId);
}

// ---------------------------------------------------------------------------
// Internal — debounced auto-persist
// ---------------------------------------------------------------------------

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    // Auto-persist is a background convenience — don't update saveStatus
    const project = state.project;
    if (!project) return;
    try {
      const key = STORAGE_PREFIX + project.id + "-draft";
      getStorage()?.setItem(key, JSON.stringify(project));
    } catch {
      // Silently fail — explicit save is the authoritative path
    }
  }, PERSIST_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Default project factory
// ---------------------------------------------------------------------------

export function createDefaultProject(): StudioProject {
  return {
    id: "default",
    name: "My UI Project",
    files: {
      "components/Hero.tsx": {
        id: "components/Hero.tsx",
        name: "Hero.tsx",
        code: `import React from "react";

export default function Hero() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
        Welcome to UI Studio
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">
        Edit components in real-time and see your changes instantly in the preview panel.
      </p>
      <div className="flex gap-3">
        <button className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Get Started
        </button>
        <button className="rounded-lg border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent">
          Learn More
        </button>
      </div>
    </section>
  );
}
`,
        language: "tsx",
      },
      "components/Card.tsx": {
        id: "components/Card.tsx",
        name: "Card.tsx",
        code: `import React from "react";

interface CardProps {
  title: string;
  description: string;
  icon?: string;
}

export default function Card({ title, description, icon }: CardProps) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      {icon && <span className="mb-3 block text-3xl">{icon}</span>}
      <h3 className="text-lg font-semibold text-card-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
`,
        language: "tsx",
      },
      "components/Footer.tsx": {
        id: "components/Footer.tsx",
        name: "Footer.tsx",
        code: `import React from "react";

export default function Footer() {
  return (
    <footer className="border-t py-8 text-center text-sm text-muted-foreground">
      <p>&copy; {new Date().getFullYear()} UI Studio. Built with React.</p>
    </footer>
  );
}
`,
        language: "tsx",
      },
      "App.tsx": {
        id: "App.tsx",
        name: "App.tsx",
        code: `import React from "react";
import Hero from "./components/Hero";
import Card from "./components/Card";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Hero />
      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-3">
        <Card
          icon="⚡"
          title="Fast Preview"
          description="See your changes instantly with live preview compilation."
        />
        <Card
          icon="🎨"
          title="Visual Editing"
          description="Edit JSX components with syntax highlighting and auto-complete."
        />
        <Card
          icon="💾"
          title="Persistent"
          description="Your work is saved automatically and survives page reloads."
        />
      </section>
      <Footer />
    </div>
  );
}
`,
        language: "tsx",
      },
      "styles.css": {
        id: "styles.css",
        name: "styles.css",
        code: `/* Project-level overrides */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.129 0.042 264.695);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.695);
  --primary: oklch(0.208 0.042 265.755);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --secondary: oklch(0.968 0.007 247.896);
  --secondary-foreground: oklch(0.208 0.042 265.755);
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --accent: oklch(0.968 0.007 247.896);
  --accent-foreground: oklch(0.208 0.042 265.755);
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background-color: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
}
`,
        language: "css",
      },
    },
    savedAt: null,
  };
}
