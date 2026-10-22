import type { ProjectDocument, DocumentVersion, DocumentDriftFinding } from "@/types/document";

const DOCS_STORAGE_KEY = "projectnova_documents_v1";

export interface IDocumentStorageAdapter {
  list(projectId: string): Promise<ProjectDocument[]>;
  getById(projectId: string, docId: string): Promise<ProjectDocument | null>;
  save(doc: ProjectDocument): Promise<ProjectDocument>;
  delete(projectId: string, docId: string): Promise<boolean>;
  recordVersion(
    projectId: string,
    docId: string,
    content: string,
    summary: string,
    author: "user" | "ai" | "generator"
  ): Promise<ProjectDocument | null>;
  revertToVersion(
    projectId: string,
    docId: string,
    versionNumber: number
  ): Promise<ProjectDocument | null>;
  updateDriftFindings(
    projectId: string,
    docId: string,
    findings: DocumentDriftFinding[]
  ): Promise<ProjectDocument | null>;
}

class LocalBrowserDocumentStorageAdapter implements IDocumentStorageAdapter {
  private getRaw(): ProjectDocument[] {
    try {
      const data = localStorage.getItem(DOCS_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (d) => d && typeof d === "object" && typeof d.id === "string" && typeof d.projectId === "string"
        );
      }
      return [];
    } catch (err) {
      console.error("[Document Storage] Failed to parse docs:", err);
      return [];
    }
  }

  private saveRaw(docs: ProjectDocument[]): void {
    try {
      localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(docs));
    } catch (err) {
      console.error("[Document Storage] Failed to write docs:", err);
      throw new Error("Local storage quota exceeded or unavailable. Document changes could not be saved.");
    }
  }

  async list(projectId: string): Promise<ProjectDocument[]> {
    const all = this.getRaw();
    return all
      .filter((d) => d.projectId === projectId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getById(projectId: string, docId: string): Promise<ProjectDocument | null> {
    const all = this.getRaw();
    return all.find((d) => d.projectId === projectId && d.id === docId) || null;
  }

  async save(doc: ProjectDocument): Promise<ProjectDocument> {
    const all = this.getRaw();
    const idx = all.findIndex((d) => d.projectId === doc.projectId && d.id === doc.id);
    const updated: ProjectDocument = {
      ...doc,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    this.saveRaw(all);
    return updated;
  }

  async delete(projectId: string, docId: string): Promise<boolean> {
    const all = this.getRaw();
    const filtered = all.filter((d) => !(d.projectId === projectId && d.id === docId));
    if (filtered.length !== all.length) {
      this.saveRaw(filtered);
      return true;
    }
    return false;
  }

  async recordVersion(
    projectId: string,
    docId: string,
    content: string,
    summary: string,
    author: "user" | "ai" | "generator"
  ): Promise<ProjectDocument | null> {
    const all = this.getRaw();
    const target = all.find((d) => d.projectId === projectId && d.id === docId);
    if (!target) return null;

    const nextVerNumber = (target.versions.length > 0 ? target.versions[0].versionNumber : 0) + 1;
    const newVersion: DocumentVersion = {
      versionId: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      versionNumber: nextVerNumber,
      content: target.content, // snapshot current content before overwriting
      summary,
      author,
      createdAt: new Date().toISOString(),
    };

    target.versions = [newVersion, ...target.versions.slice(0, 19)]; // retain 20 revisions
    target.content = content;
    target.updatedAt = new Date().toISOString();

    this.saveRaw(all);
    return target;
  }

  async revertToVersion(
    projectId: string,
    docId: string,
    versionNumber: number
  ): Promise<ProjectDocument | null> {
    const all = this.getRaw();
    const target = all.find((d) => d.projectId === projectId && d.id === docId);
    if (!target) return null;

    const historical = target.versions.find((v) => v.versionNumber === versionNumber);
    if (!historical) return null;

    // Snapshot current as a revision before rollback
    const rollbackSnapshot: DocumentVersion = {
      versionId: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      versionNumber: target.versions[0].versionNumber + 1,
      content: target.content,
      summary: `Snapshot before rolling back to version ${versionNumber}`,
      author: "user",
      createdAt: new Date().toISOString(),
    };

    target.versions = [rollbackSnapshot, ...target.versions.slice(0, 19)];
    target.content = historical.content;
    target.updatedAt = new Date().toISOString();

    this.saveRaw(all);
    return target;
  }

  async updateDriftFindings(
    projectId: string,
    docId: string,
    findings: DocumentDriftFinding[]
  ): Promise<ProjectDocument | null> {
    const all = this.getRaw();
    const target = all.find((d) => d.projectId === projectId && d.id === docId);
    if (!target) return null;

    target.driftFindings = findings;
    this.saveRaw(all);
    return target;
  }
}

export const documentStorage: IDocumentStorageAdapter = new LocalBrowserDocumentStorageAdapter();
