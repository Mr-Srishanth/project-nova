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

  it("enriches a transpilation failure with file, line, and the offending source line", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art("src/app/App.tsx", `export const App = () => { return <div unclosed tag ;`),
    ]);
    const diag = preview.diagnostics.find((d) => d.includes("Transpilation error"));
    expect(diag).toBeDefined();
    expect(diag).toContain("src/app/App.tsx");
    expect(diag).toContain("line 1");
    // The actual source line is shown, not just line:col.
    expect(diag).toContain("unclosed");
    // Nothing was guessed: no auto-fix note, and no compiled app.
    expect(preview.diagnostics.find((d) => d.includes("auto-fixed"))).toBeUndefined();
    expect(preview.html).toContain("Entry Component Not Found");
  });

  it("reports the exact render error instead of the generic empty-root message", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art("src/app/App.tsx", `export const App = () => <div>Hello</div>;`),
    ]);
    // An error boundary around the mounted component is the deterministic
    // render-error channel (React unmounts on a render throw and only logs
    // it, so window.onerror alone cannot be trusted for the exact error).
    expect(preview.html).toContain("PreviewErrorBoundary");
    expect(preview.html).toContain("getDerivedStateFromError");
    expect(preview.html).toContain("componentDidCatch");
    expect(preview.html).toContain("Render error in");
    expect(preview.html).toContain("componentStack");
    // React's own render-error log is forwarded from console.error.
    expect(preview.html).toContain("The above error occurred");
    // The old generic message must be gone: it named no file, component,
    // export, or reason.
    expect(preview.html).not.toContain("mounted but the preview root stayed empty");
  });

  it("explains an empty root exactly: entry file, component, export resolution, null-return vs throw", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art("src/app/App.tsx", `export const App = () => null;`),
    ]);
    expect(preview.html).toContain("neither #preview-root, #root, nor a portal");
    // The runtime message composes the file at mount time from
    // window.__ENTRY_FILE__ (set to src/app/App.tsx for this fixture).
    expect(preview.html).toContain("Entry file: ");
    expect(preview.html).toContain("window.__ENTRY_FILE__");
    expect(preview.html).toContain("Resolved via:");
    expect(preview.html).toContain("Entry exports found:");
    expect(preview.html).toContain("returned null, false, an empty fragment");
    expect(preview.html).toContain("gated on state that never resolved");
    // Portal-only and legacy-bootstrap output count as mounted, not empty.
    expect(preview.html).toContain("hasOutputAnywhere");
    expect(preview.html).toContain('id="root"');
    expect(preview.html).toContain("bootstrapped itself");
    // Slow first paints get 10s (200 x 50ms), not the old 3s-then-give-up.
    expect(preview.html).toContain("verifyAttempts < 200");
    // The window fallback scan prefers App/Main/Root over the first
    // uppercase function (which could be a null-returning helper).
    expect(preview.html).toContain("window scan (preferred)");
  });

  it("passes unknown-package components through instead of dropping their children", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art(
        "src/app/App.tsx",
        `import { BrowserRouter, Routes, Route } from "react-router-dom";\nexport const App = () => (<BrowserRouter><Routes><Route path="/" element={<div>Home</div>} /></Routes></BrowserRouter>);`
      ),
    ]);
    // Single-file path: unknown packages render children/element, so a
    // router/provider wrapper cannot swallow the app into an empty root.
    expect(preview.html).toContain("__PreviewPassthrough");
    expect(preview.html).toContain("__PREVIEW_UNKNOWN_IMPORTS__");
    expect(preview.html).toContain("react-router-dom");
  });

  it("multi-module missing modules become passthroughs, not null components", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art(
        "src/app/App.tsx",
        `import { Widget } from "./Widget";\nimport { BrowserRouter } from "react-router-dom";\nexport const App = () => (<BrowserRouter><Widget /></BrowserRouter>);`
      ),
      art("src/app/Widget.tsx", `export const Widget = () => <span>W</span>;`),
    ]);
    expect(preview.html).toContain("__registerModule");
    expect(preview.html).toContain("__PreviewPassthrough");
    // The old fallback ({ default: () => null }, named bindings undefined)
    // threw "Element type is invalid" at render and emptied the root.
    expect(preview.html).not.toContain("default: () => null");
  });

  it("auto-fixes a missing comma in preview only and says so (saved code untouched)", () => {
    const preview = buildTargetProjectPreviewHtml("Demo", [
      art(
        "src/app/App.tsx",
        [
          `const menu = [`,
          `  { id: 1, name: "Burger" }`,
          `  { id: 2, name: "Pizza" },`,
          `];`,
          `export const App = () => <div>{menu.length}</div>;`,
        ].join("\n")
      ),
    ]);
    // The preview renders: the repaired code's compiled output is
    // embedded in the document (a failed build would leave it out).
    // (Note: the literal "Entry Component Not Found" also appears in
    // the mount-fallback script of every generated document, so it
    // cannot be used as a pass/fail signal here.)
    expect(preview.html).toContain("Burger");
    // And the fix is disclosed as preview-only, not a transpilation error
    // (so the build is not failed for a diagnostic it recovered from).
    const fix = preview.diagnostics.find((d) => d.includes("auto-fixed"));
    expect(fix).toBeDefined();
    expect(fix).toContain("preview only");
    expect(fix).toContain("line 3");
    expect(preview.diagnostics.find((d) => d.includes("Transpilation error"))).toBeUndefined();
  });
});
