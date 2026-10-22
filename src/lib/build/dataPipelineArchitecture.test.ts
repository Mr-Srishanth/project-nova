import { describe, it, expect } from "vitest";
import { generateDefaultBlueprint } from "@/lib/blueprintDefaults";
import { parseBlueprintDirectoryTree, synchronizeBlueprintAndArtifacts } from "./blueprintDirectoryModel";
import { validateTargetProjectInIsolation } from "./targetProjectValidator";
import type { BuildArtifact } from "@/types/artifact";

describe("Autonomous Data Pipeline Architectural Integrity", () => {
  const projectName = "Autonomous Data Pipeline";
  const technologies = ["Python", "DuckDB", "Apache Parquet", "FastAPI"];
  const category = "Data Engineering";

  it("generates a tailored hybrid data engineering blueprint rather than a generic React-only template", () => {
    const bp = generateDefaultBlueprint("proj_data", projectName, technologies, category);

    // Verify technology layers preserve user requirements
    const techNames = bp.techStack.map((t) => t.tech);
    expect(techNames.some((t) => t.includes("Python") || t.includes("FastAPI"))).toBe(true);
    expect(techNames.some((t) => t.includes("DuckDB"))).toBe(true);
    expect(techNames.some((t) => t.includes("Parquet"))).toBe(true);

    // Verify folder structure contains both FastAPI backend and React dashboard
    const parsed = parseBlueprintDirectoryTree(bp.folderStructure);
    expect(parsed.files).toContain("index.html");
    expect(parsed.files).toContain("vite.config.ts");
    expect(parsed.files).toContain("src/main.tsx");
    expect(parsed.files).toContain("src/index.css");
    expect(parsed.files).toContain("requirements.txt");
    expect(parsed.files).toContain("backend/main.py");
    expect(parsed.files).toContain("backend/engine.py");
    expect(parsed.files).toContain("src/app/App.tsx");
    expect(parsed.files).toContain("data/schema.sql");
  });

  it("validates the hybrid target project in an isolated workspace with index.html and package scripts", async () => {
    const bp = generateDefaultBlueprint("proj_data", projectName, technologies, category);
    const parsed = parseBlueprintDirectoryTree(bp.folderStructure);

    // Assemble realistic artifacts for the hybrid data engineering pipeline
    const artifacts: BuildArtifact[] = [
      {
        id: "art_pkg",
        projectId: "proj_data",
        path: "package.json",
        type: "config",
        purpose: "UI dependencies & scripts",
        status: "approved",
        content: JSON.stringify({
          name: "autonomous-data-pipeline-ui",
          private: true,
          version: "0.1.0",
          type: "module",
          scripts: { dev: "vite", build: "tsc -b && vite build" },
        }),
        language: "json",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_vite",
        projectId: "proj_data",
        path: "vite.config.ts",
        type: "config",
        purpose: "Vite config",
        status: "approved",
        content: "import { defineConfig } from 'vite'; export default defineConfig({});",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_html",
        projectId: "proj_data",
        path: "index.html",
        type: "frontend",
        purpose: "HTML entry",
        status: "approved",
        content: '<!DOCTYPE html><html><body><div id="root"></div><script type="module" src="/src/app/App.tsx"></script></body></html>',
        language: "html",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_app",
        projectId: "proj_data",
        path: "src/app/App.tsx",
        type: "frontend",
        purpose: "React pipeline dashboard",
        status: "approved",
        content: "export const App = () => <div>Pipeline Dashboard</div>;",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_py_main",
        projectId: "proj_data",
        path: "backend/main.py",
        type: "backend",
        purpose: "FastAPI Ingestion Endpoint",
        status: "approved",
        content: 'from fastapi import FastAPI\napp = FastAPI(title="Autonomous Data Pipeline")\n@app.get("/api/v1/health")\ndef health(): return {"status": "ok"}',
        language: "python",
        dependencies: [],
        versions: [],
      },
    ];

    const { stats } = synchronizeBlueprintAndArtifacts(parsed, artifacts);
    expect(stats.totalFiles).toBe(parsed.files.length);
    expect(stats.approved).toBe(artifacts.length);

    // Run isolated validation
    const validation = await validateTargetProjectInIsolation("Autonomous Data Pipeline", artifacts);
    expect(validation.valid).toBe(true);
    expect(validation.entryPointVerified).toBe(true);
    expect(validation.packageScriptsValid).toBe(true);
  });
});
