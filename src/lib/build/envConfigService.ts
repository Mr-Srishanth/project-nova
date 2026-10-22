import type { Project } from "@/types/project";
import type { TargetProjectVarStatus } from "@/lib/storage/targetProjectEnvStorage";

export interface EnvVariableSpec {
  name: string;
  purpose: string;
  scope: "client" | "server" | "hybrid";
  isRequired: boolean;
  status: TargetProjectVarStatus; // "MISSING" | "EXAMPLE ONLY" | "CONFIGURED" | "VERIFIED"
  configuredLocation: string;
  setupInstructions: string;
  safeExampleValue: string;
  actualConfiguredValue?: string;
}

export interface ProjectEnvironmentReport {
  projectName: string;
  projectCategory: string;
  envExampleFileName: string;
  envExampleContent: string;
  envConfiguredContent?: string;
  gitignoreContent: string;
  variables: EnvVariableSpec[];
  totalRequired: number;
  totalConfigured: number;
  missingRequiredCount: number;
  hasUnsafeSecrets: boolean;
  evaluatedAt: string;
}

export interface TargetProjectEnvInputMap {
  [varName: string]: {
    value?: string;
    status?: TargetProjectVarStatus;
  } | string;
}

/**
 * Derives architecture-specific environment variables for a given target project.
 *
 * SCOPE SEPARATION PRINCIPLE:
 * ProjectNova's own runtime credentials (e.g. host Supabase and host Gemini keys)
 * belong strictly to ProjectNova. Target projects start with either "MISSING" (if required
 * with no value) or "EXAMPLE ONLY" (if only a template placeholder exists).
 * Values only become "CONFIGURED" when specifically provided or mapped for this target project,
 * and "VERIFIED" when direct integration testing succeeds.
 */
