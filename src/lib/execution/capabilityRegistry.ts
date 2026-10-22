import type { SupportedActionType } from "@/types/execution";

export interface ActionDefinition {
  type: SupportedActionType;
  title: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  timeoutMs: number;
  validateParameters: (params: Record<string, unknown>) => { valid: boolean; error?: string };
}

export const CAPABILITY_REGISTRY: Record<SupportedActionType, ActionDefinition> = {
  refresh_state_assessment: {
    type: "refresh_state_assessment",
    title: "Refresh Project State Assessment",
    description: "Evaluates project modules and persists normalized project-state snapshot.",
    riskLevel: "low",
    requiresApproval: false,
    timeoutMs: 5000,
    validateParameters: (p) => {
      if (!p.projectId || typeof p.projectId !== "string") {
        return { valid: false, error: "Missing or invalid 'projectId' parameter." };
      }
      return { valid: true };
    },
  },
  recalculate_roadmap_progress: {
    type: "recalculate_roadmap_progress",
    title: "Recalculate Roadmap Progress",
    description: "Aggregates milestone tasks and computes progress percentages for roadmap stages.",
    riskLevel: "low",
    requiresApproval: false,
    timeoutMs: 5000,
    validateParameters: (p) => {
      if (!p.projectId || typeof p.projectId !== "string") {
        return { valid: false, error: "Missing or invalid 'projectId' parameter." };
      }
      return { valid: true };
    },
  },
  recompute_recommendations: {
    type: "recompute_recommendations",
    title: "Recompute Next-Best Actions",
    description: "Executes deterministic orchestrator rules against current project snapshot.",
    riskLevel: "low",
    requiresApproval: false,
    timeoutMs: 5000,
    validateParameters: (p) => {
      if (!p.projectId || typeof p.projectId !== "string") {
        return { valid: false, error: "Missing or invalid 'projectId' parameter." };
      }
      return { valid: true };
    },
  },
  run_static_analysis: {
    type: "run_static_analysis",
    title: "Run Static & Security Analysis",
    description: "Executes static rules and secret audits on all Build Studio code artifacts.",
    riskLevel: "low",
    requiresApproval: false,
    timeoutMs: 10000,
    validateParameters: (p) => {
      if (!p.projectId || typeof p.projectId !== "string") {
        return { valid: false, error: "Missing or invalid 'projectId' parameter." };
      }
      return { valid: true };
    },
  },
  recalculate_doc_drift: {
    type: "recalculate_doc_drift",
    title: "Recalculate Living Documentation Drift",
    description: "Inspects documentation text for missing file references, API routes, or env params.",
    riskLevel: "low",
    requiresApproval: false,
    timeoutMs: 8000,
    validateParameters: (p) => {
      if (!p.projectId || typeof p.projectId !== "string") {
        return { valid: false, error: "Missing or invalid 'projectId' parameter." };
      }
      return { valid: true };
    },
  },
  audit_release_readiness: {
    type: "audit_release_readiness",
    title: "Audit Release Readiness Gate",
    description: "Evaluates blueprint, artifact approvals, quality errors, and env configuration.",
    riskLevel: "low",
    requiresApproval: false,
    timeoutMs: 8000,
    validateParameters: (p) => {
      if (!p.projectId || typeof p.projectId !== "string") {
        return { valid: false, error: "Missing or invalid 'projectId' parameter." };
      }
      return { valid: true };
    },
  },
};

export function isActionSupported(actionType: string): actionType is SupportedActionType {
  return Object.prototype.hasOwnProperty.call(CAPABILITY_REGISTRY, actionType);
}

export function generateApprovalToken(actionType: string, params: Record<string, unknown>): string {
  const serialized = JSON.stringify({ actionType, params: Object.entries(params).sort() });
  // Fast deterministic hash representation
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `tok_${Math.abs(hash).toString(16)}`;
}
