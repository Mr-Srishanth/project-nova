import React from "react";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCw,
  ShieldCheck,
  Lock,
} from "lucide-react";
import type { ExecutionPlan, ExecutionStep, ExecutionStepStatus } from "@/types/execution";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ExecutionPlanDetailProps {
  plan: ExecutionPlan;
  onExecuteStep: (step: ExecutionStep, stepsOverride?: ExecutionStep[]) => Promise<ExecutionStep[] | undefined>;
  onApproveStep: (step: ExecutionStep) => Promise<void>;
  onExecuteAllSteps: () => Promise<boolean>;
  isRunningPlan: boolean;
}

const STEP_STATUS_CONFIG: Record<
  ExecutionStepStatus,
  { label: string; bg: string; icon: React.ReactNode }
> = {
  draft: { label: "DRAFT", bg: "bg-surface-subtle text-foreground-muted", icon: <Clock className="w-3.5 h-3.5" /> },
  awaiting_approval: { label: "APPROVAL NEEDED", bg: "bg-amber-100 text-amber-900 border border-amber-300", icon: <Lock className="w-3.5 h-3.5 text-amber-700" /> },
  ready: { label: "READY", bg: "bg-emerald-50 text-emerald-800 border border-emerald-300", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> },
  running: { label: "RUNNING", bg: "bg-blue-100 text-blue-900 border border-blue-300 animate-pulse", icon: <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> },
  completed: { label: "COMPLETED", bg: "bg-emerald-100 text-emerald-900 border border-emerald-300", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> },
  failed: { label: "FAILED", bg: "bg-red-100 text-red-900 border border-red-300", icon: <XCircle className="w-3.5 h-3.5 text-red-600" /> },
  blocked: { label: "BLOCKED", bg: "bg-amber-50 text-amber-900 border border-amber-300", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> },
  cancelled: { label: "CANCELLED", bg: "bg-surface-subtle text-foreground-muted", icon: <XCircle className="w-3.5 h-3.5" /> },
};

export const ExecutionPlanDetail: React.FC<ExecutionPlanDetailProps> = ({
  plan,
  onExecuteStep,
  onApproveStep,
  onExecuteAllSteps,
  isRunningPlan,
}) => {
  const completedSteps = plan.steps.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-4">
      {/* Plan Header Card */}
      <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-extrabold text-base text-foreground">
              {plan.title}
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-secondary-soft text-secondary rounded">
              STATUS: {plan.status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-foreground-muted">
            {plan.description} • Progress: {completedSteps}/{plan.steps.length} steps completed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onExecuteAllSteps}
            disabled={isRunningPlan || plan.steps.length === 0}
            icon={<Play className="w-3.5 h-3.5" />}
          >
            {isRunningPlan ? "Executing Plan…" : "Run Plan Pipeline"}
          </Button>
        </div>
      </Card>

      {/* Ordered Steps Sequence */}
      <div className="space-y-3">
        {plan.steps.map((step, idx) => {
          const cfg = STEP_STATUS_CONFIG[step.status];

          return (
            <Card
              key={step.id}
              className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded flex items-center gap-1 ${cfg.bg}`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded text-foreground-muted">
                      {step.actionType}
                    </span>
                    {step.requiresApproval && !step.approvedBy && (
                      <span className="text-[10px] font-mono text-accent-red font-bold">
                        [APPROVAL MANDATORY]
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-sm text-foreground">{step.title}</h4>
                  <p className="text-xs text-foreground-muted leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Step controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {step.requiresApproval && !step.approvedBy &&
                    (step.status === "awaiting_approval" || step.status === "ready" || step.status === "failed") && (
                    <Button size="sm" onClick={() => onApproveStep(step)}>
                      Approve Step
                    </Button>
                  )}
                  {(step.status === "ready" || step.status === "failed") && (
                    <Button
                      size="sm"
                      disabled={isRunningPlan}
                      onClick={() => onExecuteStep(step)}
                      icon={<Play className="w-3.5 h-3.5" />}
                    >
                      {step.status === "failed" ? "Retry Step" : "Execute"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Execution Outcome or Failure Alert */}
              {step.resultSummary && (
                <div className="p-2.5 bg-background border border-border rounded text-xs font-mono text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                  <span>{step.resultSummary}</span>
                </div>
              )}

              {step.failureReason && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded text-xs font-mono text-red-800 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Failure: {step.failureReason}</span>
                </div>
              )}

              {/* Approval Info */}
              {step.approvedBy && (
                <div className="text-[10px] font-mono text-foreground-muted flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                  <span>Approved by {step.approvedBy} at {new Date(step.approvedAt!).toLocaleTimeString()}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
