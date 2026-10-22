/**
 * ProjectNova AI - Monitoring Storage Adapter
 * Phase 17: Live Monitoring, Alerting & Incident Response
 *
 * Isolated, versioned browser-local storage for:
 * - Monitoring Targets (`projectnova_mon_targets_v1`)
 * - Health Observations (`projectnova_mon_observations_v1`)
 * - Alert Rules (`projectnova_mon_rules_v1`)
 * - Alert Events (`projectnova_mon_alerts_v1`)
 * - Incidents (`projectnova_mon_incidents_v1`)
 *
 * Zero secrets stored. Project-scoped isolation and retention bounds.
 */

import {
  MonitoringTarget,
  HealthObservation,
  AlertRule,
  AlertEvent,
  Incident
} from '../../types/monitoring';

const TARGETS_KEY = 'projectnova_mon_targets_v1';
const OBSERVATIONS_KEY = 'projectnova_mon_observations_v1';
const RULES_KEY = 'projectnova_mon_rules_v1';
const ALERTS_KEY = 'projectnova_mon_alerts_v1';
const INCIDENTS_KEY = 'projectnova_mon_incidents_v1';

export class LocalBrowserMonitoringStorageAdapter {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  // --- Monitoring Targets ---
  public listTargets(projectId: string): MonitoringTarget[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(TARGETS_KEY);
      if (!raw) return [];
      const all: MonitoringTarget[] = JSON.parse(raw);
      return all.filter(t => t.projectId === projectId);
    } catch {
      return [];
    }
  }

  public saveTarget(target: MonitoringTarget): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(TARGETS_KEY);
      const all: MonitoringTarget[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(t => t.id === target.id);
      if (idx >= 0) all[idx] = target;
      else all.push(target);
      storage.setItem(TARGETS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[MonitoringStorage] Failed to save target:', e);
    }
  }

  public deleteTarget(projectId: string, targetId: string): boolean {
    const storage = this.getStorage();
    if (!storage) return false;
    try {
      const raw = storage.getItem(TARGETS_KEY);
      if (!raw) return false;
      const all: MonitoringTarget[] = JSON.parse(raw);
      const filtered = all.filter(t => !(t.projectId === projectId && t.id === targetId));
      storage.setItem(TARGETS_KEY, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }

  // --- Health Observations ---
  public listObservations(projectId: string, targetId?: string): HealthObservation[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(OBSERVATIONS_KEY);
      if (!raw) return [];
      const all: HealthObservation[] = JSON.parse(raw);
      return all.filter(o => o.projectId === projectId && (!targetId || o.targetId === targetId));
    } catch {
      return [];
    }
  }

  public saveObservation(observation: HealthObservation): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(OBSERVATIONS_KEY);
      const all: HealthObservation[] = raw ? JSON.parse(raw) : [];
      all.unshift(observation);
      // Retention limit: keep latest 300 observations per project
      if (all.length > 500) all.length = 500;
      storage.setItem(OBSERVATIONS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[MonitoringStorage] Failed to save observation:', e);
    }
  }

  // --- Alert Rules ---
  public listRules(projectId: string): AlertRule[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(RULES_KEY);
      if (!raw) return [];
      const all: AlertRule[] = JSON.parse(raw);
      return all.filter(r => r.projectId === projectId);
    } catch {
      return [];
    }
  }

  public saveRule(rule: AlertRule): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(RULES_KEY);
      const all: AlertRule[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(r => r.id === rule.id);
      if (idx >= 0) all[idx] = rule;
      else all.push(rule);
      storage.setItem(RULES_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[MonitoringStorage] Failed to save rule:', e);
    }
  }

  // --- Alert Events ---
  public listAlerts(projectId: string): AlertEvent[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(ALERTS_KEY);
      if (!raw) return [];
      const all: AlertEvent[] = JSON.parse(raw);
      return all.filter(a => a.projectId === projectId);
    } catch {
      return [];
    }
  }

  public saveAlert(alert: AlertEvent): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(ALERTS_KEY);
      const all: AlertEvent[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(a => a.id === alert.id);
      if (idx >= 0) all[idx] = alert;
      else all.unshift(alert);
      if (all.length > 300) all.length = 300;
      storage.setItem(ALERTS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[MonitoringStorage] Failed to save alert:', e);
    }
  }

  // --- Incidents ---
  public listIncidents(projectId: string): Incident[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(INCIDENTS_KEY);
      if (!raw) return [];
      const all: Incident[] = JSON.parse(raw);
      return all.filter(i => i.projectId === projectId);
    } catch {
      return [];
    }
  }

  public saveIncident(incident: Incident): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(INCIDENTS_KEY);
      const all: Incident[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(i => i.id === incident.id);
      if (idx >= 0) all[idx] = incident;
      else all.unshift(incident);
      if (all.length > 100) all.length = 100;
      storage.setItem(INCIDENTS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[MonitoringStorage] Failed to save incident:', e);
    }
  }

  public clearAll(projectId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const removeForProject = <T extends { projectId: string }>(key: string) => {
        const raw = storage.getItem(key);
        if (!raw) return;
        const all: T[] = JSON.parse(raw);
        storage.setItem(key, JSON.stringify(all.filter(item => item.projectId !== projectId)));
      };
      removeForProject<MonitoringTarget>(TARGETS_KEY);
      removeForProject<HealthObservation>(OBSERVATIONS_KEY);
      removeForProject<AlertRule>(RULES_KEY);
      removeForProject<AlertEvent>(ALERTS_KEY);
      removeForProject<Incident>(INCIDENTS_KEY);
    } catch (e) {
      console.warn('[MonitoringStorage] Error clearing project data:', e);
    }
  }
}

export const monitoringStorage = new LocalBrowserMonitoringStorageAdapter();
