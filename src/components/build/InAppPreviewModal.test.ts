import { describe, it, expect } from "vitest";
import { buildTargetProjectPreviewHtml } from "@/lib/preview/previewBuilder";
import type { BuildArtifact } from "@/types/artifact";

describe("InAppPreviewModal Logic & HTML Builder", () => {
  const dummyArtifacts: BuildArtifact[] = [
    {
      id: "art_index",
      projectId: "proj_modal_test",
      path: "index.html",
      type: "frontend",
      purpose: "Entry HTML",
      status: "approved",
      content: "<!DOCTYPE html><html><head><title>App</title></head><body><div id='root'></div><script type='module' src='/src/main.tsx'></script></body></html>",
      language: "html",
      dependencies: [],
      versions: [],
    },
    {
      id: "art_main",
      projectId: "proj_modal_test",
      path: "src/main.tsx",
      type: "frontend",
      purpose: "Root component",
      status: "approved",
      content: "import React from 'react';\nexport function App() { return <h1>In-App Live Preview Working</h1>; }",
      language: "typescript",
      dependencies: [],
      versions: [],
    },
  ];

  it("builds sandboxed preview HTML containing postMessage notification bridges", () => {
    const result = buildTargetProjectPreviewHtml("Modal Test Project", dummyArtifacts);

    expect(result.html).toBeDefined();
    expect(result.html.length).toBeGreaterThan(50);
    // Verifies communication bridge for modal handshake
    expect(result.html).toContain("postMessage");
    expect(result.html).toContain("PREVIEW_DOCUMENT_LOADED");
    expect(result.html).toContain("PREVIEW_MOUNTED_SUCCESS");
    expect(result.entryFile).toBe("src/main.tsx");
  });

  it("generates fallback interactive preview when no index.html is provided", () => {
    const codeOnlyArtifacts: BuildArtifact[] = [
      {
        id: "art_code",
        projectId: "proj_modal_code",
        path: "src/App.tsx",
        type: "frontend",
        purpose: "React Component",
        status: "approved",
        content: "export default function App() { return <div>Direct Component</div>; }",
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const result = buildTargetProjectPreviewHtml("Code Only Project", codeOnlyArtifacts);
    expect(result.html).toBeDefined();
    expect(result.html).toContain("Direct Component");
  });
});
