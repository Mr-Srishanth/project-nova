import type { AIEditPlanItem } from "./uiStudio";

export * from "./uiStudio";

export type OperationHistoryStatus =
  | "proposed"
  | "applied"
  | "saved"
  | "build_passed"
  | "runtime_verified"
  | "rejected"
  | "failed"
  | "reverted";

export interface OperationHistoryEntry {
  id: string; // operationId
  timestamp: string;
  projectId: string;
  projectName: string;
  userPrompt: string;
  mode: "ask" | "plan" | "edit" | "auto" | "fix" | "apply";
  affectedFiles: string[];
  summary: string;
  diffExplanation?: string;
  status: OperationHistoryStatus;
  items: AIEditPlanItem[];
  advisoryText?: string;
  validationError?: string;
  previousFileSnapshots?: Record<string, string>; // path -> content snapshot for safe revert
}
