import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  GitFork,
  Plus,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  FolderKanban,
} from "lucide-react";
import type { RoadmapMilestone, LifecycleStageId } from "@/types/roadmap";
import type { ProjectMemory } from "@/types/memory";
import { brainStorage } from "@/lib/storage/brainStorage";
import {
  LIFECYCLE_STAGES,
  STAGE_WORKSPACE_MAPPING,
  calculateStageStatuses,
  migrateLegacyMilestones,
} from "@/lib/roadmap/stageEngine";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StagePipeline } from "@/components/roadmap/StagePipeline";
import { InteractiveRoadmap } from "@/components/roadmap/InteractiveRoadmap";
import { CompactProjectIndicator } from "@/components/common/CompactProjectIndicator";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";

export const VisualFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const stageIdParam = searchParams.get("stage") as LifecycleStageId | null;
  const { activeProject: selectedProject, projects, loading, updateActiveProject } = useActiveProject();
  const selectedProjectId = selectedProject?.id || "";

  // Active Stage in the Stage Pipeline
  const [activeStageId, setActiveStageId] = useState<LifecycleStageId>(() => {
    return stageIdParam && LIFECYCLE_STAGES.some((s) => s.id === stageIdParam)
      ? stageIdParam
      : "discovery";
  });
  const [memories, setMemories] = useState<ProjectMemory[]>([]);

  useEffect(() => {
    if (!selectedProjectId) {
      setMemories([]);
      return;
    }
    let isMounted = true;
    brainStorage.list(selectedProjectId).then((mems) => {
      if (isMounted) setMemories(mems);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const handleSelectStage = (stageId: LifecycleStageId) => {
    setActiveStageId(stageId);
    if (selectedProjectId) {
      setSearchParams({ project: selectedProjectId, stage: stageId });
    }
  };

  const handleUpdateMilestones = async (updatedMilestones: RoadmapMilestone[]) => {
    if (!selectedProject) return;

    // Strict project isolation: ensure all tasks and milestones match selectedProject.id
    const sanitizedMilestones = updatedMilestones.map((m) => ({
      ...m,
      projectId: selectedProject.id,
      tasks: (m.tasks || []).map((t) => ({
        ...t,
        milestoneId: m.id,
      })),
    }));

    await updateActiveProject({
      roadmapMilestones: sanitizedMilestones,
    });
  };

  if (loading) {
    return (
      <div className="p-16 text-center border-2 border-border rounded-tactile bg-surface shadow-hard">
        <p className="text-sm font-mono text-foreground-muted">Loading Visual Project Flow & Roadmap…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="text-center py-16 bg-surface shadow-hard">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto rounded-tactile bg-accent-yellow-soft border-2 border-border flex items-center justify-center shadow-hard-sm">
            <GitFork className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">
            No Projects Available for Flow Tracking
          </h2>
          <p className="text-sm text-foreground-muted">
            Create a project first to initialize its visual lifecycle stages and task dependency roadmap.
          </p>
          <Button onClick={() => navigate("/discover")} icon={<Plus className="w-4 h-4" />}>
            Create Project Now
          </Button>
        </div>
      </Card>
    );
  }

  if (!selectedProject) return null;

  // Derive stage statuses
  const stageStatuses = calculateStageStatuses(selectedProject);
  const currentStageDef = LIFECYCLE_STAGES.find((s) => s.id === activeStageId) || LIFECYCLE_STAGES[0];

  // Resolve milestones (supporting legacy migration)
  const activeMilestones =
    selectedProject.roadmapMilestones && selectedProject.roadmapMilestones.length > 0
      ? selectedProject.roadmapMilestones
      : migrateLegacyMilestones(selectedProject.milestones);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b-2 border-border/10">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Visual Project Flow & Roadmap
          </h1>
          <p className="text-xs md:text-sm font-sans text-foreground-muted">
            Interactive multi-stage pipeline, task dependency enforcement, and Project Brain alignment.
          </p>
        </div>

        {/* Global Project Indicator */}
        <div className="w-full sm:w-auto">
          <CompactProjectIndicator />
        </div>
      </div>

      {/* 1. Stage Pipeline Engine */}
      <Card className="bg-surface border-2 border-border shadow-hard p-5 space-y-4">
        <StagePipeline
          stages={LIFECYCLE_STAGES}
          activeStageId={activeStageId}
          stageStatuses={stageStatuses}
          onSelectStage={handleSelectStage}
        />

        {/* Selected Stage Detail Drawer */}
        <div className="p-4 bg-[#FAF7ED] border-2 border-border rounded-tactile space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm text-foreground">
                  {currentStageDef.name}
                </span>
                <Badge variant={stageStatuses[currentStageDef.id]?.status === "completed" ? "primary" : stageStatuses[currentStageDef.id]?.status === "blocked" ? "danger" : "blue"}>
                  {stageStatuses[currentStageDef.id]?.status.replace("_", " ").toUpperCase()}
                </Badge>
                {stageStatuses[currentStageDef.id]?.manualOverride && (
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                    Manual Override Active
                  </span>
                )}
              </div>
              <p className="text-xs font-sans text-foreground mt-0.5">{currentStageDef.description}</p>
              {stageStatuses[currentStageDef.id]?.blockedReason && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-danger font-semibold bg-danger/10 px-2 py-0.5 rounded border border-danger/20">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{stageStatuses[currentStageDef.id]?.blockedReason}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/projects/${selectedProject.id}`)}
                icon={<FolderKanban className="w-3.5 h-3.5" />}
              >
                Project Overview
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const targetWorkspace = STAGE_WORKSPACE_MAPPING[currentStageDef.id];
                  if (targetWorkspace) {
                    navigate(targetWorkspace.path(selectedProject.id));
                  } else {
                    navigate(`/projects/${selectedProject.id}`);
                  }
                }}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                Open {STAGE_WORKSPACE_MAPPING[currentStageDef.id]?.label || "Workspace"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/20">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-foreground-muted block mb-1">
                Expected Deliverables
              </span>
              <ul className="space-y-1 text-xs font-sans">
                {currentStageDef.deliverables.map((d, i) => {
                  const stageResult = stageStatuses[currentStageDef.id];
                  const isSatisfied = stageResult?.satisfiedDeliverables?.includes(d) ?? false;
                  return (
                    <li key={i} className="flex items-center gap-1.5 text-foreground">
                      <CheckCircle2
                        className={`w-3 h-3 shrink-0 ${
                          isSatisfied ? "text-primary" : "text-foreground-muted/40"
                        }`}
                      />
                      <span className={isSatisfied ? "text-foreground font-medium" : "text-foreground-muted"}>
                        {d} {isSatisfied ? "(Satisfied)" : "(Pending)"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-foreground-muted block mb-1">
                Stage Target Workspace & Tools
              </span>
              <div className="space-y-1 mb-2 text-xs">
                <div className="font-semibold text-foreground">
                  {STAGE_WORKSPACE_MAPPING[currentStageDef.id]?.label}
                </div>
                <div className="text-[11px] text-foreground-muted">
                  {STAGE_WORKSPACE_MAPPING[currentStageDef.id]?.description}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {currentStageDef.suggestedTools.map((tool, i) => (
                  <Badge key={i} variant="muted">{tool}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Interactive Roadmap & Milestone View */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            Milestone Schedule & Task Dependency Matrix
          </span>
          <span className="text-[11px] font-mono text-foreground-muted">
            Cycle detection active • Persistent state
          </span>
        </div>

        <InteractiveRoadmap
          milestones={activeMilestones}
          memories={memories}
          onUpdateMilestones={handleUpdateMilestones}
        />
      </div>
    </div>
  );
};
