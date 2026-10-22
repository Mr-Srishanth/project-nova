import { describe, it, expect, beforeEach } from "vitest";
import { checkFileExclusion, detectLanguageFromPath } from "./exclusionRules";
import { parseSourceStructure, resolveRelativeImport } from "./structureParser";
import { indexRepository } from "./indexingEngine";
import { detectArchitectureDrift } from "./driftEngine";
import { repositoryStorage } from "@/lib/storage/repositoryStorage";
import type { Blueprint } from "@/types/blueprint";
import type { ProjectDocument } from "@/types/document";
import type { ProjectMemory } from "@/types/memory";

describe("Phase 13: Repository Intelligence & Architecture Drift Engine", () => {
  const TEST_PROJECT_ID = "proj-repo-test";

  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. Exclusion Rules & Path Confinement", () => {
    it("should exclude node_modules, .git, and dist directories", () => {
      expect(checkFileExclusion("node_modules/react/index.js").isExcluded).toBe(true);
      expect(checkFileExclusion(".git/config").isExcluded).toBe(true);
      expect(checkFileExclusion("dist/bundle.js").isExcluded).toBe(true);
      expect(checkFileExclusion("src/components/Button.tsx").isExcluded).toBe(false);
    });

    it("should exclude secret and credential-bearing files", () => {
      expect(checkFileExclusion(".env").isExcluded).toBe(true);
      expect(checkFileExclusion(".env.production").isExcluded).toBe(true);
      expect(checkFileExclusion("id_rsa").isExcluded).toBe(true);
      expect(checkFileExclusion("server.key").isExcluded).toBe(true);
    });

    it("should correctly detect languages from file extensions", () => {
      expect(detectLanguageFromPath("src/App.tsx")).toBe("typescript");
      expect(detectLanguageFromPath("server/gateway.js")).toBe("javascript");
      expect(detectLanguageFromPath("package.json")).toBe("json");
      expect(detectLanguageFromPath("README.md")).toBe("markdown");
      expect(detectLanguageFromPath("styles.css")).toBe("css");
    });
  });

  describe("2. Structure & AST Token Parser", () => {
    it("should extract imports, exports, and symbols from TypeScript files", () => {
      const code = `
        import React, { useState } from "react";
        import { formatDate } from "./utils";
        import type { User } from "../types";

        export const API_BASE = "https://api.example.com";

        export function calculateTotal(items: number[]): number {
          return items.reduce((a, b) => a + b, 0);
        }

        export interface CartItem {
          id: string;
          price: number;
        }

        function internalHelper() {
          return true;
        }
      `;

      const structure = parseSourceStructure("src/cart.ts", code, "typescript");
      expect(structure.imports).toHaveLength(3);
      expect(structure.imports[0].source).toBe("react");
      expect(structure.imports[1].isRelative).toBe(true);
      expect(structure.exports).toContain("API_BASE");
      expect(structure.exports).toContain("calculateTotal");
      expect(structure.exports).toContain("CartItem");

      const helperSymbol = structure.symbols.find((s) => s.name === "internalHelper");
      expect(helperSymbol?.isExported).toBe(false);
    });

    it("should resolve relative imports across known project paths", () => {
      const knownPaths = new Set(["src/utils.ts", "src/components/Button.tsx"]);
      const resolved = resolveRelativeImport("src/components/Header.tsx", "../utils", knownPaths);
      expect(resolved).toBe("src/utils.ts");
    });
  });

  describe("3. Repository Indexing Engine & Dependency Graph", () => {
    it("should index files, detect project archetype, and build module dependency graph", async () => {
      const files = [
        {
          path: "package.json",
          content: JSON.stringify({
            name: "sample-app",
            dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
            devDependencies: { "@vitejs/plugin-react": "^4.3.4" },
          }),
        },
        {
          path: "src/main.tsx",
          content: `
            import React from "react";
            import { App } from "./App";
            export default function run() {}
          `,
        },
        {
          path: "src/App.tsx",
          content: `
            import React from "react";
            import { helper } from "./utils/helper";
            export const App = () => null;
          `,
        },
        {
          path: "src/utils/helper.ts",
          content: `
            export const helper = () => "ok";
          `,
        },
      ];

      const index = await indexRepository({
        projectId: TEST_PROJECT_ID,
        sourceType: "project_artifacts",
        sourceName: "Sample Artifacts",
        files,
      });

      expect(index.indexedFilesCount).toBe(4);
      expect(index.projectType).toContain("React / Vite");
      expect(index.dependencyGraph.edges.length).toBeGreaterThanOrEqual(2);
      expect(index.dependencyGraph.cycles).toHaveLength(0);
    });

    it("should detect circular dependency cycles in module graph", async () => {
      const files = [
        {
          path: "src/a.ts",
          content: `import { b } from "./b"; export const a = 1;`,
        },
        {
          path: "src/b.ts",
          content: `import { a } from "./a"; export const b = 2;`,
        },
      ];

      const index = await indexRepository({
        projectId: TEST_PROJECT_ID,
        sourceType: "project_artifacts",
        sourceName: "Cycle Artifacts",
        files,
      });

      expect(index.dependencyGraph.cycles.length).toBeGreaterThanOrEqual(1);
      const cycle = index.dependencyGraph.cycles[0];
      expect(cycle.files).toContain("src/a.ts");
      expect(cycle.files).toContain("src/b.ts");
    });
  });

  describe("4. Architecture & Documentation Drift Detection", () => {
    it("should flag blueprint API routes missing in repository", async () => {
      const index = await indexRepository({
        projectId: TEST_PROJECT_ID,
        sourceType: "project_artifacts",
        sourceName: "Test App",
        files: [
          {
            path: "src/server.ts",
            content: `
              // Missing declared POST /api/checkout route
              app.get("/api/health", () => {});
            `,
          },
        ],
      });

      const blueprint: Blueprint = {
        id: "bp-1",
        projectId: TEST_PROJECT_ID,
        title: "Test Blueprint",
        overview: "Test",
        problemStatement: "Problem",
        targetUsers: ["developers"],
        realWorldUseCase: "Testing",
        features: { mvp: ["auth"], important: [], advanced: [], optional: [] },
        techStack: [],
        architecture: { summary: "Architecture", nodes: [], edges: [] },
        database: { entities: [], relationships: [], sql: "" },
        api: [
          { method: "POST", route: "/api/checkout", purpose: "Payment checkout" },
        ],
        uiScreens: [],
        folderStructure: "src/",
        testingStrategy: [],
        deploymentStrategy: [],
        futureImprovements: [],
        updatedAt: new Date().toISOString(),
      };

      const findings = detectArchitectureDrift({
        index,
        blueprint,
      });

      const missingApi = findings.find((f) => f.category === "missing_api_route");
      expect(missingApi).toBeDefined();
      expect(missingApi?.targetReference).toBe("/api/checkout");
    });

    it("should flag documented files missing from repository index", async () => {
      const index = await indexRepository({
        projectId: TEST_PROJECT_ID,
        sourceType: "project_artifacts",
        sourceName: "Test App",
        files: [{ path: "src/index.ts", content: `export const x = 1;` }],
      });

      const documents: ProjectDocument[] = [
        {
          id: "doc-1",
          projectId: TEST_PROJECT_ID,
          title: "Architecture Guide",
          slug: "architecture-guide",
          type: "architecture",
          content: "See configuration file `src/config/database.ts` for database settings.",
          summary: "Architecture summary",
          sourcesUsed: [],
          isAiGenerated: false,
          linkedArtifactPaths: [],
          linkedBrainRecordIds: [],
          status: "approved",
          versions: [],
          driftFindings: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const findings = detectArchitectureDrift({
        index,
        documents,
      });

      const missingDocFile = findings.find((f) => f.category === "missing_documented_file");
      expect(missingDocFile).toBeDefined();
      expect(missingDocFile?.targetReference).toBe("src/config/database.ts");
    });

    it("should flag active Project Brain decisions that conflict with repository implementation", async () => {
      const index = await indexRepository({
        projectId: TEST_PROJECT_ID,
        sourceType: "project_artifacts",
        sourceName: "Test App",
        files: [
          {
            path: "package.json",
            content: JSON.stringify({ dependencies: { bootstrap: "^5.0.0" } }),
          },
          { path: "src/index.ts", content: "console.log(1);" },
          { path: "src/a.ts", content: "console.log(2);" },
          { path: "src/b.ts", content: "console.log(3);" },
          { path: "src/c.ts", content: "console.log(4);" },
          { path: "src/d.ts", content: "console.log(5);" },
          { path: "src/e.ts", content: "console.log(6);" },
        ],
      });

      const memories: ProjectMemory[] = [
        {
          id: "mem-tw",
          projectId: TEST_PROJECT_ID,
          type: "decision",
          title: "Use Tailwind CSS for All Components",
          content: "We decided to standardize exclusively on Tailwind utility styling.",
          source: "user",
          status: "active",
          verificationState: "user_confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const findings = detectArchitectureDrift({
        index,
        memories,
      });

      const twDrift = findings.find((f) => f.category === "conflicting_brain_decision");
      expect(twDrift).toBeDefined();
      expect(twDrift?.explanation).toContain("Tailwind CSS");
    });
  });

  describe("5. Repository Index Storage & Persistence", () => {
    it("should save and retrieve repository index scoped strictly to projectId", async () => {
      const index = await indexRepository({
        projectId: TEST_PROJECT_ID,
        sourceType: "project_artifacts",
        sourceName: "Stored App",
        files: [{ path: "src/test.ts", content: "export const ok = true;" }],
      });

      await repositoryStorage.saveIndex(index);
      const retrieved = await repositoryStorage.getIndex(TEST_PROJECT_ID);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.projectId).toBe(TEST_PROJECT_ID);
      expect(retrieved?.indexedFilesCount).toBe(1);

      // Verify other projects return null
      const other = await repositoryStorage.getIndex("other-proj");
      expect(other).toBeNull();
    });
  });
});
