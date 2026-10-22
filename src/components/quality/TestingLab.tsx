import React, { useState } from "react";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Plus,
  Shield,
  FileCode,
} from "lucide-react";
import type { TestPlan, TestResultState } from "@/types/quality";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface TestingLabProps {
  testPlans: TestPlan[];
  onUpdateTestCaseStatus: (
    testCaseId: string,
    status: TestResultState,
    notes?: string
  ) => Promise<void>;
  onTriggerExecutionBlockedDialog: () => void;
  onProposeAITestPlan: () => Promise<void>;
  isProposingAI: boolean;
}

const RESULT_BADGES: Record<
  TestResultState,
  { label: string; bg: string; icon: React.ReactNode }
> = {
  not_run: {
    label: "NOT RUN",
    bg: "bg-surface-subtle text-foreground-muted border-border",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  passed: {
    label: "PASSED",
    bg: "bg-emerald-50 text-emerald-700 border-emerald-300",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  },
  failed: {
    label: "FAILED",
    bg: "bg-red-50 text-red-700 border-red-300",
    icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
  },
  blocked: {
    label: "BLOCKED",
    bg: "bg-amber-50 text-amber-700 border-amber-300",
    icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600" />,
  },
};

export const TestingLab: React.FC<TestingLabProps> = ({
  testPlans,
  onUpdateTestCaseStatus,
  onTriggerExecutionBlockedDialog,
  onProposeAITestPlan,
  isProposingAI,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    testPlans[0]?.id || ""
  );

  const activePlan = testPlans.find((p) => p.id === selectedPlanId) || testPlans[0];

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface border-2 border-border rounded-tactile shadow-hard-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold text-base text-foreground">
              Testing Lab & Plan Management
            </h2>
          </div>
          <p className="text-xs text-foreground-muted">
            Track manual and automated test execution results. Tests are never fabricated or automatically assumed passed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTriggerExecutionBlockedDialog}
            icon={<Shield className="w-3.5 h-3.5 text-primary" />}
          >
            Execution Policy
          </Button>
          <Button
            size="sm"
            onClick={onProposeAITestPlan}
            disabled={isProposingAI}
            icon={<Play className="w-3.5 h-3.5" />}
          >
            {isProposingAI ? "Proposing Test Plan…" : "Propose Test Cases"}
          </Button>
        </div>
      </div>

      {testPlans.length === 0 ? (
        <Card className="p-8 text-center bg-surface border-2 border-border shadow-hard-sm">
          <div className="max-w-md mx-auto space-y-3">
            <FlaskConical className="w-8 h-8 mx-auto text-foreground-muted opacity-40" />
            <p className="font-bold text-sm text-foreground">No Test Plans Registered</p>
            <p className="text-xs text-foreground-muted">
              Generate an initial test plan or create manual verification procedures for this project.
            </p>
            <Button
              size="sm"
              onClick={onProposeAITestPlan}
              disabled={isProposingAI}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Generate Test Plan
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Plan tabs if multiple */}
          {testPlans.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {testPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-tactile border transition-all ${
                    activePlan?.id === plan.id
                      ? "bg-primary text-primary-foreground border-primary shadow-hard-sm"
                      : "bg-surface text-foreground border-border hover:bg-background"
                  }`}
                >
                  {plan.title}
                </button>
              ))}
            </div>
          )}

          {activePlan && (
            <div className="space-y-3">
              <div className="p-3 bg-surface-subtle border border-border rounded-tactile flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-foreground mr-2">{activePlan.title}</span>
                  <span className="text-foreground-muted">{activePlan.description}</span>
                </div>
                {activePlan.isAiProposed && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-accent-blue-soft text-accent-blue rounded border border-accent-blue/20">
                    AI PROPOSED PLAN
                  </span>
                )}
              </div>

              {/* Test Cases Table / Cards */}
              <div className="space-y-3">
                {activePlan.testCases.map((tc) => {
                  const badge = RESULT_BADGES[tc.status];

                  return (
                    <Card
                      key={tc.id}
                      className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border flex items-center gap-1 ${badge.bg}`}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded text-foreground-muted uppercase">
                              {tc.type}
                            </span>
                            {tc.relatedFilePath && (
                              <span className="flex items-center gap-1 text-[11px] font-mono text-foreground-muted">
                                <FileCode className="w-3 h-3 text-primary" />
                                {tc.relatedFilePath}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-foreground">{tc.title}</h4>
                          <p className="text-xs text-foreground-muted">{tc.description}</p>
                        </div>

                        {/* Result state switcher */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant={tc.status === "passed" ? "primary" : "ghost"}
                            size="sm"
                            onClick={() =>
                              onUpdateTestCaseStatus(tc.id, "passed", "Verified by tester")
                            }
                          >
                            Pass
                          </Button>
                          <Button
                            variant={tc.status === "failed" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() =>
                              onUpdateTestCaseStatus(tc.id, "failed", "Verification failed")
                            }
                          >
                            Fail
                          </Button>
                          <Button
                            variant={tc.status === "blocked" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() =>
                              onUpdateTestCaseStatus(tc.id, "blocked", "Prerequisite blocked")
                            }
                          >
                            Block
                          </Button>
                        </div>
                      </div>

                      {/* Steps & Expected Outcome */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-border/10">
                        <div>
                          <strong className="block text-foreground mb-1">Procedure Steps:</strong>
                          <ol className="list-decimal list-inside space-y-0.5 text-foreground-muted">
                            {tc.steps.map((st, i) => (
                              <li key={i}>{st}</li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <strong className="block text-foreground mb-1">Expected Outcome:</strong>
                          <p className="text-foreground-muted">{tc.expectedOutcome}</p>
                          {tc.executedAt && (
                            <p className="mt-1 text-[10px] font-mono text-foreground-muted">
                              Last tested: {new Date(tc.executedAt).toLocaleTimeString()} ({tc.executionNotes})
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
