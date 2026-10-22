import { describe, it, expect } from "vitest";
import { buildTargetProjectPreviewHtml } from "./previewBuilder";
import type { BuildArtifact } from "@/types/artifact";

function art(path: string, content: string): BuildArtifact {
  return {
    id: `art_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
    projectId: "proj_1",
    path,
    type: "frontend",
    purpose: "fixture",
    status: "approved",
    content,
    language: "typescript",
    dependencies: [],
    versions: [],
  };
}

describe("previewBuilder verified mount", () => {
  it("verifies rendered DOM output before posting PREVIEW_MOUNTED_SUCCESS", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art("src/app/App.tsx", `export const App = () => <div>Hello</div>;`),
    ]);
    // The generated document must check that the root actually rendered
    // before claiming success (React 18 render() is asynchronous).
    expect(preview.html).toContain("verifyMount");
    expect(preview.html).toContain("childElementCount");
    expect(preview.html).toContain('type: "PREVIEW_MOUNTED_SUCCESS"');
    // …and must have a distinct failure path when nothing renders.
    expect(preview.html).toContain("produced no rendered output");
  });

  it("surfaces relative-import limitations as an honest diagnostic instead of silent breakage", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art(
        "src/app/App.tsx",
        `import { Widget } from "./Widget";\nexport const App = () => <div><Widget /></div>;`
      ),
      art("src/app/Widget.tsx", `export const Widget = () => <span>W</span>;`),
    ]);
    const warning = preview.diagnostics.find((d) => d.includes("not bundled"));
    expect(warning).toBeDefined();
    expect(warning).toContain("./Widget");
  });

  it("does not warn about package imports (react, lucide-react are provided)", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art(
        "src/app/App.tsx",
        `import React from "react";\nimport { Play } from "lucide-react";\nexport const App = () => <div>Hi</div>;`
      ),
    ]);
    expect(preview.diagnostics.find((d) => d.includes("not bundled"))).toBeUndefined();
  });
});
