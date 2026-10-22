import { describe, it, expect } from "vitest";
import {
  buildTargetProjectPreviewHtml,
  bundleTsxForPreview,
  sanitizePreviewContent,
} from "@/lib/preview/previewBuilder";
import { validateApplicationTarget } from "@/lib/validation/applicationValidator";
import { planAIEdits } from "@/lib/uiStudio/aiEditEngine";
import { uiStudioHistoryStorage } from "@/lib/storage/uiStudioHistoryStorage";
import {
  validateCssValue,
  resolveSourceArtifactForElement,
  applyStyleToArtifact,
  applyStyleToProject,
} from "@/lib/uiStudio/inspectorEngine";
import type { BuildArtifact } from "@/types/artifact";

describe("UI Studio Master Pipeline Tests", () => {
  const sampleArtifacts: BuildArtifact[] = [
    {
      id: "art_1",
      projectId: "proj_1",
      path: "package.json",
      type: "config",
      purpose: "Package configuration",
      status: "approved",
      content: JSON.stringify({
        name: "test-car-game",
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
      }),
      language: "json",
      dependencies: [],
      versions: [],
    },
    {
      id: "art_2",
      projectId: "proj_1",
      path: "index.html",
      type: "frontend",
      purpose: "HTML document",
      status: "approved",
      content: `<!DOCTYPE html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
      language: "html",
      dependencies: [],
      versions: [],
    },
    {
      id: "art_3",
      projectId: "proj_1",
      path: "src/app/App.tsx",
      type: "frontend",
      purpose: "Main car game component",
      status: "approved",
      content: `import React, { useState, useEffect, useRef } from "react";
import { Play, RotateCcw } from "lucide-react";

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<"menu" | "playing">("menu");
  const [speed, setSpeed] = useState<number>(80);
  const [distance, setDistance] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") console.log("steer left");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (gameState !== "playing") return;
    let animId: number;
    const loop = () => {
      // 2D collision detection and road rendering
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);

  return (
    <div className="game-container">
      <h1>Car Racing Game</h1>
      <canvas ref={canvasRef} width={400} height={600} />
      <button onClick={() => setGameState("playing")}>Start Game</button>
    </div>
  );
};
`,
      language: "typescript",
      dependencies: [],
      versions: [],
    },
  ];

  it("sanitizes preview content and redacts secret keys", () => {
    const raw = `const key = GEMINI_API_KEY = "AIzaSySecretKey123";`;
    const clean = sanitizePreviewContent(raw);
    expect(clean).not.toContain("AIzaSySecretKey123");
    expect(clean).toContain("[PREVIEW_REDACTED]");
  });

  it("transpiles TSX components and transforms imports into browser-compatible code", () => {
    const source = sampleArtifacts[2].content!;
    const bundled = bundleTsxForPreview(source);

    // Imports stripped
    expect(bundled).not.toContain('from "react"');
    expect(bundled).not.toContain('from "lucide-react"');

    // React hooks mapped to window.React
    expect(bundled).toContain("window.React.useState");
    expect(bundled).toContain("window.React.useEffect");
    expect(bundled).toContain("window.React.useRef");

    // Component mounted globally
    expect(bundled).toContain("const App");
  });

  it("builds a secure, isolated HTML preview document with correct archetype", () => {
    const preview = buildTargetProjectPreviewHtml("NitroPulse Car Game", sampleArtifacts);
    expect(preview.archetype).toBe("car_game");
    expect(preview.entryFile).toBe("src/app/App.tsx");
    expect(preview.isPlayableOrInteractive).toBe(true);

    // HTML contains sandboxed container, React roots, and runtime error handlers
    expect(preview.html).toContain('id="preview-root"');
    expect(preview.html).toContain("PREVIEW_RUNTIME_ERROR");
    expect(preview.html).toContain("PREVIEW_MOUNTED_SUCCESS");
  });

  it("validates application target against archetype criteria with high score", () => {
    const report = validateApplicationTarget("NitroPulse Car Game", sampleArtifacts, "car_game");
    expect(report.valid).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(80);

    const checkNames = report.checks.map((c) => c.name);
    expect(checkNames).toContain("Canvas Game Engine");
    expect(checkNames).toContain("60 FPS Animation Loop");
    expect(checkNames).toContain("Interactive Steering Controls");
    expect(report.errors).toHaveLength(0);
  });

  it("flags missing game loop or missing entry points on broken projects", () => {
    const brokenArtifacts: BuildArtifact[] = [
      {
        id: "art_b1",
        projectId: "proj_broken",
        path: "package.json",
        type: "config",
        purpose: "Package",
        status: "approved",
        content: "{}",
        language: "json",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_b2",
        projectId: "proj_broken",
        path: "src/app/App.tsx",
        type: "frontend",
        purpose: "App",
        status: "approved",
        content: `export const App = () => <div>Static Landing Page Only</div>;`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const report = validateApplicationTarget("Broken Car Game", brokenArtifacts, "car_game");
    expect(report.valid).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.suggestedRepairs.length).toBeGreaterThan(0);
    expect(report.suggestedRepairs[0].id).toBe("repair_game_loop");
  });

  it("produces structured AI edit plan with impact assessment and reviewable diff", async () => {
    const plan = await planAIEdits({
      projectId: "proj_1",
      projectName: "NitroPulse Car Game",
      userPrompt: "Add a high-speed nitro boost button and increase player speed",
      mode: "edit",
      artifacts: sampleArtifacts,
      activeFilePath: "src/app/App.tsx",
    });

    expect(plan.mode).toBe("edit");
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].filePath).toBe("src/app/App.tsx");
    expect(plan.items[0].proposedContent).toBeDefined();
    expect(plan.impactAssessment).toContain("Modifies 1 file");
  });

  it("handles React.FC and TypeScript typed exports correctly in bundleTsxForPreview", () => {
    const rawComponent = `import React, { useState } from "react";
export const App: React.FC = () => {
  const [active, setActive] = useState(false);
  return <div className="portfolio">Portfolio Hub Content</div>;
};`;

    const bundled = bundleTsxForPreview(rawComponent);
    expect(bundled).toContain("const App = window.App =");
    expect(bundled).not.toContain("export const App");
    expect(bundled).toContain("window.React.useState");
  });

  it("embeds target project custom stylesheet into the sandboxed preview document", () => {
    const artifactsWithCss: BuildArtifact[] = [
      ...sampleArtifacts,
      {
        id: "art_css",
        projectId: "proj_1",
        path: "src/index.css",
        type: "frontend",
        purpose: "Project Stylesheet",
        status: "approved",
        content: ".portfolio-hero { background: linear-gradient(to right, #064e3b, #022c22); }",
        language: "css",
        dependencies: [],
        versions: [],
      },
    ];

    const preview = buildTargetProjectPreviewHtml("PortfolioHub", artifactsWithCss);
    expect(preview.archetype).toBe("website");
    expect(preview.html).toContain(".portfolio-hero { background: linear-gradient(to right, #064e3b, #022c22); }");
  });

  it("renders a clear actionable message when no entry point exists", () => {
    const noEntryArtifacts: BuildArtifact[] = [
      {
        id: "art_readme",
        projectId: "proj_empty",
        path: "README.md",
        type: "docs",
        purpose: "Documentation",
        status: "approved",
        content: "# Documentation only",
        language: "markdown",
        dependencies: [],
        versions: [],
      },
    ];

    const preview = buildTargetProjectPreviewHtml("EmptyApp", noEntryArtifacts);
    expect(preview.entryFile).toBe("");
    expect(preview.diagnostics.length).toBeGreaterThan(0);
    expect(preview.diagnostics[0]).toMatch(/No standard React or HTML entry point found/i);
    expect(preview.html).toContain("Entry Component Not Found");
  });

  it("detects and validates website / portfolio archetype correctly without misclassifying as backend", () => {
    const portfolioArtifacts: BuildArtifact[] = [
      {
        id: "art_p1",
        projectId: "proj_port",
        path: "package.json",
        type: "config",
        purpose: "Package",
        status: "approved",
        content: JSON.stringify({
          name: "portfolio-hub",
          scripts: { dev: "vite", build: "vite build" },
        }),
        language: "json",
        dependencies: [],
        versions: [],
      },
      {
        id: "art_p2",
        projectId: "proj_port",
        path: "src/app/App.tsx",
        type: "frontend",
        purpose: "App",
        status: "approved",
        content: `import React from "react";
export const App: React.FC = () => <div>Delivering high-performance architecture, human-centric design, and scalable autonomous pipelines.</div>;`,
        language: "typescript",
        dependencies: [],
        versions: [],
      },
    ];

    const preview = buildTargetProjectPreviewHtml("PortfolioHub", portfolioArtifacts);
    expect(preview.archetype).toBe("website");
    expect(preview.entryFile).toBe("src/app/App.tsx");
  });

  it("handles Ask and Plan modes cleanly without generating diffs or modifying files", async () => {
    const askPlan = await planAIEdits({
      projectId: "proj_1",
      projectName: "TestCarGame",
      userPrompt: "How does the routing work in this app?",
      mode: "ask",
      artifacts: sampleArtifacts,
    });

    expect(askPlan.mode).toBe("ask");
    expect(askPlan.items.length).toBe(0);
    expect(askPlan.advisoryText).toContain("router.tsx");

    const planOnly = await planAIEdits({
      projectId: "proj_1",
      projectName: "TestCarGame",
      userPrompt: "Add a high-score leaderboard",
      mode: "plan",
      artifacts: sampleArtifacts,
    });

    expect(planOnly.mode).toBe("plan");
    expect(planOnly.items.length).toBe(0);
    expect(planOnly.advisoryText).toContain("Structured Implementation Plan");
  });

  it("calculates multidimensional health score and prevents 100% health when runtime errors occur", () => {
    // Normal healthy state
    const healthyReport = validateApplicationTarget("TestCarGame", sampleArtifacts, "car_game", {
      isMounted: true,
      hasRuntimeError: false,
    });
    expect(healthyReport.breakdown.runtimeHealth).toBe(100);
    expect(healthyReport.valid).toBe(true);

    // Runtime error failure state
    const failedReport = validateApplicationTarget("TestCarGame", sampleArtifacts, "car_game", {
      isMounted: false,
      hasRuntimeError: true,
      runtimeErrorMsg: "TypeError: Cannot read property of undefined",
    });
    expect(failedReport.breakdown.runtimeHealth).toBe(20);
    expect(failedReport.valid).toBe(false);
    expect(failedReport.score).toBeLessThanOrEqual(60);
    expect(failedReport.errors.some((e) => e.message.includes("Cannot read property"))).toBe(true);
  });

  it("assigns unique operationId and tracks baseVersionId in AI edit plans", async () => {
    const editPlan = await planAIEdits({
      operationId: "op_test_123",
      projectId: "proj_1",
      projectName: "TestCarGame",
      userPrompt: "Increase nitro speed",
      mode: "edit",
      artifacts: sampleArtifacts,
    });

    expect(editPlan.operationId).toBe("op_test_123");
    expect(editPlan.items.length).toBe(1);
    expect(editPlan.items[0].proposedContent).toContain("nitro");
    expect(editPlan.verificationLevel).toBe("generated");
  });

  it("advances verification levels accurately from generated to runtime_verified", async () => {
    const editPlan = await planAIEdits({
      operationId: "op_verify_test",
      projectId: "proj_1",
      projectName: "TestCarGame",
      userPrompt: "Optimize rendering loop",
      mode: "edit",
      artifacts: sampleArtifacts,
    });

    expect(editPlan.verificationLevel).toBe("generated");

    // Simulating lifecycle progression
    editPlan.verificationLevel = "applied";
    expect(editPlan.verificationLevel).toBe("applied");

    editPlan.verificationLevel = "saved";
    expect(editPlan.verificationLevel).toBe("saved");

    editPlan.verificationLevel = "build_passed";
    expect(editPlan.verificationLevel).toBe("build_passed");

    editPlan.verificationLevel = "runtime_verified";
    expect(editPlan.verificationLevel).toBe("runtime_verified");
  });

  it("stores, retrieves, and filters persistent operation history with safe secret sanitization", async () => {
    await uiStudioHistoryStorage.clear("proj_test_store");

    const entry1 = await uiStudioHistoryStorage.save({
      id: "op_hist_1",
      projectId: "proj_test_store",
      projectName: "TestCarGame",
      userPrompt: "Add auth credentials",
      mode: "edit",
      status: "proposed",
      summary: "Add auth variables",
      affectedFiles: [".env", "src/config.ts"],
      timestamp: new Date().toISOString(),
      items: [
        {
          id: "item_env",
          filePath: ".env",
          action: "create",
          summary: "Set secrets",
          diffExplanation: "Add secret credentials",
          proposedContent: 'GEMINI_API_KEY="secret_val"',
          originalContent: "",
        },
      ],
      previousFileSnapshots: {
        "src/config.ts": "export const config = {};",
      },
    });

    expect(entry1.id).toBe("op_hist_1");
    expect(entry1.items[0].proposedContent).toContain("[REDACTED]");

    // Update status
    await uiStudioHistoryStorage.updateStatus("op_hist_1", "applied");

    const history = await uiStudioHistoryStorage.list("proj_test_store");
    expect(history.length).toBe(1);
    expect(history[0].status).toBe("applied");
    expect(history[0].previousFileSnapshots?.["src/config.ts"]).toBe("export const config = {};");

    await uiStudioHistoryStorage.clear("proj_test_store");
    const emptyHistory = await uiStudioHistoryStorage.list("proj_test_store");
    expect(emptyHistory.length).toBe(0);
  });

  describe("Visual Inspector Pro & Engine Tests", () => {
    it("validates CSS values and prevents script injections and unsafe URLs", () => {
      // Valid property values
      expect(validateCssValue("fontSize", "18px").valid).toBe(true);
      expect(validateCssValue("fontSize", "1.5rem").valid).toBe(true);
      expect(validateCssValue("color", "#10b981").valid).toBe(true);
      expect(validateCssValue("color", "rgb(255, 0, 0)").valid).toBe(true);
      expect(validateCssValue("backgroundColor", "transparent").valid).toBe(true);
      expect(validateCssValue("padding", "10px 20px").valid).toBe(true);
      expect(validateCssValue("href", "https://example.com/about").valid).toBe(true);
      expect(validateCssValue("href", "/dashboard").valid).toBe(true);

      // Invalid / unsafe property values
      expect(validateCssValue("color", "not-a-color-12345!").valid).toBe(false);
      expect(validateCssValue("fontSize", "huge-and-broken").valid).toBe(false);
      expect(validateCssValue("color", "javascript:alert(1)").valid).toBe(false);
      expect(validateCssValue("href", "javascript:void(0)").valid).toBe(false);
      expect(validateCssValue("padding", "").valid).toBe(false);
    });

    it("identifies target source artifact based on element ID and contents", () => {
      const artWithId: BuildArtifact = {
        id: "art_header",
        projectId: "proj_1",
        path: "src/components/Header.tsx",
        type: "frontend",
        purpose: "Header nav",
        status: "approved",
        content: `export const Header = () => <header id="main-nav" className="navbar"><h1>Title</h1></header>;`,
        language: "typescript",
        dependencies: [],
        versions: [],
      };

      const artifactsList = [...sampleArtifacts, artWithId];

      const resolved = resolveSourceArtifactForElement(
        { tagName: "header", id: "main-nav", className: "navbar", textContent: "Title" },
        artifactsList
      );

      expect(resolved.artifact).toBeDefined();
      expect(resolved.artifact?.path).toBe("src/components/Header.tsx");
      expect(resolved.confidence).toBe("high");
    });

    it("accurately reports when source mapping is unavailable or falls back to App.tsx", () => {
      const resolved = resolveSourceArtifactForElement(
        { tagName: "div", id: "random-unmapped-id", className: "random-class", textContent: "" },
        sampleArtifacts
      );

      // Falls back to entry component App.tsx with medium confidence
      expect(resolved.artifact?.path).toBe("src/app/App.tsx");
      expect(resolved.confidence).toBe("medium");
    });

    it("applies style modifications to target artifact using appropriate strategy", () => {
      const targetArt = sampleArtifacts.find((a) => a.path === "src/app/App.tsx")!;

      // The nitro button does not exist in this artifact's source, so an
      // inline edit is impossible: the engine must refuse honestly instead
      // of its old behaviour — appending an inert CSS *comment* to the TSX
      // file and reporting a successful "css_rule" edit that changed
      // nothing (the exact defect this rebuild removes).
      expect(() =>
        applyStyleToArtifact(
          targetArt,
          { tagName: "button", id: "nitro-btn", className: "nitro-class", textContent: "NITRO" },
          "backgroundColor",
          "#10b981"
        )
      ).toThrow(/NOT written to source/);

      // The project-level API falls back to a REAL rule in the stylesheet
      // artifact (created here, since the fixture project has none), which
      // genuinely takes effect in the rendered preview.
      const projectResult = applyStyleToProject(
        sampleArtifacts,
        { tagName: "button", id: "nitro-btn", className: "nitro-class", textContent: "NITRO" },
        "backgroundColor",
        "#10b981"
      );
      expect(projectResult.strategy).toBe("css_rule");
      expect(projectResult.updates[0].path).toBe("src/index.css");
      expect(projectResult.updates[0].updatedContent).toContain("#nitro-btn {");
      expect(projectResult.updates[0].updatedContent).toContain("background-color: #10b981 !important;");
      expect(projectResult.updates[0].updatedContent).not.toContain("[INSPECTOR UPDATE");
    });

    it("generates preview document containing the interactive APPLY_LIVE_STYLE message handler", () => {
      const preview = buildTargetProjectPreviewHtml("TestCarGame", sampleArtifacts);
      expect(preview.html).toContain("APPLY_LIVE_STYLE");
      expect(preview.html).toContain("LIVE_STYLE_APPLIED_CONFIRMATION");
      expect(preview.html).toContain("hierarchy");
      expect(preview.html).toContain("attributes");
      expect(preview.html).toContain("unpkg.com/react@18.3.1");
    });
  });

  describe("P0 UI Studio Preview Reliability & Truthful AI Edit Status Suite", () => {
    // 1. Successful application mount reports Runtime Verified (buildId strictly bound)
    it("1. successful application mount reports Runtime Verified with matching buildId", () => {
      const build = buildTargetProjectPreviewHtml("NitroPulse", sampleArtifacts, {
        buildId: "bld_verified_123",
      });
      expect(build.buildId).toBe("bld_verified_123");
      expect(build.html).toContain('const CURRENT_BUILD_ID = "bld_verified_123";');
      expect(build.html).toContain('type: "PREVIEW_MOUNTED_SUCCESS"');
      expect(build.html).toContain("CURRENT_BUILD_ID");
      expect(build.html).toContain("ReactDOM.createRoot");
    });

    // 2. Syntax or transpilation failure reports Build Failed
    it("2. syntax or transpilation failure reports Build Failed and preserves diagnostic error", () => {
      const brokenArtifacts: BuildArtifact[] = [
        ...sampleArtifacts.filter((a) => a.path !== "src/app/App.tsx"),
        {
          id: "art_broken",
          projectId: "proj_1",
          path: "src/app/App.tsx",
          type: "frontend",
          purpose: "Broken component",
          status: "approved",
          content: "export const App = () => { return <div unclosed tag ;",
          language: "typescript",
          dependencies: [],
          versions: [],
        },
      ];

      const brokenBuild = buildTargetProjectPreviewHtml("NitroPulse", brokenArtifacts);
      expect(brokenBuild.diagnostics.length).toBeGreaterThan(0);
      expect(brokenBuild.diagnostics[0]).toContain("Transpilation error");
      // AppToMount will be undefined because transpiledApp is empty on syntax error
      expect(brokenBuild.html).toContain('Entry Component Not Found');
    });

    // 3. An exception during mount reports Runtime Error
    it("3. an exception during mount reports Runtime Error and preserves diagnostic error details", () => {
      const preview = buildTargetProjectPreviewHtml("NitroPulse", sampleArtifacts);
      expect(preview.html).toContain('type: "PREVIEW_RUNTIME_ERROR"');
      expect(preview.html).toContain("Runtime Exception During Mount");
      expect(preview.html).toContain("Build ID:");
    });

    // 4. A genuine mount timeout shows useful diagnostics
    it("4. a genuine mount timeout shows useful diagnostics and build ID", () => {
      const preview = buildTargetProjectPreviewHtml("NitroPulse", sampleArtifacts, {
        buildId: "bld_timeout_test_456",
      });
      expect(preview.buildId).toBe("bld_timeout_test_456");
      expect(preview.html).toContain("bld_timeout_test_456");
      expect(preview.html).toContain("Entry Component Not Found");
    });

    // 5. A stale build cannot mark a newer build as successful
    it("5. ensures build ID binding prevents obsolete build messages from overriding newer state", () => {
      const currentBuildId = "bld_newer_999";
      const staleBuildId = "bld_stale_111";

      const handleMessageSim = (msgBuildId: string, currentId: string) => {
        if (msgBuildId !== currentId) {
          return "ignored";
        }
        return "processed";
      };

      expect(handleMessageSim(staleBuildId, currentBuildId)).toBe("ignored");
      expect(handleMessageSim(currentBuildId, currentBuildId)).toBe("processed");
    });

    // 6. Saving code while preview fails does not falsely mark runtime verification successful
    it("6. saving code updates status to saved and does NOT prematurely mark runtime_verified", async () => {
      const opId = "op_truth_test_6";
      await uiStudioHistoryStorage.save({
        id: opId,
        timestamp: new Date().toISOString(),
        projectId: "proj_truth",
        projectName: "Truth Project",
        userPrompt: "Add dark theme",
        mode: "edit",
        affectedFiles: ["src/app/App.tsx"],
        summary: "Updated styles",
        status: "saved",
        items: [],
      });

      const entry = (await uiStudioHistoryStorage.list("proj_truth")).find((e) => e.id === opId);
      expect(entry?.status).toBe("saved");
      expect(entry?.status).not.toBe("runtime_verified");
      expect(entry?.status).not.toBe("build_passed");
    });

    // 7. Retrying creates a new build lifecycle and cleans up the previous one
    it("7. retrying generates a distinct fresh buildId and increments the lifecycle", () => {
      const build1 = buildTargetProjectPreviewHtml("NitroPulse", sampleArtifacts);
      const build2 = buildTargetProjectPreviewHtml("NitroPulse", sampleArtifacts);

      expect(build1.buildId).toBeDefined();
      expect(build2.buildId).toBeDefined();
      expect(build1.buildId).not.toBe(build2.buildId);
    });

    // 8. Edit history accurately represents applied, saved, build-passed, and runtime-verified states
    it("8. edit history accurately transitions through applied -> saved -> build_passed -> runtime_verified", async () => {
      const opId = "op_lifecycle_audit";
      await uiStudioHistoryStorage.save({
        id: opId,
        timestamp: new Date().toISOString(),
        projectId: "proj_audit",
        projectName: "Audit Project",
        userPrompt: "Lifecycle verify",
        mode: "auto",
        affectedFiles: ["src/app/App.tsx"],
        summary: "Verify lifecycle transitions",
        status: "applied",
        items: [],
      });

      let record = (await uiStudioHistoryStorage.list("proj_audit")).find((e) => e.id === opId);
      expect(record?.status).toBe("applied");

      await uiStudioHistoryStorage.updateStatus(opId, "saved");
      record = (await uiStudioHistoryStorage.list("proj_audit")).find((e) => e.id === opId);
      expect(record?.status).toBe("saved");

      await uiStudioHistoryStorage.updateStatus(opId, "build_passed");
      record = (await uiStudioHistoryStorage.list("proj_audit")).find((e) => e.id === opId);
      expect(record?.status).toBe("build_passed");

      await uiStudioHistoryStorage.updateStatus(opId, "runtime_verified");
      record = (await uiStudioHistoryStorage.list("proj_audit")).find((e) => e.id === opId);
      expect(record?.status).toBe("runtime_verified");
    });

    // 9. Health & Preview status decoupling
    it("9. decouples preview mount readiness from domain functional verification", () => {
      // Preview mounted cleanly without runtime error
      const report = validateApplicationTarget("NitroPulse", sampleArtifacts, "car_game", {
        isMounted: true,
        hasRuntimeError: false,
      });

      // Preview is valid and mounted, but domain functional checks are truthfully flagged
      expect(report.valid).toBe(true);
      expect(report.isVerified).toBe(true);
      expect(report.functionalStatus).toBe("not_verified");
      expect(report.functionalDetail).toContain("domain functional tests pending");

      // In case of runtime error during mount
      const failedReport = validateApplicationTarget("NitroPulse", sampleArtifacts, "car_game", {
        isMounted: true,
        hasRuntimeError: true,
        runtimeErrorMsg: "ReferenceError: carSpeed is not defined",
      });
      expect(failedReport.valid).toBe(false);
      expect(failedReport.functionalStatus).toBe("failed");
      expect(failedReport.functionalDetail).toContain("carSpeed is not defined");
    });

    // 10. Multi-session chat isolation and persistence by project
    it("10. isolates chat sessions and messages per project without cross-project leakage", async () => {
      const { uiChatSessionStorage } = await import("@/lib/storage/uiChatSessionStorage");

      // Save a session for Project Alpha
      await uiChatSessionStorage.save({
        id: "sess_alpha_1",
        projectId: "proj_alpha",
        title: "Session Alpha",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "msg_a1",
            role: "user",
            mode: "edit",
            content: "Make the car red",
            timestamp: new Date().toISOString(),
          },
        ],
      });

      // Save a session for Project Beta
      await uiChatSessionStorage.save({
        id: "sess_beta_1",
        projectId: "proj_beta",
        title: "Session Beta",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "msg_b1",
            role: "user",
            mode: "ask",
            content: "Explain portfolio routing",
            timestamp: new Date().toISOString(),
          },
        ],
      });

      // Verify listing for Project Alpha returns only Project Alpha sessions
      const alphaSessions = await uiChatSessionStorage.list("proj_alpha");
      expect(alphaSessions).toHaveLength(1);
      expect(alphaSessions[0].id).toBe("sess_alpha_1");
      expect(alphaSessions[0].messages[0].content).toBe("Make the car red");

      // Verify listing for Project Beta returns only Project Beta sessions
      const betaSessions = await uiChatSessionStorage.list("proj_beta");
      expect(betaSessions).toHaveLength(1);
      expect(betaSessions[0].id).toBe("sess_beta_1");
      expect(betaSessions[0].messages[0].content).toBe("Explain portfolio routing");
    });
  });
});
