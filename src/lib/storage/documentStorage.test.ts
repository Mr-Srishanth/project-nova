import { describe, it, expect, beforeEach } from "vitest";
import { documentStorage } from "./documentStorage";
import type { ProjectDocument } from "@/types/document";

describe("Document Storage Adapter & Project Isolation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleDocA: ProjectDocument = {
    id: "doc-1",
    projectId: "proj-alpha",
    title: "Alpha README",
    slug: "readme",
    type: "readme",
    status: "approved",
    content: "# Alpha Project\n\nOverview content.",
    summary: "Standard README",
    sourcesUsed: ["project.metadata"],
    isAiGenerated: false,
    linkedArtifactPaths: ["package.json"],
    linkedBrainRecordIds: [],
    versions: [],
    driftFindings: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("should initialize empty for any project", async () => {
    const list = await documentStorage.list("proj-alpha");
    expect(list).toEqual([]);
    const item = await documentStorage.getById("proj-alpha", "doc-1");
    expect(item).toBeNull();
  });

  it("should save and retrieve documents strictly isolated by projectId", async () => {
    await documentStorage.save(sampleDocA);

    const alphaDocs = await documentStorage.list("proj-alpha");
    const betaDocs = await documentStorage.list("proj-beta");

    expect(alphaDocs.length).toBe(1);
    expect(alphaDocs[0].title).toBe("Alpha README");
    expect(betaDocs.length).toBe(0);
  });

  it("should record version history snapshots on update", async () => {
    await documentStorage.save(sampleDocA);

    const updated = await documentStorage.recordVersion(
      "proj-alpha",
      "doc-1",
      "# Alpha Project Updated\n\nNew section.",
      "Added new section",
      "user"
    );

    expect(updated).not.toBeNull();
    expect(updated?.content).toContain("Alpha Project Updated");
    expect(updated?.versions.length).toBe(1);
    expect(updated?.versions[0].summary).toBe("Added new section");
    // Verify snapshot stored prior content
    expect(updated?.versions[0].content).toBe(sampleDocA.content);
  });

  it("should revert to a historical version snapshot", async () => {
    await documentStorage.save(sampleDocA);

    // Update 1
    await documentStorage.recordVersion(
      "proj-alpha",
      "doc-1",
      "# Version 2 Content",
      "Edit 1",
      "user"
    );

    // Revert to Version 1
    const reverted = await documentStorage.revertToVersion("proj-alpha", "doc-1", 1);
    expect(reverted).not.toBeNull();
    expect(reverted?.content).toBe(sampleDocA.content);
  });
});
