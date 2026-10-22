import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useProjectOpener } from "./useProjectOpener";
import { StudioDocumentManager } from "./studioDocuments";
import { generateTargetProjectBaseline } from "@/lib/build/targetProjectBaseline";
import type { BuildArtifact } from "@/types/artifact";
import type { IArtifactStorageAdapter } from "@/lib/storage/artifactStorage";
import type { Project } from "@/types/project";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** In-memory artifact storage with the same semantics as the real adapter. */
class FakeArtifactStorage implements IArtifactStorageAdapter {
  private store = new Map<string, BuildArtifact>();

  private key(projectId: string, path: string) {
    return `${projectId}::${path}`;
  }

  async list(projectId: string): Promise<BuildArtifact[]> {
    return [...this.store.values()].filter((a) => a.projectId === projectId).map((a) => ({ ...a }));
  }

  async getByPath(projectId: string, path: string): Promise<BuildArtifact | null> {
    return this.store.get(this.key(projectId, path)) || null;
  }

  async save(artifact: BuildArtifact): Promise<BuildArtifact> {
    const toSave: BuildArtifact = {
      ...artifact,
      lastModifiedAt: new Date().toISOString(),
      versions: artifact.versions || [],
    };
    this.store.set(this.key(artifact.projectId, artifact.path), toSave);
    return toSave;
  }

  async delete(projectId: string, path: string): Promise<boolean> {
    return this.store.delete(this.key(projectId, path));
  }

  async recordVersion(
    projectId: string,
    path: string,
    content: string,
    summary: string,
    author: "ai" | "user"
  ): Promise<BuildArtifact> {
    const existing = await this.getByPath(projectId, path);
    if (!existing) throw new Error(`Artifact at path "${path}" does not exist`);
    const updated: BuildArtifact = {
      ...existing,
      content,
      lastModifiedAt: new Date().toISOString(),
      versions: [
        {
          versionId: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          content: existing.content,
          timestamp: new Date().toISOString(),
          author,
          summary,
        },
        ...(existing.versions || []),
      ],
    };
    this.store.set(this.key(projectId, path), updated);
    return updated;
  }

  async updateStatus(projectId: string, path: string, status: BuildArtifact["status"]): Promise<BuildArtifact> {
    const existing = await this.getByPath(projectId, path);
    if (!existing) throw new Error("not found");
    const updated = { ...existing, status };
    this.store.set(this.key(projectId, path), updated);
    return updated;
  }
}

function makeProject(id: string, name = "NitroPulse Car Game"): Project {
  return {
    id,
    name,
    description: "2D Canvas retro car racing game with high-speed physics, dynamic obstacles, and responsive controls.",
    objective: "Deliver a playable retro racing simulation with dynamic obstacles and high-score tracking.",
    category: "Developer Tool",
    technologies: ["React", "TypeScript", "HTML5 Canvas"],
    status: "active",
    discoveryMode: "custom",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [],
  };
}

/**
 * The open + baseline-seed sequence exactly as UIStudioPage performs it
 * (open through the document manager, then seed only the baseline files
 * that are missing). Kept in step with the page's openSelectedProject.
 */
