/**
 * PreviewSessionController
 *
 * Owns the lifecycle of ONE target-project preview at a time:
 * build sequencing, stage transitions, stale-message rejection,
 * last-known-good retention and the mount watchdog.
 *
 * Design notes (root causes this fixes):
 * - Every build gets a monotonic id from this controller. Messages carrying any
 *   other build id are stale and are ignored, so an older asynchronous build can
 *   never overwrite a newer preview.
 * - The watchdog is two-phase: at the soft deadline the host probes the iframe
 *   with PREVIEW_PING. A PONG reporting `mounted: true` recovers a lost
 *   MOUNTED message; a PONG reporting `mounted: false` (or no PONG at all)
 *   escalates to the hard deadline, where the failure is classified as a
 *   *load* timeout (document never signalled) or a *mount* timeout (document
 *   loaded, app never mounted). The watchdog only ever runs against the build
 *   that is currently pending, and reaching a terminal stage disarms it — it
 *   can never fire against an already-mounted preview.
 * - Timers and the ping transport are injected so the controller is fully
 *   testable without a DOM.
 */

export type PreviewSessionStage =
  | "idle"
  | "building"
  | "loading"
  | "ready"
  | "build_error"
  | "runtime_error"
  | "load_timeout"
  | "mount_timeout"
  | "stopped";

export type PreviewErrorKind = "build" | "runtime" | "load_timeout" | "mount_timeout";

export interface PreviewSessionError {
  kind: PreviewErrorKind;
  message: string;
  buildId: string;
}

export interface PreviewSessionSnapshot {
  stage: PreviewSessionStage;
  /** Build currently being attempted (pending or most recent). */
  currentBuildId: string | null;
  /** Build whose document is actually mounted and verified right now. */
  mountedBuildId: string | null;
  /** Most recent build that mounted successfully (fallback candidate). */
  lastGoodBuildId: string | null;
  error: PreviewSessionError | null;
  /** True when the visible preview is an older build than the latest attempt. */
  isShowingFallback: boolean;
}

export interface PreviewSessionDeps {
  /** Sends a PREVIEW_PING to the iframe showing the given build. */
  sendPing: (buildId: string) => void;
  setTimeoutFn?: (fn: () => void, ms: number) => any;
  clearTimeoutFn?: (handle: any) => void;
  /** First watchdog deadline: probe liveness. */
  softTimeoutMs?: number;
  /** Second watchdog deadline: classify and fail. */
  hardTimeoutMs?: number;
  onChange?: (snapshot: PreviewSessionSnapshot) => void;
}

export interface PreviewHostMessage {
  type?: string;
  buildId?: string;
  message?: string;
  mounted?: boolean;
  [key: string]: any;
}

const TERMINAL_STAGES: ReadonlySet<PreviewSessionStage> = new Set([
  "ready",
  "build_error",
  "runtime_error",
  "load_timeout",
  "mount_timeout",
  "stopped",
]);

export class PreviewSessionController {
  private deps: Required<Omit<PreviewSessionDeps, "onChange">> & Pick<PreviewSessionDeps, "onChange">;
  private buildSeq = 0;
  private stage: PreviewSessionStage = "idle";
  private currentBuildId: string | null = null;
  private mountedBuildId: string | null = null;
  private lastGoodBuildId: string | null = null;
  private error: PreviewSessionError | null = null;
  private documentLoaded = false;
  private softTimer: any = null;
  private hardTimer: any = null;

  constructor(deps: PreviewSessionDeps) {
    this.deps = {
      sendPing: deps.sendPing,
      setTimeoutFn: deps.setTimeoutFn || ((fn, ms) => setTimeout(fn, ms)),
      clearTimeoutFn: deps.clearTimeoutFn || ((h) => clearTimeout(h)),
      // First-open CDN loads (React + Tailwind from unpkg/CDN) routinely
      // exceed the old 8s/15s limits on slow networks, so the first preview
      // timed out and only a manual Retry (with CDN cached) worked. Give
      // cold loads room: soft probe at 20s, hard failure at 45s.
      softTimeoutMs: deps.softTimeoutMs ?? 20000,
      hardTimeoutMs: deps.hardTimeoutMs ?? 45000,
      onChange: deps.onChange,
    };
  }

  getSnapshot(): PreviewSessionSnapshot {
    return {
      stage: this.stage,
      currentBuildId: this.currentBuildId,
      mountedBuildId: this.mountedBuildId,
      lastGoodBuildId: this.lastGoodBuildId,
      error: this.error,
      isShowingFallback:
        this.lastGoodBuildId !== null &&
        this.currentBuildId !== null &&
        this.lastGoodBuildId !== this.currentBuildId &&
        TERMINAL_STAGES.has(this.stage) &&
        this.stage !== "ready",
    };
  }

  /** Generates the next monotonic build id. Ids are never reused. */
  nextBuildId(revision?: number): string {
    this.buildSeq += 1;
    const rev = typeof revision === "number" ? `_r${revision}` : "";
    return `bld_${Date.now()}_${this.buildSeq}${rev}`;
  }

