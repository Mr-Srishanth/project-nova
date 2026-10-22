import type {
  ActivityEvent,
  EventCategory,
  EventSeverity,
  EventOutcome,
  SubsystemType,
} from "@/types/observability";
import { observabilityStorage } from "@/lib/storage/observabilityStorage";
import { safeSummary, sanitizeString } from "./sanitizer";
import { generateId } from "@/lib/utils";

export interface LogEventParams {
  projectId?: string;
  category: EventCategory;
  eventType: string;
  severity?: EventSeverity;
  outcome?: EventOutcome;
  sourceSubsystem: SubsystemType;
  summary: string;
  correlationId?: string;
  operationId?: string;
  durationMs?: number;
  errorCode?: string;
  safeDetails?: Record<string, unknown>;
  entityLink?: {
    entityType: "plan" | "run" | "artifact" | "document" | "project";
    entityId: string;
    route?: string;
  };
}

class ActivityLoggerService {
  /**
   * Records an activity event. Wrapped in try/catch to ensure telemetry failures never disrupt business flows.
   */
  async log(params: LogEventParams): Promise<ActivityEvent | null> {
    try {
      const event: ActivityEvent = {
        id: generateId("evt"),
        timestamp: new Date().toISOString(),
        projectId: params.projectId,
        category: params.category,
        eventType: params.eventType,
        severity: params.severity || "info",
        outcome: params.outcome || "succeeded",
        sourceSubsystem: params.sourceSubsystem,
        summary: safeSummary(params.summary),
        correlationId: params.correlationId,
        operationId: params.operationId,
        durationMs: typeof params.durationMs === "number" && params.durationMs >= 0 ? Math.round(params.durationMs) : undefined,
        errorCode: params.errorCode ? sanitizeString(params.errorCode) : undefined,
        safeDetails: params.safeDetails,
        entityLink: params.entityLink,
      };

      return await observabilityStorage.recordEvent(event);
    } catch (err) {
      console.warn("[ActivityLogger] Telemetry failure (suppressed to preserve core flow):", err);
      return null;
    }
  }

  /**
   * Helper to execute an async operation, measure its duration, and record start and success/failure events.
   */
  async trackOperation<T>(
    meta: {
      projectId?: string;
      category: EventCategory;
      eventType: string;
      sourceSubsystem: SubsystemType;
      summary: string;
      correlationId?: string;
      entityLink?: LogEventParams["entityLink"];
    },
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const correlationId = meta.correlationId || generateId("op");

    try {
      const result = await fn();
      const durationMs = performance.now() - startTime;

      await this.log({
        ...meta,
        correlationId,
        outcome: "succeeded",
        severity: "info",
        durationMs,
        summary: `${meta.summary} (completed in ${Math.round(durationMs)}ms)`,
      });

      return result;
    } catch (err: any) {
      const durationMs = performance.now() - startTime;
      const errorMsg = err?.message || String(err);

      await this.log({
        ...meta,
        correlationId,
        outcome: "failed",
        severity: "error",
        durationMs,
        errorCode: err?.code || "OPERATION_FAILED",
        summary: `${meta.summary} failed: ${safeSummary(errorMsg, 120)}`,
        safeDetails: {
          errorType: err?.name || "Error",
        },
      });

      throw err;
    }
  }
}

export const activityLogger = new ActivityLoggerService();
