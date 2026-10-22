export type ReviewSeverity = "critical" | "high" | "medium" | "low";

export type ReviewCategory =
  | "correctness"
  | "security"
  | "maintainability"
  | "performance"
  | "architecture";

export type ReviewFindingStatus = "open" | "accepted" | "rejected" | "fixed" | "needs_review";

export type ReviewDetectionMethod = "deterministic_rule" | "parser_verified" | "ai_assisted";

export interface ReviewFinding {
  id: string;
  projectId: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  confidence: "high" | "medium" | "tentative";
  title: string;
  explanation: string;
  filePath: string;
  lineRange?: { start: number; end: number };
  evidenceSnippet?: string;
  detectionMethod: ReviewDetectionMethod;
  potentialImpact: string;
  recommendedAction: string;
  status: ReviewFindingStatus;
  relatedMemoryId?: string;
  relatedRuleId?: string;
  detectedAt: string;
}

export type ProposalStatus =
  | "draft"
  | "validated"
  | "invalid"
  | "awaiting_approval"
  | "approved"
  | "applied"
  | "rejected"
  | "stale";

export interface RepairProposal {
  id: string;
  projectId: string;
  findingId: string;
  targetFilePath: string;
  originalContentHash: string;
  originalCodeSnippet: string;
  proposedCodeSnippet: string;
  unifiedDiff: string;
  rationale: string;
  expectedBehaviorChange: string;
  potentialSideEffects?: string;
  validationStatus: ProposalStatus;
  validationDiagnostic?: string;
  approvalToken?: string;
  approvedAt?: string;
  appliedAt?: string;
  appliedVersionId?: string;
  createdAt: string;
}

export interface VerificationCheckResult {
  checkType: "static_analysis" | "security_rules" | "dependency_resolution" | "syntax_validation";
  title: string;
  passed: boolean;
  message: string;
  executedAt: string;
}

export interface CodeReviewSession {
  id: string;
  projectId: string;
  sourceName: string;
  createdAt: string;
  updatedAt: string;
  status: "analyzing" | "findings_available" | "completed";
  findings: ReviewFinding[];
  proposals: RepairProposal[];
  verificationResults?: VerificationCheckResult[];
}
