/**
 * ProjectNova AI - Live Monitoring, Alerting & Incident Response Domain Types
 * Phase 17: Live Monitoring, Alerting & Incident Response
 */

export type MonitoringTargetType =
  | 'deployment'
  | 'execution_workflow'
  | 'scheduled_automation'
  | 'test_suite'
  | 'ai_gateway';

export type TargetHealthState =
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'failed'
  | 'unknown'
  | 'stale';

export type EvidenceSourceType =
  | 'live_provider'
  | 'live_http_check'
  | 'local_event'
  | 'imported_report'
  | 'test_fixture';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertStatus = 'active' | 'acknowledged' | 'suppressed' | 'resolved';

export type IncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'investigating'
  | 'monitoring_recovery'
  | 'resolved'
  | 'reopened';

export interface MonitoringTarget {
  id: string;
  projectId: string;
  targetType: MonitoringTargetType;
  name: string;
  endpointUrl?: string; // e.g. public health endpoint for deployment
  providerId?: string;  // e.g. 'vercel', 'github_actions'
  environment?: string; // 'preview', 'production'
  currentState: TargetHealthState;
  lastObservedAt?: string;
  lastSuccessfulObservationAt?: string;
  evidenceSource: EvidenceSourceType;
  enabled: boolean;
  freshnessThresholdSeconds: number; // e.g. 300s (5m) before marked stale
  metadata?: Record<string, any>;
}

export interface HealthObservation {
  id: string;
  targetId: string;
  projectId: string;
  timestamp: string;
  durationMs: number;
  result: TargetHealthState;
  evidenceSource: EvidenceSourceType;
  httpStatusCode?: number;
  providerStatusRaw?: string;
  sanitizedDiagnostic?: string;
  errorCategory?: 'http_error' | 'ssrf_blocked' | 'timeout' | 'provider_down' | 'unverified';
  correlationId?: string;
}

export interface AlertRule {
  id: string;
  projectId: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  targetType: MonitoringTargetType;
  conditionType:
    | 'deployment_failed'
    | 'consecutive_health_failures'
    | 'execution_terminal_failure'
    | 'verification_gate_failed'
    | 'target_stale';
  thresholdCount: number; // e.g. 2 consecutive failures
  cooldownMinutes: number; // Suppress duplicate alerts for X minutes
  evaluationWindowMinutes: number;
}

export interface AlertEvent {
  id: string;
  dedupKey: string;
  ruleId: string;
  targetId: string;
  projectId: string;
  incidentId?: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  firstOccurredAt: string;
  lastOccurredAt: string;
  occurrenceCount: number;
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  deliveryState: 'in_app_only' | 'pending' | 'delivered' | 'failed' | 'channel_unavailable';
  evidenceSnapshot: Record<string, any>;
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: string;
  type: 'observation' | 'alert_linked' | 'state_transition' | 'investigation_note' | 'recovery_attempt' | 'resolution';
  author: string; // 'system_monitor' or user identifier
  title: string;
  detail: string;
}

export interface Incident {
  id: string;
  projectId: string;
  title: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  affectedTargetIds: string[];
  linkedAlertIds: string[];
  openedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  investigatedAt?: string;
  resolvedAt?: string;
  reopenedAt?: string;
  timeline: IncidentTimelineEntry[];
  rootCauseStatus: 'confirmed' | 'suspected' | 'unknown';
  rootCauseSummary?: string;
  resolutionSummary?: string;
  suggestedActionId?: string;
}

export interface RecoveryRecommendation {
  id: string;
  title: string;
  explanation: string;
  supportingEvidence: string;
  expectedImpact: string;
  riskLevel: 'low' | 'medium' | 'high';
  isAvailableInRuntime: boolean;
  requiresUserApproval: boolean;
  actionPayload?: {
    actionType: 'refresh_target' | 'rerun_test_suite' | 'recheck_deployment_status';
    targetId: string;
    params?: Record<string, any>;
  };
}
