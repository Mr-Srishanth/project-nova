import { describe, it, expect } from "vitest";
import { StudioDocumentManager } from "./studioDocuments";
import type { BuildArtifact } from "@/types/artifact";
import type { IArtifactStorageAdapter } from "@/lib/storage/artifactStorage";

/** In-memory artifact storage with the same semantics as the real adapter. */
class FakeArtifactStorage implements IArtifactStorageAdapter {
  private store = new Map<string, BuildArtifact>();
  failNextRecordVersion = false;
  failNextSave = false;

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
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error("simulated storage failure");
    }
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
    if (this.failNextRecordVersion) {
      this.failNextRecordVersion = false;
      throw new Error("simulated storage failure");
    }
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

function makeArtifact(projectId: string, path: string, content: string): BuildArtifact {
  return {
    id: `art_${projectId}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
    projectId,
    path,
    type: "frontend",
    purpose: "test",
    status: "approved",
    content,
    language: "typescript",
    dependencies: [],
    versions: [],
  };
}

async function setup() {
  const storage = new FakeArtifactStorage();
  await storage.save(makeArtifact("proj_a", "src/app/App.tsx", "export const App = () => <div>A</div>;"));
  await storage.save(makeArtifact("proj_a", "src/index.css", "body { margin: 0; }"));
  await storage.save(makeArtifact("proj_b", "src/app/App.tsx", "export const App = () => <div>B</div>;"));
  const manager = new StudioDocumentManager(storage);
  await manager.openProject("proj_a");
  await manager.openProject("proj_b");
  return { storage, manager };
}

describe("StudioDocumentManager", () => {
  it("opens a project with all files clean and saved", async () => {
    const { manager } = await setup();
    const state = manager.getProjectState("proj_a")!;
    expect(state.files.size).toBe(2);
    expect(state.files.get("src/app/App.tsx")?.status).toBe("saved");
    expect(manager.isDirty("proj_a")).toBe(false);
    expect(state.revision).toBe(0);
  });

  it("persists an edit through save and survives a reload (fresh manager, same storage)", async () => {
    const { storage, manager } = await setup();
    manager.edit("proj_a", "src/app/App.tsx", "export const App = () => <div>A v2</div>;");
    expect(manager.isDirty("proj_a")).toBe(true);
    expect(manager.getProjectState("proj_a")?.files.get("src/app/App.tsx")?.status).toBe("unsaved");

    const ok = await manager.saveFile("proj_a", "src/app/App.tsx");
    expect(ok).toBe(true);
    const state = manager.getProjectState("proj_a")!;
    expect(state.files.get("src/app/App.tsx")?.status).toBe("saved");
    expect(state.revision).toBe(1);

    // Simulate closing and reopening UI Studio: a brand-new manager over
    // the same storage must see the saved content, not the old version.
    const reopened = new StudioDocumentManager(storage);
    const reloaded = await reopened.openProject("proj_a");
    expect(reloaded.files.get("src/app/App.tsx")?.savedContent).toContain("A v2");
  });

  it("keeps the draft and reports 'failed' when persistence fails, then retries successfully", async () => {
    const { storage, manager } = await setup();
    manager.edit("proj_a", "src/app/App.tsx", "export const App = () => <div>retry me</div>;");
    storage.failNextRecordVersion = true;
    const ok = await manager.saveFile("proj_a", "src/app/App.tsx");
    expect(ok).toBe(false);
    const file = manager.getProjectState("proj_a")!.files.get("src/app/App.tsx")!;
    expect(file.status).toBe("failed");
    expect(file.error).toContain("simulated storage failure");
    expect(file.draftContent).toContain("retry me"); // draft NOT discarded
    expect(file.savedContent).toContain("<div>A</div>"); // saved revision untouched
    expect(manager.getProjectState("proj_a")!.revision).toBe(0); // no phantom revision

    const retried = await manager.retrySave("proj_a", "src/app/App.tsx");
    expect(retried).toBe(true);
    expect(manager.getProjectState("proj_a")!.files.get("src/app/App.tsx")!.status).toBe("saved");
    expect(manager.getProjectState("proj_a")!.revision).toBe(1);
  });

  it("previews build only from saved content, never from unsaved drafts", async () => {
    const { manager } = await setup();
    manager.edit("proj_a", "src/app/App.tsx", "export const App = () => <div>DRAFT</div>;");
    const artifacts = manager.getSavedArtifacts("proj_a");
    const app = artifacts.find((a) => a.path === "src/app/App.tsx")!;
    expect(app.content).toContain("<div>A</div>");
    expect(app.content).not.toContain("DRAFT");
  });

  it("undo restores the previous saved content and redo reapplies it", async () => {
    const { manager } = await setup();
    manager.edit("proj_a", "src/app/App.tsx", "export const App = () => <div>A v2</div>;");
    await manager.saveFile("proj_a", "src/app/App.tsx");
    expect(manager.canUndo("proj_a")).toBe(true);

    const affected = await manager.undo("proj_a");
    expect(affected).toContain("src/app/App.tsx");
    expect(manager.getProjectState("proj_a")!.files.get("src/app/App.tsx")!.savedContent).toContain("<div>A</div>");
    expect(manager.canRedo("proj_a")).toBe(true);

    await manager.redo("proj_a");
    expect(manager.getProjectState("proj_a")!.files.get("src/app/App.tsx")!.savedContent).toContain("A v2");
  });

  it("routes AI-applied changes through the same pipeline (revision + undo)", async () => {
    const { manager } = await setup();
    const result = await manager.applyExternalChanges(
      "proj_a",
      [{ path: "src/app/App.tsx", content: "export const App = () => <div>AI</div>;" }],
      { label: "AI edit", author: "ai" }
    );
    expect(result.failedPath).toBeNull();
    expect(result.applied).toEqual(["src/app/App.tsx"]);
    expect(manager.getProjectState("proj_a")!.revision).toBe(1);
    await manager.undo("proj_a");
    expect(manager.getProjectState("proj_a")!.files.get("src/app/App.tsx")!.savedContent).toContain("<div>A</div>");
  });

  it("isolates projects: edits and saves in one never leak into another", async () => {
    const { manager } = await setup();
    manager.edit("proj_a", "src/app/App.tsx", "export const App = () => <div>A changed</div>;");
    await manager.saveFile("proj_a", "src/app/App.tsx");

    const bState = manager.getProjectState("proj_b")!;
    expect(bState.revision).toBe(0);
    expect(bState.files.get("src/app/App.tsx")!.savedContent).toContain("<div>B</div>");
    expect(manager.isDirty("proj_b")).toBe(false);
    expect(manager.canUndo("proj_b")).toBe(false);
  });

  it("supports create / rename / delete as undoable operations", async () => {
    const { manager } = await setup();
    expect(await manager.createFile("proj_a", "src/components/Card.tsx", "export const Card = () => null;")).toBe(true);
    expect(manager.getProjectState("proj_a")!.files.has("src/components/Card.tsx")).toBe(true);
    // Duplicate create is refused.
    expect(await manager.createFile("proj_a", "src/components/Card.tsx", "x")).toBe(false);

    expect(await manager.renameFile("proj_a", "src/components/Card.tsx", "src/components/Panel.tsx")).toBe(true);
    let state = manager.getProjectState("proj_a")!;
    expect(state.files.has("src/components/Card.tsx")).toBe(false);
    expect(state.files.get("src/components/Panel.tsx")!.savedContent).toContain("Card");

    expect(await manager.deleteFile("proj_a", "src/components/Panel.tsx")).toBe(true);
    state = manager.getProjectState("proj_a")!;
    expect(state.files.has("src/components/Panel.tsx")).toBe(false);

    // Undo the delete -> file restored with its content.
    await manager.undo("proj_a");
    state = manager.getProjectState("proj_a")!;
    expect(state.files.get("src/components/Panel.tsx")!.savedContent).toContain("Card");
  });

  it("seeds baseline files without overwriting existing saved content", async () => {
    const { manager } = await setup();
    await manager.seedFiles("proj_a", [
      makeArtifact("proj_a", "src/app/App.tsx", "BASELINE MUST NOT WIN"),
      makeArtifact("proj_a", "package.json", "{}"),
    ]);
    const state = manager.getProjectState("proj_a")!;
    expect(state.files.get("src/app/App.tsx")!.savedContent).toContain("<div>A</div>");
    expect(state.files.get("package.json")!.savedContent).toBe("{}");
    // Seeding is not an undoable user operation and does not bump revision.
    expect(state.revision).toBe(0);
    expect(manager.canUndo("proj_a")).toBe(false);
  });

  it("saveAllDirty persists every dirty file and reports failures per file", async () => {
    const { manager } = await setup();
    manager.edit("proj_a", "src/app/App.tsx", "export const App = () => <div>v2</div>;");
    manager.edit("proj_a", "src/index.css", "body { margin: 4px; }");
    const res = await manager.saveAllDirty("proj_a");
    expect(res.failed).toEqual([]);
    expect(res.saved.sort()).toEqual(["src/app/App.tsx", "src/index.css"]);
    expect(manager.isDirty("proj_a")).toBe(false);
    expect(manager.getProjectState("proj_a")!.revision).toBe(2);
  });
});
