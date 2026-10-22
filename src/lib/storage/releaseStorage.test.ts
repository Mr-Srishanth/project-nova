import { describe, it, expect, beforeEach } from "vitest";
import { releaseStorage } from "./releaseStorage";
import type { ReleaseRecord } from "@/types/release";

describe("Release Storage Adapter & Persistence Isolation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleReleaseA: ReleaseRecord = {
    id: "rel-alpha-1",
    projectId: "proj-alpha",
    version: "v1.0.0",
    title: "Alpha Release",
    summary: "Production candidate for project alpha",
    status: "draft",
    notableChanges: ["Initial build"],
    knownLimitations: ["Requires manual migration"],
    deploymentPrerequisites: {
      target: "Docker",
      buildCommands: ["npm run build"],
      environmentVariables: ["NODE_ENV"],
      postDeploymentSmokeChecks: ["curl http://localhost/health"],
      rollbackPlan: "docker rollback",
    },
    checklist: [
      { id: "c1", label: "Tests passed", completed: false, required: true },
    ],
    envVariables: [],
    readinessSummary: {
      passed: 1,
      failed: 0,
      warnings: 0,
      notVerified: 0,
      isReady: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("should initialize empty for any project", async () => {
    const list = await releaseStorage.list("proj-alpha");
    expect(list).toEqual([]);
    const latest = await releaseStorage.getLatest("proj-alpha");
    expect(latest).toBeNull();
  });

  it("should save and retrieve release records strictly isolated by projectId", async () => {
    await releaseStorage.save(sampleReleaseA);

    const alphaReleases = await releaseStorage.list("proj-alpha");
    const betaReleases = await releaseStorage.list("proj-beta");

    expect(alphaReleases.length).toBe(1);
    expect(alphaReleases[0].version).toBe("v1.0.0");
    expect(betaReleases.length).toBe(0);
  });

  it("should record approval status transitions with timestamp and author", async () => {
    await releaseStorage.save(sampleReleaseA);

    const approved = await releaseStorage.updateStatus(
      "proj-alpha",
      "rel-alpha-1",
      "approved",
      "Lead Release Manager"
    );

    expect(approved).not.toBeNull();
    expect(approved?.status).toBe("approved");
    expect(approved?.approvedBy).toBe("Lead Release Manager");
    expect(approved?.approvedAt).toBeDefined();
  });

  it("should update checklist item states with timestamp", async () => {
    await releaseStorage.save(sampleReleaseA);

    const updated = await releaseStorage.updateChecklist(
      "proj-alpha",
      "rel-alpha-1",
      "c1",
      true
    );

    expect(updated).not.toBeNull();
    expect(updated?.checklist[0].completed).toBe(true);
    expect(updated?.checklist[0].completedAt).toBeDefined();
  });
});
