export type ProjectMemoryType =
  | "fact"
  | "decision"
  | "constraint"
  | "risk"
  | "open_question"
  | "summary"
  | "lesson_learned"
  | "requirement"
  | "preference";

export type ProjectMemorySource =
  | "user"
  | "blueprint"
  | "ai"
  | "execution"
  | "document";

export type MemoryStatus =
  | "active"
  | "superseded"
  | "resolved"
  | "archived";

export type MemoryVerificationState =
  | "user_confirmed"
  | "ai_proposed"
  | "unverified"
  | "rejected";

export interface EntityReference {
  entityType: "artifact" | "blueprint" | "task" | "execution" | "document";
  entityId: string;
  name?: string;
}

export interface ProjectMemory {
  id: string;
  projectId: string;
  type: ProjectMemoryType;
  title: string;
  content: string;
  source: ProjectMemorySource;
  status: MemoryStatus;
  verificationState: MemoryVerificationState;
  confidence?: number; // 0 - 100
  tags?: string[];
  rationale?: string;
  supersededBy?: string; // ID of the superseding memory
  relatedMemoryIds?: string[];
  relatedEntityRef?: EntityReference;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  projectId: string;
  type: ProjectMemoryType;
  title: string;
  content: string;
  source: ProjectMemorySource;
  status?: MemoryStatus;
  verificationState?: MemoryVerificationState;
  confidence?: number;
  tags?: string[];
  rationale?: string;
  relatedMemoryIds?: string[];
  relatedEntityRef?: EntityReference;
}

export interface UpdateMemoryInput {
  title?: string;
  content?: string;
  type?: ProjectMemoryType;
  status?: MemoryStatus;
  verificationState?: MemoryVerificationState;
  confidence?: number;
  tags?: string[];
  rationale?: string;
  supersededBy?: string;
  relatedMemoryIds?: string[];
  relatedEntityRef?: EntityReference;
}

export type IntegrityFindingType =
  | "conflicting_decision"
  | "conflicting_constraint"
  | "stale_reference"
  | "answered_question"
  | "duplicate_candidate";

export interface MemoryIntegrityFinding {
  id: string;
  projectId: string;
  findingType: IntegrityFindingType;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  affectedMemoryIds: string[];
  suggestedAction: string;
  detectedAt: string;
}

export interface MemoryRetrievalResult {
  memory: ProjectMemory;
  relevanceScore: number;
  retrievalReason: string;
}

export interface AssembledMemoryContext {
  projectId: string;
  contextText: string;
  selectedMemories: MemoryRetrievalResult[];
  omittedCount: number;
  totalAvailable: number;
  budgetUsedChars: number;
  maxBudgetChars: number;
  isTruncated: boolean;
}
