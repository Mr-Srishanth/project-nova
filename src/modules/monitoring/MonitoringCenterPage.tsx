import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  Bell,
  RotateCw,
  Layers,
  Flame,
  Radio,
  CheckSquare
} from "lucide-react";
import { projectStorage } from "@/lib/storage/projectStorage";
import { monitoringStorage } from "@/lib/storage/monitoringStorage";
import { healthObservationService } from "@/lib/monitoring/healthObservationService";
import { alertEvaluationEngine } from "@/lib/monitoring/alertEvaluationEngine";
import { incidentManagementService } from "@/lib/monitoring/incidentManagementService";
import type { Project } from "@/types/project";
import type {
  MonitoringTarget,
  AlertRule,
  AlertEvent,
  Incident,
  HealthObservation
} from "@/types/monitoring";

export const MonitoringCenterPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [targets, setTargets] = useState<MonitoringTarget[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [observations, setObservations] = useState<HealthObservation[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "targets" | "alerts" | "incidents" | "rules">("overview");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Load project list
  useEffect(() => {
    async function loadProjects() {
      const projs = await projectStorage.list();
      setProjects(projs);
      const urlProj = searchParams.get("projectId");
      if (urlProj && projs.some(p => p.id === urlProj)) {
        setSelectedProjectId(urlProj);
      } else if (projs.length > 0) {
        setSelectedProjectId(projs[0].id);
      }
    }
    loadProjects();
  }, []);

  // Update selected project and populate default targets/rules if missing
  useEffect(() => {
    if (!selectedProjectId) return;
    async function loadProjectData() {
      const proj = await projectStorage.getById(selectedProjectId);
      setSearchParams({ projectId: selectedProjectId });

      // Load Targets
      let curTargets = monitoringStorage.listTargets(selectedProjectId);
      if (curTargets.length === 0) {
        const defaultTarget: MonitoringTarget = {
          id: `tgt-${selectedProjectId}-health`,
          projectId: selectedProjectId,
          targetType: 'deployment',
          name: `${proj?.name || 'Project'} Public Health`,
          endpointUrl: 'https://projectnova-preview.vercel.app/health',
          providerId: 'vercel',
          environment: 'production',
          currentState: 'unknown',
          evidenceSource: 'live_http_check',
          enabled: true,
          freshnessThresholdSeconds: 300
        };
        monitoringStorage.saveTarget(defaultTarget);
        curTargets = [defaultTarget];
      }
      setTargets(curTargets);

      // Load Rules
      let curRules = monitoringStorage.listRules(selectedProjectId);
      if (curRules.length === 0) {
        const defaultRule: AlertRule = {
          id: `rule-${selectedProjectId}-fail`,
          projectId: selectedProjectId,
          name: 'Target Down or Consecutive Failures',
          description: 'Triggers when observations report failed or unavailable for 2 consecutive cycles',
          enabled: true,
          severity: 'high',
          targetType: 'deployment',
          conditionType: 'consecutive_health_failures',
          thresholdCount: 2,
          cooldownMinutes: 10,
          evaluationWindowMinutes: 30
        };
        monitoringStorage.saveRule(defaultRule);
        curRules = [defaultRule];
      }
      setRules(curRules);

      // Load alerts, incidents, observations
      setAlerts(monitoringStorage.listAlerts(selectedProjectId));
      const incs = monitoringStorage.listIncidents(selectedProjectId);
      setIncidents(incs);
      if (incs.length > 0) setSelectedIncident(incs[0]);
      setObservations(monitoringStorage.listObservations(selectedProjectId));
    }
    loadProjectData();
  }, [selectedProjectId]);

  const handleRefreshTarget = async (target: MonitoringTarget) => {
    setIsRefreshing(true);
    try {
      await healthObservationService.observeHttpTarget(target);
      // Re-evaluate alert rules
      alertEvaluationEngine.evaluateRules({ projectId: selectedProjectId });
      
      // Reload state
      setTargets(monitoringStorage.listTargets(selectedProjectId));
      setAlerts(monitoringStorage.listAlerts(selectedProjectId));
      setObservations(monitoringStorage.listObservations(selectedProjectId));
      setNotice(`Observation dispatched for '${target.name}'. Check updated.`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    alertEvaluationEngine.acknowledgeAlert(selectedProjectId, alertId, 'engineer');
    setAlerts(monitoringStorage.listAlerts(selectedProjectId));
    setNotice('Alert acknowledged.');
  };

  const handleResolveAlert = (alertId: string) => {
    alertEvaluationEngine.resolveAlert(selectedProjectId, alertId, 'Resolved by engineer');
    setAlerts(monitoringStorage.listAlerts(selectedProjectId));
    setNotice('Alert marked resolved.');
  };

  const handleCreateIncident = () => {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    if (activeAlerts.length === 0) {
      setNotice('No active alerts available to bundle into an incident.');
      return;
    }
    const inc = incidentManagementService.createIncidentFromAlerts(
      selectedProjectId,
      `Service Degradation: ${activeAlerts[0].title}`,
      activeAlerts,
      'lead_engineer'
    );
    setIncidents(monitoringStorage.listIncidents(selectedProjectId));
    setSelectedIncident(inc);
    setActiveTab("incidents");
    setNotice(`Incident ${inc.id} opened.`);
  };

  const handleTransitionIncident = (status: any) => {
    if (!selectedIncident) return;
    const res = incidentManagementService.transitionStatus(
      selectedProjectId,
      selectedIncident.id,
      status,
      'lead_engineer',
      `Manual status change to ${status}`
    );
    if (res.success && res.incident) {
      setSelectedIncident(res.incident);
      setIncidents(monitoringStorage.listIncidents(selectedProjectId));
      setNotice(`Incident transitioned to ${status}.`);
    } else {
      setNotice(res.error || 'Transition rejected');
    }
  };

  // Metrics summary
  const healthyCount = targets.filter(t => t.currentState === 'healthy').length;
  const degradedCount = targets.filter(t => t.currentState === 'degraded').length;
  const unavailableCount = targets.filter(t => t.currentState === 'unavailable' || t.currentState === 'failed').length;
  const unverifiedCount = targets.filter(t => t.currentState === 'unknown' || t.currentState === 'stale').length;
  const activeAlertsCount = alerts.filter(a => a.status === 'active').length;
  const openIncidentsCount = incidents.filter(i => i.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F4F1DF] p-6 rounded-xl border border-[#153A52]/10 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#153A52] text-white">
              <Activity className="w-6 h-6 text-[#70C84B]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#153A52]">Live Monitoring, Alerting & Incidents</h1>
              <p className="text-sm text-[#153A52]/70">
                Phase 17 · Grounded target observations, deterministic alert rules, and incident recovery workflows.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 bg-white border border-[#153A52]/20 rounded-lg text-sm text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#153A52]/30"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => targets[0] && handleRefreshTarget(targets[0])}
            disabled={isRefreshing || targets.length === 0}
            className="px-3.5 py-2 bg-[#153A52] hover:bg-[#153A52]/90 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 text-[#70C84B] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Poll Targets</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-center justify-between shadow-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-indigo-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
          <span className="text-xs text-emerald-700 uppercase font-semibold">Healthy</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{healthyCount}</div>
          <span className="text-[11px] text-gray-500">Live Verified</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs text-amber-700 uppercase font-semibold">Degraded</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">{degradedCount}</div>
          <span className="text-[11px] text-gray-500">Performance / Latency</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
          <span className="text-xs text-rose-700 uppercase font-semibold">Down / Failed</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">{unavailableCount}</div>
          <span className="text-[11px] text-rose-600 font-medium">Action Required</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-600 uppercase font-semibold">Stale / Unknown</span>
          <div className="text-2xl font-bold text-gray-700 mt-1">{unverifiedCount}</div>
          <span className="text-[11px] text-gray-500">Unobserved</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm">
          <span className="text-xs text-purple-700 uppercase font-semibold">Active Alerts</span>
          <div className="text-2xl font-bold text-purple-600 mt-1">{activeAlertsCount}</div>
          <span className="text-[11px] text-gray-500">Unresolved</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-300 shadow-sm">
          <span className="text-xs text-rose-700 uppercase font-semibold">Open Incidents</span>
          <div className="text-2xl font-bold text-rose-700 mt-1">{openIncidentsCount}</div>
          <span className="text-[11px] text-rose-600 font-medium">In Investigation</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#153A52]/10 gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("targets")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "targets"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Monitoring Targets ({targets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("alerts")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "alerts"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Alerts ({alerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("incidents")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "incidents"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Incidents ({incidents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "rules"
              ? "border-[#153A52] text-[#153A52]"
              : "border-transparent text-[#153A52]/60 hover:text-[#153A52]"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Alert Rules ({rules.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="bg-[#F4F1DF]/40 p-4 rounded-xl border border-[#153A52]/10 text-xs text-[#153A52]/80">
            <span className="font-bold">Runtime Boundary Notice:</span> ProjectNova operates within local browser context and local server gateway. Monitoring checks run on-demand or during active browser sessions; monitoring stops when browser tabs are closed.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Observations */}
            <div className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-[#153A52]">Recent Health Observations</h3>
              {observations.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">No observations recorded yet. Click 'Poll Targets'.</div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {observations.slice(0, 10).map((obs) => (
                    <div key={obs.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            obs.result === 'healthy' ? 'bg-emerald-100 text-emerald-800' :
                            obs.result === 'degraded' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {obs.result}
                          </span>
                          <span className="font-mono text-gray-600">{obs.sanitizedDiagnostic}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">{obs.evidenceSource}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono">{new Date(obs.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Alerts & Quick Incidents */}
            <div className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#153A52]">Active Alerts & Incidents</h3>
                {activeAlertsCount > 0 && (
                  <button
                    onClick={handleCreateIncident}
                    className="text-xs bg-[#153A52] text-white px-3 py-1 rounded font-semibold hover:bg-[#153A52]/90"
                  >
                    Open Incident
                  </button>
                )}
              </div>

              {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">No active alerts recorded. All targets nominal.</div>
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 5).map((a) => (
                    <div key={a.id} className="p-3 bg-gray-50 rounded-lg border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-gray-800">{a.title}</span>
                        <p className="text-gray-600 mt-0.5">{a.message}</p>
                        <span className="text-[10px] text-gray-400 font-mono">Count: {a.occurrenceCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.status === 'active' && (
                          <button
                            onClick={() => handleAcknowledgeAlert(a.id)}
                            className="px-2 py-1 bg-white border text-gray-700 rounded text-[11px] hover:bg-gray-100"
                          >
                            Ack
                          </button>
                        )}
                        {a.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolveAlert(a.id)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] hover:bg-emerald-700"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONITORING TARGETS */}
      {activeTab === "targets" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {targets.map((tgt) => (
              <div key={tgt.id} className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      tgt.currentState === 'healthy' ? 'bg-emerald-100 text-emerald-800' :
                      tgt.currentState === 'degraded' ? 'bg-amber-100 text-amber-800' :
                      tgt.currentState === 'unavailable' || tgt.currentState === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {tgt.currentState}
                    </span>
                    <h3 className="font-bold text-[#153A52] text-base mt-2">{tgt.name}</h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{tgt.endpointUrl}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">
                    {tgt.targetType}
                  </span>
                </div>

                <div className="text-xs space-y-1 pt-2 border-t text-gray-600">
                  <div className="flex justify-between">
                    <span>Evidence Source:</span>
                    <span className="font-mono">{tgt.evidenceSource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Observed:</span>
                    <span>{tgt.lastObservedAt ? new Date(tgt.lastObservedAt).toLocaleTimeString() : 'Never'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Freshness Threshold:</span>
                    <span>{tgt.freshnessThresholdSeconds}s</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleRefreshTarget(tgt)}
                    disabled={isRefreshing}
                    className="px-3 py-1.5 bg-[#153A52] text-white hover:bg-[#153A52]/90 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#70C84B]" />
                    <span>Check Health Now</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ALERTS */}
      {activeTab === "alerts" && (
        <div className="bg-white rounded-xl border border-[#153A52]/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-sm text-[#153A52]">Recorded Alert Events</h3>
            <span className="text-xs text-gray-500 font-mono">Delivery: In-App Only</span>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">No alert events recorded.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {alerts.map((alt) => (
                <div key={alt.id} className="p-4 hover:bg-gray-50 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        alt.status === 'active' ? 'bg-rose-100 text-rose-800' :
                        alt.status === 'acknowledged' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {alt.status}
                      </span>
                      <span className="text-xs font-bold text-gray-800">{alt.title}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">
                        {alt.severity}
                      </span>
                    </div>

                    <span className="text-xs text-gray-400 font-mono">
                      Occurrences: {alt.occurrenceCount} · Last: {new Date(alt.lastOccurredAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600">{alt.message}</p>

                  <div className="pt-2 flex justify-end gap-2">
                    {alt.status === 'active' && (
                      <button
                        onClick={() => handleAcknowledgeAlert(alt.id)}
                        className="px-2.5 py-1 bg-white border rounded text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Acknowledge
                      </button>
                    )}
                    {alt.status !== 'resolved' && (
                      <button
                        onClick={() => handleResolveAlert(alt.id)}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: INCIDENTS */}
      {activeTab === "incidents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-2">
            <h3 className="font-bold text-sm text-[#153A52]">Incident Log</h3>
            {incidents.length === 0 ? (
              <div className="p-6 bg-white rounded-xl border text-center text-gray-400 text-xs">No incidents opened.</div>
            ) : (
              incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedIncident?.id === inc.id
                      ? "bg-[#F4F1DF]/40 border-[#153A52] ring-1 ring-[#153A52]"
                      : "bg-white border-[#153A52]/10 hover:border-[#153A52]/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {inc.status}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{new Date(inc.openedAt).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="font-bold text-xs text-[#153A52] mt-2">{inc.title}</h4>
                  <p className="text-[11px] text-gray-500 mt-1">Linked Alerts: {inc.linkedAlertIds.length}</p>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-[#153A52]/10 shadow-sm space-y-6">
            {selectedIncident ? (
              <>
                <div className="flex items-start justify-between border-b pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#153A52]/60">
                      Incident Details · {selectedIncident.id}
                    </span>
                    <h3 className="text-base font-bold text-[#153A52] mt-1">{selectedIncident.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Root Cause: {selectedIncident.rootCauseStatus}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedIncident.status === 'open' && (
                      <button
                        onClick={() => handleTransitionIncident('acknowledged')}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-semibold"
                      >
                        Acknowledge
                      </button>
                    )}
                    {selectedIncident.status === 'acknowledged' && (
                      <button
                        onClick={() => handleTransitionIncident('investigating')}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold"
                      >
                        Investigate
                      </button>
                    )}
                    {selectedIncident.status !== 'resolved' && (
                      <button
                        onClick={() => handleTransitionIncident('resolved')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold"
                      >
                        Resolve Incident
                      </button>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">Incident Timeline</h4>
                  <div className="space-y-2 border-l-2 border-gray-200 pl-4">
                    {selectedIncident.timeline.map((entry) => (
                      <div key={entry.id} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#153A52]">{entry.title}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-gray-600">{entry.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recovery Recommendations */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">Recovery Actions & Safety</h4>
                  <div className="space-y-2">
                    {incidentManagementService.generateRecoveryRecommendations(selectedIncident).map((rec) => (
                      <div key={rec.id} className="p-3 bg-gray-50 rounded-lg border text-xs flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{rec.title}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              rec.riskLevel === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {rec.riskLevel} Risk
                            </span>
                          </div>
                          <p className="text-gray-600">{rec.explanation}</p>
                          <p className="text-[11px] text-gray-400">{rec.expectedImpact}</p>
                        </div>

                        <div>
                          {rec.isAvailableInRuntime ? (
                            <button
                              onClick={() => {
                                if (rec.actionPayload?.actionType === 'refresh_target') {
                                  const target = targets.find(t => t.id === rec.actionPayload?.targetId);
                                  if (target) handleRefreshTarget(target);
                                }
                              }}
                              className="px-2.5 py-1 bg-[#153A52] text-white rounded text-[11px] font-semibold hover:bg-[#153A52]/90"
                            >
                              Execute Action
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                              Server Required
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs">Select an incident to view timeline and recovery actions.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ALERT RULES */}
      {activeTab === "rules" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white p-5 rounded-xl border border-[#153A52]/10 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-[#153A52] text-base">{rule.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  rule.severity === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {rule.severity}
                </span>
              </div>

              <div className="text-xs space-y-1.5 pt-2 border-t text-gray-600">
                <div className="flex justify-between">
                  <span>Condition Type:</span>
                  <span className="font-mono">{rule.conditionType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failure Threshold:</span>
                  <span>{rule.thresholdCount} events</span>
                </div>
                <div className="flex justify-between">
                  <span>Cooldown Window:</span>
                  <span>{rule.cooldownMinutes} minutes</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
