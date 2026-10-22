export type DocumentType =
  | "readme"
  | "architecture"
  | "setup"
  | "api_reference"
  | "database"
  | "testing"
  | "deployment"
  | "contributing"
  | "decision_record"
  | "custom";

export type DocumentStatus = "draft" | "review" | "approved" | "archived";

export interface DocumentVersion {
  versionId: string;
  versionNumber: number;
  content: string;
  summary: string;
  author: "user" | "ai" | "generator";
  createdAt: string;
}

export type DriftSeverity = "mismatch" | "drift" | "unverified";

export interface DocumentDriftFinding {
  id: string;
  documentId: string;
  section: string;
  severity: DriftSeverity;
  reason: string;
  sourceContext: string;
  suggestedAction: string;
  status: "open" | "dismissed" | "resolved";
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  type: DocumentType;
  status: DocumentStatus;
  content: string;
  summary: string;
  sourcesUsed: string[];
  isAiGenerated: boolean;
  linkedArtifactPaths: string[];
  linkedBrainRecordIds: string[];
  versions: DocumentVersion[];
  driftFindings: DocumentDriftFinding[];
  createdAt: string;
  updatedAt: string;
}
