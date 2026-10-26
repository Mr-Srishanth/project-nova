import type { ExecutionStep, ExecutionStepStatus } from "@/types/execution";

export function validatePlanStepOrder(steps: ExecutionStep[]): { valid: boolean; error?: string } {
  const stepIds = new Set(steps.map((s) => s.id));

  // Check unique IDs
  if (stepIds.size !== steps.length) {
    return { valid: false, error: "Execution plan contains duplicate step IDs." };
  }

  // Check dependencies exist and are topologically prior
  const seen = new Set<string>();
  for (const step of steps) {
    for (const depId of step.dependencies) {
      if (!stepIds.has(depId)) {
        return { valid: false, error: `Step "${step.title}" references missing dependency ID "${depId}".` };
      }
      if (!seen.has(depId)) {
        return {
          valid: false,
          error: `Step "${step.title}" depends on step "${depId}" which is scheduled after it.`,
        };
      }
    }
    seen.add(step.id);
  }

  return { valid: true };
}

const VALID_STEP_TRANSITIONS: Record<ExecutionStepStatus, ExecutionStepStatus[]> = {
  draft: ["awaiting_approval", "ready", "cancelled"],
  awaiting_approval: ["ready", "cancelled"],
  ready: ["running", "blocked", "cancelled"],
  running: ["completed", "failed", "blocked"],
  completed: [],
  failed: ["ready", "cancelled"], // retry
  blocked: ["ready", "cancelled"],
  cancelled: [],
};

export function canTransitionStep(current: ExecutionStepStatus, next: ExecutionStepStatus): boolean {
  return VALID_STEP_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * An approval-gated step with no approver is BLOCKED, not failed: running it
 * would only fail in the executor (missing approval token), and marking it
 * failed hides the real state — it is waiting for a human, not broken.
 */
export function isStepBlockedByApproval(step: ExecutionStep): boolean {
  return step.requiresApproval === true && !step.approvedBy;
}

export function areStepDependenciesSatisfied(
  step: ExecutionStep,
  allSteps: ExecutionStep[]
): boolean {
  if (step.dependencies.length === 0) return true;
  const stepMap = new Map(allSteps.map((s) => [s.id, s]));

  return step.dependencies.every((depId) => {
    const dep = stepMap.get(depId);
    return dep && dep.status === "completed";
  });
}
