export type ArtifactStatus =
  | "planned"
  | "generated"
  | "modified"
  | "approved"
  | "applied"
  | "failed";

export type ArtifactType =
  | "config"
  | "frontend"
  | "backend"
  | "schema"
  | "api"
  | "test"
  | "docs";

export interface ArtifactVersion {
  versionId: string;
  content: string;
  timestamp: string;
  author: "ai" | "user";
  summary: string;
}

export interface BuildArtifact {
  id: string;
  projectId: string;
  path: string; // Relative path, e.g. "src/lib/auth.ts"
  type: ArtifactType;
  purpose: string;
  status: ArtifactStatus;
  content: string;
  language: string;
  dependencies: string[]; // Paths of other artifacts it references
  lastGeneratedAt?: string;
  lastModifiedAt?: string;
  approvedAt?: string;
  appliedAt?: string;
  generationNotes?: string;
  versions: ArtifactVersion[];
}

export interface FilePlanItem {
  path: string;
  type: ArtifactType;
  purpose: string;
  language: string;
  dependencies: string[];
  blueprintRef?: string;
}

export interface FilePlan {
  projectId: string;
  generatedAt: string;
  files: FilePlanItem[];
}
