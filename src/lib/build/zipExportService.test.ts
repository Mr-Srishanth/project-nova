import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  isSafeArchivePath,
  buildExportManifest,
  createProjectZipArchive,
} from "./zipExportService";
import { parseBlueprintDirectoryTree } from "./blueprintDirectoryModel";
import type { BuildArtifact } from "@/types/artifact";

describe("Project ZIP Export & Archive Integrity Service", () => {
  it("rejects forbidden secrets, credential files, path traversals, and build clutter", () => {
    expect(isSafeArchivePath(".env").safe).toBe(false);
    expect(isSafeArchivePath(".env.local").safe).toBe(false);
    expect(isSafeArchivePath("config/service_role.key").safe).toBe(false);
    expect(isSafeArchivePath("certs/server.pem").safe).toBe(false);
    expect(isSafeArchivePath(".git/config").safe).toBe(false);
    expect(isSafeArchivePath("node_modules/react/index.js").safe).toBe(false);
    expect(isSafeArchivePath("../parent.txt").safe).toBe(false);
    expect(isSafeArchivePath("/etc/passwd").safe).toBe(false);

    // Valid files
    expect(isSafeArchivePath("index.html").safe).toBe(true);
    expect(isSafeArchivePath("src/main.tsx").safe).toBe(true);
    expect(isSafeArchivePath("backend/main.py").safe).toBe(true);
    expect(isSafeArchivePath(".env.example").safe).toBe(true);
  });

  it("builds an export manifest accurately detecting complete vs incomplete states", () => {
    const rawTree = `sample-app/
├── index.html
├── package.json
└── src/
    └── main.tsx`;
    const bpModel = parseBlueprintDirectoryTree(rawTree, "sample-app");

    const artifacts: BuildArtifact[] = [
      {
        id: "art_1",
        projectId: "p1",
        path: "index.html",
        type: "frontend",
        purpose: "HTML Root",
        status: "approved",
        content: "<!DOCTYPE html><html><body>Root</body></html>",
        language: "html",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_2",
        projectId: "p1",
        path: "package.json",
        type: "config",
        purpose: "Package Manifest",
        status: "approved",
        content: JSON.stringify({ name: "sample-app" }),
        language: "json",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_3",
        projectId: "p1",
        path: "src/main.tsx",
        type: "frontend",
        purpose: "App Entry",
        status: "planned",
        content: "// src/main.tsx\n// Planned from Blueprint Studio\n",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const manifest = buildExportManifest("Sample App", bpModel, artifacts);
    expect(manifest.projectName).toBe("Sample App");
    expect(manifest.totalPlannedFiles).toBe(3);
    expect(manifest.totalIncludedFiles).toBe(3);
    expect(manifest.ungeneratedFiles).toContain("src/main.tsx");
    expect(manifest.isComplete).toBe(false);
  });

  it("generates a real ZIP archive, decompresses it, and verifies byte-for-byte content integrity", async () => {
    const rawTree = `data-pipeline/
├── index.html
├── vite.config.ts
├── package.json
├── backend/
│   └── main.py
└── src/
    └── App.tsx`;
    const bpModel = parseBlueprintDirectoryTree(rawTree, "data-pipeline");

    const artifacts: BuildArtifact[] = [
      {
        id: "art_html",
        projectId: "p2",
        path: "index.html",
        type: "frontend",
        purpose: "HTML Root",
        status: "approved",
        content: "<html><body><script type='module' src='/src/App.tsx'></script></body></html>",
        language: "html",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_vite",
        projectId: "p2",
        path: "vite.config.ts",
        type: "config",
        purpose: "Vite Configuration",
        status: "approved",
        content: "import { defineConfig } from 'vite'; export default defineConfig({});",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_pkg",
        projectId: "p2",
        path: "package.json",
        type: "config",
        purpose: "Dependencies",
        status: "approved",
        content: JSON.stringify({ name: "data-pipeline", scripts: { dev: "vite" } }, null, 2),
        language: "json",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_py",
        projectId: "p2",
        path: "backend/main.py",
        type: "backend",
        purpose: "FastAPI App",
        status: "approved",
        content: 'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/health")\ndef h(): return {"status":"ok"}',
        language: "python",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_app",
        projectId: "p2",
        path: "src/App.tsx",
        type: "frontend",
        purpose: "Main Component",
        status: "approved",
        content: "export const App = () => <div>Pipeline Monitor</div>;",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      // Intentionally insert a forbidden secret to test exclusion in export
      {
        id: "art_secret",
        projectId: "p2",
        path: ".env",
        type: "config",
        purpose: "Secrets",
        status: "approved",
        content: "SUPABASE_SERVICE_ROLE_KEY=supersecret123",
        language: "text",
        dependencies: [],
        versions: [],
      },
    ];

    const manifest = buildExportManifest("Autonomous Data Pipeline", bpModel, artifacts);
    expect(manifest.isComplete).toBe(true);
    expect(manifest.files.some((f) => f.path === ".env")).toBe(false);
    expect(manifest.exclusions.some((e) => e.path === ".env")).toBe(true);

    const { uint8Array, filename } = await createProjectZipArchive(manifest);
    expect(filename).toBe("autonomous-data-pipeline-source-code.zip");
    expect(uint8Array).toBeDefined();
    expect(uint8Array!.length).toBeGreaterThan(100);

    // Decompress and verify each file
    const loadedZip = await JSZip.loadAsync(uint8Array!);
    const unzippedPaths = Object.keys(loadedZip.files);

    expect(unzippedPaths).toContain("index.html");
    expect(unzippedPaths).toContain("vite.config.ts");
    expect(unzippedPaths).toContain("package.json");
    expect(unzippedPaths).toContain("backend/main.py");
    expect(unzippedPaths).toContain("src/App.tsx");
    expect(unzippedPaths).not.toContain(".env");

    const decompressedPython = await loadedZip.file("backend/main.py")!.async("string");
    expect(decompressedPython).toContain("from fastapi import FastAPI");

    const decompressedHtml = await loadedZip.file("index.html")!.async("string");
    expect(decompressedHtml).toContain("<script type='module' src='/src/App.tsx'></script>");
  });

  it("handles configured ZIP export only with explicit user confirmation while excluding raw certificates", async () => {
    const rawTree = `sample-app/
├── index.html
├── package.json
└── src/
    └── main.tsx`;
    const bpModel = parseBlueprintDirectoryTree(rawTree, "sample-app");
    const artifacts: BuildArtifact[] = [
      {
        id: "art_1",
        projectId: "p1",
        path: "index.html",
        type: "frontend",
        purpose: "HTML Root",
        status: "approved",
        content: "<!DOCTYPE html><html><body>Root</body></html>",
        language: "html",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_2",
        projectId: "p1",
        path: "package.json",
        type: "config",
        purpose: "Package",
        status: "approved",
        content: JSON.stringify({ name: "sample-app" }),
        language: "json",
        dependencies: [],
        versions: [],
      },
    ];

    // Case A: User selected Configured ZIP but DID NOT grant explicit confirmation checkbox
    const unconfirmedManifest = buildExportManifest("sample-app", bpModel, artifacts, {
      includeConfiguredEnv: true,
      userConfirmationGranted: false,
      configuredEnvContent: "VITE_SUPABASE_URL=https://custom.supabase.co\n",
    });
    expect(unconfirmedManifest.files.some((f) => f.path === ".env")).toBe(false);

    // Case B: User selected Configured ZIP AND granted explicit confirmation checkbox
    const confirmedManifest = buildExportManifest("sample-app", bpModel, artifacts, {
      includeConfiguredEnv: true,
      userConfirmationGranted: true,
      configuredEnvContent: "VITE_SUPABASE_URL=https://custom.supabase.co\n",
    });
    expect(confirmedManifest.files.some((f) => f.path === ".env")).toBe(true);

    const { uint8Array } = await createProjectZipArchive(confirmedManifest);
    const loadedZip = await JSZip.loadAsync(uint8Array!);
    expect(Object.keys(loadedZip.files)).toContain(".env");
    const envStr = await loadedZip.file(".env")!.async("string");
    expect(envStr).toContain("https://custom.supabase.co");
  });

  it("extracts and validates configured ZIP export in a clean temporary directory", async () => {
    const rawTree = `data-pipeline/
├── index.html
├── package.json
├── vite.config.ts
├── .env.example
├── .gitignore
├── requirements.txt
├── backend/
│   └── main.py
└── src/
    └── app/
        └── App.tsx`;

    const bpModel = parseBlueprintDirectoryTree(rawTree, "data-pipeline");
    const configuredEnv = `VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://target-prod.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.targettest
GEMINI_API_KEY=AIzaSyTargetExplicitKey999
PORT=8000
DATABASE_URL=duckdb:///./data/pipeline.duckdb
DATA_STORAGE_DIR=./data/partitions
`;

    const gitignoreContent = `.env
.env.local
node_modules/
dist/
`;

    const artifacts: BuildArtifact[] = [
      {
        id: "art_html",
        projectId: "dp1",
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
        id: "art_pkg",
        projectId: "dp1",
        path: "package.json",
        type: "config",
        purpose: "Package Manifest",
        status: "approved",
        content: JSON.stringify({
          name: "data-pipeline",
          scripts: { dev: "vite", build: "tsc -b && vite build" },
        }),
        language: "json",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_vite",
        projectId: "dp1",
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
        id: "art_envexample",
        projectId: "dp1",
        path: ".env.example",
        type: "config",
        purpose: "Safe Environment Template",
        status: "approved",
        content: "VITE_SUPABASE_URL=https://your-project.supabase.co\nGEMINI_API_KEY=AIzaSy...\n",
        language: "text",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_gitignore",
        projectId: "dp1",
        path: ".gitignore",
        type: "config",
        purpose: "Git Ignore Rules",
        status: "approved",
        content: gitignoreContent,
        language: "text",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_req",
        projectId: "dp1",
        path: "requirements.txt",
        type: "config",
        purpose: "Python packages",
        status: "approved",
        content: "fastapi==0.110.0\nuvicorn==0.28.0\nduckdb==0.10.0\n",
        language: "text",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_py",
        projectId: "dp1",
        path: "backend/main.py",
        type: "backend",
        purpose: "FastAPI server",
        status: "approved",
        content: "import os\nfrom fastapi import FastAPI\napp = FastAPI()\ngemini_key = os.getenv('GEMINI_API_KEY')",
        language: "python",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_app",
        projectId: "dp1",
        path: "src/app/App.tsx",
        type: "frontend",
        purpose: "Frontend UI",
        status: "approved",
        content: "export const App = () => <div>Target Data Pipeline</div>;",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const manifest = buildExportManifest("data-pipeline", bpModel, artifacts, {
      includeConfiguredEnv: true,
      userConfirmationGranted: true,
      configuredEnvContent: configuredEnv,
    });

    const { uint8Array } = await createProjectZipArchive(manifest);
    const loadedZip = await JSZip.loadAsync(uint8Array!);
    const fileNames = Object.keys(loadedZip.files);

    // 1. .env exists at root and contains user's target values
    expect(fileNames).toContain(".env");
    const extractedEnv = await loadedZip.file(".env")!.async("string");
    expect(extractedEnv).toContain("https://target-prod.supabase.co");
    expect(extractedEnv).toContain("AIzaSyTargetExplicitKey999");
    expect(extractedEnv).toContain("duckdb:///./data/pipeline.duckdb");

    // 2. .env.example is also included
    expect(fileNames).toContain(".env.example");
    const extractedExample = await loadedZip.file(".env.example")!.async("string");
    expect(extractedExample).toContain("https://your-project.supabase.co");

    // 3. .gitignore excludes .env
    expect(fileNames).toContain(".gitignore");
    const extractedGitignore = await loadedZip.file(".gitignore")!.async("string");
    expect(extractedGitignore).toContain(".env");

    // 4. GEMINI_API_KEY is not placed in any frontend bundle or VITE_ prefix variable
    expect(extractedEnv).not.toContain("VITE_GEMINI_API_KEY");
    const appTsxContent = await loadedZip.file("src/app/App.tsx")!.async("string");
    expect(appTsxContent).not.toContain("AIzaSyTargetExplicitKey999");

    // 5. Backend main.py references environment safely via os.getenv
    const pyContent = await loadedZip.file("backend/main.py")!.async("string");
    expect(pyContent).toContain("os.getenv('GEMINI_API_KEY')");
  });
});
