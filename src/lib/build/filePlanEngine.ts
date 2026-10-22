import type { Blueprint } from "@/types/blueprint";
import type { Project } from "@/types/project";
import type { FilePlan, FilePlanItem } from "@/types/artifact";
import { validateRelativeFilePath } from "./pathValidator";
import {
  parseBlueprintDirectoryTree,
  inferArtifactTypeAndLanguage,
} from "./blueprintDirectoryModel";

/**
 * Derives the canonical file plan directly from the project's Blueprint directory structure,
 * augmented with semantic blueprint artifacts (schema, API routes, core services, UI, tests).
 * Guaranteed 1-to-1 parity with the Blueprint Studio directory tree while fulfilling contract specs.
 */
export function generateFilePlanFromBlueprint(project: Project, blueprint?: Blueprint): FilePlan {
  const items: FilePlanItem[] = [];
  const addedPaths = new Set<string>();

  const addItem = (item: FilePlanItem) => {
    const val = validateRelativeFilePath(item.path);
    if (!val.isValid || !val.normalizedPath) return;
    const norm = val.normalizedPath;
    if (!addedPaths.has(norm)) {
      addedPaths.add(norm);
      items.push({ ...item, path: norm });
    }
  };

  // 1. Files defined in folderStructure
  if (blueprint?.folderStructure && blueprint.folderStructure.trim().length > 0) {
    const parsed = parseBlueprintDirectoryTree(
      blueprint.folderStructure,
      project.name.toLowerCase().replace(/\s+/g, "-")
    );

    for (const filePath of parsed.files) {
      const { type, language } = inferArtifactTypeAndLanguage(filePath);
      let purpose = `Source file for ${filePath}`;
      if (filePath === "package.json") {
        purpose = "Project dependencies and execution scripts";
      } else if (filePath === "tsconfig.json") {
        purpose = "TypeScript compiler settings and path aliases";
      } else if (filePath === "README.md") {
        purpose = "Project overview, setup instructions, and architecture synopsis";
      } else if (filePath.endsWith("schema.sql")) {
        purpose = "DDL database table definitions and indices";
      } else if (filePath.includes("route") || filePath.includes("api")) {
        purpose = "API endpoint routing and request handlers";
      } else if (filePath.includes("test") || filePath.includes("spec")) {
        purpose = "Automated unit and contract verification tests";
      } else if (filePath.includes("App.tsx") || filePath.includes("main.")) {
        purpose = "Application root component and layout orchestrator";
      }

      addItem({
        path: filePath,
        type,
        purpose,
        language,
        dependencies: [],
        blueprintRef: "folderStructure",
      });
    }
  }

  // 2. Root config baseline
  addItem({
    path: "package.json",
    type: "config",
    purpose: "Project dependencies and execution scripts",
    language: "json",
    dependencies: [],
    blueprintRef: "techStack",
  });
  addItem({
    path: "tsconfig.json",
    type: "config",
    purpose: "TypeScript compiler settings and path aliases",
    language: "json",
    dependencies: ["package.json"],
    blueprintRef: "techStack",
  });
  addItem({
    path: "README.md",
    type: "docs",
    purpose: "Project overview, setup instructions, and architecture synopsis",
    language: "markdown",
    dependencies: [],
    blueprintRef: "overview",
  });

  // 3. Database Schema Artifact
  if (blueprint?.database?.sql) {
    addItem({
      path: "src/db/schema.sql",
      type: "schema",
      purpose: "DDL database table definitions and indices",
      language: "sql",
      dependencies: [],
      blueprintRef: "database",
    });
  }

  // 4. API Route Artifacts
  if (blueprint?.api && blueprint.api.length > 0) {
    addItem({
      path: "src/api/routes.ts",
      type: "api",
      purpose: "REST API route handlers and request/response validation",
      language: "typescript",
      dependencies: ["package.json"],
      blueprintRef: "api",
    });
  }

  // 5. Architecture / Domain Core
  if (blueprint?.architecture?.nodes) {
    addItem({
      path: "src/core/types.ts",
      type: "backend",
      purpose: "Core entity domain models and contract interfaces",
      language: "typescript",
      dependencies: [],
      blueprintRef: "architecture",
    });
    addItem({
      path: "src/core/service.ts",
      type: "backend",
      purpose: "Primary business logic and state workflow coordinator",
      language: "typescript",
      dependencies: ["src/core/types.ts"],
      blueprintRef: "architecture",
    });
  }

  // 6. Frontend UI Screens & CSS Entry
  if (blueprint?.uiScreens && blueprint.uiScreens.length > 0) {
    addItem({
      path: "src/app/App.tsx",
      type: "frontend",
      purpose: "Main application layout and screen orchestrator",
      language: "typescript",
      dependencies: ["src/core/types.ts"],
      blueprintRef: "uiScreens",
    });
  } else {
    addItem({
      path: "src/main.ts",
      type: "frontend",
      purpose: "Application entry point",
      language: "typescript",
      dependencies: ["src/core/types.ts"],
      blueprintRef: "features",
    });
  }

  // 7. Testing Strategy
  addItem({
    path: "src/core/service.test.ts",
    type: "test",
    purpose: "Automated unit tests for core service contracts",
    language: "typescript",
    dependencies: ["src/core/service.ts"],
    blueprintRef: "testingStrategy",
  });

  return {
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    files: items,
  };
}
