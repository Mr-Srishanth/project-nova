import { describe, it, expect } from "vitest";
import { deriveProjectEnvironmentReport } from "./envConfigService";
import type { Project } from "@/types/project";
import { isSafeArchivePath, buildExportManifest, createProjectZipArchive } from "./zipExportService";
import { parseBlueprintDirectoryTree } from "./blueprintDirectoryModel";
import type { BuildArtifact } from "@/types/artifact";
import JSZip from "jszip";

describe("ProjectNova Environment Configuration & Secret Health Engine", () => {
  const mockWebProject: Project = {
    id: "proj_web_1",
    name: "Web Portal App",
    description: "Full-stack dashboard",
    objective: "Ship production app",
    category: "Web Application",
    technologies: ["React", "TypeScript", "Tailwind CSS", "Supabase"],
    status: "active",
    discoveryMode: "custom",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [],
  };

  const mockPipelineProject: Project = {
    id: "proj_pipeline_1",
    name: "Autonomous Data Pipeline",
    description: "Streaming duckdb parquet pipeline",
    objective: "Automate ingestion",
    category: "Data Engineering",
    technologies: ["Python", "DuckDB", "Apache Parquet", "FastAPI"],
    status: "active",
    discoveryMode: "custom",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [],
  };

  it("derives architecture-specific environment variables for web applications", () => {
    const report = deriveProjectEnvironmentReport(mockWebProject);
    expect(report.projectName).toBe("Web Portal App");
    expect(report.envExampleFileName).toBe(".env.example");

    const varNames = report.variables.map((v) => v.name);
    expect(varNames).toContain("VITE_SUPABASE_URL");
    expect(varNames).toContain("VITE_SUPABASE_ANON_KEY");
    expect(varNames).toContain("AI_PROVIDER");

    // Must never contain actual secret keys in safe example template
    expect(report.envExampleContent).not.toContain("AQ.Ab8RN6I4");
    expect(report.envExampleContent).toContain("VITE_SUPABASE_URL=https://your-project-id.supabase.co");
    expect(report.gitignoreContent).toContain(".env");
  });

  it("derives architecture-specific environment variables for Python & Data Pipeline applications", () => {
    const report = deriveProjectEnvironmentReport(mockPipelineProject);
    const varNames = report.variables.map((v) => v.name);

    expect(varNames).toContain("PORT");
    expect(varNames).toContain("DATA_STORAGE_DIR");
    expect(varNames).toContain("DATABASE_URL");
    expect(varNames).toContain("VITE_API_BASE_URL");

    expect(report.envExampleContent).toContain("DATA_STORAGE_DIR=./data/partitions");
    expect(report.gitignoreContent).toContain("__pycache__/");
    expect(report.gitignoreContent).toContain(".pytest_cache/");
  });

  it("strictly enforces scope separation: ProjectNova credentials do not auto-pollute target project", () => {
    // When no target-project values are supplied, required variables must report MISSING or EXAMPLE ONLY
    const report = deriveProjectEnvironmentReport(mockWebProject);
    const supabaseUrlVar = report.variables.find((v) => v.name === "VITE_SUPABASE_URL");
    const supabaseKeyVar = report.variables.find((v) => v.name === "VITE_SUPABASE_ANON_KEY");
    const geminiVar = report.variables.find((v) => v.name === "GEMINI_API_KEY");

    expect(supabaseUrlVar?.status).toBe("MISSING");
    expect(supabaseKeyVar?.status).toBe("MISSING");
    expect(geminiVar?.status).toBe("EXAMPLE ONLY");

    // Must never mark unsupplied required variable as CONFIGURED or VERIFIED
    expect(supabaseUrlVar?.status).not.toBe("CONFIGURED");
    expect(supabaseUrlVar?.status).not.toBe("VERIFIED");

    // When user explicitly maps or configures target project variables:
    const configuredReport = deriveProjectEnvironmentReport(mockWebProject, {
      VITE_SUPABASE_URL: "https://user-target.supabase.co",
      VITE_SUPABASE_ANON_KEY: {
        value: "sb_publishable_custom_target_key_999",
        status: "VERIFIED",
      },
    });

    const configuredUrl = configuredReport.variables.find((v) => v.name === "VITE_SUPABASE_URL");
    const configuredKey = configuredReport.variables.find((v) => v.name === "VITE_SUPABASE_ANON_KEY");

    expect(configuredUrl?.status).toBe("CONFIGURED");
    expect(configuredUrl?.actualConfiguredValue).toBe("https://user-target.supabase.co");
    expect(configuredKey?.status).toBe("VERIFIED");
    expect(configuredReport.envConfiguredContent).toContain("https://user-target.supabase.co");
  });

  it("strictly includes .env.example and .gitignore in ZIP export while excluding .env and credential keys", async () => {
    const rawTree = `web-app/
├── index.html
├── package.json
├── .env.example
├── .gitignore
└── src/
    └── main.tsx`;
    const bpModel = parseBlueprintDirectoryTree(rawTree, "web-app");

    const artifacts: BuildArtifact[] = [
      {
        id: "art_example",
        projectId: "proj_web_1",
        path: ".env.example",
        type: "config",
        purpose: "Safe environment template",
        status: "approved",
        content: "VITE_SUPABASE_URL=https://your-project-id.supabase.co\nVITE_SUPABASE_ANON_KEY=placeholder\n",
        language: "text",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_gitignore",
        projectId: "proj_web_1",
        path: ".gitignore",
        type: "config",
        purpose: "Git ignore file",
        status: "approved",
        content: "node_modules/\n.env\ndist/\n",
        language: "text",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_html",
        projectId: "proj_web_1",
        path: "index.html",
        type: "frontend",
        purpose: "HTML entry",
        status: "approved",
        content: "<html><body><script type='module' src='/src/main.tsx'></script></body></html>",
        language: "html",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_main",
        projectId: "proj_web_1",
        path: "src/main.tsx",
        type: "frontend",
        purpose: "React entry",
        status: "approved",
        content: "console.log('App ready');",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_pkg",
        projectId: "proj_web_1",
        path: "package.json",
        type: "config",
        purpose: "Dependencies",
        status: "approved",
        content: JSON.stringify({ name: "web-app" }),
        language: "json",
        dependencies: [],
        versions: [],
      },
      // Insert secret .env artifact intentionally to verify exclusion
      {
        id: "art_secret_env",
        projectId: "proj_web_1",
        path: ".env",
        type: "config",
        purpose: "Secret file",
        status: "approved",
        content: "VITE_SUPABASE_URL=https://real.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=leak_secret\n",
        language: "text",
        dependencies: [],
        versions: [],
      },
    ];

    expect(isSafeArchivePath(".env.example").safe).toBe(true);
    expect(isSafeArchivePath(".gitignore").safe).toBe(true);
    expect(isSafeArchivePath(".env").safe).toBe(false);

    const manifest = buildExportManifest("Web Portal App", bpModel, artifacts);
    expect(manifest.files.some((f) => f.path === ".env.example")).toBe(true);
    expect(manifest.files.some((f) => f.path === ".gitignore")).toBe(true);
    expect(manifest.files.some((f) => f.path === ".env")).toBe(false);

    const { uint8Array } = await createProjectZipArchive(manifest);
    const loadedZip = await JSZip.loadAsync(uint8Array!);
    const zipKeys = Object.keys(loadedZip.files);

    expect(zipKeys).toContain(".env.example");
    expect(zipKeys).toContain(".gitignore");
    expect(zipKeys).toContain("index.html");
    expect(zipKeys).not.toContain(".env");
  });
});
