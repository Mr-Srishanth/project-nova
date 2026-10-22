import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  AlertOctagon,
  Circle,
} from "lucide-react";
import type { StageDefinition, StageStatus, LifecycleStageId } from "@/types/roadmap";
import type { StageStatusResult } from "@/lib/roadmap/stageEngine";
import { Badge } from "@/components/ui/Badge";

interface StagePipelineProps {
  stages: StageDefinition[];
  activeStageId: string;
  stageStatuses: Record<string, StageStatusResult>;
  onSelectStage: (stageId: LifecycleStageId) => void;
}

const STATUS_ICONS: Record<StageStatus, React.ReactNode> = {
  completed: <CheckCircle2 className="w-4 h-4 text-primary" />,
  in_progress: <Clock className="w-4 h-4 text-accent-blue" />,
  blocked: <AlertOctagon className="w-4 h-4 text-danger" />,
  not_started: <Circle className="w-4 h-4 text-foreground-muted/60" />,
};

const STATUS_BADGE_VARIANTS: Record<StageStatus, "primary" | "blue" | "danger" | "muted"> = {
  completed: "primary",
  in_progress: "blue",
  blocked: "danger",
  not_started: "muted",
};

export const StagePipeline: React.FC<StagePipelineProps> = ({
  stages,
  activeStageId,
  stageStatuses,
  onSelectStage,
}) => {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
          Autonomous Lifecycle Pipeline (7 Stages)
        </span>
        <span className="text-[11px] font-mono text-foreground-muted hidden sm:inline">Interactive Stage Map</span>
      </div>

      {/* Responsive stage pipeline with clean grid on desktop and smooth horizontal scroll on narrow screens */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1 select-none">
        {stages.map((stage) => {
          const isSelected = stage.id === activeStageId;
          const statusInfo = stageStatuses[stage.id] || {
            status: "not_started",
            totalTasks: 0,
            completedTasks: 0,
            blockedTasks: 0,
            percent: 0,
            hasTasks: false,
          };

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              className={`text-left p-3 rounded-tactile border-2 transition-all relative flex flex-col justify-between min-h-[140px] ${
                isSelected
                  ? "bg-surface border-foreground shadow-hard-lg -translate-y-[2px]"
                  : "bg-[#FAF7ED] border-border/70 hover:bg-surface hover:border-border shadow-hard-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  <span className="text-[10px] font-mono font-bold text-foreground-muted uppercase">
                    0{stage.order}
                  </span>
                  <div className="flex items-center gap-1">
                    {statusInfo.manualOverride && (
                      <span className="text-[8px] bg-amber-200 text-amber-900 font-bold px-1 rounded">OVR</span>
                    )}
                    <Badge variant={STATUS_BADGE_VARIANTS[statusInfo.status]}>
                      {statusInfo.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <h4 className="font-display font-bold text-xs text-foreground leading-snug line-clamp-1" title={stage.name}>
                  {stage.name.replace(/^\d+\.\s*/, "")}
                </h4>
                <p className="text-[10px] font-sans text-foreground-muted mt-0.5 line-clamp-2" title={stage.shortDesc}>
                  {stage.shortDesc}
                </p>
              </div>

              {/* Progress bar per stage */}
              <div className="pt-2 mt-2 border-t border-border/10">
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-foreground-muted flex items-center gap-1">
                    {STATUS_ICONS[statusInfo.status]}
                    <span>{statusInfo.percent}%</span>
                  </span>
                  <span className="text-foreground font-semibold">
                    {statusInfo.hasTasks ? (
                      `${statusInfo.completedTasks}/${statusInfo.totalTasks}`
                    ) : (
                      <span className="text-foreground-muted font-normal text-[9px]">
                        {statusInfo.status === "completed" ? "Deliverables" : "No tasks"}
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-border/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 rounded-full"
                    style={{ width: `${statusInfo.percent}%` }}
                  />
                </div>
              </div>

              {isSelected && (
                <motion.div
                  layoutId="active-stage-indicator"
                  className="absolute -bottom-1 left-4 right-4 h-0.5 bg-foreground rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
