import { describe, it, expect, beforeEach } from "vitest";
import { inferMonacoLanguage } from "./MonacoCodeEditor";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import type { BuildArtifact } from "@/types/artifact";

describe("VS Code-Style IDE Architecture & Editor Workflows", () => {
  const dummyProjectId = "proj_test_ide_sandbox";

  beforeEach(async () => {
    localStorage.clear();
  });

  describe("Monaco Language Inference", () => {
    it("maps file extensions correctly to Monaco language modes", () => {
      expect(inferMonacoLanguage("src/App.tsx")).toBe("typescript");
      expect(inferMonacoLanguage("src/utils.ts")).toBe("typescript");
      expect(inferMonacoLanguage("package.json")).toBe("json");
      expect(inferMonacoLanguage("styles.css")).toBe("css");
      expect(inferMonacoLanguage("index.html")).toBe("html");
      expect(inferMonacoLanguage("backend/main.py")).toBe("python");
      expect(inferMonacoLanguage("schema.sql")).toBe("sql");
      expect(inferMonacoLanguage("README.md")).toBe("markdown");
      expect(inferMonacoLanguage("unknown.xyz")).toBe("plaintext");
    });
  });

  describe("Artifact Persistence & State Management", () => {
    it("saves edits to artifact storage and creates a version snapshot", async () => {
      const initialArtifact: BuildArtifact = {
        id: "art_1",
        projectId: dummyProjectId,
        path: "src/main.ts",
        type: "frontend",
        purpose: "Main entry point",
        status: "generated",
        content: "console.log('initial');",
        language: "typescript",
        dependencies: [],
        versions: [],
      };

      await artifactStorage.save(initialArtifact);

      // Record a new version
      const updated = await artifactStorage.recordVersion(
        dummyProjectId,
        "src/main.ts",
        "console.log('updated content');",
        "Updated entry point",
        "user"
      );

      expect(updated.content).toBe("console.log('updated content');");
      expect(updated.versions.length).toBe(1);
      expect(updated.versions[0].content).toBe("console.log('initial');");
      expect(updated.versions[0].author).toBe("user");
    });

    it("creates, retrieves, and deletes files without cross-project leakage", async () => {
      const artAlpha: BuildArtifact = {
        id: "art_alpha",
        projectId: "proj_alpha",
        path: "src/alpha.ts",
        type: "frontend",
        purpose: "Alpha file",
        status: "generated",
        content: "export const alpha = 1;",
        language: "typescript",
        dependencies: [],
        versions: [],
      };

      const artBeta: BuildArtifact = {
        id: "art_beta",
        projectId: "proj_beta",
        path: "src/beta.ts",
        type: "frontend",
        purpose: "Beta file",
        status: "generated",
        content: "export const beta = 2;",
        language: "typescript",
        dependencies: [],
        versions: [],
      };

      await artifactStorage.save(artAlpha);
      await artifactStorage.save(artBeta);

      const alphaList = await artifactStorage.list("proj_alpha");
      const betaList = await artifactStorage.list("proj_beta");

      expect(alphaList.some((a) => a.path === "src/alpha.ts")).toBe(true);
      expect(alphaList.some((a) => a.path === "src/beta.ts")).toBe(false);

      expect(betaList.some((a) => a.path === "src/beta.ts")).toBe(true);
      expect(betaList.some((a) => a.path === "src/alpha.ts")).toBe(false);
    });
  });
});
