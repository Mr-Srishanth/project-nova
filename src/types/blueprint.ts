export type NodeKind =
  | "client"
  | "frontend"
  | "api"
  | "backend"
  | "ai"
  | "database"
  | "storage"
  | "auth"
  | "deployment"
  | "external";

export interface ArchNode {
  id: string;
  label: string;
  kind: NodeKind;
  detail: string;
}

export interface ArchEdge {
  from: string;
  to: string;
  label: string;
}

export interface ArchitectureSpec {
  summary: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface DbField {
  name: string;
  type: string;
  key?: "PK" | "FK" | "UNIQUE" | "";
  note?: string;
}

export interface DbEntity {
  name: string;
  purpose: string;
  fields: DbField[];
}

export interface DatabaseSpec {
  entities: DbEntity[];
  relationships: string[];
  sql: string;
}

export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  route: string;
  purpose: string;
  request?: string;
  response?: string;
}

export interface UiScreen {
  name: string;
  purpose: string;
  elements: string[];
}

export interface FeatureBreakdown {
  mvp: string[];
  important: string[];
  advanced: string[];
  optional: string[];
}

export interface Blueprint {
  id: string;
  projectId: string;
  title: string;
  overview: string;
  problemStatement: string;
  targetUsers: string[];
  realWorldUseCase: string;
  features: FeatureBreakdown;
  techStack: { layer: string; tech: string; why: string }[];
  architecture: ArchitectureSpec;
  database: DatabaseSpec;
  api: ApiEndpoint[];
  uiScreens: UiScreen[];
  folderStructure: string;
  testingStrategy: string[];
  deploymentStrategy: string[];
  futureImprovements: string[];
  updatedAt: string;
}