  /**
   * Registers a new pending build. Any previously pending build is superseded:
   * its watchdog is disarmed and its future messages will be ignored.
   */
  beginBuild(buildId: string): void {
    this.disarmWatchdog();
    this.currentBuildId = buildId;
    this.documentLoaded = false;
    this.error = null;
    this.setStage("building");
    this.armWatchdog(buildId);
  }

  /** Records a host-side build failure (e.g. transpilation diagnostics). */
  failBuild(buildId: string, message: string): void {
    if (buildId !== this.currentBuildId) return;
    this.disarmWatchdog();
    this.error = { kind: "build", message, buildId };
    this.setStage("build_error");
  }

  stop(): void {
    this.disarmWatchdog();
    this.setStage("stopped");
  }

  /**
   * Routes a postMessage payload from the preview iframe.
   * Returns true when the message was consumed for the current build,
   * false when it was ignored (stale build, unknown type, no pending build).
   */
  handleMessage(msg: PreviewHostMessage): boolean {
    if (!msg || typeof msg !== "object" || !msg.type) return false;
    const buildId = msg.buildId;
    if (!buildId || buildId !== this.currentBuildId) return false;
    if (this.stage === "stopped") return false;

    switch (msg.type) {
      case "PREVIEW_DOCUMENT_LOADED": {
        if (TERMINAL_STAGES.has(this.stage)) return false;
        this.documentLoaded = true;
        this.setStage("loading");
        return true;
      }
      case "PREVIEW_MOUNTED_SUCCESS": {
        if (this.stage === "ready" && this.mountedBuildId === buildId) return true;
        this.disarmWatchdog();
        this.mountedBuildId = buildId;
        this.lastGoodBuildId = buildId;
        this.error = null;
        this.setStage("ready");
        return true;
      }
      case "PREVIEW_RUNTIME_ERROR": {
        // A runtime error after a verified mount does not unmount the app:
        // record it but keep the preview in its ready/fallback state visible.
        if (this.stage === "ready" && this.mountedBuildId === buildId) {
          this.error = {
            kind: "runtime",
            message: msg.message || "Runtime error after mount",
            buildId,
          };
          this.emit();
          return true;
        }
        this.disarmWatchdog();
        this.error = {
          kind: "runtime",
          message: msg.message || "Runtime exception occurred during application execution",
          buildId,
        };
        this.setStage("runtime_error");
        return true;
      }
      case "PREVIEW_PONG": {
        if (TERMINAL_STAGES.has(this.stage)) return false;
        if (msg.mounted) {
          // The MOUNTED message was lost in transit; the app is verifiably alive.
          this.disarmWatchdog();
          this.mountedBuildId = buildId;
          this.lastGoodBuildId = buildId;
          this.error = null;
          this.setStage("ready");
        }
        // mounted === false: stay pending; the hard watchdog will classify it.
        return true;
      }
      default:
        return false;
    }
  }

  private armWatchdog(buildId: string): void {
    this.softTimer = this.deps.setTimeoutFn(() => {
      if (this.currentBuildId !== buildId || TERMINAL_STAGES.has(this.stage)) return;
      // Liveness probe: the iframe may be alive but slow (CDN fetch, heavy bundle).
      try {
        this.deps.sendPing(buildId);
      } catch {
        /* transport failure is handled by the hard deadline */
      }
      this.hardTimer = this.deps.setTimeoutFn(() => {
        if (this.currentBuildId !== buildId || TERMINAL_STAGES.has(this.stage)) return;
        const kind: PreviewErrorKind = this.documentLoaded ? "mount_timeout" : "load_timeout";
        this.error = {
          kind,
          buildId,
          message: this.documentLoaded
            ? `Mount Timeout: the preview document loaded but the application did not mount or report ready (Build: ${buildId}). Check for a runtime error in the entry file or a failed CDN dependency.`
            : `Load Timeout: the preview document did not finish loading (Build: ${buildId}). This usually means a blocked or slow CDN script (React / Tailwind) or a sandbox failure.`,
        };
        this.setStage(kind);
      }, Math.max(0, this.deps.hardTimeoutMs - this.deps.softTimeoutMs));
    }, this.deps.softTimeoutMs);
  }

  private disarmWatchdog(): void {
    if (this.softTimer !== null) {
      this.deps.clearTimeoutFn(this.softTimer);
      this.softTimer = null;
    }
    if (this.hardTimer !== null) {
      this.deps.clearTimeoutFn(this.hardTimer);
      this.hardTimer = null;
    }
  }

  private setStage(stage: PreviewSessionStage): void {
    this.stage = stage;
    this.emit();
  }

  private emit(): void {
    this.deps.onChange?.(this.getSnapshot());
  }
}

/** Maps the session stage onto the app's shared lifecycle vocabulary. */
export function toLifecycleStage(stage: PreviewSessionStage): string {
  switch (stage) {
    case "building":
    case "loading":
      return "building";
    case "ready":
      return "ready";
    case "build_error":
      return "build_failed";
    case "runtime_error":
    case "load_timeout":
    case "mount_timeout":
      return "runtime_error";
    case "stopped":
      return "stopped";
    default:
      return "stale";
  }
}