async function openAndSeedBaseline(manager: StudioDocumentManager, project: Project): Promise<void> {
  await manager.openProject(project.id);
  const baseline = generateTargetProjectBaseline(project, project.blueprint);
  const state = manager.getProjectState(project.id);
  if (!state) return;
  const missing: BuildArtifact[] = [];
  for (const [path, content] of Object.entries(baseline)) {
    if (!state.files.has(path)) {
      missing.push({
        id: `art_${project.id}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
        projectId: project.id,
        path,
        type: path.includes("app") || path.endsWith(".tsx") ? "frontend" : "config",
        purpose: `Baseline for ${path}`,
        status: "approved",
        content,
        language: path.endsWith(".tsx") || path.endsWith(".ts") ? "typescript" : "text",
        dependencies: [],
        versions: [],
      });
    }
  }
  if (missing.length > 0) await manager.seedFiles(project.id, missing);
}

type OpenFn = (project: Project, isCurrent: () => boolean) => void | Promise<void>;

function OpenerHarness(props: { record: Project | null; onOpen: OpenFn }) {
  useProjectOpener(props.record, props.onOpen);
  return null;
}

describe("useProjectOpener — project-open ordering race", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(record: Project | null, onOpen: OpenFn) {
    act(() => {
      root.render(createElement(OpenerHarness, { record, onOpen }));
    });
  }

  async function flush() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  it("opens and seeds the baseline when the record resolves after the id was already selected", async () => {
    const storage = new FakeArtifactStorage();
    const manager = new StudioDocumentManager(storage);
    const project = makeProject("proj_race");
    const baselinePaths = Object.keys(generateTargetProjectBaseline(project)).sort();
    const openSpy = vi.fn(async (p: Project) => {
      await openAndSeedBaseline(manager, p);
    });

    // The studio mounts with the id already selected (URL param / global
    // active project) but projectStorage.list() has not resolved yet, so
    // there is no record. This is the ordering that used to strand the
    // studio at Rev 0 with no files.
    render(null, openSpy);
    await flush();
    expect(openSpy).not.toHaveBeenCalled();
    expect(manager.getProjectState(project.id)).toBeNull();

    // The list resolves and the record for the selected id becomes available.
    render(project, openSpy);
    await vi.waitFor(() => {
      expect(manager.getProjectState(project.id)?.files.size).toBe(baselinePaths.length);
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const state = manager.getProjectState(project.id)!;
    for (const path of baselinePaths) {
      expect(state.files.has(path)).toBe(true);
    }
    // The files the validation panel complained about must all be present.
    expect(state.files.has("package.json")).toBe(true);
    expect(state.files.has("index.html")).toBe(true);
    expect(state.files.has("src/app/App.tsx")).toBe(true);
    // Seeded files are persisted to storage, not just held in memory.
    const persisted = await storage.list(project.id);
    expect(persisted.map((a) => a.path).sort()).toEqual(baselinePaths);
  });

  it("does not re-open or duplicate files when the record object is replaced for the same project", async () => {
    const storage = new FakeArtifactStorage();
    const manager = new StudioDocumentManager(storage);
    const project = makeProject("proj_refresh");
    const openSpy = vi.fn(async (p: Project) => {
      await openAndSeedBaseline(manager, p);
    });

    render(project, openSpy);
    await vi.waitFor(() => {
      expect(manager.getProjectState(project.id)).not.toBeNull();
    });
    await flush();
    expect(openSpy).toHaveBeenCalledTimes(1);
    const fileCount = (await storage.list(project.id)).length;
    expect(fileCount).toBeGreaterThan(0);

    // A list refresh hands the studio a new record object for the same id.
    render({ ...project }, openSpy);
    await flush();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect((await storage.list(project.id)).length).toBe(fileCount);
  });

  it("re-opens on switch-back without overwriting saved content, and stale opens lose currency", async () => {
    const storage = new FakeArtifactStorage();
    const manager = new StudioDocumentManager(storage);
    const projectA = makeProject("proj_a");
    const projectB = makeProject("proj_b", "Other App");
    const openSpy = vi.fn(async (p: Project, _isCurrent: () => boolean) => {
      await openAndSeedBaseline(manager, p);
    });

    render(projectA, openSpy);
    await vi.waitFor(() => {
      expect(manager.getProjectState(projectA.id)?.files.has("src/app/App.tsx")).toBe(true);
    });
    const firstOpenIsCurrent = openSpy.mock.calls[0]?.[1];
    if (!firstOpenIsCurrent) throw new Error("project A was never opened");

    // A saved user change lands in storage for A's entry file.
    const saved = await storage.getByPath(projectA.id, "src/app/App.tsx");
    await storage.save({ ...saved!, content: "// user work — do not overwrite" });

    // Switch to B: B opens; A's open is no longer the current one.
    render(projectB, openSpy);
    await vi.waitFor(() => {
      expect(manager.getProjectState(projectB.id)?.files.has("package.json")).toBe(true);
    });
    expect(firstOpenIsCurrent()).toBe(false);

    // Switch back to A: it re-opens, and seeding must not clobber the save.
    render(projectA, openSpy);
    await vi.waitFor(() => {
      expect(
        manager.getProjectState(projectA.id)?.files.get("src/app/App.tsx")?.savedContent
      ).toBe("// user work — do not overwrite");
    });
    expect(openSpy.mock.calls.filter(([p]) => p.id === projectA.id)).toHaveLength(2);
  });
});
