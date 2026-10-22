/**
 * ProjectNova AI - Incident Management & Recovery Service
 * Phase 17: Live Monitoring, Alerting & Incident Response
 *
 * Implements strict incident lifecycle:
 * open -> acknowledged -> investigating -> monitoring_recovery -> resolved -> reopened
 *
 * Provides safe recovery recommendations without executing destructive remediation automatically.
 */

import {
  Incident,
  IncidentStatus,
  AlertEvent,
  RecoveryRecommendation
} from '../../types/monitoring';
import { monitoringStorage } from '../storage/monitoringStorage';
import { activityLogger } from '../observability/activityLogger';

export class IncidentManagementService {
  /**
   * Creates an incident from qualifying alert events.
   */
  public createIncidentFromAlerts(
    projectId: string,
    title: string,
    alerts: AlertEvent[],
    author: string = 'system_monitor'
  ): Incident {
    const now = new Date().toISOString();
    const highestSeverity = alerts.some(a => a.severity === 'critical')
      ? 'critical'
      : alerts.some(a => a.severity === 'high')
      ? 'high'
      : 'medium';

    const incident: Incident = {
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      title,
      severity: highestSeverity,
      status: 'open',
      affectedTargetIds: Array.from(new Set(alerts.map(a => a.targetId))),
      linkedAlertIds: alerts.map(a => a.id),
      openedAt: now,
      timeline: [
        {
          id: `tl-${Date.now()}-1`,
          timestamp: now,
          type: 'alert_linked',
          author,
          title: 'Incident Opened',
          detail: `Created incident from ${alerts.length} qualifying alert(s).`
        }
      ],
      rootCauseStatus: 'unknown'
    };

    monitoringStorage.saveIncident(incident);

    // Link back to alerts
    for (const a of alerts) {
      a.incidentId = incident.id;
      monitoringStorage.saveAlert(a);
    }

    activityLogger.log({
      projectId,
      category: 'system_health',
      eventType: 'incident_opened',
      severity: highestSeverity === 'critical' || highestSeverity === 'high' ? 'error' : 'warning',
      outcome: 'failed',
      sourceSubsystem: 'observability',
      summary: `Incident opened: ${title}`,
      safeDetails: {
        incidentId: incident.id,
        severity: highestSeverity,
        alertCount: alerts.length
      }
    });

    return incident;
  }

  /**
   * Advances an incident lifecycle state with strict valid transitions.
   */
  public transitionStatus(
    projectId: string,
    incidentId: string,
    nextStatus: IncidentStatus,
    author: string,
    note?: string
  ): { success: boolean; incident?: Incident; error?: string } {
    const incident = monitoringStorage.listIncidents(projectId).find(i => i.id === incidentId);
    if (!incident) {
      return { success: false, error: 'Incident not found' };
    }

    const current = incident.status;
    const now = new Date().toISOString();

    // Valid transitions
    const validMap: Record<IncidentStatus, IncidentStatus[]> = {
      open: ['acknowledged', 'investigating', 'resolved'],
      acknowledged: ['investigating', 'monitoring_recovery', 'resolved'],
      investigating: ['monitoring_recovery', 'resolved'],
      monitoring_recovery: ['resolved', 'investigating', 'reopened'],
      resolved: ['reopened'],
      reopened: ['acknowledged', 'investigating', 'resolved']
    };

    if (!validMap[current].includes(nextStatus)) {
      return {
        success: false,
        error: `Invalid transition from '${current}' to '${nextStatus}'.`
      };
    }

    incident.status = nextStatus;

    if (nextStatus === 'acknowledged') {
      incident.acknowledgedAt = now;
      incident.acknowledgedBy = author;
    } else if (nextStatus === 'investigating') {
      incident.investigatedAt = now;
    } else if (nextStatus === 'resolved') {
      incident.resolvedAt = now;
      incident.resolutionSummary = note || 'Incident resolved.';
    } else if (nextStatus === 'reopened') {
      incident.reopenedAt = now;
    }

    incident.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: now,
      type: 'state_transition',
      author,
      title: `Status: ${current.toUpperCase()} -> ${nextStatus.toUpperCase()}`,
      detail: note || `Transitioned to ${nextStatus}`
    });

    monitoringStorage.saveIncident(incident);
    return { success: true, incident };
  }

  /**
   * Generates safe, grounded recovery suggestions without executing destructive actions.
   */
  public generateRecoveryRecommendations(incident: Incident): RecoveryRecommendation[] {
    const recommendations: RecoveryRecommendation[] = [];

    // Recommendation 1: Targeted Health Re-check
    recommendations.push({
      id: `rec-refresh-${incident.id}`,
      title: 'Refresh Target Health Observation',
      explanation: 'Dispatches an immediate live observation check to verify if the incident is ongoing or transient.',
      supportingEvidence: `Incident has ${incident.affectedTargetIds.length} affected target(s).`,
      expectedImpact: 'Safe, read-only observation. Does not modify application state.',
      riskLevel: 'low',
      isAvailableInRuntime: true,
      requiresUserApproval: false,
      actionPayload: {
        actionType: 'refresh_target',
        targetId: incident.affectedTargetIds[0] || ''
      }
    });

    // Recommendation 2: Run Verification Test Suite
    recommendations.push({
      id: `rec-test-${incident.id}`,
      title: 'Run Test Automation Verification Suite',
      explanation: 'Executes the Phase 15 registered deterministic verification tests to assert workspace syntax and security integrity.',
      supportingEvidence: 'Verifies whether recent file modifications introduced regressions.',
      expectedImpact: 'Executes internal static and security analyzers without mutating code.',
      riskLevel: 'low',
      isAvailableInRuntime: true,
      requiresUserApproval: true,
      actionPayload: {
        actionType: 'rerun_test_suite',
        targetId: incident.projectId
      }
    });

    // Recommendation 3: Provider Deployment Rollback / Redepoy (Requires Explicit Signoff)
    recommendations.push({
      id: `rec-rollback-${incident.id}`,
      title: 'Target Deployment Rollback (Restricted)',
      explanation: 'Rollback to previously verified stable deployment revision via provider API.',
      supportingEvidence: 'High severity incident affecting active deployment.',
      expectedImpact: 'Mutates external provider routing to point back to previous deployment.',
      riskLevel: 'high',
      isAvailableInRuntime: false, // Requires live provider server tokens
      requiresUserApproval: true
    });

    return recommendations;
  }
}

export const incidentManagementService = new IncidentManagementService();
