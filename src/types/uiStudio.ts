export type ViewportMode = "desktop" | "tablet" | "mobile";

export type ApplicationArchetype = "car_game" | "game" | "dashboard" | "website" | "backend" | "general_app";

export interface PreviewSecurityOptions {
  allowExternalCdn?: boolean;
  allowLocalStorage?: boolean;
  stripHostSecrets?: boolean;
  restrictedExecution?: boolean;
}

export type PreviewLifecycleStage =
  | "building"
  | "loading"
  | "ready"
  | "runtime_error"
  | "build_failed"
  | "stale"
  | "stopped";

export interface PreviewBuildResult {
  html: string;
  entryFile: string;
  archetype: ApplicationArchetype;
  diagnostics: string[];
  isPlayableOrInteractive: boolean;
  detectedRoutes: string[];
  buildId?: string;
  compiledAt?: string;
}

export interface ApplicationValidationReport {
  valid: boolean;
  archetype: ApplicationArchetype;
  score: number; // 0 - 100 based on verified criteria
  isVerified?: boolean; // false if runtime checks have not yet run
  functionalStatus: "passed" | "failed" | "not_verified" | "testing";
  functionalDetail?: string;
  breakdown: {
    staticChecks: number; // 0 - 100
    runtimeHealth: number; // 0 - 100
    archetypeCompliance: number; // 0 - 100
    buildChecks?: number; // 0 - 100
    functionalChecks?: number; // 0 - 100
  };
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
    critical: boolean;
  }>;
  errors: Array<{
    file?: string;
    line?: number;
    message: string;
    type: "build" | "runtime" | "syntax" | "missing_entry" | "broken_import";
    suggestedFix?: string;
  }>;
  suggestedRepairs: Array<{
    id: string;
    title: string;
    description: string;
    affectedFile: string;
    replacementContent?: string;
  }>;
}

export interface AIEditPlanItem {
  id: string;
  filePath: string;
  action: "create" | "modify" | "delete";
  summary: string;
  diffExplanation: string;
  originalContent?: string;
  proposedContent: string;
  baseVersionId?: string;
}

export type AIVerificationLevel =
  | "generated"
  | "applied"
  | "saved"
  | "build_passed"
  | "runtime_verified"
  | "failed";

export interface AIEditPlan {
  id: string;
  operationId: string;
  projectId: string;
  userPrompt: string;
  mode: "ask" | "plan" | "edit" | "auto" | "fix" | "apply";
  summary: string;
  impactAssessment: string;
  items: AIEditPlanItem[];
  advisoryText?: string;
  createdAt: string;
  approved: boolean;
  applied: boolean;
  verificationLevel: AIVerificationLevel;
  validationError?: string;
}

export interface AIConversationMessage {
  id: string;
  operationId?: string;
  role: "user" | "assistant";
  mode: "ask" | "plan" | "edit" | "auto" | "fix" | "apply";
  content: string;
  timestamp: string;
  plan?: AIEditPlan;
  status?: "pending" | "applied" | "rejected" | "reverted" | "failed";
}

export interface UIStudioNotification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface UIStudioState {
  selectedProjectId: string | null;
  activeTab: "pages" | "files" | "components" | "design" | "assets" | "ai_changes" | "errors";
  viewport: ViewportMode;
  previewUrl: string | null;
  selectedFilePath: string | null;
  selectedRoute: string;
  isRunning: boolean;
  selectedElementId: string | null;
  inspectableProperties: Record<string, string>;
  validationReport: ApplicationValidationReport | null;
}
