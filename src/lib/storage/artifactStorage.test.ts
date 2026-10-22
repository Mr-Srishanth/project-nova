import { describe, it, expect, beforeEach } from "vitest";
import { artifactStorage } from "./artifactStorage";
import type { BuildArtifact } from "@/types/artifact";

describe("Artifact Storage & Version History", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleArtifact: BuildArtifact = {
    id: "art_1",
    projectId: "proj_build_test",
    path: "src/core/auth.ts",
    type: "backend",
    purpose: "JWT authentication helper",
    status: "planned",
    content: "export const auth = true;",
    language: "typescript",
    dependencies: [],
    versions: [],
  };

  it("should initialize empty for any project", async () => {
    const list = await artifactStorage.list("proj_build_test");
    expect(list).toEqual([]);
  });

  it("should save and retrieve an artifact by path", async () => {
    await artifactStorage.save(sampleArtifact);

    const fetched = await artifactStorage.getByPath("proj_build_test", "src/core/auth.ts");
    expect(fetched).not.toBeNull();
    expect(fetched?.path).toBe("src/core/auth.ts");
    expect(fetched?.status).toBe("planned");
  });

  it("should record version history on updates and snapshot prior content", async () => {
    await artifactStorage.save(sampleArtifact);

    // Update content and record version
    const updated = await artifactStorage.recordVersion(
      "proj_build_test",
      "src/core/auth.ts",
      "export const auth = false; // updated",
      "Updated auth flag",
      "user"
    );

    expect(updated.content).toBe("export const auth = false; // updated");
    expect(updated.status).toBe("modified");
    expect(updated.versions.length).toBe(1);
    expect(updated.versions[0].content).toBe("export const auth = true;"); // snapshots original
  });

  it("should update artifact approval status", async () => {
    await artifactStorage.save(sampleArtifact);

    const approved = await artifactStorage.updateStatus("proj_build_test", "src/core/auth.ts", "approved");
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeDefined();
  });

  it("should isolate artifacts strictly between projects", async () => {
    await artifactStorage.save({
      ...sampleArtifact,
      projectId: "proj_A",
    });

    await artifactStorage.save({
      ...sampleArtifact,
      projectId: "proj_B",
      path: "src/b.ts",
    });

    const listA = await artifactStorage.list("proj_A");
    expect(listA.length).toBe(1);
    expect(listA[0].path).toBe("src/core/auth.ts");

    const listB = await artifactStorage.list("proj_B");
    expect(listB.length).toBe(1);
    expect(listB[0].path).toBe("src/b.ts");
  });
});
