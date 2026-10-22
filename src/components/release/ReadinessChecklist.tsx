import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, ArrowRight } from "lucide-react";
import type { ReadinessCheckResult, ReadinessCheckState } from "@/types/release";
import { Card } from "@/components/ui/Card";

interface ReadinessChecklistProps {
  checks: ReadinessCheckResult[];
  onNavigateToSource?: (sourceRef: string) => void;
}

const STATE_CONFIG: Record<
  ReadinessCheckState,
  { label: string; icon: React.ReactNode; badgeClass: string; cardBorder: string }
> = {
  pass: {
    label: "PASSED",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-300",
    cardBorder: "border-l-4 border-l-emerald-600",
  },
  fail: {
    label: "BLOCKER",
    icon: <XCircle className="w-4 h-4 text-accent-red" />,
    badgeClass: "bg-red-50 text-accent-red border-accent-red/20",
    cardBorder: "border-l-4 border-l-accent-red",
  },
  warning: {
    label: "WARNING",
    icon: <AlertTriangle className="w-4 h-4 text-accent-yellow" />,
    badgeClass: "bg-amber-50 text-accent-yellow border-accent-yellow/20",
    cardBorder: "border-l-4 border-l-accent-yellow",
  },
  not_verified: {
    label: "NOT VERIFIED",
    icon: <HelpCircle className="w-4 h-4 text-accent-blue" />,
    badgeClass: "bg-blue-50 text-accent-blue border-accent-blue/20",
    cardBorder: "border-l-4 border-l-accent-blue",
  },
};

export const ReadinessChecklist: React.FC<ReadinessChecklistProps> = ({
  checks,
  onNavigateToSource,
}) => {
  return (
    <div className="space-y-3">
      {checks.map((check) => {
        const config = STATE_CONFIG[check.state];

        return (
          <Card
            key={check.id}
            className={`p-4 bg-surface border-2 border-border shadow-hard-sm transition-all ${config.cardBorder}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded flex items-center gap-1 border ${config.badgeClass}`}
                  >
                    {config.icon}
                    {config.label}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded text-foreground-muted uppercase">
                    {check.category}
                  </span>
                  {check.sourceRef && (
                    <span className="text-[11px] font-mono text-foreground-muted">
                      Source: {check.sourceRef}
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-sm text-foreground">{check.name}</h4>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  {check.explanation}
                </p>

                {check.remediation && (
                  <div className="pt-1.5 text-xs text-foreground-muted flex items-center gap-1">
                    <strong className="text-foreground">Required Action:</strong>
                    <span>{check.remediation}</span>
                  </div>
                )}
              </div>

              {check.sourceRef && onNavigateToSource && (
                <button
                  type="button"
                  onClick={() => onNavigateToSource(check.sourceRef!)}
                  className="px-2.5 py-1 text-xs font-bold text-primary bg-primary-soft hover:bg-primary/20 rounded-tactile border border-primary/20 flex items-center gap-1 self-start sm:self-auto shrink-0 transition-all"
                >
                  Inspect <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
