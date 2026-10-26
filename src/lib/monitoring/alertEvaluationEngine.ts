/**
 * ProjectNova AI - Alert Evaluation & Deduplication Engine
 * Phase 17: Live Monitoring, Alerting & Incident Response
 *
 * Evaluates rules against real observations, aggregates repeating alerts,
 * enforces cooldown windows, and groups qualified alerts into incidents.
 */

import {
  AlertRule,
  AlertEvent,
  MonitoringTarget,
  HealthObservation
} from '../../types/monitoring';
import { monitoringStorage } from '../storage/monitoringStorage';
import { activityLogger } from '../observability/activityLogger';

export interface EvaluationContext {
  projectId: string;
  now?: Date;
}

export class AlertEvaluationEngine {
  /**
   * Deterministically evaluates enabled alert rules against recorded observations.
   */
  public evaluateRules(context: EvaluationContext): { newAlerts: AlertEvent[]; updatedAlerts: AlertEvent[] } {
    const { projectId, now = new Date() } = context;
    const rules = monitoringStorage.listRules(projectId).filter(r => r.enabled);
    const targets = monitoringStorage.listTargets(projectId).filter(t => t.enabled);
    const existingAlerts = monitoringStorage.listAlerts(projectId);

    const newAlerts: AlertEvent[] = [];
    const updatedAlerts: AlertEvent[] = [];

    for (const rule of rules) {
      const applicableTargets = targets.filter(t => t.targetType === rule.targetType);

      for (const target of applicableTargets) {
        const observations = monitoringStorage.listObservations(projectId, target.id);
        const shouldTrigger = this.checkCondition(rule, target, observations, now);

        if (shouldTrigger.triggered) {
          const dedupKey = `alert_${rule.id}_${target.id}`;
          const existing = existingAlerts.find(a => a.dedupKey === dedupKey && a.status !== 'resolved');

          if (existing) {
            // Check cooldown window
            const lastTime = new Date(existing.lastOccurredAt).getTime();
            const elapsedMinutes = (now.getTime() - lastTime) / (1000 * 60);

            if (elapsedMinutes >= rule.cooldownMinutes) {
              existing.occurrenceCount += 1;
              existing.lastOccurredAt = now.toISOString();
              existing.message = shouldTrigger.message;
              existing.evidenceSnapshot = shouldTrigger.evidence;
              monitoringStorage.saveAlert(existing);
              updatedAlerts.push(existing);
            }
          } else {
            // Create fresh alert
            const alert: AlertEvent = {
              id: `alt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              dedupKey,
              ruleId: rule.id,
              targetId: target.id,
              projectId,
              severity: rule.severity,
              title: `${rule.name}: ${target.name}`,
              message: shouldTrigger.message,
              firstOccurredAt: now.toISOString(),
              lastOccurredAt: now.toISOString(),
              occurrenceCount: 1,
              status: 'active',
              deliveryState: 'in_app_only',
              evidenceSnapshot: shouldTrigger.evidence
            };

            monitoringStorage.saveAlert(alert);
            newAlerts.push(alert);

            activityLogger.log({
              projectId,
              category: 'system_health',
              eventType: 'alert_created',
              severity: rule.severity === 'critical' || rule.severity === 'high' ? 'error' : 'warning',
              outcome: 'failed',
              sourceSubsystem: 'observability',
              summary: alert.title,
              safeDetails: {
                ruleId: rule.id,
                targetId: target.id,
                severity: rule.severity
              }
            });
          }
        }
      }
    }

    return { newAlerts, updatedAlerts };
  }

  /**
   * Internal rule condition evaluator.
   */
  private checkCondition(
    rule: AlertRule,
    target: MonitoringTarget,
    observations: HealthObservation[],
    now: Date
  ): { triggered: boolean; message: string; evidence: Record<string, any> } {
    switch (rule.conditionType) {
      case 'deployment_failed': {
        const isFailed = target.currentState === 'failed' || target.currentState === 'unavailable';
        return {
          triggered: isFailed,
          message: `Target ${target.name} observed in state '${target.currentState}'`,
          evidence: { currentState: target.currentState, lastObservedAt: target.lastObservedAt }
        };
      }

      case 'consecutive_health_failures': {
        const recent = observations.slice(0, rule.thresholdCount);
        if (recent.length < rule.thresholdCount) return { triggered: false, message: '', evidence: {} };
        const allFailed = recent.every(o => o.result === 'failed' || o.result === 'unavailable' || o.result === 'degraded');
        return {
          triggered: allFailed,
          message: `${rule.thresholdCount} consecutive observations reported unhealthy for ${target.name}.`,
          evidence: { failureCount: recent.length, recentResults: recent.map(r => r.result) }
        };
      }

      case 'target_stale': {
        const last = target.lastObservedAt ? new Date(target.lastObservedAt).getTime() : 0;
        const elapsedSec = (now.getTime() - last) / 1000;
        const isStale = elapsedSec > target.freshnessThresholdSeconds;
        return {
          triggered: isStale,
          message: `Observations for ${target.name} stopped. Elapsed ${Math.round(elapsedSec)}s > ${target.freshnessThresholdSeconds}s threshold.`,
          evidence: { elapsedSec, threshold: target.freshnessThresholdSeconds }
        };
      }

      default:
        return { triggered: false, message: '', evidence: {} };
    }
  }

  /**
   * Acknowledges an active alert.
   */
  public acknowledgeAlert(projectId: string, alertId: string, acknowledgedBy: string = 'App user'): AlertEvent | null {
    const alerts = monitoringStorage.listAlerts(projectId);
    const targetAlert = alerts.find(a => a.id === alertId);
    if (!targetAlert) return null;

    targetAlert.status = 'acknowledged';
    targetAlert.acknowledgedBy = acknowledgedBy;
    targetAlert.acknowledgedAt = new Date().toISOString();
    monitoringStorage.saveAlert(targetAlert);
    return targetAlert;
  }

  /**
   * Resolves an active alert.
   */
  public resolveAlert(projectId: string, alertId: string, resolutionNote: string): AlertEvent | null {
    const alerts = monitoringStorage.listAlerts(projectId);
    const targetAlert = alerts.find(a => a.id === alertId);
    if (!targetAlert) return null;

    targetAlert.status = 'resolved';
    targetAlert.resolvedAt = new Date().toISOString();
    targetAlert.resolutionNote = resolutionNote;
    monitoringStorage.saveAlert(targetAlert);
    return targetAlert;
  }
}

export const alertEvaluationEngine = new AlertEvaluationEngine();
