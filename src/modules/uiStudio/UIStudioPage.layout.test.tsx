import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UIStudioPage } from "./UIStudioPage";
import { ActiveProjectProvider } from "@/lib/context/ActiveProjectContext";
import { generateTargetProjectBaseline } from "@/lib/build/targetProjectBaseline";
import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom does not implement scrollIntoView; the AI panel calls it on mount.
if (!(Element.prototype as { scrollIntoView?: unknown }).scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const PROJECT_ID = "proj_layout_demo";

/**
 * Seed localStorage with one project whose files are exactly the generated
 * baseline set (so the opener has nothing to add), with the entry component
 * replaced by a minimal valid one. Note: the stock car-game baseline App.tsx
 * currently fails the preview builder's transpiler ("Unexpected token
 * (161:42)") — a pre-existing baseline issue, reproduced with the builder
 * alone and visible in production before this layout change — so this test
 * uses a buildable entry to exercise the full preview-mount path.
 */
function seedBuildableProject() {
  const project = {
    id: PROJECT_ID,
    name: "Layout Demo App",
    description: "Minimal app used by the UI Studio layout test.",
    objective: "Render a preview.",
    category: "Web Application",
    technologies: ["React", "TypeScript"],
    status: "active",
    discoveryMode: "custom",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [],
  } as unknown as Project;

  const baseline = generateTargetProjectBaseline(project, undefined);
  const artifacts: BuildArtifact[] = Object.entries(baseline).map(([path, content]) => ({
    id: `art_${PROJECT_ID}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
    projectId: PROJECT_ID,
    path,
    type: path.endsWith(".tsx") ? "frontend" : "config",
    purpose: `Baseline for ${path}`,
    status: "approved",
    content:
      path === "src/app/App.tsx"
        ? 'import React from "react";\n\nexport const App: React.FC = () => {\n  return <div>Hello Preview</div>;\n};\n\nexport default App;\n'
        : content,
    language: path.endsWith(".tsx") || path.endsWith(".ts") ? "typescript" : "text",
    dependencies: [],
    versions: [],
  }));

  localStorage.setItem("projectnova_projects_v1", JSON.stringify([project]));
  localStorage.setItem("projectnova_build_artifacts_v1", JSON.stringify(artifacts));
}

/**
 * Layout contract for the simplified UI Studio (owner instruction, 2026-10-23):
 * the workspace is ONLY the Live Preview + the AI Assistant chat + the Inspector
 * panel, under a slim top bar (project selector + save/revision status).
 * The Explorer, code editor, Pages/Design/Health sections, mode toggle and
 * History panel must not render. Code editing lives in Build Studio.
 */
describe("UIStudioPage layout — preview + AI chat + inspector only", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    seedBuildableProject();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  async function renderStudioAndSettle() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/ui-studio?project=${PROJECT_ID}`]}>
          <ActiveProjectProvider>
            <UIStudioPage />
          </ActiveProjectProvider>
        </MemoryRouter>
      );
    });
    // Flush the async chain: project list -> open -> first preview build.
    for (let i = 0; i < 60; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      if (container.querySelector("iframe") && container.textContent?.includes("AI Assistant")) break;
    }
  }

  it("renders the live preview and the AI assistant, and nothing else", async () => {
    await renderStudioAndSettle();
    const text = container.textContent || "";

    // Slim top bar: project selector + revision/save status.
    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    expect(text).toContain("Layout Demo App");
    expect(text).toMatch(/Rev \d+/);
    expect(text).toContain("Saved");

    // (1) Live Preview pane, with a real preview document mounted.
    expect(text).toContain("Live Preview");
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("title")).toBe("Application Live Preview");
    expect(iframe?.getAttribute("srcdoc")).toContain("Hello Preview");

    // (2) AI Assistant chat panel and (3) Inspector tab are present.
    expect(text).toContain("AI Assistant");
    expect(text).toContain("Inspector");

    // Exactly one side panel (the right AI/Inspector panel) — no Explorer aside.
    expect(container.querySelectorAll("aside").length).toBe(1);

    // Removed surfaces must not render.
    expect(text).not.toContain("Explorer");
    expect(text).not.toContain("No file open"); // editor tab strip empty state
    expect(text).not.toContain("Design Tokens"); // Design section
    expect(text).not.toContain("Health Audit"); // Health section
    expect(text).not.toContain("Application Routes"); // Pages section
    expect(text).not.toContain("Operation History"); // History panel / panel history button
    expect(container.querySelector(".monaco-editor")).toBeNull();
    // No Code/Split/Preview workspace-mode tablist.
    expect(container.querySelector('[aria-label="Workspace mode"]')).toBeNull();
  });
});
