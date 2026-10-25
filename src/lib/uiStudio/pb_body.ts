/**
 * pb_body.ts — Preview body manager for UI Studio.
 *
 * Manages the iframe preview lifecycle:
 *  - Creating and updating the preview iframe content
 *  - Debouncing preview rebuilds on source changes
 *  - Capturing preview state (loading, ready, error)
 *  - Communicating between the preview iframe and the host page
 *
 * Recent fixes preserved:
 *  - Blob URL cleanup prevents memory leaks on rapid re-renders.
 *  - srcdoc is preferred over blob URLs for CSP compatibility.
 *  - Preview state transitions are atomic to avoid flickering.
 */

import { bundleProject, type BundleResult, type BundleError } from "./previewModuleBundler";
import {
  subscribe,
  getProject,
} from "./studioSourceStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreviewStatus = "idle" | "building" | "ready" | "error";

export interface PreviewState {
  status: PreviewStatus;
  html: string | null;
  errors: BundleError[];
  lastBuildTime: number | null;
  buildDurationMs: number | null;
}

type PreviewListener = (state: PreviewState) => void;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentState: PreviewState = {
  status: "idle",
  html: null,
  errors: [],
  lastBuildTime: null,
  buildDurationMs: null,
};

const previewListeners = new Set<PreviewListener>();
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
let storeUnsubscribe: (() => void) | null = null;
let lastProjectSnapshot: string | null = null;

const REBUILD_DEBOUNCE_MS = 350;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe to preview state changes. Returns an unsubscribe function.
 */
export function subscribePreview(listener: PreviewListener): () => void {
  previewListeners.add(listener);
  // Immediately emit current state
  listener(currentState);
  return () => {
    previewListeners.delete(listener);
  };
}

/**
 * Get the current preview state.
 */
export function getPreviewState(): Readonly<PreviewState> {
  return currentState;
}

/**
 * Start watching the source store and auto-rebuilding the preview.
 * Call this once when the Studio mounts.
 */
export function startPreviewEngine() {
  if (storeUnsubscribe) return; // Already running

  storeUnsubscribe = subscribe(() => {
    scheduleRebuild();
  });

  // Initial build
  triggerBuild();
}

/**
 * Stop watching the source store.
 * Call this when the Studio unmounts.
 */
export function stopPreviewEngine() {
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
}

/**
 * Force an immediate rebuild of the preview.
 */
export function forceRebuild() {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  triggerBuild();
}

/**
 * Apply the current preview HTML to an iframe element.
 * Uses srcdoc for security and CSP compatibility.
 */
export function applyPreviewToIframe(iframe: HTMLIFrameElement) {
  if (!currentState.html) return;
  iframe.srcdoc = currentState.html;
}

/**
 * Get a standalone HTML blob URL for the current preview.
 * Caller is responsible for revoking the URL when done.
 */
export function getPreviewBlobUrl(): string | null {
  if (!currentState.html) return null;
  const blob = new Blob([currentState.html], { type: "text/html" });
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function emitPreview() {
  for (const fn of previewListeners) {
    try {
      fn(currentState);
    } catch (e) {
      console.error("[pb_body] preview listener threw:", e);
    }
  }
}

function updateState(partial: Partial<PreviewState>) {
  currentState = { ...currentState, ...partial };
  emitPreview();
}

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    triggerBuild();
  }, REBUILD_DEBOUNCE_MS);
}

function triggerBuild() {
  const project = getProject();
  if (!project) {
    updateState({ status: "idle", html: null, errors: [] });
    return;
  }

  // Skip if nothing changed since last build
  const snapshot = JSON.stringify(project.files);
  if (snapshot === lastProjectSnapshot && currentState.status === "ready") {
    return;
  }

  updateState({ status: "building" });

  // Use requestAnimationFrame to avoid blocking the editor (with SSR fallback)
  const schedule = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (fn: () => void) => setTimeout(fn, 0);

  schedule(() => {
    const startTime = performance.now();

    try {
      const result: BundleResult = bundleProject(project.files);
      const elapsed = performance.now() - startTime;

      lastProjectSnapshot = snapshot;

      updateState({
        status: result.ok ? "ready" : "error",
        html: result.html,
        errors: result.errors,
        lastBuildTime: Date.now(),
        buildDurationMs: Math.round(elapsed),
      });
    } catch (err) {
      const elapsed = performance.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);

      updateState({
        status: "error",
        errors: [
          {
            fileId: "bundler",
            message: `Bundler crash: ${message}`,
            severity: "error",
          },
        ],
        lastBuildTime: Date.now(),
        buildDurationMs: Math.round(elapsed),
      });
    }
  });
}
