import React from "react";
import {
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
} from "lucide-react";
import type { OrchestrationAction, ActionRiskLevel, OperationState } from "@/types/orchestrator";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface RecommendationCardProps {
  action: OrchestrationAction;
  onApprove: (action: OrchestrationAction) => Promise<void>;
  onExecute: (action: OrchestrationAction) => Promise<void>;
  onCancel: (action: OrchestrationAction) => Promise<void>;
  onNavigate: (route: string) => void;
  isExecuting?: boolean;
}

const RISK_BADGES: Record<
  ActionRiskLevel,
  { label: string; bg: string; icon: React.ReactNode }
> = {
  critical: {
    label: "CRITICAL RISK",
    bg: "bg-red-50 text-red-700 border-red-300",
    icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
  },
  high: {
    label: "HIGH RISK",
    bg: "bg-amber-50 text-amber-700 border-amber-300",
    icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />,
  },
  medium: {
    label: "MEDIUM RISK",
    bg: "bg-blue-50 text-blue-700 border-blue-300",
    icon: <Clock className="w-3.5 h-3.5 text-blue-600" />,
  },
  low: {
    label: "LOW RISK",
    bg: "bg-emerald-50 text-emerald-700 border-emerald-300",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  },
};

const STATE_BADGES: Record<OperationState, { label: string; class: string }> = {
  proposed: { label: "RECOMMENDED", class: "bg-surface-subtle text-foreground-muted" },
  awaiting_approval: { label: "AWAITING APPROVAL", class: "bg-amber-100 text-amber-900 border border-amber-300" },
  approved: { label: "APPROVED", class: "bg-emerald-100 text-emerald-900 border border-emerald-300" },
  running: { label: "RUNNING", class: "bg-blue-100 text-blue-900 animate-pulse" },
  completed: { label: "COMPLETED", class: "bg-emerald-50 text-emerald-700" },
  failed: { label: "FAILED", class: "bg-red-50 text-red-700" },
  cancelled: { label: "CANCELLED", class: "bg-surface-subtle text-foreground-muted" },
  blocked: { label: "BLOCKED", class: "bg-amber-50 text-amber-700" },
};

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  action,
  onApprove,
  onExecute,
  onCancel,
  onNavigate,
  isExecuting = false,
}) => {
  const riskBadge = RISK_BADGES[action.riskLevel];
  const stateBadge = STATE_BADGES[action.status];

  return (
    <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border flex items-center gap-1 ${riskBadge.bg}`}
            >
              {riskBadge.icon}
              {riskBadge.label}
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${stateBadge.class}`}
            >
              {stateBadge.label}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded text-foreground-muted uppercase">
              Target: {action.targetModule}
            </span>
            {action.requiresApproval && (
              <span className="text-[10px] font-mono text-accent-red font-bold">
                [APPROVAL REQUIRED]
              </span>
            )}
          </div>

          <h4 className="font-bold text-sm text-foreground">{action.title}</h4>
          <p className="text-xs text-foreground-muted leading-relaxed">
            {action.description}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {action.status === "proposed" && action.requiresApproval && (
            <Button size="sm" onClick={() => onApprove(action)}>
              Authorize Action
            </Button>
          )}

          {action.status === "approved" && (
            <Button
              size="sm"
              disabled={isExecuting}
              onClick={() => onExecute(action)}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Execute Now
            </Button>
          )}

          {action.status === "proposed" && !action.requiresApproval && (
            <Button
              size="sm"
              disabled={isExecuting}
              onClick={() => onExecute(action)}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Execute
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(action.targetRoute)}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Go to {action.targetModule.toUpperCase()}
          </Button>

          {(action.status === "awaiting_approval" || action.status === "approved") && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(action)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Evidence & Expected Outcome Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2.5 border-t border-border/10">
        <div>
          <strong className="block text-foreground font-mono text-[11px] mb-0.5">Source Evidence:</strong>
          <span className="text-foreground-muted">{action.sourceEvidence}</span>
        </div>
        <div>
          <strong className="block text-foreground font-mono text-[11px] mb-0.5">Expected Outcome:</strong>
          <span className="text-foreground-muted">{action.expectedOutcome}</span>
        </div>
      </div>

      {/* Execution / Approval Meta if present */}
      {(action.approvedAt || action.executedAt || action.completedAt) && (
        <div className="pt-2 border-t border-border/10 text-[10px] font-mono text-foreground-muted flex items-center gap-3">
          {action.approvedAt && <span>Approved by: {action.approvedBy}</span>}
          {action.completedAt && (
            <span className="text-secondary font-bold">
              ✓ Completed at {new Date(action.completedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};
