import { describe, it, expect } from "vitest";
import { generateDefaultBlueprint } from "@/lib/blueprintDefaults";
import {
  detectProjectArchetype,
  generateTargetProjectBaseline,
} from "./targetProjectBaseline";
import { parseBlueprintDirectoryTree } from "./blueprintDirectoryModel";
import { buildExportManifest } from "./zipExportService";
import { validateTargetProjectInIsolation } from "./targetProjectValidator";
import { buildTargetProjectPreviewHtml } from "@/lib/preview/previewBuilder";
import type { BuildArtifact } from "@/types/artifact";

describe("Car Game Intent, Blueprint, Baseline & Export Verification", () => {
  const carGameProject = {
    id: "proj_car_game_123",
    name: "NitroPulse Car Game",
    category: "Game Development" as any,
    objective: "Build a high-velocity 2D highway car racing game with collision detection, traffic, and steering controls",
    description: "Build an arcade car game where the player dodges obstacles and overtakes traffic on a multi-lane highway",
    technologies: ["React", "TypeScript", "HTML5 Canvas", "Vite", "Tailwind CSS"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("detects 'car_game' archetype accurately from user prompt and objective", () => {
    const archetype = detectProjectArchetype(carGameProject);
    expect(archetype).toBe("car_game");
  });

  it("generates a domain-specific car game blueprint rather than generic enterprise CRUD", () => {
    const bp = generateDefaultBlueprint(
      carGameProject.id,
      carGameProject.name,
      carGameProject.technologies,
      carGameProject.category,
      carGameProject.objective,
      carGameProject.description
    );

    expect(bp.title).toContain("Car Game");
    expect(bp.overview).toContain("Car Racing");
    // Verify features mention gameplay, steering controls, collision detection
    const allFeatures = [
      ...bp.features.mvp,
      ...bp.features.important,
      ...bp.features.advanced,
    ].join(" ");
    expect(allFeatures).toMatch(/game loop|steering|collision|traffic|speedometer/i);

    // Verify folder structure contains standard client files
    expect(bp.folderStructure).toContain("index.html");
    expect(bp.folderStructure).toContain("App.tsx");
    expect(bp.folderStructure).toContain("main.tsx");
  });

  it("produces complete, runnable baseline files for the car game", () => {
    const bp = generateDefaultBlueprint(
      carGameProject.id,
      carGameProject.name,
      carGameProject.technologies,
      carGameProject.category,
      carGameProject.objective,
      carGameProject.description
    );

    const baseline = generateTargetProjectBaseline(carGameProject as any, bp);

    // 1. package.json must have Vite dev/build/preview scripts
    expect(baseline["package.json"]).toBeDefined();
    const pkg = JSON.parse(baseline["package.json"]);
    expect(pkg.scripts.dev).toBe("vite");
    expect(pkg.scripts.build).toContain("vite build");
    expect(pkg.scripts.preview).toBe("vite preview");
    expect(pkg.dependencies.react).toBeDefined();

    // 2. index.html must mount React into #root and load /src/main.tsx
    expect(baseline["index.html"]).toBeDefined();
    expect(baseline["index.html"]).toContain('<div id="root"></div>');
    expect(baseline["index.html"]).toContain('<script type="module" src="/src/main.tsx"></script>');

    // 3. src/main.tsx must mount App
    expect(baseline["src/main.tsx"]).toBeDefined();
    expect(baseline["src/main.tsx"]).toContain('createRoot(rootEl).render(');

    // 4. src/app/App.tsx must be the complete, playable car game engine
    const appTsx = baseline["src/app/App.tsx"];
    expect(appTsx).toBeDefined();
    expect(appTsx).toContain("requestAnimationFrame");
    expect(appTsx).toContain("handleKeyDown");
    expect(appTsx).toContain("ArrowLeft");
    expect(appTsx).toContain("collided");
    expect(appTsx).toContain("<canvas");
    expect(appTsx).toContain("speed");
    expect(appTsx).toContain("distance");

    // 5. README.md must clearly specify how to launch
    expect(baseline["README.md"]).toBeDefined();
    expect(baseline["README.md"]).toContain("npm install");
    expect(baseline["README.md"]).toContain("npm run dev");
  });

  it("passes targetProjectValidator in isolated workspace sandbox", async () => {
    const bp = generateDefaultBlueprint(
      carGameProject.id,
      carGameProject.name,
      carGameProject.technologies,
      carGameProject.category,
      carGameProject.objective,
      carGameProject.description
    );

    const baseline = generateTargetProjectBaseline(carGameProject as any, bp);
    const artifacts: BuildArtifact[] = Object.entries(baseline).map(([filePath, content]) => ({
      id: `art_${filePath}`,
      projectId: carGameProject.id,
      path: filePath,
      type: "frontend",
      purpose: `Baseline for ${filePath}`,
      status: "approved",
      content,
      language: filePath.endsWith(".ts") || filePath.endsWith(".tsx") ? "typescript" : "text",
      dependencies: [],
      versions: [],
    }));

    const validation = await validateTargetProjectInIsolation(carGameProject.name, artifacts);
    expect(validation.valid).toBe(true);
    expect(validation.entryPointVerified).toBe(true);
    expect(validation.packageScriptsValid).toBe(true);
    expect(validation.missingFiles).toHaveLength(0);
    expect(validation.syntaxErrors).toHaveLength(0);
  });

  it("produces an export manifest containing the playable car game and entry point without forbidden files", () => {
    const bp = generateDefaultBlueprint(
      carGameProject.id,
      carGameProject.name,
      carGameProject.technologies,
      carGameProject.category,
      carGameProject.objective,
      carGameProject.description
    );

    const parsedModel = parseBlueprintDirectoryTree(bp.folderStructure);
    const baseline = generateTargetProjectBaseline(carGameProject as any, bp);

    const artifacts: BuildArtifact[] = Object.entries(baseline).map(([filePath, content]) => ({
      id: `art_${filePath}`,
      projectId: carGameProject.id,
      path: filePath,
      type: "frontend",
      purpose: `Baseline for ${filePath}`,
      status: "approved",
      content,
      language: filePath.endsWith(".ts") || filePath.endsWith(".tsx") ? "typescript" : "text",
      dependencies: [],
      versions: [],
    }));

    const manifest = buildExportManifest(carGameProject.name, parsedModel, artifacts);

    // Verify index.html and App.tsx are in manifest
    const paths = manifest.files.map((f) => f.path);
    expect(paths).toContain("index.html");
    expect(paths).toContain("src/app/App.tsx");
    expect(paths).toContain("src/main.tsx");
    expect(paths).toContain("package.json");
    expect(paths).toContain("README.md");

    // Manifest must not leak raw .env unless opted in
    expect(paths).not.toContain(".env");
    expect(paths).toContain(".env.example");

    // Verify index.html content inside manifest mounts main.tsx
    const indexHtml = manifest.files.find((f) => f.path === "index.html")!;
    expect(indexHtml.content).toContain('<script type="module" src="/src/main.tsx"></script>');

    // Verify App.tsx content inside manifest has playable game loop and responsive layout properties
    const appTsx = manifest.files.find((f) => f.path === "src/app/App.tsx")!;
    expect(appTsx.content).toContain("<canvas");
    expect(appTsx.content).toContain("requestAnimationFrame");
    expect(appTsx.content).toContain("overflow-x-hidden");
    expect(appTsx.content).toContain("box-border");
    expect(appTsx.content).toContain("aspect-[2/3]");
  });

  it("verifies all generated archetypes provide responsive viewport styling without horizontal overflow", () => {
    const archetypes: Array<{ archetype: string; project: any }> = [
      {
        archetype: "car_game",
        project: carGameProject,
      },
      {
        archetype: "game",
        project: {
          id: "proj_arcade",
          name: "Space Dodge Arcade",
          category: "Game Development",
          objective: "Retro arcade falling blocks dodging game",
          technologies: ["React", "TypeScript", "Canvas"],
        },
      },
      {
        archetype: "dashboard",
        project: {
          id: "proj_dash",
          name: "Telemetry Dashboard",
          category: "Full-Stack Web App",
          objective: "Operational metrics and analytics dashboard",
          technologies: ["React", "TypeScript", "Tailwind CSS"],
        },
      },
      {
        archetype: "website",
        project: {
          id: "proj_site",
          name: "Creative Portfolio",
          category: "Landing Page / Website",
          objective: "High-end product showcase website",
          technologies: ["React", "TypeScript", "Tailwind CSS"],
        },
      },
    ];

    for (const { project } of archetypes) {
      const bp = generateDefaultBlueprint(
        project.id,
        project.name,
        project.technologies,
        project.category,
        project.objective
      );
      const baseline = generateTargetProjectBaseline(project as any, bp);
      const appContent = baseline["src/app/App.tsx"];
      const indexHtml = baseline["index.html"];

      expect(indexHtml).toContain('name="viewport" content="width=device-width, initial-scale=1.0"');
      expect(appContent).toContain("overflow-x-hidden");
      expect(appContent).toContain("box-border");
    }
  });

  it("generates an App.tsx with balanced component closers (no duplicated close-paren)", () => {
    const baseline = generateTargetProjectBaseline(carGameProject as any);
    const appTsx = baseline["src/app/App.tsx"];

    // Regression: the template once emitted a duplicated "  );" after the
    // return statement, which broke transpilation of the whole file
    // (surfaced as: Transpilation error: Unexpected token, expected ";" (161:42)).
    expect(appTsx.trimEnd().endsWith("    </div>\n  );\n};")).toBe(true);
    expect(appTsx).not.toContain("  );\n  );");
  });

  it("builds a preview from the freshly generated baseline with no transpilation error", () => {
    const baseline = generateTargetProjectBaseline(carGameProject as any);
    const artifacts: BuildArtifact[] = Object.entries(baseline).map(([filePath, content]) => ({
      id: `art_${filePath}`,
      projectId: carGameProject.id,
      path: filePath,
      type: "frontend",
      purpose: `Baseline for ${filePath}`,
      status: "approved",
      content,
      language: filePath.endsWith(".ts") || filePath.endsWith(".tsx") ? "typescript" : "text",
      dependencies: [],
      versions: [],
    }));

    const preview = buildTargetProjectPreviewHtml(carGameProject.name, artifacts);
    expect(preview.entryFile).toBe("src/app/App.tsx");
    expect(preview.diagnostics.filter((d) => d.includes("Transpilation error"))).toHaveLength(0);
    // The transpiled game component actually made it into the document
    expect(preview.html).toContain("START PLAYING");
  });

  it("locks the car game to a single viewport-sized screen with no scrollbars", () => {
    const baseline = generateTargetProjectBaseline(carGameProject as any);
    const appTsx = baseline["src/app/App.tsx"];
    const indexCss = baseline["src/index.css"];

    // Root container is sized to the dynamic viewport and clips overflow on
    // both axes instead of growing with content (the old min-h-screen root
    // plus vh-capped canvas overflowed short/narrow preview viewports).
    expect(appTsx).toContain("h-[100dvh]");
    expect(appTsx).toContain("max-h-[100dvh]");
    expect(appTsx).toContain("overflow-hidden");
    expect(appTsx).not.toContain("min-h-screen");
    // The canvas scales to its stage instead of fixed vh caps.
    expect(appTsx).toContain("max-h-full");
    expect(appTsx).not.toContain("max-h-[52vh]");

    // The generated shell itself is height-locked and non-scrolling.
    expect(indexCss).toContain("height: 100%");
    expect(indexCss).toContain("overflow: hidden");
  });

  it("keeps the viewport-lock shell scoped to the car_game archetype only", () => {
    const arcadeProject = {
      id: "proj_arcade",
      name: "Space Dodge Arcade",
      category: "Game Development",
      objective: "Retro arcade falling blocks dodging game",
      technologies: ["React", "TypeScript", "Canvas"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const baseline = generateTargetProjectBaseline(arcadeProject as any);

    // Other archetypes keep the original free-scrolling shell, unchanged.
    expect(baseline["src/index.css"]).not.toContain("overflow: hidden");
    expect(baseline["src/app/App.tsx"]).toContain("min-h-screen");
    expect(baseline["src/app/App.tsx"]).not.toContain("h-[100dvh]");
  });
});
