export type AIProviderType = "gemini" | "openai" | "anthropic" | "ollama";

export interface AIProviderConfig {
  provider: AIProviderType;
  model: string;
  isConfigured: boolean;
}

export interface StructuredDiscoveryOutput {
  name: string;
  summary: string;
  problemStatement: string;
  targetUsers: string[];
  proposedSolution: string;
  keyFeatures: string[];
  suggestedTechnologies: { layer: string; tech: string; why: string }[];
  complexity: "Low" | "Medium" | "High" | "Expert";
  estimatedMVPWeeks: number;
  risksAndAssumptions: string[];
  recommendedNextSteps: string[];
}

export interface StructuredBlueprintOutput {
  title: string;
  overview: string;
  problemStatement: string;
  targetUsers: string[];
  realWorldUseCase: string;
  features: {
    mvp: string[];
    important: string[];
    advanced: string[];
    optional: string[];
  };
  techStack: { layer: string; tech: string; why: string }[];
  architecture: {
    summary: string;
    nodes: { id: string; label: string; kind: string; detail: string }[];
    edges: { from: string; to: string; label: string }[];
  };
  database: {
    entities: {
      name: string;
      purpose: string;
      fields: { name: string; type: string; key?: string; note?: string }[];
    }[];
    relationships: string[];
    sql: string;
  };
  api: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    route: string;
    purpose: string;
    request?: string;
    response?: string;
  }[];
  folderStructure: string;
  testingStrategy: string[];
  deploymentStrategy: string[];
  futureImprovements: string[];
}

export interface AssistQueryInput {
  projectId: string;
  question: string;
  contextText: string;
}

export interface AssistQueryOutput {
  answer: string;
  suggestedAction?: string;
  codeSnippets?: { language: string; filename?: string; code: string }[];
  relevantDecisions?: string[];
  openQuestionsIdentified?: string[];
}

export interface GenerateFileInput {
  projectId: string;
  projectName: string;
  filePath: string;
  purpose: string;
  language: string;
  contextText: string;
}

export interface GenerateFileOutput {
  filePath: string;
  language: string;
  content: string;
  explanation: string;
  dependencies: string[];
}

export interface SupportedGeminiModel {
  id: string;
  name: string;
  description: string;
}

export interface GatewayHealthResponse {
  status: "ok" | "degraded" | "unconfigured";
  provider: AIProviderType;
  model: string;
  hasKey: boolean;
  credentials?: {
    geminiSource: "server_env" | "user_session" | "none";
    supabaseSource: "server_env" | "user_session" | "none";
    supabaseUrlConfigured: boolean;
    supabaseAnonKeyConfigured: boolean;
  };
  supportedModels?: SupportedGeminiModel[];
}

export interface UpdateCredentialsInput {
  sessionId: string;
  geminiApiKey?: string;
  geminiModel?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface UpdateCredentialsResponse {
  success: boolean;
  status: {
    gemini: {
      isConfigured: boolean;
      model: string;
      source: "server_env" | "user_session" | "none";
    };
    supabase: {
      isConfigured: boolean;
      urlConfigured: boolean;
      anonKeyConfigured: boolean;
      source: "server_env" | "user_session" | "none";
    };
  };
  message: string;
}

export interface TestGeminiResponse {
  success: boolean;
  model: string;
  output?: string;
  error?: string;
  verifiedAt?: string;
}

export interface TestSupabaseResponse {
  success: boolean;
  statusCode?: number;
  message?: string;
  error?: string;
  verifiedAt?: string;
}
