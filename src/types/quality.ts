export type QualitySeverity = "error" | "warning" | "info";

export type QualityCategory =
  | "static_analysis"
  | "security"
  | "dependency"
  | "structure"
  | "ai_review";

export type FindingStatus =
  | "open"
  | "fix_proposed"
  | "awaiting_approval"
  | "fixed"
  | "verified"
  | "resolved"
  | "dismissed";

export interface QualityFinding {
  id: string;
  projectId: string;
  assessmentId: string;
  category: QualityCategory;
  severity: QualitySeverity;
  title: string;
  message: string;
  filePath?: string;
  lineNumber?: number;
  snippet?: string;
  suggestedFix?: string;
  ruleId: string;
  status: FindingStatus;
  isAiGenerated: boolean;
  createdAt: string;
  resolvedAt?: string;
  dismissedAt?: string;
  notes?: string;
}

export type TestCaseType = "manual" | "automated";
export type TestResultState = "not_run" | "passed" | "failed" | "blocked";

export interface TestCase {
  id: string;
  testPlanId: string;
  projectId: string;
  title: string;
  description: string;
  type: TestCaseType;
  preconditions: string[];
  steps: string[];
  expectedOutcome: string;
  status: TestResultState;
  relatedFilePath?: string;
  relatedFindingId?: string;
  isAiProposed: boolean;
  executedAt?: string;
  executionNotes?: string;
  executionDurationMs?: number;
}

export interface TestPlan {
  id: string;
  projectId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isAiProposed: boolean;
  testCases: TestCase[];
}

export interface QualityAssessment {
  id: string;
  projectId: string;
  assessedAt: string;
  checksPerformed: string[];
  totalArtifactsChecked: number;
  findings: QualityFinding[];
  score: {
    healthGrade: "A" | "B" | "C" | "D" | "F";
    errorCount: number;
    warningCount: number;
    infoCount: number;
    resolvedCount: number;
  };
}

export interface TestExecutionPolicy {
  isSupported: boolean;
  reasonBlocked: string;
  requiredConfirmations: string[];
  allowlistedCommands: string[];
}
