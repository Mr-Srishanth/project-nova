export type EventSeverity = "debug" | "info" | "warning" | "error";
export type EventOutcome = "started" | "succeeded" | "failed" | "blocked" | "cancelled";
export type EventCategory =
  | "ai_gateway"
  | "execution_plan"
  | "capability_action"
  | "scheduler"
  | "orchestration"
  | "quality_check"
  | "documentation"
  | "release_readiness"
  | "storage"
  | "system_health";

export type SubsystemType =
  | "ai_gateway"
  | "execution_engine"
  | "scheduler"
  | "orchestrator"
  | "local_storage"
  | "observability"
  | "quality_lab"
  | "release_center";

export interface ActivityEvent {
  id: string;
  timestamp: string; // ISO-8601
  projectId?: string;
  category: EventCategory;
  eventType: string;
  severity: EventSeverity;
  outcome: EventOutcome;
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

export type SubsystemHealthStatus = "healthy" | "degraded" | "unavailable" | "unknown";

export interface SubsystemHealthResult {
  subsystem: SubsystemType;
  title: string;
  status: SubsystemHealthStatus;
  explanation: string;
  isLiveTested: boolean;
  lastChecked: string; // ISO-8601
  suggestedAction?: string;
  details?: Record<string, unknown>;
}

export interface ActivityFilterOptions {
  projectId?: string;
  subsystem?: SubsystemType;
  severity?: EventSeverity;
  outcome?: EventOutcome;
  category?: EventCategory;
  search?: string;
  limit?: number;
}
