import { describe, it, expect, beforeEach } from "vitest";
import { projectStorage } from "@/lib/storage/projectStorage";
import { planAIEdits } from "@/lib/uiStudio/aiEditEngine";
import { generateTargetProjectBaseline } from "@/lib/build/targetProjectBaseline";
import type { BuildArtifact } from "@/types/artifact";

function makeArtifact(path: string, content: string): BuildArtifact {
  return {
    id: `art_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
    projectId: "proj_omnibite",
    path,
    type: "frontend",
    purpose: "test",
    status: "approved",
    content,
    language: "typescript",
    dependencies: [],
    versions: [],
  };
}

describe("Single-Prompt Project Creation Handoff & Idempotent Generation", () => {
  const omniBitePrompt =
    "Build OmniBite Solo, a premium food ordering web app with a responsive restaurant menu, food categories, product cards showing names and prices, Add to Cart buttons, quantity controls, a cart with live subtotal, and a polished mobile-friendly interface. Use a modern premium design and make the main interactions functional.";

  beforeEach(() => {
    localStorage.clear();
  });

  it("persists the exact original user prompt and generation status upon project creation", async () => {
    const created = await projectStorage.create({
      name: "OmniBite Solo",
      category: "Web Application",
      objective: "Deliver a food ordering application with live menu and cart arithmetic.",
      description: "OmniBite Solo food delivery web client.",
      technologies: ["React", "TypeScript", "Tailwind CSS"],
      initialPrompt: omniBitePrompt,
      generationStatus: "not_generated",
    });

    expect(created.id).toBeDefined();
    expect(created.initialPrompt).toBe(omniBitePrompt);
    expect(created.generationStatus).toBe("not_generated");

    // Verify localStorage persistence
    const reloaded = await projectStorage.getById(created.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.initialPrompt).toBe(omniBitePrompt);
    expect(reloaded?.generationStatus).toBe("not_generated");
  });

  it("preserves legacy projects without initialPrompt or generationStatus metadata", async () => {
    const legacyProject = await projectStorage.create({
      name: "Legacy Analytics",
      category: "Developer Tool",
      objective: "Telemetry dashboard",
      description: "Legacy project created before single-prompt handoff",
      technologies: ["React"],
    });

    // Should not invent an initialPrompt
    expect(legacyProject.initialPrompt).toBeUndefined();
    expect(legacyProject.generationStatus).toBeUndefined();

    // Baseline files are accessible
    const baseline = generateTargetProjectBaseline(legacyProject);
    expect(baseline["src/app/App.tsx"]).toBeDefined();
  });

  it("executes the single-prompt initial generation using the saved prompt without requiring a second prompt", async () => {
    const project = await projectStorage.create({
      name: "OmniBite Solo",
      category: "Web Application",
      objective: "Deliver a food ordering application with live menu and cart arithmetic.",
      description: "OmniBite Solo food delivery web client.",
      technologies: ["React", "TypeScript", "Tailwind CSS"],
      initialPrompt: omniBitePrompt,
      generationStatus: "not_generated",
    });

    // Baseline artifacts
    const baseline = generateTargetProjectBaseline(project);
    const artifacts: BuildArtifact[] = Object.entries(baseline).map(([path, content]) =>
      makeArtifact(path, content)
    );

    // Initial generation triggered using the saved initialPrompt
    const plan = await planAIEdits({
      operationId: "op_init_test",
      projectId: project.id,
      projectName: project.name,
      userPrompt: project.initialPrompt!,
      mode: "auto",
      artifacts,
      activeFilePath: "src/app/App.tsx",
    });

    expect(plan).toBeDefined();
    expect(plan.userPrompt).toBe(omniBitePrompt);
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items[0].filePath).toBe("src/app/App.tsx");

    // Update generationStatus to 'generated' upon completion
    const updated = await projectStorage.update(project.id, { generationStatus: "generated" });
    expect(updated.generationStatus).toBe("generated");
    // Verify initialPrompt was preserved
    expect(updated.initialPrompt).toBe(omniBitePrompt);
  });

  it("allows prompt editing inside UI Studio without destroying the original creation prompt", async () => {
    const project = await projectStorage.create({
      name: "OmniBite Solo",
      category: "Web Application",
      objective: "Food ordering app",
      description: "Food app",
      technologies: ["React", "TypeScript", "Tailwind CSS"],
      initialPrompt: omniBitePrompt,
      generationStatus: "generated",
    });

    const revisionPrompt =
      "Add a vegetarian-only category filter, make the food cards more premium, and preserve the existing cart functionality.";

    // Revision edit using planAIEdits
    const revisionPlan = await planAIEdits({
      operationId: "op_rev_test",
      projectId: project.id,
      projectName: project.name,
      userPrompt: revisionPrompt,
      mode: "edit",
      artifacts: [makeArtifact("src/app/App.tsx", "export const App = () => <div>OmniBite Menu</div>;")],
      activeFilePath: "src/app/App.tsx",
    });

    expect(revisionPlan.userPrompt).toBe(revisionPrompt);

    // The project's stored initialPrompt must remain untouched
    const retrieved = await projectStorage.getById(project.id);
    expect(retrieved?.initialPrompt).toBe(omniBitePrompt);
  });

  it("handles failed generation safely and allows retry with the original prompt", async () => {
    const project = await projectStorage.create({
      name: "Failed Project",
      category: "Web Application",
      objective: "Testing failure recovery",
      description: "Fail test",
      technologies: ["React"],
      initialPrompt: "Build something cool",
      generationStatus: "failed",
    });

    expect(project.generationStatus).toBe("failed");
    expect(project.initialPrompt).toBe("Build something cool");

    // Retry uses the same initialPrompt
    const retryPlan = await planAIEdits({
      operationId: "op_retry_test",
      projectId: project.id,
      projectName: project.name,
      userPrompt: project.initialPrompt!,
      mode: "auto",
      artifacts: [makeArtifact("src/app/App.tsx", "export const App = () => <div>Starter</div>;")],
      activeFilePath: "src/app/App.tsx",
    });

    expect(retryPlan.userPrompt).toBe("Build something cool");
  });
});
