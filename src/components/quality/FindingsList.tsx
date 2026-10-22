import React from "react";
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import type { QualityFinding, QualitySeverity, QualityCategory } from "@/types/quality";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface FindingsListProps {
  findings: QualityFinding[];
  filterCategory: string;
  filterSeverity: string;
  onResolveFinding: (findingId: string) => Promise<void>;
  onDismissFinding: (findingId: string) => Promise<void>;
  onNavigateToFile?: (filePath: string) => void;
}

const SEVERITY_CONFIG: Record<
  QualitySeverity,
  { label: string; icon: React.ReactNode; badgeClass: string; cardBorder: string }
> = {
  error: {
    label: "ERROR",
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
  info: {
    label: "INFO",
    icon: <Info className="w-4 h-4 text-accent-blue" />,
    badgeClass: "bg-blue-50 text-accent-blue border-accent-blue/20",
    cardBorder: "border-l-4 border-l-accent-blue",
  },
};

const CATEGORY_LABELS: Record<QualityCategory, string> = {
  static_analysis: "Static Analysis",
  security: "Security & Secret",
  dependency: "Dependencies & Manifest",
  structure: "Project Structure",
  ai_review: "AI Review Proposal",
};

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  filterCategory,
  filterSeverity,
  onResolveFinding,
  onDismissFinding,
  onNavigateToFile,
}) => {
  const filtered = findings.filter((f) => {
    if (filterCategory !== "all" && f.category !== filterCategory) return false;
    if (filterSeverity !== "all" && f.severity !== filterSeverity) return false;
    return true;
  });

  if (findings.length === 0) {
    return (
      <Card className="p-8 text-center bg-surface border-2 border-border shadow-hard-sm">
        <div className="max-w-md mx-auto space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-secondary-soft text-secondary flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="font-bold text-foreground">Zero Quality Findings</p>
          <p className="text-xs text-foreground-muted">
            All executed static and security inspection rules passed cleanly for stored artifacts.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.length === 0 ? (
        <Card className="p-6 text-center bg-surface border-2 border-border text-foreground-muted text-xs">
          No findings match the current category and severity filters.
        </Card>
      ) : (
        filtered.map((finding) => {
          const config = SEVERITY_CONFIG[finding.severity];
          const isResolved = finding.status === "resolved";
          const isDismissed = finding.status === "dismissed";

          return (
            <div
              key={finding.id}
              className={`p-4 bg-surface border-2 border-border rounded-tactile shadow-hard-sm transition-all duration-200 ${
                config.cardBorder
              } ${isResolved ? "opacity-60 bg-surface-subtle" : ""}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-tactile border flex items-center gap-1 ${config.badgeClass}`}
                    >
                      {config.icon}
                      {config.label}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-background border border-border rounded-tactile text-foreground-muted">
                      {CATEGORY_LABELS[finding.category] || finding.category}
                    </span>
                    <span className="text-[10px] font-mono text-foreground-muted">
                      [{finding.ruleId}]
                    </span>
                    {finding.status === "fix_proposed" && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-300 rounded">
                        FIX PROPOSED
                      </span>
                    )}
                    {finding.status === "awaiting_approval" && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-300 rounded">
                        AWAITING APPROVAL
                      </span>
                    )}
                    {finding.status === "fixed" && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-300 rounded">
                        FIXED
                      </span>
                    )}
                    {finding.status === "verified" && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 rounded">
                        VERIFIED
                      </span>
                    )}
                    {isResolved && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-secondary-soft text-secondary rounded">
                        RESOLVED
                      </span>
                    )}
                    {isDismissed && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-surface-subtle text-foreground-muted rounded">
                        DISMISSED
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm text-foreground">{finding.title}</h3>
                  <p className="text-xs text-foreground-muted leading-relaxed">
                    {finding.message}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                  {finding.filePath && onNavigateToFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigateToFile(finding.filePath!)}
                      icon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      View File
                    </Button>
                  )}
                  {!isResolved && !isDismissed && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onResolveFinding(finding.id)}
                      >
                        Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDismissFinding(finding.id)}
                      >
                        Dismiss
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Code Snippet if present (Secret Redacted) */}
              {finding.snippet && (
                <div className="mt-2.5 p-2 bg-background border border-border rounded text-[11px] font-mono overflow-x-auto text-foreground">
                  <span className="text-foreground-muted select-none mr-2">
                    Line {finding.lineNumber || 1}:
                  </span>
                  <code>{finding.snippet}</code>
                </div>
              )}

              {/* Suggested Remediation */}
              {finding.suggestedFix && (
                <div className="mt-2 pt-2 border-t border-border/20 text-xs flex items-start gap-1.5 text-foreground-muted">
                  <strong className="text-foreground shrink-0">Remediation:</strong>
                  <span>{finding.suggestedFix}</span>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
