import { describe, it, expect, beforeEach } from "vitest";
import { projectStorage } from "./projectStorage";

describe("LocalBrowserStorageAdapter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should initialize empty and return empty array", async () => {
    const list = await projectStorage.list();
    expect(list).toEqual([]);
  });

  it("should create and persist a project", async () => {
    const created = await projectStorage.create({
      name: "Alpha OS",
      description: "An AI Project OS",
      objective: "Build autonomous software platform",
      category: "Developer Tool",
      technologies: ["React", "TypeScript", "Vite"],
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Alpha OS");
    expect(created.status).toBe("active");

    const list = await projectStorage.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(created.id);
  });

  it("should update project fields and update timestamp", async () => {
    const project = await projectStorage.create({
      name: "Beta OS",
      description: "Draft",
      objective: "Test updates",
      category: "Web Application",
      technologies: ["Tailwind"],
    });

    const updated = await projectStorage.update(project.id, {
      name: "Beta OS v2",
      status: "completed",
    });

    expect(updated.name).toBe("Beta OS v2");
    expect(updated.status).toBe("completed");

    const fetched = await projectStorage.getById(project.id);
    expect(fetched?.name).toBe("Beta OS v2");
  });

  it("should delete a project cleanly", async () => {
    const project = await projectStorage.create({
      name: "Gamma OS",
      description: "To be deleted",
      objective: "Testing deletion",
      category: "Other",
      technologies: [],
    });

    const initialList = await projectStorage.list();
    expect(initialList.length).toBe(1);

    const deleted = await projectStorage.delete(project.id);
    expect(deleted).toBe(true);

    const postList = await projectStorage.list();
    expect(postList.length).toBe(0);
  });

  it("should handle corrupted JSON in local storage and create a backup without crashing", async () => {
    localStorage.setItem("projectnova_projects_v1", "{ malformed json: not valid ]]]");

    const list = await projectStorage.list();
    expect(list).toEqual([]);

    const backup = projectStorage.getCorruptedBackup();
    expect(backup).toBe("{ malformed json: not valid ]]]");
  });

  it("should filter out corrupted objects inside an array and retain valid projects", async () => {
    const mixed = [
      { id: "valid_1", name: "Valid Project", status: "active", updatedAt: new Date().toISOString() },
      { corrupted: true, missingIdAndName: 123 },
      null,
      "random string",
    ];
    localStorage.setItem("projectnova_projects_v1", JSON.stringify(mixed));

    const list = await projectStorage.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("valid_1");
  });
});
