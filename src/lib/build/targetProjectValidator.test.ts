import { describe, it, expect } from "vitest";
import { validateTargetProjectInIsolation } from "./targetProjectValidator";
import type { BuildArtifact } from "@/types/artifact";

describe("Target Project Validation in Isolated Workspace", () => {
  it("validates a complete, functional web project in an isolated temporary directory", async () => {
    const artifacts: BuildArtifact[] = [
      {
        id: "art_pkg",
        projectId: "test_proj",
        path: "package.json",
        type: "config",
        purpose: "Package Manifest",
        status: "approved",
        content: JSON.stringify({
          name: "autonomous-data-pipeline",
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
        id: "art_html",
        projectId: "test_proj",
        path: "index.html",
        type: "frontend",
        purpose: "Vite HTML host template",
        status: "approved",
        content: '<!DOCTYPE html><html><body><div id="root"></div><script type="module" src="/src/app/App.tsx"></script></body></html>',
        language: "html",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_app",
        projectId: "test_proj",
        path: "src/app/App.tsx",
        type: "frontend",
        purpose: "Main App Component",
        status: "approved",
        content: "export const App = () => <div>Hello World</div>;",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_vite",
        projectId: "test_proj",
        path: "vite.config.ts",
        type: "config",
        purpose: "Vite build configuration",
        status: "approved",
        content: "import { defineConfig } from 'vite'; export default defineConfig({});",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_types",
        projectId: "test_proj",
        path: "src/core/types.ts",
        type: "backend",
        purpose: "Core domain types",
        status: "approved",
        content: "export interface PipelineConfig { id: string; name: string; }",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const result = await validateTargetProjectInIsolation("Autonomous Data Pipeline", artifacts);
    expect(result.valid).toBe(true);
    expect(result.entryPointVerified).toBe(true);
    expect(result.packageScriptsValid).toBe(true);
    expect(result.viteConfigValid).toBe(true);
    expect(result.missingFiles).toHaveLength(0);
    expect(result.filesChecked).toBe(5);
  });

  it("detects when index.html references non-existent entry point", async () => {
    const invalidArtifacts: BuildArtifact[] = [
      {
        id: "art_pkg",
        projectId: "test_proj",
        path: "package.json",
        type: "config",
        purpose: "Package Manifest",
        status: "approved",
        content: JSON.stringify({
          name: "test-app",
          scripts: { dev: "vite" },
        }),
        language: "json",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_html",
        projectId: "test_proj",
        path: "index.html",
        type: "frontend",
        purpose: "HTML host",
        status: "approved",
        content: '<!DOCTYPE html><html><body><script type="module" src="/src/missing/Main.tsx"></script></body></html>',
        language: "html",
        dependencies: [],
        versions: [],
      },
    ];

    const result = await validateTargetProjectInIsolation("Broken Project", invalidArtifacts);
    expect(result.valid).toBe(false);
    expect(result.entryPointVerified).toBe(false);
    expect(result.diagnostics.some((d) => d.includes("missing/Main.tsx"))).toBe(true);
  });
});
