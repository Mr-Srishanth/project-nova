import type {
  GatewayHealthResponse,
  StructuredDiscoveryOutput,
  StructuredBlueprintOutput,
  AssistQueryOutput,
} from "./types";
import type { IdeaUnderstandingResult } from "./ideaTypes";
import { validateIdeaUnderstandingResponse } from "./ideaValidator";
import { GATEWAY_ORIGIN } from "../gatewayBase";

const GATEWAY_BASE = `${GATEWAY_ORIGIN}/api/ai`;

export class AIGatewayClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const res = await fetch(`${GATEWAY_BASE}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
        ...options,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(errorData.error || `AI Gateway request failed with status ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      if (err.message?.includes("Failed to fetch") || err.message?.includes("ECONNREFUSED")) {
        throw new Error(
          `AI Gateway server is not reachable on ${GATEWAY_ORIGIN}. Start server with 'bun run server'.`
        );
      }
      throw err;
    }
  }

  async checkHealth(): Promise<GatewayHealthResponse> {
    return this.request<GatewayHealthResponse>("/health", { method: "GET" });
  }

  async generateDiscovery(input: {
    idea: string;
    mode: string;
    targetTechnologies?: string;
    constraints?: string;
  }): Promise<StructuredDiscoveryOutput> {
    return this.request<StructuredDiscoveryOutput>("/discover", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async understandIdea(input: {
    idea: string;
    refinementPrompt?: string;
    targetTechnologies?: string;
  }): Promise<IdeaUnderstandingResult> {
    const raw = await this.request<any>("/discover", {
      method: "POST",
      body: JSON.stringify({
        idea: input.idea,
        mode: "idea_understanding",
        constraints: input.refinementPrompt,
        targetTechnologies: input.targetTechnologies,
      }),
    });
    return validateIdeaUnderstandingResponse(raw, input.idea);
  }

  async generateBlueprint(input: {
    projectName: string;
    objective: string;
    contextText?: string;
    technologies?: string[];
  }): Promise<StructuredBlueprintOutput> {
    return this.request<StructuredBlueprintOutput>("/blueprint", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async queryAssistant(input: {
    projectId: string;
    question: string;
    contextText: string;
  }): Promise<AssistQueryOutput> {
    return this.request<AssistQueryOutput>("/assist", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async generateFile(input: {
    projectId: string;
    projectName: string;
    filePath: string;
    purpose: string;
    language?: string;
    contextText?: string;
  }): Promise<{
    filePath: string;
    language: string;
    content: string;
    explanation: string;
    dependencies: string[];
  }> {
    return this.request("/generate-file", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async continueCode(input: {
    projectName: string;
    filePath: string;
    language?: string;
    prefixContent: string;
    suffixContent?: string;
    selectedCode?: string;
    contextFiles?: Array<{ path: string; content: string }>;
  }): Promise<{
    continuation: string;
    summary: string;
    intent: "continuation" | "next_step";
  }> {
    return this.request("/continue-code", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async explainCode(input: {
    projectName: string;
    filePath: string;
    language?: string;
    fileContent: string;
    selectedCode?: string;
    mode: "eli5" | "normal";
    selectionRange?: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } | null;
    contextFiles?: Array<{ path: string; content: string }>;
  }): Promise<import("@/types/codeExplainer").CodeExplanationResult> {
    return this.request("/explain-code", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async proposeTestPlan(input: {
    projectName: string;
    blueprintContext?: string;
    existingFiles?: string[];
  }): Promise<{
    title: string;
    description: string;
    testCases: Array<{
      id: string;
      title: string;
      description: string;
      type: "manual" | "automated";
      preconditions: string[];
      steps: string[];
      expectedOutcome: string;
      relatedFilePath?: string;
    }>;
  }> {
    return this.request("/propose-test-plan", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // Session & User Credential Management (BYO Keys)
  async updateCredentials(input: {
    sessionId: string;
    geminiApiKey?: string;
    geminiModel?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }): Promise<any> {
    const res = await fetch(`${GATEWAY_ORIGIN}/api/settings/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to update credentials" }));
      throw new Error(err.error || "Failed to update credentials on server");
    }
    return res.json();
  }

  async clearCredentials(sessionId: string): Promise<any> {
    const res = await fetch(`${GATEWAY_ORIGIN}/api/settings/credentials/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to clear credentials" }));
      throw new Error(err.error || "Failed to clear credentials on server");
    }
    return res.json();
  }

  async testGeminiInference(input: {
    apiKey?: string;
    model?: string;
    sessionId?: string;
  }): Promise<any> {
    const res = await fetch(`${GATEWAY_ORIGIN}/api/settings/test-gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Gemini inference failed" }));
      throw new Error(err.error || "Gemini inference failed");
    }
    return res.json();
  }

  async testSupabaseConnection(input: {
    url?: string;
    anonKey?: string;
    sessionId?: string;
  }): Promise<any> {
    const res = await fetch(`${GATEWAY_ORIGIN}/api/settings/test-supabase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Supabase connection test failed" }));
      throw new Error(err.error || "Supabase connection test failed");
    }
    return res.json();
  }
}

export const aiClient = new AIGatewayClient();
