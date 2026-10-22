import { describe, it, expect } from "vitest";
import {
  applyStyleToArtifact,
  applyStyleToProject,
  resolveSourceArtifactForElement,
  upsertInspectorCssRule,
} from "./inspectorEngine";
import type { BuildArtifact } from "@/types/artifact";

function art(path: string, content: string): BuildArtifact {
  return {
    id: `art_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
    projectId: "proj_1",
    path,
    type: "frontend",
    purpose: "test fixture",
    status: "approved",
    content,
    language: path.endsWith(".css") ? "css" : "typescript",
    dependencies: [],
    versions: [],
  };
}

const APP_TSX = `import React, { useState } from "react";

export const App: React.FC = () => {
  const [count, setCount] = useState(0);
  return (
    <div className="game-container">
      <h1 className="title-text">Car Racing Game</h1>
      <button id="start-btn" className="start-button" onClick={() => setCount(count + 1)}>
        Start Game
      </button>
      <div className="panel-box" style={{ backgroundColor: "red", padding: "4px" }}>
        Panel
      </div>
    </div>
  );
};
`;

describe("Inspector -> source synchronization", () => {
  it("writes a real inline style into the located element's JSX tag", () => {
    const target = art("src/app/App.tsx", APP_TSX);
    const result = applyStyleToArtifact(
      target,
      { tagName: "button", id: "start-btn", className: "start-button", textContent: "Start Game" },
      "backgroundColor",
      "#10b981"
    );
    expect(result.appliedStrategy).toBe("inline_style");
    expect(result.updatedContent).toContain('style={{ backgroundColor: "#10b981" }}');
    // The style lands on the button tag itself, not somewhere inert.
    const btnStart = result.updatedContent.indexOf("<button");
    const buttonTag = result.updatedContent.slice(btnStart, btnStart + 220);
    expect(buttonTag).toContain('id="start-btn"');
    expect(buttonTag).toContain("backgroundColor");
  });

  it("locates an element by a distinctive className token when it has no id", () => {
    const target = art("src/app/App.tsx", APP_TSX);
    const result = applyStyleToArtifact(
      target,
      { tagName: "h1", id: null, className: "title-text", textContent: "Car Racing Game" },
      "color",
      "#ffffff"
    );
    expect(result.appliedStrategy).toBe("inline_style");
    const h1Tag = result.updatedContent.match(/<h1[^>]*>/)![0];
    expect(h1Tag).toContain('color: "#ffffff"');
  });

  it("merges into an existing style object by REPLACING the property, never duplicating it", () => {
    const target = art("src/app/App.tsx", APP_TSX);
    const result = applyStyleToArtifact(
      target,
      { tagName: "div", id: null, className: "panel-box", textContent: "Panel" },
      "backgroundColor",
      "#0000ff"
    );
    const occurrences = result.updatedContent.match(/backgroundColor/g) || [];
    expect(occurrences).toHaveLength(1);
    expect(result.updatedContent).toContain('backgroundColor: "#0000ff"');
    // The sibling property survives the merge.
    expect(result.updatedContent).toContain('padding: "4px"');
  });

  it("refuses honestly when the element cannot be located — no inert comment is written", () => {
    const target = art("src/app/App.tsx", APP_TSX);
    expect(() =>
      applyStyleToArtifact(
        target,
        { tagName: "button", id: "nitro-btn", className: "nitro-class", textContent: "NITRO" },
        "backgroundColor",
        "#10b981"
      )
    ).toThrow(/NOT written to source/);
    // The old behaviour appended "/* [INSPECTOR UPDATE: ...] */" and claimed
    // success. That string must never be produced again.
    expect(APP_TSX).not.toContain("[INSPECTOR UPDATE");
  });

  it("replaces text content in source when the exact text is present", () => {
    const target = art("src/app/App.tsx", APP_TSX);
    const result = applyStyleToArtifact(
      target,
      { tagName: "h1", id: null, className: "title-text", textContent: "Car Racing Game" },
      "textContent",
      "Speed Racer"
    );
    expect(result.appliedStrategy).toBe("attribute_update");
    expect(result.updatedContent).toContain("Speed Racer");
    expect(result.updatedContent).not.toContain("Car Racing Game");
  });

  it("resolves the source artifact by distinctive className token", () => {
    const header = art(
      "src/components/Header.tsx",
      `export const Header = () => <header className="site-header-nav"><h1>Title</h1></header>;`
    );
    const app = art("src/app/App.tsx", APP_TSX);
    const resolved = resolveSourceArtifactForElement(
      { tagName: "header", id: null, className: "site-header-nav", textContent: "" },
      [app, header]
    );
    expect(resolved.artifact?.path).toBe("src/components/Header.tsx");
  });

  it("applyStyleToProject falls back to a REAL stylesheet rule that takes effect", () => {
    const app = art("src/app/App.tsx", APP_TSX);
    const css = art("src/index.css", "body { margin: 0; }\n");
    const result = applyStyleToProject(
      [app, css],
      { tagName: "button", id: "nitro-btn", className: "nitro-class", textContent: "NITRO" },
      "backgroundColor",
      "#10b981"
    );
    expect(result.strategy).toBe("css_rule");
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].path).toBe("src/index.css");
    // A genuine declaration, inside a rule for the element's selector.
    expect(result.updates[0].updatedContent).toContain("#nitro-btn {");
    expect(result.updates[0].updatedContent).toContain("background-color: #10b981 !important;");
    // The TSX file is untouched by the fallback.
    expect(result.updates[0].updatedContent).not.toContain("[INSPECTOR UPDATE");
  });

  it("repeated inspector edits replace the managed rule instead of stacking duplicates", () => {
    const once = upsertInspectorCssRule("body { margin: 0; }", "#nitro-btn", "background-color", "#111111");
    const twice = upsertInspectorCssRule(once, "#nitro-btn", "background-color", "#222222");
    const matches = twice.match(/#nitro-btn \{/g) || [];
    expect(matches).toHaveLength(1);
    expect(twice).toContain("background-color: #222222 !important;");
    expect(twice).not.toContain("#111111");
  });

  it("applyStyleToProject creates src/index.css when the project has no stylesheet", () => {
    const app = art("src/app/App.tsx", APP_TSX);
    const result = applyStyleToProject(
      [app],
      { tagName: "span", id: "hud-score", className: "hud-score", textContent: "" },
      "color",
      "#ffcc00"
    );
    expect(result.updates[0].path).toBe("src/index.css");
    expect(result.updates[0].isNewFile).toBe(true);
    expect(result.updates[0].updatedContent).toContain("color: #ffcc00 !important;");
  });

  it("applyStyleToProject surfaces an honest error for textContent it cannot locate", () => {
    const app = art("src/app/App.tsx", APP_TSX);
    expect(() =>
      applyStyleToProject(
        [app],
        { tagName: "p", id: null, className: "missing-class", textContent: "No such text anywhere" },
        "textContent",
        "Replacement"
      )
    ).toThrow(/NOT written to source/);
  });
});
