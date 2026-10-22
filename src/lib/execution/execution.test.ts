import { describe, it, expect, beforeEach } from "vitest";
import { isActionSupported, generateApprovalToken } from "./capabilityRegistry";
import { validatePlanStepOrder, canTransitionStep, areStepDependenciesSatisfied } from "./planEngine";
import { executeRegisteredAction } from "./actionExecutor";
import { computeNextRunTimestamp, isScheduleDue } from "./schedulerEngine";
import { projectStorage } from "@/lib/storage/projectStorage";
import type { ExecutionStep } from "@/types/execution";

describe("Execution Engine, Capability Registry & Active-Session Scheduler", () => {
  beforeEach(async () => {
    localStorage.clear();
    await projectStorage.create({
      name: "Capability Project",
      description: "Testing capability execution",
      objective: "Test actions",
      category: "Developer Tool",
      technologies: ["TypeScript"],
    });
    // Override id to fixed "proj-cap-test"
    const list = await projectStorage.list();
    if (list.length > 0) {
      list[0].id = "proj-cap-test";
      localStorage.setItem("projectnova_projects_v1", JSON.stringify(list));
    }
  });

  it("strictly validates supported action capabilities in registry", () => {
    expect(isActionSupported("refresh_state_assessment")).toBe(true);
    expect(isActionSupported("run_static_analysis")).toBe(true);
    expect(isActionSupported("recalculate_doc_drift")).toBe(true);
    expect(isActionSupported("audit_release_readiness")).toBe(true);
    // Arbitrary action execution is blocked
    expect(isActionSupported("rm_rf_root")).toBe(false);
    expect(isActionSupported("arbitrary_bash_command")).toBe(false);
  });

  it("rejects execution of unsupported actions with clear rejection summary", async () => {
    const res = await executeRegisteredAction("arbitrary_shell_command", {
      projectId: "proj-cap-test",
    });

    expect(res.success).toBe(false);
    expect(res.failureReason).toContain("not supported by the capability registry");
  });

  it("validates step dependency order and detects out-of-order execution", () => {
    const validSteps: ExecutionStep[] = [
      {
        id: "s1",
        planId: "p1",
        order: 1,
        title: "Step 1",
        description: "",
        actionType: "refresh_state_assessment",
        parameters: { projectId: "proj-cap-test" },
        dependencies: [],
        requiresApproval: false,
        status: "ready",
        retryCount: 0,
        maxRetries: 1,
      },
      {
        id: "s2",
        planId: "p1",
        order: 2,
        title: "Step 2",
        description: "",
        actionType: "run_static_analysis",
        parameters: { projectId: "proj-cap-test" },
        dependencies: ["s1"],
        requiresApproval: false,
        status: "ready",
        retryCount: 0,
        maxRetries: 1,
      },
    ];

    expect(validatePlanStepOrder(validSteps).valid).toBe(true);

    // Invalid forward dependency
    const invalidSteps: ExecutionStep[] = [
      {
        ...validSteps[0],
        dependencies: ["s2"], // depends on step that occurs later
      },
      validSteps[1],
    ];

    expect(validatePlanStepOrder(invalidSteps).valid).toBe(false);
    expect(validatePlanStepOrder(invalidSteps).error).toContain("scheduled after it");
  });

  it("validates step state transitions and prevents illegal transitions", () => {
    expect(canTransitionStep("draft", "ready")).toBe(true);
    expect(canTransitionStep("ready", "running")).toBe(true);
    expect(canTransitionStep("running", "completed")).toBe(true);
    // Completed cannot transition to running
    expect(canTransitionStep("completed", "running")).toBe(false);
  });

  it("checks prerequisite dependency satisfaction before step starts", () => {
    const steps: ExecutionStep[] = [
      {
        id: "s1",
        planId: "p1",
        order: 1,
        title: "Prereq",
        description: "",
        actionType: "refresh_state_assessment",
        parameters: {},
        dependencies: [],
        requiresApproval: false,
        status: "completed",
        retryCount: 0,
        maxRetries: 1,
      },
      {
        id: "s2",
        planId: "p1",
        order: 2,
        title: "Child",
        description: "",
        actionType: "run_static_analysis",
        parameters: {},
        dependencies: ["s1"],
        requiresApproval: false,
        status: "ready",
        retryCount: 0,
        maxRetries: 1,
      },
    ];

    expect(areStepDependenciesSatisfied(steps[1], steps)).toBe(true);

    steps[0].status = "running";
    expect(areStepDependenciesSatisfied(steps[1], steps)).toBe(false);
  });

  it("generates deterministic approval tokens bound to action parameters", () => {
    const tok1 = generateApprovalToken("run_static_analysis", { projectId: "proj-cap-test" });
    const tok2 = generateApprovalToken("run_static_analysis", { projectId: "proj-cap-test" });
    const tok3 = generateApprovalToken("run_static_analysis", { projectId: "other-project" });

    expect(tok1).toBe(tok2);
    expect(tok1).not.toBe(tok3);
  });

  it("calculates next recurrence runs correctly and identifies due schedules", () => {
    const baseTime = new Date("2026-10-20T10:00:00Z").getTime();
    const nextDaily = computeNextRunTimestamp("daily", baseTime);

    expect(new Date(nextDaily!).getUTCDate()).toBe(21);

    const schedule: any = {
      enabled: true,
      nextRunAt: "2026-10-20T09:00:00Z", // in the past
    };

    expect(isScheduleDue(schedule, baseTime)).toBe(true);

    schedule.enabled = false;
    expect(isScheduleDue(schedule, baseTime)).toBe(false);
  });

  it("successfully executes safe registered action and reports outcome", async () => {
    const res = await executeRegisteredAction("refresh_state_assessment", {
      projectId: "proj-cap-test",
    });

    expect(res.success).toBe(true);
    expect(res.resultSummary).toContain("Refreshed project state assessment");
  });
});
