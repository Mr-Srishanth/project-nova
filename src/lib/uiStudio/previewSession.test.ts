import { describe, it, expect, vi } from "vitest";
import { PreviewSessionController } from "./previewSession";

/** Deterministic manual timer harness injected into the controller. */
function createTimers() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  return {
    setTimeoutFn: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeoutFn: (id: number) => {
      timers.delete(id);
    },
    advance: (ms: number) => {
      const target = now + ms;
      for (;;) {
        let nextId: number | null = null;
        let nextAt = Infinity;
        for (const [id, t] of timers) {
          if (t.at <= target && t.at < nextAt) {
            nextAt = t.at;
            nextId = id;
          }
        }
        if (nextId === null) break;
        const t = timers.get(nextId)!;
        timers.delete(nextId);
        now = t.at;
        t.fn();
      }
      now = target;
    },
    pendingCount: () => timers.size,
  };
}

function createSession() {
  const timers = createTimers();
  const pings: string[] = [];
  const session = new PreviewSessionController({
    sendPing: (buildId) => pings.push(buildId),
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
    softTimeoutMs: 1000,
    hardTimeoutMs: 2500,
  });
  return { session, timers, pings };
}

describe("PreviewSessionController", () => {
  it("reaches ready only after a verified mount message for the current build", () => {
    const { session } = createSession();
    session.beginBuild("b1");
    expect(session.getSnapshot().stage).toBe("building");
    expect(session.handleMessage({ type: "PREVIEW_DOCUMENT_LOADED", buildId: "b1" })).toBe(true);
    expect(session.getSnapshot().stage).toBe("loading");
    expect(session.handleMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "b1" })).toBe(true);
    const snap = session.getSnapshot();
    expect(snap.stage).toBe("ready");
    expect(snap.mountedBuildId).toBe("b1");
    expect(snap.lastGoodBuildId).toBe("b1");
    expect(snap.error).toBeNull();
  });

  it("never fires the watchdog after a successful mount (regression: watchdog re-arm bug)", () => {
    const { session, timers } = createSession();
    session.beginBuild("b1");
    session.handleMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "b1" });
    expect(session.getSnapshot().stage).toBe("ready");
    // The old implementation re-armed a 6s watchdog whenever lastKnownGoodHtml
    // changed, flipping healthy previews to "Mount Timeout". Advancing far
    // past every deadline must leave a mounted preview untouched.
    timers.advance(120000);
    expect(session.getSnapshot().stage).toBe("ready");
    expect(session.getSnapshot().error).toBeNull();
    expect(timers.pendingCount()).toBe(0);
  });

  it("ignores messages from superseded builds (stale-preview prevention)", () => {
    const { session } = createSession();
    session.beginBuild("b1");
    session.beginBuild("b2");
    expect(session.handleMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "b1" })).toBe(false);
    expect(session.getSnapshot().stage).toBe("building");
    expect(session.handleMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "b2" })).toBe(true);
    expect(session.getSnapshot().mountedBuildId).toBe("b2");
  });

  it("classifies a mount timeout when the document loaded but the app never mounted", () => {
    const { session, timers, pings } = createSession();
    session.beginBuild("b1");
    session.handleMessage({ type: "PREVIEW_DOCUMENT_LOADED", buildId: "b1" });
    timers.advance(1000); // soft deadline -> liveness probe
    expect(pings).toEqual(["b1"]);
    expect(session.getSnapshot().stage).toBe("loading");
    timers.advance(1500); // hard deadline
    const snap = session.getSnapshot();
    expect(snap.stage).toBe("mount_timeout");
    expect(snap.error?.kind).toBe("mount_timeout");
    expect(snap.error?.message).toContain("b1");
  });

  it("classifies a load timeout when the document never signals at all", () => {
    const { session, timers } = createSession();
    session.beginBuild("b1");
    timers.advance(2500);
    const snap = session.getSnapshot();
    expect(snap.stage).toBe("load_timeout");
    expect(snap.error?.kind).toBe("load_timeout");
  });

  it("recovers a lost MOUNTED message via the PING/PONG liveness probe", () => {
    const { session, timers } = createSession();
    session.beginBuild("b1");
    session.handleMessage({ type: "PREVIEW_DOCUMENT_LOADED", buildId: "b1" });
    timers.advance(1000);
    expect(session.handleMessage({ type: "PREVIEW_PONG", buildId: "b1", mounted: true })).toBe(true);
    expect(session.getSnapshot().stage).toBe("ready");
    timers.advance(60000);
    expect(session.getSnapshot().stage).toBe("ready");
  });

  it("does not treat a PONG with mounted=false as success", () => {
    const { session, timers } = createSession();
    session.beginBuild("b1");
    session.handleMessage({ type: "PREVIEW_DOCUMENT_LOADED", buildId: "b1" });
    timers.advance(1000);
    session.handleMessage({ type: "PREVIEW_PONG", buildId: "b1", mounted: false });
    expect(session.getSnapshot().stage).toBe("loading");
    timers.advance(1500);
    expect(session.getSnapshot().stage).toBe("mount_timeout");
  });

  it("records build failures distinctly from runtime failures", () => {
    const { session } = createSession();
    session.beginBuild("b1");
    session.failBuild("b1", "Transpilation error: unexpected token");
    const snap = session.getSnapshot();
    expect(snap.stage).toBe("build_error");
    expect(snap.error?.kind).toBe("build");
    // A stale build's failure must not clobber the current state.
    session.beginBuild("b2");
    session.failBuild("b1", "stale failure");
    expect(session.getSnapshot().stage).toBe("building");
    expect(session.getSnapshot().error).toBeNull();
  });

  it("keeps the last good build as fallback when a newer build fails at runtime", () => {
    const { session } = createSession();
    session.beginBuild("b1");
    session.handleMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "b1" });
    session.beginBuild("b2");
    session.handleMessage({ type: "PREVIEW_RUNTIME_ERROR", buildId: "b2", message: "boom" });
    const snap = session.getSnapshot();
    expect(snap.stage).toBe("runtime_error");
    expect(snap.lastGoodBuildId).toBe("b1");
    expect(snap.isShowingFallback).toBe(true);
  });

  it("keeps a mounted preview ready when a runtime error arrives after mount", () => {
    const { session } = createSession();
    session.beginBuild("b1");
    session.handleMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "b1" });
    session.handleMessage({ type: "PREVIEW_RUNTIME_ERROR", buildId: "b1", message: "async boom" });
    const snap = session.getSnapshot();
    expect(snap.stage).toBe("ready");
    expect(snap.error?.kind).toBe("runtime");
    expect(snap.error?.message).toContain("async boom");
  });

  it("generates monotonic, never-reused build ids", () => {
    const { session } = createSession();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(session.nextBuildId(i));
    expect(ids.size).toBe(50);
  });

  it("stop() disarms the watchdog and freezes the session", () => {
    const { session, timers } = createSession();
    session.beginBuild("b1");
    session.stop();
    timers.advance(60000);
    expect(session.getSnapshot().stage).toBe("stopped");
    expect(session.handleMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "b1" })).toBe(false);
  });

  it("emits snapshots to subscribers on stage changes", () => {
    const onChange = vi.fn();
    const timers = createTimers();
    const session = new PreviewSessionController({
      sendPing: () => {},
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
      onChange,
    });
    session.beginBuild("b1");
    session.handleMessage({ type: "PREVIEW_MOUNTED_SUCCESS", buildId: "b1" });
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last.stage).toBe("ready");
  });
});
