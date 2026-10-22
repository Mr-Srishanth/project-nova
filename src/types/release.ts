export type ReleaseStatus =
  | "draft"
  | "preparing"
  | "blocked"
  | "ready_for_approval"
  | "approved"
  | "released";

export type ReadinessCheckState = "pass" | "fail" | "warning" | "not_verified";

export interface ReadinessCheckResult {
  id: string;
  name: string;
  category: "blueprint" | "artifacts" | "quality" | "tests" | "environment";
  state: ReadinessCheckState;
  explanation: string;
  sourceRef?: string;
  remediation?: string;
}

export interface EnvVariableSpec {
  name: string;
  description: string;
  required: boolean;
  format?: string;
  exampleValue: string; // Placeholder only (e.g. "https://api.example.com", never real secret)
  status: "configured" | "missing" | "not_verified";
}

export interface DeploymentPrerequisite {
  target: string;
  buildCommands: string[];
  environmentVariables: string[];
  databaseMigrationStep?: string;
  postDeploymentSmokeChecks: string[];
  rollbackPlan: string;
}

export interface ReleaseChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  completedAt?: string;
  notes?: string;
}

export interface ReleaseRecord {
  id: string;
  projectId: string;
  version: string; // e.g. "v1.0.0"
  title: string;
  summary: string;
  status: ReleaseStatus;
  notableChanges: string[];
  knownLimitations: string[];
  deploymentPrerequisites: DeploymentPrerequisite;
  checklist: ReleaseChecklistItem[];
  envVariables: EnvVariableSpec[];
  readinessSummary: {
    passed: number;
    failed: number;
    warnings: number;
    notVerified: number;
    isReady: boolean;
  };
  approvedAt?: string;
  approvedBy?: string;
  releasedAt?: string;
  createdAt: string;
  updatedAt: string;
}
