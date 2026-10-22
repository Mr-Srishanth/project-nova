import type { OrchestrationAction, OperationState } from "@/types/orchestrator";

/**
 * Valid state transitions for Orchestration Actions:
 *
 * proposed -> awaiting_approval (if requiresApproval) or running / completed (if automatic)
 * awaiting_approval -> approved | cancelled
 * approved -> running
 * running -> completed | failed | blocked
 * failed -> proposed (retry) | cancelled
 * blocked -> proposed | cancelled
 */
const VALID_TRANSITIONS: Record<OperationState, OperationState[]> = {
  proposed: ["awaiting_approval", "approved", "running", "completed", "cancelled"],
  awaiting_approval: ["approved", "cancelled"],
  approved: ["running", "cancelled"],
  running: ["completed", "failed", "blocked"],
  completed: [],
  failed: ["proposed", "cancelled"],
  cancelled: [],
  blocked: ["proposed", "cancelled"],
};

export function canTransition(current: OperationState, next: OperationState): boolean {
  const allowed = VALID_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

export function transitionActionState(
  action: OrchestrationAction,
  nextState: OperationState,
  options?: {
    reason?: string;
    actor?: string;
  }
): OrchestrationAction {
  if (!canTransition(action.status, nextState)) {
    throw new Error(
      `Invalid orchestration state transition from "${action.status}" to "${nextState}".`
    );
  }

  const updated: OrchestrationAction = {
    ...action,
    status: nextState,
    stateReason: options?.reason || action.stateReason,
    updatedAt: new Date().toISOString(),
  };

  if (nextState === "approved") {
    updated.approvedBy = options?.actor || "Authorized User";
    updated.approvedAt = new Date().toISOString();
  } else if (nextState === "running") {
    updated.executedAt = new Date().toISOString();
  } else if (nextState === "completed") {
    updated.completedAt = new Date().toISOString();
  } else if (nextState === "failed") {
    updated.failureReason = options?.reason || "Execution failed";
  }

  return updated;
}
