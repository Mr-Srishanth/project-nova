/**
 * ProjectNova AI - Health Observation & Correlation Service
 * Phase 17: Live Monitoring, Alerting & Incident Response
 *
 * Performs safe observation checks:
 * - Deployment health checks with strict SSRF protection
 * - Stale observation detection based on target freshness thresholds
 * - Normalized event correlation connecting deployments, test runs, and execution plans
 */

import {
  MonitoringTarget,
  HealthObservation,
  TargetHealthState
} from '../../types/monitoring';
import { validateSafeDeploymentUrl } from '../deployment/deploymentProviderRegistry';
import { monitoringStorage } from '../storage/monitoringStorage';
import { activityLogger } from '../observability/activityLogger';

export interface ObservationRequestOptions {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class HealthObservationService {
  /**
   * Checks if an observation is considered stale based on the target's threshold.
   */
  public isTargetStale(target: MonitoringTarget, currentTime: Date = new Date()): boolean {
    if (!target.lastObservedAt) return true;
    const lastTime = new Date(target.lastObservedAt).getTime();
    const elapsedSeconds = (currentTime.getTime() - lastTime) / 1000;
    return elapsedSeconds > target.freshnessThresholdSeconds;
  }

  /**
   * Dispatches a live HTTP health check to a target with strict SSRF and timeout enforcement.
   */
  public async observeHttpTarget(
    target: MonitoringTarget,
    options: ObservationRequestOptions = {}
  ): Promise<HealthObservation> {
    const startedAt = Date.now();
    const timestamp = new Date().toISOString();
    const timeoutMs = options.timeoutMs ?? 5000;
    const fetchFn = options.fetchFn ?? globalThis.fetch;

    if (!target.endpointUrl) {
      const obs: HealthObservation = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        targetId: target.id,
        projectId: target.projectId,
        timestamp,
        durationMs: 0,
        result: 'unknown',
        evidenceSource: 'local_event',
        sanitizedDiagnostic: 'Target does not declare an endpoint URL.',
        errorCategory: 'unverified'
      };
      monitoringStorage.saveObservation(obs);
      return obs;
    }

    // SSRF Validation
    const safety = validateSafeDeploymentUrl(target.endpointUrl);
    if (!safety.safe) {
      const durationMs = Date.now() - startedAt;
      const obs: HealthObservation = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        targetId: target.id,
        projectId: target.projectId,
        timestamp,
        durationMs,
        result: 'unavailable',
        evidenceSource: 'live_http_check',
        sanitizedDiagnostic: `SSRF check rejected URL: ${safety.reason}`,
        errorCategory: 'ssrf_blocked'
      };

      // Update target current state
      monitoringStorage.saveObservation(obs);
      target.currentState = 'unavailable';
      target.lastObservedAt = timestamp;
      monitoringStorage.saveTarget(target);
      return obs;
    }

    // Perform bounded fetch
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetchFn(target.endpointUrl, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const durationMs = Date.now() - startedAt;
      const status = response.status;
      let result: TargetHealthState = 'unknown';

      if (status >= 200 && status < 300) {
        result = 'healthy';
      } else if (status >= 300 && status < 500) {
        result = 'degraded';
      } else {
        result = 'failed';
      }

      const obs: HealthObservation = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        targetId: target.id,
        projectId: target.projectId,
        timestamp,
        durationMs,
        result,
        evidenceSource: 'live_http_check',
        httpStatusCode: status,
        sanitizedDiagnostic: `HTTP ${status} responded in ${durationMs}ms.`
      };

      monitoringStorage.saveObservation(obs);
      target.currentState = result;
      target.lastObservedAt = timestamp;
      if (result === 'healthy') {
        target.lastSuccessfulObservationAt = timestamp;
      }
      monitoringStorage.saveTarget(target);

      activityLogger.log({
        projectId: target.projectId,
        category: 'system_health',
        eventType: 'observation_completed',
        severity: result === 'healthy' ? 'info' : 'warning',
        outcome: result === 'healthy' ? 'succeeded' : 'failed',
        sourceSubsystem: 'observability',
        summary: `Observation for ${target.name}: ${result} (HTTP ${status})`,
        durationMs,
        safeDetails: {
          targetId: target.id,
          result,
          httpStatusCode: status
        }
      });

      return obs;
    } catch (err: any) {
      const durationMs = Date.now() - startedAt;
      const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');

      const obs: HealthObservation = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        targetId: target.id,
        projectId: target.projectId,
        timestamp,
        durationMs,
        result: isTimeout ? 'degraded' : 'unavailable',
        evidenceSource: 'live_http_check',
        sanitizedDiagnostic: isTimeout ? `Request timed out after ${timeoutMs}ms` : `Connection failed: ${err?.message || String(err)}`,
        errorCategory: isTimeout ? 'timeout' : 'http_error'
      };

      monitoringStorage.saveObservation(obs);
      target.currentState = isTimeout ? 'degraded' : 'unavailable';
      target.lastObservedAt = timestamp;
      monitoringStorage.saveTarget(target);

      return obs;
    }
  }

  /**
   * Evaluates freshness and updates stale targets.
   */
  public evaluateFreshness(target: MonitoringTarget, currentTime: Date = new Date()): MonitoringTarget {
    if (this.isTargetStale(target, currentTime) && target.currentState !== 'stale' && target.enabled) {
      target.currentState = 'stale';
      monitoringStorage.saveTarget(target);
    }
    return target;
  }
}

export const healthObservationService = new HealthObservationService();
