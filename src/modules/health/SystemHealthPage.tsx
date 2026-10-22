import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  FolderKanban,
  RotateCw,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Shield,
  Search,
  Clock,
} from "lucide-react";
import type { Project } from "@/types/project";
import type {
  ActivityEvent,
  SubsystemHealthResult,
} from "@/types/observability";
import { projectStorage } from "@/lib/storage/projectStorage";
import { observabilityStorage } from "@/lib/storage/observabilityStorage";
import { assessSystemHealth } from "@/lib/observability/healthEngine";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SubsystemCard } from "@/components/health/SubsystemCard";
import { EventTimeline } from "@/components/health/EventTimeline";

export const SystemHealthPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProjectId = searchParams.get("projectId") || "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(requestedProjectId);
  const [healthResults, setHealthResults] = useState<SubsystemHealthResult[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState<boolean>(false);

  // Filter states
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [filterSubsystem, setFilterSubsystem] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"timeline" | "subsystems" | "failures">("timeline");

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load projects and initial passive health
  useEffect(() => {
    async function loadInitial() {
      try {
        const projs = await projectStorage.list();
        setProjects(projs);

        const initialHealth = await assessSystemHealth({ checkLiveGateway: false });
        setHealthResults(initialHealth);

        await refreshEvents(selectedProjectId);
      } catch (err) {
        console.error("Failed to load initial observability data:", err);
      }
    }
    loadInitial();
  }, []);

  const refreshEvents = async (projId: string) => {
    try {
      const list = await observabilityStorage.listEvents({
        projectId: projId || undefined,
        limit: 150,
      });
      setEvents(list);
    } catch (err) {
      console.error("Failed to refresh events:", err);
    }
  };

  const handleProjectChange = async (projId: string) => {
    setSelectedProjectId(projId);
    if (projId) {
      setSearchParams({ projectId: projId });
    } else {
      setSearchParams({});
    }
    await refreshEvents(projId);
  };

  const handleRunDiagnostics = async () => {
    if (runningDiagnostics) return;
    setRunningDiagnostics(true);
    try {
      // Execute live gateway check and storage verification
      const live = await assessSystemHealth({ checkLiveGateway: true });
      setHealthResults(live);
      await refreshEvents(selectedProjectId);
    } catch (err) {
      console.error("Diagnostics execution error:", err);
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const handleClearHistory = async () => {
    await observabilityStorage.clearEvents(selectedProjectId || undefined);
    await refreshEvents(selectedProjectId);
    setShowClearConfirm(false);
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterSeverity !== "all" && e.severity !== filterSeverity) return false;
      if (filterOutcome !== "all" && e.outcome !== filterOutcome) return false;
      if (filterSubsystem !== "all" && e.sourceSubsystem !== filterSubsystem) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          e.summary.toLowerCase().includes(q) ||
          e.eventType.toLowerCase().includes(q) ||
          (e.errorCode && e.errorCode.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [events, filterSeverity, filterOutcome, filterSubsystem, searchQuery]);

  // Failure & warning events only
  const failureEvents = useMemo(() => {
    return events.filter((e) => e.severity === "error" || e.severity === "warning");
  }, [events]);

  // Health summary metrics
  const healthStats = useMemo(() => {
    const healthy = healthResults.filter((h) => h.status === "healthy").length;
    const degraded = healthResults.filter((h) => h.status === "degraded").length;
    const unavailable = healthResults.filter((h) => h.status === "unavailable").length;
    const unknown = healthResults.filter((h) => h.status === "unknown").length;
    return { healthy, degraded, unavailable, unknown, total: healthResults.length };
  }, [healthResults]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Activity className="w-3.5 h-3.5" />
              Observability & System Health
            </span>
            <span className="text-xs font-mono text-muted-foreground">Phase 11 Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            System Health & Activity Ledger
          </h1>
          <p className="text-sm text-secondary">
            Grounded diagnostic ledger, active-session telemetry, and verifiable subsystem statuses.
          </p>
        </div>

        {/* Global Project Selector & Diagnostics CTA */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-border rounded-md px-2.5 py-1 text-xs">
            <FolderKanban className="w-3.5 h-3.5 text-secondary" />
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="bg-transparent border-none text-foreground font-medium text-xs focus:outline-none cursor-pointer"
            >
              <option value="">All Projects (Global)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleRunDiagnostics}
            disabled={runningDiagnostics}
            variant="primary"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground"
          >
            <RotateCw className={`w-3.5 h-3.5 ${runningDiagnostics ? "animate-spin" : ""}`} />
            {runningDiagnostics ? "Assessing..." : "Run Diagnostics"}
          </Button>

          <Button
            onClick={() => setShowClearConfirm(true)}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-red-700 hover:bg-red-50 hover:text-red-800 border-red-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Ledger
          </Button>
        </div>
      </div>

      {/* Confirmation Modal for Clearing History */}
      {showClearConfirm && (
        <Card className="p-4 border-2 border-red-300 bg-red-50/60 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-bold">Clear Observability History?</p>
              <p className="text-xs text-red-700">
                This removes local activity events for {selectedProjectId ? "the selected project" : "all projects"}. Existing execution plans, artifacts, and project blueprints are preserved.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={handleClearHistory}>
              Confirm Clear
            </Button>
          </div>
        </Card>
      )}

      {/* Subsystem Health Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Healthy Subsystems</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-900 mt-1">{healthStats.healthy}</p>
          <span className="text-[11px] text-emerald-700">Verified functional</span>
        </Card>

        <Card className="p-3 border border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Degraded / Unconfigured</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-900 mt-1">{healthStats.degraded}</p>
          <span className="text-[11px] text-amber-700">Needs configuration or check</span>
        </Card>

        <Card className="p-3 border border-red-200 bg-red-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-800">Unavailable</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-red-900 mt-1">{healthStats.unavailable}</p>
          <span className="text-[11px] text-red-700">Service unreachable</span>
        </Card>

        <Card className="p-3 border border-slate-200 bg-slate-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Passive / Unchecked</span>
            <HelpCircle className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{healthStats.unknown}</p>
          <span className="text-[11px] text-slate-600">Click Run Diagnostics to test</span>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex items-center justify-between">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "timeline"
                ? "border-primary text-foreground bg-white/60"
                : "border-transparent text-secondary hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Activity Timeline ({filteredEvents.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("subsystems")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "subsystems"
                ? "border-primary text-foreground bg-white/60"
                : "border-transparent text-secondary hover:text-foreground"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Subsystem Health ({healthResults.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("failures")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "failures"
                ? "border-primary text-foreground bg-white/60"
                : "border-transparent text-secondary hover:text-foreground"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Failures & Warnings ({failureEvents.length})
          </button>
        </div>

        <div className="text-[11px] text-muted-foreground font-mono hidden md:block">
          Privacy Policy: Secrets, API Keys & Auth Bearers Sanitized
        </div>
      </div>

      {/* Tab: Subsystem Health Grid */}
      {activeTab === "subsystems" && (
        <div className="space-y-3">
          <div className="text-xs text-secondary bg-white p-3 rounded-lg border border-border flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              Subsystem statuses are grounded in actual inspections. Passive mode avoids repeated external network requests.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics}
              className="h-7 text-xs"
            >
              <RotateCw className={`w-3 h-3 mr-1 ${runningDiagnostics ? "animate-spin" : ""}`} />
              Re-test All
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {healthResults.map((r) => (
              <SubsystemCard key={r.subsystem} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: Failures & Warnings */}
      {activeTab === "failures" && (
        <div className="space-y-4">
          {failureEvents.length === 0 ? (
            <Card className="p-8 text-center text-secondary border border-border">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
              <p className="font-bold text-foreground">Zero Recent Failures or Warnings</p>
              <p className="text-xs text-muted-foreground mt-1">
                All registered operations, capability executions, and storage adapters are reporting clean outcomes.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
                <span className="font-bold">Active Diagnostics Notice: </span>
                Reviewing {failureEvents.length} recorded failure or warning events. All sensitive tokens and credentials have been redacted.
              </div>
              <EventTimeline events={failureEvents} onNavigateEntity={(r) => navigate(r)} />
            </div>
          )}
        </div>
      )}

      {/* Tab: Activity Timeline & Filters */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="p-3 border border-border bg-white flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search event summary or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs border border-border rounded bg-transparent focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-secondary">
                <Filter className="w-3 h-3" />
                <span>Severity:</span>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="text-xs border border-border rounded px-1.5 py-1 bg-transparent font-medium"
                >
                  <option value="all">All</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="debug">Debug</option>
                </select>
              </div>

              <div className="flex items-center gap-1 text-xs text-secondary">
                <span>Outcome:</span>
                <select
                  value={filterOutcome}
                  onChange={(e) => setFilterOutcome(e.target.value)}
                  className="text-xs border border-border rounded px-1.5 py-1 bg-transparent font-medium"
                >
                  <option value="all">All</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                  <option value="blocked">Blocked</option>
                  <option value="started">Started</option>
                </select>
              </div>

              <div className="flex items-center gap-1 text-xs text-secondary">
                <span>Subsystem:</span>
                <select
                  value={filterSubsystem}
                  onChange={(e) => setFilterSubsystem(e.target.value)}
                  className="text-xs border border-border rounded px-1.5 py-1 bg-transparent font-medium"
                >
                  <option value="all">All</option>
                  <option value="ai_gateway">AI Gateway</option>
                  <option value="execution_engine">Execution Engine</option>
                  <option value="scheduler">Scheduler</option>
                  <option value="orchestrator">Orchestrator</option>
                  <option value="local_storage">Local Storage</option>
                </select>
              </div>

              {(filterSeverity !== "all" || filterOutcome !== "all" || filterSubsystem !== "all" || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-secondary hover:text-foreground"
                  onClick={() => {
                    setFilterSeverity("all");
                    setFilterOutcome("all");
                    setFilterSubsystem("all");
                    setSearchQuery("");
                  }}
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <EventTimeline events={filteredEvents} onNavigateEntity={(r) => navigate(r)} />
        </div>
      )}
    </div>
  );
};
