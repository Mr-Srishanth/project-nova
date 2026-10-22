import React from "react";
import type { SubsystemHealthResult } from "@/types/observability";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Activity,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

interface SubsystemCardProps {
  result: SubsystemHealthResult;
}

export const SubsystemCard: React.FC<SubsystemCardProps> = ({ result }) => {
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "healthy":
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
          cardBorder: "border-emerald-200/80 hover:border-emerald-400",
          label: "HEALTHY",
        };
      case "degraded":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
          badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
          cardBorder: "border-amber-200/80 hover:border-amber-400",
          label: "DEGRADED",
        };
      case "unavailable":
        return {
          icon: <XCircle className="w-4 h-4 text-red-600" />,
          badgeClass: "bg-red-100 text-red-800 border-red-300",
          cardBorder: "border-red-200/80 hover:border-red-400",
          label: "UNAVAILABLE",
        };
      default:
        return {
          icon: <HelpCircle className="w-4 h-4 text-slate-500" />,
          badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
          cardBorder: "border-slate-200/80 hover:border-slate-400",
          label: "UNVERIFIED",
        };
    }
  };

  const statusInfo = getStatusDisplay(result.status);

  return (
    <Card className={`p-4 border transition-all duration-150 ${statusInfo.cardBorder} flex flex-col justify-between`}>
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-secondary opacity-70" />
            {result.title}
          </h4>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${statusInfo.badgeClass}`}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </span>
        </div>

        <p className="text-xs text-secondary leading-relaxed mb-3">
          {result.explanation}
        </p>
      </div>

      <div className="pt-2 border-t border-border/50 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>{result.isLiveTested ? "● Live Verified" : "○ Inferred / Unchecked"}</span>
          <span>Checked: {new Date(result.lastChecked).toLocaleTimeString()}</span>
        </div>

        {result.suggestedAction && (
          <div className="bg-amber-50/70 border border-amber-200/60 rounded p-2 text-xs text-amber-900 flex items-start gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Next Step: </span>
              {result.suggestedAction}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
