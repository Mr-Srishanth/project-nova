import { describe, it, expect } from "vitest";
import { validateDependency, isTaskBlocked, removeDependency } from "./dependencyGraph";
import type { WorkflowTask } from "@/types/roadmap";

describe("Task Dependency Graph & Cycle Detection", () => {
  const tasks: WorkflowTask[] = [
    {
      id: "task_1",
      milestoneId: "m1",
      title: "Initialize Database Schema",
      status: "done",
      priority: "high",
      dependencies: [],
    },
    {
      id: "task_2",
      milestoneId: "m1",
      title: "Build API Gateway Endpoints",
      status: "in_progress",
      priority: "high",
      dependencies: ["task_1"], // depends on task 1
    },
    {
      id: "task_3",
      milestoneId: "m1",
      title: "Construct UI Presentation Layer",
      status: "todo",
      priority: "medium",
      dependencies: ["task_2"], // depends on task 2
    },
    {
      id: "task_4",
      milestoneId: "m1",
      title: "End-to-End Integration Tests",
      status: "todo",
      priority: "medium",
      dependencies: ["task_3"], // depends on task 3
    },
  ];

  it("should reject self-dependency", () => {
    const res = validateDependency("task_1", "task_1", tasks);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("A task cannot depend on itself");
  });

  it("should reject direct circular dependency (e.g. task_1 depends on task_2 when task_2 depends on task_1)", () => {
    const res = validateDependency("task_1", "task_2", tasks);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("Circular dependency detected");
  });

  it("should reject multi-hop circular dependency (e.g. task_1 depends on task_4 when 4 -> 3 -> 2 -> 1)", () => {
    const res = validateDependency("task_1", "task_4", tasks);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("Circular dependency detected");
  });

  it("should permit valid acyclic dependency (e.g. task_4 also depends directly on task_1)", () => {
    const res = validateDependency("task_4", "task_1", tasks);
    expect(res.isValid).toBe(true);
  });

  it("should correctly detect when a task is blocked by incomplete predecessors", () => {
    // task_2 depends on task_1 (done) -> NOT blocked
    const checkTask2 = isTaskBlocked(tasks[1], tasks);
    expect(checkTask2.blocked).toBe(false);

    // task_3 depends on task_2 (in_progress) -> BLOCKED
    const checkTask3 = isTaskBlocked(tasks[2], tasks);
    expect(checkTask3.blocked).toBe(true);
    expect(checkTask3.blockingTaskTitles).toContain("Build API Gateway Endpoints");
  });

  it("should safely remove a dependency", () => {
    const updated = removeDependency(tasks[1], "task_1");
    expect(updated.dependencies).toEqual([]);
  });
});
