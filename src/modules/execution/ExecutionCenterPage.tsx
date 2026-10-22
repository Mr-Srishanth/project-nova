import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Cpu,
  FolderKanban,
  ArrowRight,
} from "lucide-react";
import type { Project } from "@/types/project";
import type {
  ExecutionPlan,
  ExecutionStep,
  AutomationSchedule,
  ExecutionRunRecord,
  ScheduleRecurrence,
} from "@/types/execution";
import { projectStorage } from "@/lib/storage/projectStorage";
import { executionStorage } from "@/lib/storage/executionStorage";
import { executeRegisteredAction } from "@/lib/execution/actionExecutor";
import { areStepDependenciesSatisfied } from "@/lib/execution/planEngine";
import { computeNextRunTimestamp } from "@/lib/execution/schedulerEngine";
import { generateApprovalToken } from "@/lib/execution/capabilityRegistry";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ExecutionPlanDetail } from "@/components/execution/ExecutionPlanDetail";
import { SchedulerTab } from "@/components/execution/SchedulerTab";
import { generateId } from "@/lib/utils";

export const ExecutionCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("project");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [plans, setPlans] = useState<ExecutionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<AutomationSchedule[]>([]);
  const [runs, setRuns] = useState<ExecutionRunRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"plans" | "schedules" | "runs">("plans");
  const [loading, setLoading] = useState(true);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

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

  // Load execution records for active project
  useEffect(() => {
    if (!selectedProjectId || !selectedProject) {
      setPlans([]);
      setSchedules([]);
      setRuns([]);
      return;
    }

    Promise.all([
      executionStorage.listPlans(selectedProjectId),
      executionStorage.listSchedules(selectedProjectId),
      executionStorage.listRunRecords(selectedProjectId),
    ]).then(async ([storedPlans, storedSchedules, storedRuns]) => {
      setSchedules(storedSchedules);
      setRuns(storedRuns);

      if (storedPlans.length === 0) {
        // Initialize default continuous integration & quality plan
        const planId = generateId("plan_");
        const step1Id = generateId("stp_");
        const step2Id = generateId("stp_");
        const step3Id = generateId("stp_");

        const defaultPlan: ExecutionPlan = {
          id: planId,
          projectId: selectedProjectId,
          title: "Continuous Quality & Health Pipeline",
          description: "Automated sequential execution: state refresh -> static analysis -> drift calculation",
          status: "ready",
          steps: [
            {
              id: step1Id,
              planId,
              order: 1,
              title: "Evaluate Project State & Recommendations",
              description: "Normalizes project data across modules and calculates next steps",
              actionType: "refresh_state_assessment",
              parameters: { projectId: selectedProjectId },
              dependencies: [],
              requiresApproval: false,
              status: "ready",
              retryCount: 0,
              maxRetries: 2,
            },
            {
              id: step2Id,
              planId,
              order: 2,
              title: "Execute Code Artifact Static Analysis",
              description: "Scans Build Studio files for defects, broken imports, and plain secrets",
              actionType: "run_static_analysis",
              parameters: { projectId: selectedProjectId },
              dependencies: [step1Id],
              requiresApproval: false,
              status: "ready",
              retryCount: 0,
              maxRetries: 2,
            },
            {
              id: step3Id,
              planId,
              order: 3,
              title: "Synchronize Living Documentation Drift",
              description: "Checks documentation against updated source artifacts and endpoints",
              actionType: "recalculate_doc_drift",
              parameters: { projectId: selectedProjectId },
              dependencies: [step2Id],
              requiresApproval: false,
              status: "ready",
              retryCount: 0,
              maxRetries: 2,
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const savedPlan = await executionStorage.savePlan(defaultPlan);
        setPlans([savedPlan]);
        setSelectedPlanId(savedPlan.id);
      } else {
        setPlans(storedPlans);
        if (!selectedPlanId || !storedPlans.some((p) => p.id === selectedPlanId)) {
          setSelectedPlanId(storedPlans[0].id);
        }
      }
    });
  }, [selectedProjectId, selectedProject]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || plans[0] || null,
    [plans, selectedPlanId]
  );

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSelectedPlanId(null);
    setSearchParams({ project: id });
  };

  const handleApproveStep = async (step: ExecutionStep) => {
    if (!activePlan) return;
    const token = generateApprovalToken(step.actionType, step.parameters);
    const updatedStep: ExecutionStep = {
      ...step,
      status: "ready",
      approvedBy: "QA Officer",
      approvedAt: new Date().toISOString(),
      approvalToken: token,
    };

    const updatedSteps = activePlan.steps.map((s) => (s.id === step.id ? updatedStep : s));
    const updatedPlan = await executionStorage.savePlan({
      ...activePlan,
      steps: updatedSteps,
    });

    setPlans((prev) => prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p)));
  };

  const handleExecuteStep = async (step: ExecutionStep) => {
    if (!activePlan || !selectedProject) return;

    // Check prerequisites
    if (!areStepDependenciesSatisfied(step, activePlan.steps)) {
      alert(`Prerequisite dependencies for step "${step.title}" are not yet completed.`);
      return;
    }

    const startTimestamp = Date.now();
    const runId = generateId("run_rec_");

    // Mark running
    const runningStep: ExecutionStep = { ...step, status: "running", startedAt: new Date().toISOString() };
    let currentSteps = activePlan.steps.map((s) => (s.id === step.id ? runningStep : s));
    await executionStorage.savePlan({ ...activePlan, steps: currentSteps });
    setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? { ...p, steps: currentSteps } : p)));

    // Execute actual registered action
    const outcome = await executeRegisteredAction(step.actionType, step.parameters, {
      approvedToken: step.approvalToken,
    });

    const finishTime = Date.now();
    const completedStep: ExecutionStep = {
      ...step,
      status: outcome.success ? "completed" : "failed",
      completedAt: new Date().toISOString(),
      resultSummary: outcome.resultSummary,
      failureReason: outcome.failureReason,
      retryCount: outcome.success ? step.retryCount : step.retryCount + 1,
    };

    currentSteps = activePlan.steps.map((s) => (s.id === step.id ? completedStep : s));
    const savedPlan = await executionStorage.savePlan({
      ...activePlan,
      steps: currentSteps,
      status: currentSteps.every((s) => s.status === "completed") ? "completed" : "ready",
    });

    // Record execution run log
    const runRecord: ExecutionRunRecord = {
      id: runId,
      projectId: selectedProject.id,
      planId: activePlan.id,
      stepId: step.id,
      actionType: step.actionType,
      status: outcome.success ? "completed" : "failed",
      startedAt: new Date(startTimestamp).toISOString(),
      completedAt: new Date(finishTime).toISOString(),
      durationMs: finishTime - startTimestamp,
      resultSummary: outcome.resultSummary,
      failureReason: outcome.failureReason,
      retryAttempt: step.retryCount,
      approvedBy: step.approvedBy,
    };

    await executionStorage.saveRunRecord(runRecord);
    const updatedRuns = await executionStorage.listRunRecords(selectedProject.id);

    setPlans((prev) => prev.map((p) => (p.id === savedPlan.id ? savedPlan : p)));
    setRuns(updatedRuns);
  };

  const handleExecuteAllSteps = async () => {
    if (!activePlan || !selectedProject) return;
    setIsRunningPipeline(true);

    for (const step of activePlan.steps) {
      if (step.status === "completed") continue;
      if (!areStepDependenciesSatisfied(step, activePlan.steps)) break;
      await handleExecuteStep(step);
    }

    setIsRunningPipeline(false);
  };

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    const nextRun = enabled ? computeNextRunTimestamp(target.recurrence) : undefined;
    const updated = await executionStorage.saveSchedule({
      ...target,
      enabled,
      nextRunAt: nextRun,
    });

    setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleTriggerScheduleNow = async (sch: AutomationSchedule) => {
    if (activePlan) {
      await handleExecuteAllSteps();
      const updated = await executionStorage.saveSchedule({
        ...sch,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: "completed",
        nextRunAt: computeNextRunTimestamp(sch.recurrence),
      });
      setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    }
  };

  const handleCreateSchedule = async (title: string, recurrence: ScheduleRecurrence) => {
    if (!selectedProject || !activePlan) return;
    const newSch: AutomationSchedule = {
      id: generateId("sch_"),
      projectId: selectedProject.id,
      planId: activePlan.id,
      title,
      recurrence,
      enabled: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      nextRunAt: computeNextRunTimestamp(recurrence),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await executionStorage.saveSchedule(newSch);
    setSchedules((prev) => [saved, ...prev]);
  };

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading Execution Center…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
            <Cpu className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">
            No Projects Available for Automation
          </h2>
          <p className="text-sm text-foreground-muted">
            Create an initial project to manage continuous execution plans and automation schedules.
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
              PHASE 10 ENGINE
            </span>
            <span className="text-xs text-foreground-muted">
              Execution Intelligence & Active-Session Scheduler
            </span>
          </div>
          <h1 className="font-display font-extrabold text-2xl text-foreground">
            Execution Center
          </h1>
          <p className="text-sm text-foreground-muted">
            Deterministic pipeline plans, active-session schedulers, parameter-bound approval gates, and execution audit history.
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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-border/20 pb-2">
        <button
          onClick={() => setActiveTab("plans")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "plans"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Execution Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("schedules")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "schedules"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Session Scheduler ({schedules.length})
        </button>
        <button
          onClick={() => setActiveTab("runs")}
          className={`px-4 py-2 text-xs font-bold rounded-tactile transition-all ${
            activeTab === "runs"
              ? "bg-primary text-primary-foreground shadow-hard-sm"
              : "bg-surface text-foreground hover:bg-background border border-border"
          }`}
        >
          Run History ({runs.length})
        </button>
      </div>

      {/* Tab 1: Execution Plans */}
      {activeTab === "plans" && activePlan && (
        <ExecutionPlanDetail
          plan={activePlan}
          onExecuteStep={handleExecuteStep}
          onApproveStep={handleApproveStep}
          onExecuteAllSteps={handleExecuteAllSteps}
          isRunningPlan={isRunningPipeline}
        />
      )}

      {/* Tab 2: Scheduler */}
      {activeTab === "schedules" && (
        <SchedulerTab
          schedules={schedules}
          onToggleSchedule={handleToggleSchedule}
          onTriggerNow={handleTriggerScheduleNow}
          onCreateSchedule={handleCreateSchedule}
          isTriggering={isRunningPipeline}
        />
      )}

      {/* Tab 3: Run History */}
      {activeTab === "runs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-foreground">Audit Log & Verified Execution Records</h4>
            <span className="text-xs font-mono text-foreground-muted">Secrets redacted</span>
          </div>

          {runs.length === 0 ? (
            <Card className="p-8 text-center bg-surface border-2 border-border shadow-hard-sm text-foreground-muted text-xs">
              No executions recorded yet. Run a step from Execution Plans to generate audit history.
            </Card>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <Card
                  key={r.id}
                  className="p-3 bg-surface border-2 border-border rounded-tactile shadow-hard-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                          r.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-red-50 text-red-700 border-red-300"
                        }`}
                      >
                        {r.status.toUpperCase()}
                      </span>
                      <span className="font-mono text-foreground font-bold">{r.actionType}</span>
                      <span className="text-foreground-muted font-mono text-[10px]">({r.durationMs || 0}ms)</span>
                    </div>
                    <p className="text-foreground-muted">{r.resultSummary}</p>
                    {r.failureReason && (
                      <p className="text-accent-red font-mono text-[11px]">Reason: {r.failureReason}</p>
                    )}
                  </div>

                  <div className="text-right font-mono text-[10px] text-foreground-muted shrink-0">
                    <div>{new Date(r.startedAt).toLocaleString()}</div>
                    {r.approvedBy && <div>Approved by: {r.approvedBy}</div>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
