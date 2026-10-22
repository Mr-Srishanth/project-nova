import { describe, it, expect } from "vitest";
import {
  parseBlueprintDirectoryTree,
  synchronizeBlueprintAndArtifacts,
} from "./blueprintDirectoryModel";
import type { BuildArtifact } from "@/types/artifact";

describe("Blueprint-Synchronized Directory Model", () => {
  const sampleFolderStructure = `my-app/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   └── Button.tsx
│   │   └── layout/
│   ├── modules/
│   └── types/
│       └── index.ts
├── index.html
├── package.json
└── tsconfig.json`;

  it("parses ASCII tree into canonical hierarchy preserving exact root name and relative paths", () => {
    const parsed = parseBlueprintDirectoryTree(sampleFolderStructure, "fallback-root");
    expect(parsed.rootName).toBe("my-app");
    expect(parsed.files).toContain("index.html");
    expect(parsed.files).toContain("package.json");
    expect(parsed.files).toContain("tsconfig.json");
    expect(parsed.files).toContain("src/app/App.tsx");
    expect(parsed.files).toContain("src/app/router.tsx");
    expect(parsed.files).toContain("src/components/ui/Button.tsx");
    expect(parsed.files).toContain("src/types/index.ts");
    expect(parsed.directories).toContain("src");
    expect(parsed.directories).toContain("src/app");
    expect(parsed.directories).toContain("src/components/ui");
  });

  it("synchronizes blueprint tree with artifacts, marking missing as planned and generated as generated", () => {
    const parsed = parseBlueprintDirectoryTree(sampleFolderStructure, "my-app");
    const artifacts: BuildArtifact[] = [
      {
        id: "art_1",
        projectId: "p1",
        path: "src/app/App.tsx",
        type: "frontend",
        purpose: "Main App Component",
        status: "generated",
        content: "export const App = () => <div>Hello</div>;",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_2",
        projectId: "p1",
        path: "package.json",
        type: "config",
        purpose: "Dependencies",
        status: "approved",
        content: '{"name": "my-app"}',
        language: "json",
        dependencies: [],
        versions: [],
      },
    ];

    const { tree, stats, additionalArtifacts } = synchronizeBlueprintAndArtifacts(
      parsed,
      artifacts
    );

    expect(stats.totalFiles).toBe(parsed.files.length);
    expect(stats.generated).toBe(1);
    expect(stats.approved).toBe(1);
    expect(stats.planned).toBe(parsed.files.length - 2);
    expect(additionalArtifacts).toHaveLength(0);

    // Verify root files exist in tree
    const rootFiles = tree.children.filter((c) => !c.isDir).map((c) => c.name);
    expect(rootFiles).toContain("index.html");
    expect(rootFiles).toContain("package.json");
    expect(rootFiles).toContain("tsconfig.json");
  });

  it("reports additional artifacts not present in the canonical blueprint", () => {
    const parsed = parseBlueprintDirectoryTree(sampleFolderStructure, "my-app");
    const artifacts: BuildArtifact[] = [
      {
        id: "art_extra",
        projectId: "p1",
        path: "unplanned/extra.ts",
        type: "backend",
        purpose: "Extra unplanned service",
        status: "generated",
        content: "console.log('extra');",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const { additionalArtifacts, stats } = synchronizeBlueprintAndArtifacts(parsed, artifacts);
    expect(additionalArtifacts).toHaveLength(1);
    expect(additionalArtifacts[0].path).toBe("unplanned/extra.ts");
    expect(stats.additional).toBe(1);
  });

  it("maintains distinct files even when basenames match across directories", () => {
    const duplicateBasenameTree = `project/
├── src/
│   ├── service.ts
│   └── core/
│       └── service.ts
└── test/
    └── service.ts`;

    const parsed = parseBlueprintDirectoryTree(duplicateBasenameTree, "project");
    expect(parsed.files).toEqual([
      "src/service.ts",
      "src/core/service.ts",
      "test/service.ts",
    ]);

    const artifacts: BuildArtifact[] = [
      {
        id: "art_src",
        projectId: "p1",
        path: "src/service.ts",
        type: "backend",
        purpose: "Src service",
        status: "approved",
        content: "export const a = 1;",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const { tree } = synchronizeBlueprintAndArtifacts(parsed, artifacts);
    // Find src/service.ts vs src/core/service.ts
    const srcDir = tree.children.find((c) => c.name === "src" && c.isDir);
    expect(srcDir).toBeDefined();

    const srcService = srcDir?.children.find((c) => c.name === "service.ts" && !c.isDir);
    expect(srcService?.status).toBe("approved");

    const coreDir = srcDir?.children.find((c) => c.name === "core" && c.isDir);
    const coreService = coreDir?.children.find((c) => c.name === "service.ts" && !c.isDir);
    expect(coreService?.status).toBe("planned");
  });
});
