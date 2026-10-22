import React, { useState } from "react";
import type { ActivityEvent } from "@/types/observability";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface EventTimelineProps {
  events: ActivityEvent[];
  onNavigateEntity?: (route: string) => void;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events, onNavigateEntity }) => {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <Card className="p-8 text-center text-secondary border border-border">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium text-foreground">No Activity Events Recorded</p>
        <p className="text-xs text-muted-foreground mt-1">
          Operations, AI gateway queries, and scheduled runs will appear here in chronological order.
        </p>
      </Card>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono font-medium bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-3 h-3 text-red-600" />
            error
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono font-medium bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            warning
          </span>
        );
      case "debug":
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-700 border border-slate-300">
            <Layers className="w-3 h-3 text-slate-500" />
            debug
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            info
          </span>
        );
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case "succeeded":
        return <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">succeeded</span>;
      case "failed":
        return <span className="text-[11px] font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded">failed</span>;
      case "blocked":
        return <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">blocked</span>;
      case "cancelled":
        return <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">cancelled</span>;
      default:
        return <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">started</span>;
    }
  };

  return (
    <div className="space-y-3">
      {events.map((evt) => {
        const isExpanded = expandedEventId === evt.id;
        const timeStr = new Date(evt.timestamp).toLocaleTimeString();
        const dateStr = new Date(evt.timestamp).toLocaleDateString();

        return (
          <div
            key={evt.id}
            className={`border rounded-lg p-3 transition-colors ${
              evt.severity === "error"
                ? "bg-red-50/40 border-red-200"
                : evt.severity === "warning"
                ? "bg-amber-50/30 border-amber-200"
                : "bg-white border-border hover:border-foreground/30"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {getSeverityBadge(evt.severity)}
                  {getOutcomeBadge(evt.outcome)}
                  <span className="text-xs font-mono bg-secondary/15 px-2 py-0.5 rounded text-foreground font-medium">
                    {evt.sourceSubsystem}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto font-mono">
                    {dateStr} {timeStr}
                  </span>
                </div>

                <p className="text-sm font-semibold text-foreground break-words">{evt.summary}</p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1.5">
                  <span className="font-mono">event: {evt.eventType}</span>
                  {typeof evt.durationMs === "number" && (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {evt.durationMs}ms
                    </span>
                  )}
                  {evt.errorCode && (
                    <span className="font-mono text-red-700 font-semibold">code: {evt.errorCode}</span>
                  )}
                  {evt.projectId && (
                    <span className="font-mono text-secondary">proj: {evt.projectId}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {evt.entityLink?.route && onNavigateEntity && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => onNavigateEntity(evt.entityLink!.route!)}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View
                  </Button>
                )}
                {(evt.safeDetails || evt.correlationId) && (
                  <button
                    type="button"
                    onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-transform"
                    aria-label="Toggle details"
                  >
                    <ChevronRight className={`w-4 h-4 transform ${isExpanded ? "rotate-90" : ""}`} />
                  </button>
                )}
              </div>
            </div>

            {isExpanded && (evt.safeDetails || evt.correlationId) && (
              <div className="mt-3 pt-3 border-t border-border/60 text-xs font-mono bg-muted/20 p-2.5 rounded space-y-1.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium text-foreground">Sanitized Diagnostic Context:</span>
                </div>
                {evt.correlationId && (
                  <div>
                    <span className="text-muted-foreground">correlationId: </span>
                    <span className="text-foreground">{evt.correlationId}</span>
                  </div>
                )}
                {evt.safeDetails && (
                  <pre className="text-xs whitespace-pre-wrap break-all text-secondary overflow-x-auto bg-white/70 p-2 rounded border border-border">
                    {JSON.stringify(evt.safeDetails, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
