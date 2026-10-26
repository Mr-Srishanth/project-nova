import { describe, it, expect } from "vitest";
import { buildTargetProjectPreviewHtml } from "./previewBuilder";
import type { BuildArtifact } from "@/types/artifact";

function art(path: string, content: string): BuildArtifact {
  return {
    id: `art_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
    projectId: "proj_multimodule",
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

describe("previewBuilder multi-module bundling & execution", () => {
  it("bundles multiple interdependent modules with relative imports into the preview", () => {
    const preview = buildTargetProjectPreviewHtml("MultiModuleGame", [
      art(
        "src/app/App.tsx",
        `import React from "react";
import { Engine } from "../game/Engine";
import { HUD } from "../components/HUD";
import type { GameState } from "../core/types";

export const App = () => (
  <div className="game-wrapper">
    <HUD score={100} />
    <Engine mode="turbo" />
  </div>
);
export default App;`
      ),
      art(
        "src/game/Engine.tsx",
        `import React from "react";
export const Engine = ({ mode }: { mode: string }) => <div className="engine-node">Engine: {mode}</div>;`
      ),
      art(
        "src/components/HUD.tsx",
        `import React from "react";
import { SpeedGauge } from "./SpeedGauge";
export const HUD = ({ score }: { score: number }) => (
  <header className="hud">
    <span>Score: {score}</span>
    <SpeedGauge speed={120} />
  </header>
);`
      ),
      art(
        "src/components/SpeedGauge.tsx",
        `import React from "react";
export const SpeedGauge = ({ speed }: { speed: number }) => <div>Speed: {speed}mph</div>;`
      ),
      art(
        "src/core/types.ts",
        `export interface GameState {
  score: number;
  speed: number;
}`
      ),
    ]);

    expect(preview.entryFile).toBe("src/app/App.tsx");
    // Verify that all modules were registered in the preview bundle
    expect(preview.html).toContain('__registerModule("src/app/App.tsx"');
    expect(preview.html).toContain('__registerModule("src/game/Engine.tsx"');
    expect(preview.html).toContain('__registerModule("src/components/HUD.tsx"');
    expect(preview.html).toContain('__registerModule("src/components/SpeedGauge.tsx"');
    expect(preview.html).toContain('__registerModule("src/core/types.ts"');
    // Verify no transpile error was raised
    expect(preview.diagnostics.filter((d) => d.includes("Transpilation error"))).toHaveLength(0);
    // Verify require and ReactDOM root render
    expect(preview.html).toContain("__createRequire");
    expect(preview.html).toContain("ReactDOM.createRoot");
  });

  it("repairs a missing comma in the multi-module entry file (preview only)", () => {
    const preview = buildTargetProjectPreviewHtml("MultiModuleGame", [
      art(
        "src/app/App.tsx",
        [
          `import React from "react";`,
          `import { Widget } from "./Widget";`,
          `const menu = [`,
          `  { id: 1, name: "Burger" }`,
          `  { id: 2, name: "Pizza" },`,
          `];`,
          `export const App = () => (<div><Widget /><span>{menu.length}</span></div>);`,
          `export default App;`,
        ].join("\n")
      ),
      art("src/app/Widget.tsx", `export const Widget = () => <span>W</span>;`),
    ]);
    expect(preview.diagnostics.filter((d) => d.includes("Transpilation error"))).toHaveLength(0);
    const fix = preview.diagnostics.find((d) => d.includes("auto-fixed"));
    expect(fix).toBeDefined();
    expect(fix).toContain("src/app/App.tsx");
    expect(fix).toContain("preview only");
    expect(preview.html).toContain('__registerModule("src/app/App.tsx"');
    expect(preview.html).toContain("Burger");
  });
});
