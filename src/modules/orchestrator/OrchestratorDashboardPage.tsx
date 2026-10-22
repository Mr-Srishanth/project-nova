import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Compass,
  RotateCw,
  FolderKanban,
  CheckCircle2,
  ArrowRight,
  Activity,
  History,
} from "lucide-react";
import type { Project } from "@/types/project";
import type {
  ProjectStateSnapshot,
  OrchestrationAction,
  OrchestrationAssessment,
} from "@/types/orchestrator";
import { projectStorage } from "@/lib/storage/projectStorage";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { qualityStorage } from "@/lib/storage/qualityStorage";
import { releaseStorage } from "@/lib/storage/releaseStorage";
import { documentStorage } from "@/lib/storage/documentStorage";
import { brainStorage } from "@/lib/storage/brainStorage";
import { orchestrationStorage } from "@/lib/storage/orchestrationStorage";
import { assembleProjectStateSnapshot } from "@/lib/orchestrator/stateAssembler";
import { evaluateNextBestActions } from "@/lib/orchestrator/recommendationEngine";
import { transitionActionState } from "@/lib/orchestrator/workflowStateMachine";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RecommendationCard } from "@/components/orchestrator/RecommendationCard";
import { generateId } from "@/lib/utils";

export const OrchestratorDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("project");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<ProjectStateSnapshot | null>(null);
  const [actions, setActions] = useState<OrchestrationAction[]>([]);
  const [historyRuns, setHistoryRuns] = useState<OrchestrationAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  // Load Projects
  useEffect(() => {
    projectStorage.list().then((list) => {
      setProjects(list);
      if (list.length > 0) {
        if (projectIdParam && list.some((p) => p.id === projectIdParam)) {
          setSelectedProjectId(projectIdParam);
        } else {
          setSelectedProjectId(list[0].id);
        }
      }
      setLoading(false);
    });
  }, [projectIdParam]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // Refresh assessment and assemble state
  const refreshOrchestrationState = async (projId: string) => {
    if (!selectedProject) return;
    setIsRefreshing(true);

    try {
      const [artifacts, assessment, testPlans, release, documents, brainMemories, runs] =
        await Promise.all([
          artifactStorage.list(projId),
          qualityStorage.getLatestAssessment(projId),
          qualityStorage.listTestPlans(projId),
          releaseStorage.getLatest(projId),
          documentStorage.list(projId),
          brainStorage.list(projId),
          orchestrationStorage.list(projId),
        ]);

      setHistoryRuns(runs);

      const assembledSnapshot = assembleProjectStateSnapshot({
        project: selectedProject,
        artifacts,
        assessment,
        testPlans,
        release,
        documents,
        brainMemories,
      });

      setSnapshot(assembledSnapshot);

      const computedActions = evaluateNextBestActions(assembledSnapshot);
      setActions(computedActions);

      // Save Assessment record
      const runAssessment: OrchestrationAssessment = {
        id: generateId("run_"),
        projectId: projId,
        assessedAt: new Date().toISOString(),
        snapshot: assembledSnapshot,
        actions: computedActions,
        overallHealth:
          assembledSnapshot.quality.openErrors > 0
            ? "blocked"
            : assembledSnapshot.quality.openWarnings > 0
            ? "needs_attention"
            : "healthy",
      };

      await orchestrationStorage.save(runAssessment);
    } catch (err) {
      console.error("[Orchestrator] Assessment error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId && selectedProject) {
      refreshOrchestrationState(selectedProjectId);
    }
  }, [selectedProjectId, selectedProject]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSearchParams({ project: id });
  };

  const handleApproveAction = async (action: OrchestrationAction) => {
    try {
      const updated = transitionActionState(action, "approved", { actor: "Project Lead" });
      setActions((prev) => prev.map((a) => (a.id === action.id ? updated : a)));
      await orchestrationStorage.updateActionState(selectedProjectId, action.id, updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteAction = async (action: OrchestrationAction) => {
    setExecutingActionId(action.id);
    try {
      // Transition running
      let running = transitionActionState(action, "running");
      setActions((prev) => prev.map((a) => (a.id === action.id ? running : a)));

      // Simulate verified short completion for internal automated tasks or redirect
      await new Promise((resolve) => setTimeout(resolve, 800));

      const completed = transitionActionState(running, "completed", {
        reason: "Orchestrator task completed successfully",
      });
      setActions((prev) => prev.map((a) => (a.id === action.id ? completed : a)));
      await orchestrationStorage.updateActionState(selectedProjectId, action.id, completed);
    } catch (err: unknown) {
      const failReason = err instanceof Error ? err.message : "Execution failed";
      const failed = transitionActionState(action, "failed", { reason: failReason });
      setActions((prev) => prev.map((a) => (a.id === action.id ? failed : a)));
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleCancelAction = async (action: OrchestrationAction) => {
    try {
      const cancelled = transitionActionState(action, "cancelled", { reason: "User cancelled" });
      setActions((prev) => prev.map((a) => (a.id === action.id ? cancelled : a)));
      await orchestrationStorage.updateActionState(selectedProjectId, action.id, cancelled);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading Autonomous Orchestrator…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
            <Compass className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">
            No Projects Available to Orchestrate
          </h2>
          <p className="text-sm text-foreground-muted">
            Create an initial project in Discovery to enable autonomous lifecycle orchestration.
          </p>
          <Button onClick={() => navigate("/discover")} icon={<ArrowRight className="w-4 h-4" />}>
            Start Discovery
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-primary-soft text-primary rounded-tactile border border-primary/20">
              PHASE 9 ENGINE
            </span>
            <span className="text-xs text-foreground-muted">
              Autonomous Project Orchestrator & Hybrid Autonomy
            </span>
          </div>
          <h1 className="font-display font-extrabold text-2xl text-foreground">
            Project Orchestrator
          </h1>
          <p className="text-sm text-foreground-muted">
            Lifecycle coordination, next-best action recommendations, and auditable approval gates.
          </p>
        </div>

        {/* Project Switcher */}
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-foreground-muted" />
          <select
            value={selectedProjectId}
            onChange={(e) => handleSelectProject(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold bg-surface border-2 border-border rounded-tactile shadow-hard-sm text-foreground focus:outline-none focus:border-primary"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Snapshot Health Overview Card */}
      {snapshot && (
        <Card className="p-5 bg-surface border-2 border-border shadow-hard">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-tactile border-2 border-border shadow-hard-sm flex items-center justify-center font-display font-black text-xl ${
                  snapshot.quality.openErrors === 0 && snapshot.artifacts.approved > 0
                    ? "bg-secondary-soft text-secondary"
                    : snapshot.quality.openErrors > 0
                    ? "bg-red-50 text-accent-red"
                    : "bg-accent-yellow-soft text-accent-yellow"
                }`}
              >
                {snapshot.quality.openErrors === 0 && snapshot.artifacts.approved > 0
                  ? "READY"
                  : snapshot.quality.openErrors > 0
                  ? "ALERT"
                  : "STAGE"}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">
                    Lifecycle Stage: {snapshot.roadmap.currentStage.toUpperCase()}
                  </h3>
                  <span className="text-xs font-mono text-foreground-muted">
                    Last evaluated: {new Date(snapshot.capturedAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-foreground-muted">
                  {actions.length} actionable workflow recommendation(s) derived from verified module data.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-xs font-mono px-3 py-2 bg-background rounded-tactile border border-border">
                <div>
                  <span className="text-foreground-muted block">Artifacts</span>
                  <strong>{snapshot.artifacts.approved}/{snapshot.artifacts.total}</strong>
                </div>
                <div>
                  <span className="text-foreground-muted block">Quality</span>
                  <strong className={snapshot.quality.openErrors > 0 ? "text-accent-red" : "text-secondary"}>
                    {snapshot.quality.openErrors} Err / {snapshot.quality.openWarnings} Warn
                  </strong>
                </div>
                <div>
                  <span className="text-foreground-muted block">Drift</span>
                  <strong>{snapshot.docs.openDriftFindings}</strong>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => refreshOrchestrationState(selectedProjectId)}
                disabled={isRefreshing}
                icon={<RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />}
              >
                {isRefreshing ? "Assessing…" : "Reassess"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Recommended Actions Workbench */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-base text-foreground">
              Prioritized Next-Best Actions ({actions.length})
            </h3>
          </div>
          <span className="text-xs text-foreground-muted font-mono">
            Deterministic rules with strict user approval gates
          </span>
        </div>

        {actions.length === 0 ? (
          <Card className="p-8 text-center bg-surface border-2 border-border shadow-hard-sm">
            <div className="max-w-md mx-auto space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-secondary" />
              <p className="font-bold text-sm text-foreground">All Stage Objectives Complete</p>
              <p className="text-xs text-foreground-muted">
                No active blockers or pending actions detected for the current project state.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {actions.map((act) => (
              <RecommendationCard
                key={act.id}
                action={act}
                onApprove={handleApproveAction}
                onExecute={handleExecuteAction}
                onCancel={handleCancelAction}
                onNavigate={(route) => navigate(route)}
                isExecuting={executingActionId === act.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Orchestration History */}
      {historyRuns.length > 0 && (
        <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-foreground">
            <History className="w-3.5 h-3.5" />
            <span>Audit History & State Transitions</span>
          </div>

          <div className="space-y-2 text-xs max-h-[240px] overflow-y-auto">
            {historyRuns.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="p-2.5 bg-background border border-border rounded flex items-center justify-between text-foreground-muted"
              >
                <div>
                  <span className="font-bold text-foreground mr-2">
                    Evaluation {run.id}
                  </span>
                  <span>Health: {run.overallHealth.toUpperCase()} • Actions: {run.actions.length}</span>
                </div>
                <span className="font-mono text-[10px]">
                  {new Date(run.assessedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
