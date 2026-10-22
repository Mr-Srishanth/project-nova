import type { ActivityEvent, ActivityFilterOptions } from "@/types/observability";
import { sanitizeData } from "@/lib/observability/sanitizer";

export const OBSERVABILITY_STORAGE_KEY = "projectnova_observability_events_v1";
export const MAX_EVENTS_LIMIT = 200;

export interface IObservabilityStorageAdapter {
  listEvents(filters?: ActivityFilterOptions): Promise<ActivityEvent[]>;
  recordEvent(event: ActivityEvent): Promise<ActivityEvent>;
  clearEvents(projectId?: string): Promise<boolean>;
  getStats(): Promise<{ total: number; errors: number; warnings: number }>;
}

export class LocalBrowserObservabilityStorageAdapter implements IObservabilityStorageAdapter {
  private getRaw(): ActivityEvent[] {
    try {
      const data = localStorage.getItem(OBSERVABILITY_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];

      // Validate event shape and sanitize defensively
      return parsed.filter(
        (e) => e && typeof e === "object" && typeof e.id === "string" && typeof e.timestamp === "string"
      );
    } catch (err) {
      console.warn("[Observability Storage] Corrupted local storage JSON. Preserving backup & resetting:", err);
      try {
        const raw = localStorage.getItem(OBSERVABILITY_STORAGE_KEY);
        if (raw) {
          localStorage.setItem(`${OBSERVABILITY_STORAGE_KEY}_backup_${Date.now()}`, raw);
        }
        localStorage.removeItem(OBSERVABILITY_STORAGE_KEY);
      } catch {
        // Safe fallback
      }
      return [];
    }
  }

  private saveRaw(events: ActivityEvent[]): void {
    try {
      localStorage.setItem(OBSERVABILITY_STORAGE_KEY, JSON.stringify(events));
    } catch (err) {
      console.warn("[Observability Storage] Storage quota exceeded or unavailable:", err);
      // Attempt quota recovery: retain only the latest 50 events (preserving errors)
      try {
        const errors = events.filter((e) => e.severity === "error").slice(-25);
        const others = events.filter((e) => e.severity !== "error").slice(-25);
        const pruned = [...errors, ...others].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        localStorage.setItem(OBSERVABILITY_STORAGE_KEY, JSON.stringify(pruned));
      } catch {
        // If still failing, omit writing without crashing application
      }
    }
  }

  async listEvents(filters?: ActivityFilterOptions): Promise<ActivityEvent[]> {
    let events = this.getRaw();

    // Project isolation: if projectId specified, filter strictly
    if (filters?.projectId) {
      events = events.filter((e) => e.projectId === filters.projectId);
    }

    if (filters?.subsystem) {
      events = events.filter((e) => e.sourceSubsystem === filters.subsystem);
    }

    if (filters?.severity) {
      events = events.filter((e) => e.severity === filters.severity);
    }

    if (filters?.outcome) {
      events = events.filter((e) => e.outcome === filters.outcome);
    }

    if (filters?.category) {
      events = events.filter((e) => e.category === filters.category);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      events = events.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          e.eventType.toLowerCase().includes(q) ||
          (e.errorCode && e.errorCode.toLowerCase().includes(q))
      );
    }

    // Sort descending by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit && filters.limit > 0) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  async recordEvent(event: ActivityEvent): Promise<ActivityEvent> {
    const sanitized = sanitizeData<ActivityEvent>({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });

    const all = this.getRaw();
    all.push(sanitized);

    // Bounded retention policy:
    // If total exceeds MAX_EVENTS_LIMIT, preserve errors & warnings while trimming oldest info/debug events
    let bounded = all;
    if (bounded.length > MAX_EVENTS_LIMIT) {
      const errorsAndWarnings = bounded.filter((e) => e.severity === "error" || e.severity === "warning");
      const generalEvents = bounded.filter((e) => e.severity !== "error" && e.severity !== "warning");

      // Keep recent general events
      const keepGeneralCount = Math.max(0, MAX_EVENTS_LIMIT - Math.min(errorsAndWarnings.length, 100));
      const trimmedGeneral = generalEvents.slice(-keepGeneralCount);

      bounded = [...errorsAndWarnings.slice(-100), ...trimmedGeneral].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    this.saveRaw(bounded);
    return sanitized;
  }

  async clearEvents(projectId?: string): Promise<boolean> {
    if (projectId) {
      const all = this.getRaw();
      const remaining = all.filter((e) => e.projectId !== projectId);
      this.saveRaw(remaining);
      return true;
    }

    try {
      localStorage.removeItem(OBSERVABILITY_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<{ total: number; errors: number; warnings: number }> {
    const all = this.getRaw();
    return {
      total: all.length,
      errors: all.filter((e) => e.severity === "error").length,
      warnings: all.filter((e) => e.severity === "warning").length,
    };
  }
}

export const observabilityStorage = new LocalBrowserObservabilityStorageAdapter();
