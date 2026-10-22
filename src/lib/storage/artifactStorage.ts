import type { BuildArtifact, ArtifactStatus, ArtifactVersion } from "@/types/artifact";
import { generateId } from "@/lib/utils";

const ARTIFACT_STORAGE_KEY = "projectnova_build_artifacts_v1";

export interface IArtifactStorageAdapter {
  list(projectId: string): Promise<BuildArtifact[]>;
  getByPath(projectId: string, path: string): Promise<BuildArtifact | null>;
  save(artifact: BuildArtifact): Promise<BuildArtifact>;
  delete(projectId: string, path: string): Promise<boolean>;
  recordVersion(projectId: string, path: string, content: string, summary: string, author: "ai" | "user"): Promise<BuildArtifact>;
  updateStatus(projectId: string, path: string, status: ArtifactStatus): Promise<BuildArtifact>;
}

class LocalBrowserArtifactStorageAdapter implements IArtifactStorageAdapter {
  private getRaw(): BuildArtifact[] {
    try {
      const data = localStorage.getItem(ARTIFACT_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter((a) => a && typeof a === "object" && typeof a.id === "string" && typeof a.projectId === "string");
      }
      return [];
    } catch (err) {
      console.error("[Artifact Storage] Failed to parse artifacts:", err);
      return [];
    }
  }

  private saveRaw(artifacts: BuildArtifact[]): void {
    try {
      localStorage.setItem(ARTIFACT_STORAGE_KEY, JSON.stringify(artifacts));
    } catch (err) {
      console.error("[Artifact Storage] Failed to write artifacts:", err);
      throw new Error("Local storage quota exceeded or unavailable. Artifact changes could not be saved.");
    }
  }

  async list(projectId: string): Promise<BuildArtifact[]> {
    const all = this.getRaw();
    return all.filter((a) => a.projectId === projectId);
  }

  async getByPath(projectId: string, path: string): Promise<BuildArtifact | null> {
    const all = this.getRaw();
    return all.find((a) => a.projectId === projectId && a.path === path) || null;
  }

  async save(artifact: BuildArtifact): Promise<BuildArtifact> {
    const all = this.getRaw();
    const idx = all.findIndex((a) => a.projectId === artifact.projectId && a.path === artifact.path);

    const now = new Date().toISOString();
    const toSave: BuildArtifact = {
      ...artifact,
      id: artifact.id || generateId("art"),
      lastModifiedAt: now,
      versions: artifact.versions || [],
    };

    if (idx >= 0) {
      all[idx] = toSave;
    } else {
      all.push(toSave);
    }

    this.saveRaw(all);
    return toSave;
  }

  async delete(projectId: string, path: string): Promise<boolean> {
    const all = this.getRaw();
    const filtered = all.filter((a) => !(a.projectId === projectId && a.path === path));
    if (filtered.length === all.length) return false;
    this.saveRaw(filtered);
    return true;
  }

  async recordVersion(
    projectId: string,
    path: string,
    content: string,
    summary: string,
    author: "ai" | "user"
  ): Promise<BuildArtifact> {
    const existing = await this.getByPath(projectId, path);
    if (!existing) {
      throw new Error(`Cannot record version: Artifact at path "${path}" does not exist in project "${projectId}".`);
    }

    const version: ArtifactVersion = {
      versionId: `v_${Date.now()}`,
      content: existing.content, // Snapshot previous content
      timestamp: new Date().toISOString(),
      author,
      summary,
    };

    const updated: BuildArtifact = {
      ...existing,
      content,
      lastModifiedAt: new Date().toISOString(),
      status: author === "user" ? "modified" : "generated",
      versions: [version, ...(existing.versions || [])].slice(0, 20), // Retain up to 20 past versions
    };

    return this.save(updated);
  }

  async updateStatus(projectId: string, path: string, status: ArtifactStatus): Promise<BuildArtifact> {
    const existing = await this.getByPath(projectId, path);
    if (!existing) {
      throw new Error(`Cannot update status: Artifact at path "${path}" not found.`);
    }

    const now = new Date().toISOString();
    const updated: BuildArtifact = {
      ...existing,
      status,
      approvedAt: status === "approved" ? now : existing.approvedAt,
      appliedAt: status === "applied" ? now : existing.appliedAt,
    };

    return this.save(updated);
  }
}

export const artifactStorage: IArtifactStorageAdapter = new LocalBrowserArtifactStorageAdapter();
