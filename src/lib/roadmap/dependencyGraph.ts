import type { WorkflowTask } from "@/types/roadmap";

export interface DependencyValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Checks if adding `dependsOnTaskId` to `targetTask` would introduce a self-dependency or cycle.
 */
export function validateDependency(
  targetTaskId: string,
  dependsOnTaskId: string,
  allTasks: WorkflowTask[]
): DependencyValidationResult {
  // 1. Self-dependency check
  if (targetTaskId === dependsOnTaskId) {
    return {
      isValid: false,
      error: "A task cannot depend on itself.",
    };
  }

  // 2. Existence check
  const sourceTask = allTasks.find((t) => t.id === targetTaskId);
  const predecessor = allTasks.find((t) => t.id === dependsOnTaskId);

  if (!sourceTask || !predecessor) {
    return {
      isValid: false,
      error: "One or both tasks involved in the dependency do not exist.",
    };
  }

  // 3. Duplicate check
  if (sourceTask.dependencies.includes(dependsOnTaskId)) {
    return {
      isValid: false,
      error: "This dependency relationship already exists.",
    };
  }

  // 4. Cycle detection using Depth-First Search
  // If we add an edge targetTaskId -> dependsOnTaskId, we must verify that
  // dependsOnTaskId cannot already reach targetTaskId.
  const visited = new Set<string>();

  function hasPath(fromId: string, toId: string): boolean {
    if (fromId === toId) return true;
    visited.add(fromId);

    const current = allTasks.find((t) => t.id === fromId);
    if (!current || !current.dependencies) return false;

    for (const depId of current.dependencies) {
      if (!visited.has(depId)) {
        if (hasPath(depId, toId)) return true;
      }
    }
    return false;
  }

  // Check if dependsOnTaskId already reaches targetTaskId
  if (hasPath(dependsOnTaskId, targetTaskId)) {
    return {
      isValid: false,
      error: `Circular dependency detected: adding this link creates an invalid dependency loop.`,
    };
  }

  return { isValid: true };
}

/**
 * Returns whether a task is currently blocked by incomplete predecessor tasks.
 */
export function isTaskBlocked(task: WorkflowTask, allTasks: WorkflowTask[]): { blocked: boolean; blockingTaskTitles: string[] } {
  if (!task.dependencies || task.dependencies.length === 0) {
    return { blocked: false, blockingTaskTitles: [] };
  }

  const blockingTitles: string[] = [];

  for (const depId of task.dependencies) {
    const depTask = allTasks.find((t) => t.id === depId);
    if (depTask && depTask.status !== "done") {
      blockingTitles.push(depTask.title);
    }
  }

  return {
    blocked: blockingTitles.length > 0,
    blockingTaskTitles: blockingTitles,
  };
}

/**
 * Safely removes a dependency from a task.
 */
export function removeDependency(task: WorkflowTask, depTaskId: string): WorkflowTask {
  return {
    ...task,
    dependencies: task.dependencies.filter((id) => id !== depTaskId),
  };
}
