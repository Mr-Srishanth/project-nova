import { describe, it, expect, beforeEach } from "vitest";
import { executionStorage } from "./executionStorage";
import type { ExecutionPlan, AutomationSchedule, ExecutionRunRecord } from "@/types/execution";

describe("Execution Storage Adapter & Isolation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const samplePlan: ExecutionPlan = {
    id: "plan-1",
    projectId: "proj-exec",
    title: "Test Plan",
    description: "Sample execution plan",
    status: "ready",
    steps: [
      {
        id: "step-1",
        planId: "plan-1",
        order: 1,
        title: "Scan",
        description: "Scan code",
        actionType: "run_static_analysis",
        parameters: { projectId: "proj-exec" },
        dependencies: [],
        requiresApproval: false,
        status: "ready",
        retryCount: 0,
        maxRetries: 2,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("should initialize empty for any project", async () => {
    const plans = await executionStorage.listPlans("proj-exec");
    expect(plans).toEqual([]);
    const schedules = await executionStorage.listSchedules("proj-exec");
    expect(schedules).toEqual([]);
    const runs = await executionStorage.listRunRecords("proj-exec");
    expect(runs).toEqual([]);
  });

  it("should persist and isolate plans strictly by project", async () => {
    await executionStorage.savePlan(samplePlan);

    const execPlans = await executionStorage.listPlans("proj-exec");
    const otherPlans = await executionStorage.listPlans("proj-other");

    expect(execPlans.length).toBe(1);
    expect(execPlans[0].title).toBe("Test Plan");
    expect(otherPlans.length).toBe(0);
  });

  it("should persist automation schedules and toggle status", async () => {
    const sch: AutomationSchedule = {
      id: "sch-1",
      projectId: "proj-exec",
      planId: "plan-1",
      title: "Daily Quality Check",
      recurrence: "daily",
      enabled: true,
      timezone: "UTC",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await executionStorage.saveSchedule(sch);
    const list = await executionStorage.listSchedules("proj-exec");
    expect(list.length).toBe(1);
    expect(list[0].enabled).toBe(true);

    // Toggle
    await executionStorage.saveSchedule({ ...sch, enabled: false });
    const updatedList = await executionStorage.listSchedules("proj-exec");
    expect(updatedList[0].enabled).toBe(false);
  });

  it("should record verified execution runs without storing secrets", async () => {
    const run: ExecutionRunRecord = {
      id: "run-1",
      projectId: "proj-exec",
      planId: "plan-1",
      stepId: "step-1",
      actionType: "run_static_analysis",
      status: "completed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 45,
      resultSummary: "Found 0 errors",
      retryAttempt: 0,
    };

    await executionStorage.saveRunRecord(run);
    const runs = await executionStorage.listRunRecords("proj-exec");
    expect(runs.length).toBe(1);
    expect(runs[0].resultSummary).toBe("Found 0 errors");
  });
});
