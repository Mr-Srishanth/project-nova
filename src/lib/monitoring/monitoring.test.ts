import { describe, it, expect, beforeEach, vi } from 'vitest';
import { healthObservationService } from './healthObservationService';
import { alertEvaluationEngine } from './alertEvaluationEngine';
import { incidentManagementService } from './incidentManagementService';
import { monitoringStorage } from '../storage/monitoringStorage';
import type {
  MonitoringTarget,
  AlertRule,
  AlertEvent
} from '../../types/monitoring';

describe('Phase 17: Live Monitoring, Alerting & Incident Response', () => {
  const projectId = 'proj-mon-phase17';

  const mockTarget: MonitoringTarget = {
    id: 'tgt-preview-1',
    projectId,
    targetType: 'deployment',
    name: 'Production Health Endpoint',
    endpointUrl: 'https://projectnova-preview.vercel.app/health',
    providerId: 'vercel',
    environment: 'production',
    currentState: 'unknown',
    evidenceSource: 'live_http_check',
    enabled: true,
    freshnessThresholdSeconds: 300
  };

  const mockRule: AlertRule = {
    id: 'rule-consecutive-fail',
    projectId,
    name: 'Consecutive Health Failures',
    description: 'Triggers when 2 consecutive observations fail',
    enabled: true,
    severity: 'critical',
    targetType: 'deployment',
    conditionType: 'consecutive_health_failures',
    thresholdCount: 2,
    cooldownMinutes: 10,
    evaluationWindowMinutes: 30
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    monitoringStorage.clearAll(projectId);
  });

  describe('1. Health Observations & SSRF Safeguards', () => {
    it('rejects loopback and private IP endpoints to prevent SSRF', async () => {
      const hostileTarget: MonitoringTarget = {
        ...mockTarget,
        id: 'tgt-ssrf',
        endpointUrl: 'http://127.0.0.1:4000/internal'
      };

      const obs = await healthObservationService.observeHttpTarget(hostileTarget);
      expect(obs.result).toBe('unavailable');
      expect(obs.errorCategory).toBe('ssrf_blocked');
      expect(obs.sanitizedDiagnostic).toContain('SSRF check rejected URL');
    });

    it('records healthy observation on HTTP 200 response', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        status: 200
      } as any);

      const obs = await healthObservationService.observeHttpTarget(mockTarget, {
        fetchFn: mockFetch as any
      });

      expect(obs.result).toBe('healthy');
      expect(obs.httpStatusCode).toBe(200);
      expect(obs.evidenceSource).toBe('live_http_check');

      // Verify stored target state updated
      const updatedTargets = monitoringStorage.listTargets(projectId);
      expect(updatedTargets[0].currentState).toBe('healthy');
      expect(updatedTargets[0].lastSuccessfulObservationAt).toBeDefined();
    });

    it('detects and marks targets as stale when freshness threshold exceeded', () => {
      const staleTarget: MonitoringTarget = {
        ...mockTarget,
        lastObservedAt: new Date(Date.now() - 400 * 1000).toISOString(), // 400s ago > 300s threshold
        currentState: 'healthy'
      };

      expect(healthObservationService.isTargetStale(staleTarget)).toBe(true);

      const evaluated = healthObservationService.evaluateFreshness(staleTarget);
      expect(evaluated.currentState).toBe('stale');
    });
  });

  describe('2. Alert Evaluation, Deduplication & Cooldowns', () => {
    it('triggers alert when rule threshold is met', () => {
      monitoringStorage.saveTarget(mockTarget);
      monitoringStorage.saveRule(mockRule);

      // Save 2 failed observations
      monitoringStorage.saveObservation({
        id: 'obs-1',
        targetId: mockTarget.id,
        projectId,
        timestamp: new Date().toISOString(),
        durationMs: 50,
        result: 'failed',
        evidenceSource: 'live_http_check'
      });
      monitoringStorage.saveObservation({
        id: 'obs-2',
        targetId: mockTarget.id,
        projectId,
        timestamp: new Date().toISOString(),
        durationMs: 45,
        result: 'failed',
        evidenceSource: 'live_http_check'
      });

      const { newAlerts } = alertEvaluationEngine.evaluateRules({ projectId });
      expect(newAlerts.length).toBe(1);
      expect(newAlerts[0].severity).toBe('critical');
      expect(newAlerts[0].occurrenceCount).toBe(1);
    });

    it('enforces cooldown and updates occurrence count rather than duplicating alerts', () => {
      monitoringStorage.saveTarget(mockTarget);
      monitoringStorage.saveRule(mockRule);

      // Initial alert
      const existingAlert: AlertEvent = {
        id: 'alt-1',
        dedupKey: `alert_${mockRule.id}_${mockTarget.id}`,
        ruleId: mockRule.id,
        targetId: mockTarget.id,
        projectId,
        severity: 'critical',
        title: 'Initial Alert',
        message: 'Initial failure',
        firstOccurredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
        lastOccurredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        occurrenceCount: 1,
        status: 'active',
        deliveryState: 'in_app_only',
        evidenceSnapshot: {}
      };
      monitoringStorage.saveAlert(existingAlert);

      // Save failed observations
      monitoringStorage.saveObservation({
        id: 'obs-1',
        targetId: mockTarget.id,
        projectId,
        timestamp: new Date().toISOString(),
        durationMs: 50,
        result: 'failed',
        evidenceSource: 'live_http_check'
      });
      monitoringStorage.saveObservation({
        id: 'obs-2',
        targetId: mockTarget.id,
        projectId,
        timestamp: new Date().toISOString(),
        durationMs: 50,
        result: 'failed',
        evidenceSource: 'live_http_check'
      });

      const { newAlerts, updatedAlerts } = alertEvaluationEngine.evaluateRules({ projectId });
      expect(newAlerts.length).toBe(0);
      expect(updatedAlerts.length).toBe(1);
      expect(updatedAlerts[0].occurrenceCount).toBe(2);
    });
  });

  describe('3. Incident Lifecycle & Transitions', () => {
    it('creates an incident from qualifying alerts and advances through valid transitions', () => {
      const alert: AlertEvent = {
        id: 'alt-inc-1',
        dedupKey: 'dedup-1',
        ruleId: mockRule.id,
        targetId: mockTarget.id,
        projectId,
        severity: 'high',
        title: 'High severity target failure',
        message: 'Service is unavailable',
        firstOccurredAt: new Date().toISOString(),
        lastOccurredAt: new Date().toISOString(),
        occurrenceCount: 1,
        status: 'active',
        deliveryState: 'in_app_only',
        evidenceSnapshot: {}
      };

      const incident = incidentManagementService.createIncidentFromAlerts(
        projectId,
        'Outage: Target Down',
        [alert]
      );

      expect(incident.status).toBe('open');
      expect(incident.severity).toBe('high');
      expect(incident.linkedAlertIds).toContain('alt-inc-1');

      // Transition to acknowledged
      const ack = incidentManagementService.transitionStatus(
        projectId,
        incident.id,
        'acknowledged',
        'engineer_dendi',
        'Acknowledged and beginning investigation'
      );
      expect(ack.success).toBe(true);
      expect(ack.incident?.status).toBe('acknowledged');

      // Invalid transition: acknowledged cannot directly jump to reopened
      const invalid = incidentManagementService.transitionStatus(
        projectId,
        incident.id,
        'reopened',
        'engineer_dendi'
      );
      expect(invalid.success).toBe(false);
      expect(invalid.error).toContain("Invalid transition from 'acknowledged' to 'reopened'");

      // Transition to investigating then resolved
      incidentManagementService.transitionStatus(projectId, incident.id, 'investigating', 'engineer_dendi');
      const resolved = incidentManagementService.transitionStatus(
        projectId,
        incident.id,
        'resolved',
        'engineer_dendi',
        'Recovered after network blip cleared'
      );
      expect(resolved.success).toBe(true);
      expect(resolved.incident?.status).toBe('resolved');
      expect(resolved.incident?.resolutionSummary).toContain('Recovered');
    });

    it('generates recovery recommendations without automatic execution', () => {
      const incident = incidentManagementService.createIncidentFromAlerts(
        projectId,
        'Test Incident',
        []
      );

      const recs = incidentManagementService.generateRecoveryRecommendations(incident);
      expect(recs.length).toBeGreaterThanOrEqual(3);

      const rollback = recs.find(r => r.title.includes('Rollback'));
      expect(rollback).toBeDefined();
      expect(rollback?.requiresUserApproval).toBe(true);
      expect(rollback?.isAvailableInRuntime).toBe(false); // Safeguarded from auto-execution
    });
  });
});
