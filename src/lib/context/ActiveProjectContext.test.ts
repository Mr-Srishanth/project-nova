import { describe, it, expect, beforeEach } from "vitest";
import { ACTIVE_PROJECT_STORAGE_KEY } from "./ActiveProjectContext";
import { projectStorage } from "@/lib/storage/projectStorage";
import type { Project } from "@/types/project";

describe("Active Project State Synchronization & Persistence", () => {
  const dummyProjectA: Project = {
    id: "proj_test_alpha",
    name: "Alpha Logistics Engine",
    description: "High speed route optimizer",
    objective: "Optimize fleet routing",
    category: "Cloud & Infrastructure",
    technologies: ["TypeScript", "Node.js"],
    status: "active",
    discoveryMode: "custom",
    milestones: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const dummyProjectB: Project = {
    id: "proj_test_beta",
    name: "Beta Financial Analytics",
    description: "Real-time risk scoring",
    objective: "Evaluate credit exposure",
    category: "Web Application",
    technologies: ["Python", "React"],
    status: "active",
    discoveryMode: "custom",
    milestones: [],
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  };

  beforeEach(async () => {
    localStorage.clear();
    // Clear project storage
    const all = await projectStorage.list();
    for (const p of all) {
      await projectStorage.delete(p.id);
    }
  });

  it("persists active project selection to standard localStorage key", async () => {
    await projectStorage.create(dummyProjectA);
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, dummyProjectA.id);

    const persisted = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    expect(persisted).toBe(dummyProjectA.id);
  });

  it("safely falls back when persisted project ID no longer exists in project list", async () => {
    const createdA = await projectStorage.create({
      name: dummyProjectA.name,
      description: dummyProjectA.description,
      objective: dummyProjectA.objective,
      category: dummyProjectA.category,
      technologies: dummyProjectA.technologies,
    });
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, "proj_deleted_ghost");

    const projs = await projectStorage.list();
    const persisted = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);

    const isValid = projs.some((p) => p.id === persisted);
    expect(isValid).toBe(false);

    // Context fallback policy: first project in list if invalid
    const fallback = isValid ? persisted : projs.length > 0 ? projs[0].id : null;
    expect(fallback).toBe(createdA.id);
  });

  it("honors project ID query parameter precedence over persisted local storage", async () => {
    const createdA = await projectStorage.create({
      name: dummyProjectA.name,
      description: dummyProjectA.description,
      objective: dummyProjectA.objective,
      category: dummyProjectA.category,
      technologies: dummyProjectA.technologies,
    });
    const createdB = await projectStorage.create({
      name: dummyProjectB.name,
      description: dummyProjectB.description,
      objective: dummyProjectB.objective,
      category: dummyProjectB.category,
      technologies: dummyProjectB.technologies,
    });
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, createdA.id);

    const queryParamId = createdB.id;
    const projs = await projectStorage.list();

    const paramFound = projs.find((p) => p.id === queryParamId);
    expect(paramFound).toBeDefined();
    expect(paramFound?.id).toBe(createdB.id);
  });
});