export function deriveProjectEnvironmentReport(
  project: Project,
  targetProjectValues?: TargetProjectEnvInputMap
): ProjectEnvironmentReport {
  const isDataEng =
    project.category === "Data Engineering" ||
    project.name.toLowerCase().includes("pipeline") ||
    project.technologies?.some((t) => ["python", "duckdb", "parquet", "fastapi"].includes(t.toLowerCase()));

  const resolveVarState = (
    name: string,
    isRequired: boolean,
    hasDefaultLocalValue = false,
    defaultLocalVal = ""
  ): { status: TargetProjectVarStatus; actualValue?: string } => {
    if (!targetProjectValues) {
      if (hasDefaultLocalValue) {
        return { status: "CONFIGURED", actualValue: defaultLocalVal };
      }
      return { status: isRequired ? "MISSING" : "EXAMPLE ONLY" };
    }

    const entry = targetProjectValues[name];
    if (entry === undefined || entry === null) {
      if (hasDefaultLocalValue) {
        return { status: "CONFIGURED", actualValue: defaultLocalVal };
      }
      return { status: isRequired ? "MISSING" : "EXAMPLE ONLY" };
    }

    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed || trimmed === "your-key-here" || trimmed.startsWith("example-")) {
        return { status: isRequired ? "MISSING" : "EXAMPLE ONLY" };
      }
      return { status: "CONFIGURED", actualValue: trimmed };
    }

    const val = (entry.value || "").trim();
    if (!val || val === "your-key-here" || val.startsWith("example-")) {
      return { status: isRequired ? "MISSING" : "EXAMPLE ONLY" };
    }

    return {
      status: entry.status || "CONFIGURED",
      actualValue: val,
    };
  };

  const variables: EnvVariableSpec[] = [];

  if (isDataEng) {
    // Hybrid Data Engineering Pipeline: FastAPI backend + Vite React console
    const portState = resolveVarState("PORT", true, true, "8000");
    variables.push({
      name: "PORT",
      purpose: "FastAPI ingestion gateway listening port",
      scope: "server",
      isRequired: true,
      status: portState.status,
      actualConfiguredValue: portState.actualValue,
      configuredLocation: ".env (server)",
      setupInstructions: "Set to 8000 (default) or custom port matching Docker compose port binding.",
      safeExampleValue: "8000",
    });

    const storageDirState = resolveVarState("DATA_STORAGE_DIR", true, true, "./data/partitions");
    variables.push({
      name: "DATA_STORAGE_DIR",
      purpose: "Local filesystem path for partitioned Parquet lakehouse storage",
      scope: "server",
      isRequired: true,
      status: storageDirState.status,
      actualConfiguredValue: storageDirState.actualValue,
      configuredLocation: ".env (server)",
      setupInstructions: "Directory path where batch partitioned .parquet files will be committed.",
      safeExampleValue: "./data/partitions",
    });

    const dbUrlState = resolveVarState("DATABASE_URL", true, true, "duckdb:///./data/pipeline.duckdb");
    variables.push({
      name: "DATABASE_URL",
      purpose: "DuckDB persistent database file path or PostgreSQL sink connection",
      scope: "server",
      isRequired: true,
      status: dbUrlState.status,
      actualConfiguredValue: dbUrlState.actualValue,
      configuredLocation: ".env (server)",
      setupInstructions: "DuckDB file path (e.g. duckdb:///./data/pipeline.duckdb) or postgres connection string.",
      safeExampleValue: "duckdb:///./data/pipeline.duckdb",
    });

    const webhookSecretState = resolveVarState("WEBHOOK_SECRET_KEY", false);
    variables.push({
      name: "WEBHOOK_SECRET_KEY",
      purpose: "HMAC signature secret for authenticating inbound webhook payloads",
      scope: "server",
      isRequired: false,
      status: webhookSecretState.status,
      actualConfiguredValue: webhookSecretState.actualValue,
      configuredLocation: ".env (server)",
      setupInstructions: "Generate a 32-character random string using `openssl rand -hex 16`.",
      safeExampleValue: "your-webhook-hmac-secret-placeholder",
    });

    const apiBaseState = resolveVarState("VITE_API_BASE_URL", true, true, "http://localhost:8000");
    variables.push({
      name: "VITE_API_BASE_URL",
      purpose: "Frontend operational monitoring UI client gateway URL",
      scope: "client",
      isRequired: true,
      status: apiBaseState.status,
      actualConfiguredValue: apiBaseState.actualValue,
      configuredLocation: ".env (client build)",
      setupInstructions: "Base HTTP URL pointing to the running FastAPI server (e.g. http://localhost:8000).",
      safeExampleValue: "http://localhost:8000",
    });

    const geminiState = resolveVarState("GEMINI_API_KEY", false);
    variables.push({
      name: "GEMINI_API_KEY",
      purpose: "Backend Google Gemini AI Key for intelligent ingestion anomaly detection",
      scope: "server",
      isRequired: false,
      status: geminiState.status,
      actualConfiguredValue: geminiState.actualValue,
      configuredLocation: ".env (server gateway only - NEVER in VITE_ client bundle)",
      setupInstructions: "Obtain from Google AI Studio (https://aistudio.google.com/app/apikey).",
      safeExampleValue: "AIzaSy...",
    });
  } else {
    // Standard Web Application (Vite + React + TypeScript + Supabase/Postgres)
    const envState = resolveVarState("VITE_APP_ENV", true, true, "development");
    variables.push({
      name: "VITE_APP_ENV",
      purpose: "Execution environment descriptor for client logging and feature flags",
      scope: "client",
      isRequired: true,
      status: envState.status,
      actualConfiguredValue: envState.actualValue,
      configuredLocation: ".env (client build)",
      setupInstructions: "Set to 'development', 'staging', or 'production'.",
      safeExampleValue: "development",
    });

    const supabaseUrlState = resolveVarState("VITE_SUPABASE_URL", true);
    variables.push({
      name: "VITE_SUPABASE_URL",
      purpose: "Target Project Supabase HTTPS REST & GraphQL endpoint URL",
      scope: "client",
      isRequired: true,
      status: supabaseUrlState.status,
      actualConfiguredValue: supabaseUrlState.actualValue,
      configuredLocation: ".env (client build)",
      setupInstructions: "Obtain from Supabase Dashboard > Project Settings > API > Project URL.",
      safeExampleValue: "https://your-project-id.supabase.co",
    });

    const supabaseAnonState = resolveVarState("VITE_SUPABASE_ANON_KEY", true);
    variables.push({
      name: "VITE_SUPABASE_ANON_KEY",
      purpose: "Target Project client-side safe publishable key protected by database RLS",
      scope: "client",
      isRequired: true,
      status: supabaseAnonState.status,
      actualConfiguredValue: supabaseAnonState.actualValue,
      configuredLocation: ".env (client build)",
      setupInstructions: "Obtain from Supabase Dashboard > Project Settings > API > Project API Keys (anon/public).",
      safeExampleValue: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    });

    const aiProviderState = resolveVarState("AI_PROVIDER", false, true, "gemini");
    variables.push({
      name: "AI_PROVIDER",
      purpose: "Target Project AI Gateway Provider Engine (e.g. gemini, openai)",
      scope: "server",
      isRequired: false,
      status: aiProviderState.status,
      actualConfiguredValue: aiProviderState.actualValue,
      configuredLocation: ".env (server)",
      setupInstructions: "Specifies which AI provider backend to use. Defaults to 'gemini'.",
      safeExampleValue: "gemini",
    });

    const geminiState = resolveVarState("GEMINI_API_KEY", false);
    variables.push({
      name: "GEMINI_API_KEY",
      purpose: "Target Project Google Gemini AI API Key for synthesized AI features",
      scope: "server",
      isRequired: false,
      status: geminiState.status,
      actualConfiguredValue: geminiState.actualValue,
      configuredLocation: ".env (server gateway only - NEVER in VITE_ client bundle)",
      setupInstructions: "Obtain from Google AI Studio (https://aistudio.google.com/app/apikey).",
      safeExampleValue: "AIzaSy...",
    });

    const portState = resolveVarState("PORT", false, true, "4000");
    variables.push({
      name: "PORT",
      purpose: "Target Project backend/gateway server listening port",
      scope: "server",
      isRequired: false,
      status: portState.status,
      actualConfiguredValue: portState.actualValue,
      configuredLocation: ".env (server)",
      setupInstructions: "Port for project backend server (defaults to 4000).",
      safeExampleValue: "4000",
    });
  }

  // Generate safe .env.example content with comments and no real secrets
  const envExampleLines = [
    `# ==============================================================================`,
    `# Environment Configuration Template for: ${project.name}`,
    `# Architecture: ${project.category} (${(project.technologies || []).join(", ") || "TypeScript"})`,
    `# SAFE PLACEHOLDER VALUES ONLY — NEVER COMMIT REAL SECRETS OR KEYS TO GIT`,
    `# ==============================================================================`,
    ``,
  ];

  for (const v of variables) {
    envExampleLines.push(`# ${v.purpose} (${v.isRequired ? "Required" : "Optional"} | ${v.scope})`);
    envExampleLines.push(`# Status: ${v.status}`);
    envExampleLines.push(`${v.name}=${v.safeExampleValue}`);
    envExampleLines.push(``);
  }

  const envExampleContent = envExampleLines.join("\n");

  // Generate configured .env content ONLY when variables have configured values
  let envConfiguredContent: string | undefined = undefined;
  const configuredLines = [
    `# ==============================================================================`,
    `# LOCALLY CONFIGURED ENVIRONMENT FOR: ${project.name}`,
    `# Generated for private local development ONLY. DO NOT COMMIT TO VERSION CONTROL.`,
    `# ==============================================================================`,
    ``,
  ];

  let hasAnyConfiguredVal = false;
  for (const v of variables) {
    const val = v.actualConfiguredValue || v.safeExampleValue;
    if (v.actualConfiguredValue) hasAnyConfiguredVal = true;
    configuredLines.push(`${v.name}=${val}`);
  }

  if (hasAnyConfiguredVal) {
    envConfiguredContent = configuredLines.join("\n");
  }

  const gitignoreContent = `# Dependencies
node_modules/
.pnp/
.pnp.js

# Production builds
dist/
build/
*.tsbuildinfo

# Environment & Secrets (MANDATORY: DO NOT COMMIT REAL SECRETS)
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.pem
*.key
*.pfx

# Python / Data Pipeline Caches
__pycache__/
*.py[cod]
*$py.class
.pytest_cache/
.venv/
env/
venv/
*.parquet.tmp

# OS & Logs
.DS_Store
Thumbs.db
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
`;

  const totalRequired = variables.filter((v) => v.isRequired).length;
  const totalConfigured = variables.filter(
    (v) => v.isRequired && (v.status === "CONFIGURED" || v.status === "VERIFIED")
  ).length;
  const missingRequiredCount = totalRequired - totalConfigured;

  return {
    projectName: project.name,
    projectCategory: project.category,
    envExampleFileName: ".env.example",
    envExampleContent,
    envConfiguredContent,
    gitignoreContent,
    variables,
    totalRequired,
    totalConfigured,
    missingRequiredCount,
    hasUnsafeSecrets: false,
    evaluatedAt: new Date().toISOString(),
  };
}
