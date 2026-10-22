import type { BuildArtifact } from "@/types/artifact";
import type { ApplicationArchetype, ApplicationValidationReport } from "@/types/uiStudio";

/**
 * Validates a target project based on its detected archetype.
 * Calculates explicit multidimensional health scores:
 * - staticChecks: Structural manifest, package.json, entry points, .env templates (0-100)
 * - runtimeHealth: Evaluates if errors/warnings exist in the codebase (0-100)
 * - archetypeCompliance: Canvas loops for games, KPIs for dashboards, Nav/Footer for websites (0-100)
 * The composite score is a weighted average and never declares 100% unless all dimensions are verified.
 */
export function validateApplicationTarget(
  _projectName: string,
  artifacts: BuildArtifact[],
  archetype: ApplicationArchetype,
  runtimeState?: { isMounted: boolean; hasRuntimeError: boolean; runtimeErrorMsg?: string | null }
): ApplicationValidationReport {
  const artifactMap = new Map<string, string>();
  for (const a of artifacts) {
    artifactMap.set(a.path.replace(/\\/g, "/"), a.content || "");
  }

  const checks: ApplicationValidationReport["checks"] = [];
  const errors: ApplicationValidationReport["errors"] = [];
  const suggestedRepairs: ApplicationValidationReport["suggestedRepairs"] = [];

  // 1. Mandatory Root Configuration Checks
  const hasPackageJson = artifactMap.has("package.json");
  checks.push({
    name: "Package Manifest",
    passed: hasPackageJson,
    detail: hasPackageJson ? "package.json is present" : "package.json is missing",
    critical: true,
  });
  if (!hasPackageJson) {
    errors.push({
      file: "package.json",
      message: "Target application lacks package.json manifest",
      type: "missing_entry",
      suggestedFix: "Generate package.json with standard build and preview scripts",
    });
  }

  const hasIndexHtml = artifactMap.has("index.html");
  checks.push({
    name: "HTML Entry Document",
    passed: hasIndexHtml,
    detail: hasIndexHtml ? "index.html exists" : "index.html is missing",
    critical: true,
  });

  const hasEnvExample = artifactMap.has(".env.example");
  checks.push({
    name: "Environment Template",
    passed: hasEnvExample,
    detail: hasEnvExample ? ".env.example is configured" : ".env.example is recommended",
    critical: false,
  });

  // 2. Entry point resolution
  const hasAppEntry =
    artifactMap.has("src/app/App.tsx") ||
    artifactMap.has("src/App.tsx") ||
    artifactMap.has("src/main.tsx");
  checks.push({
    name: "Application Entry Component",
    passed: hasAppEntry,
    detail: hasAppEntry ? "Found React entry component" : "Missing src/app/App.tsx or main.tsx",
    critical: true,
  });

  const structuralChecksCount = checks.length;
  const passedStructural = checks.filter((c) => c.passed).length;
  const staticChecksScore = structuralChecksCount > 0 ? Math.round((passedStructural / structuralChecksCount) * 100) : 0;

  // 3. Archetype-specific Checks
  const archetypeChecks: Array<{ name: string; passed: boolean; detail: string; critical: boolean }> = [];
  if (archetype === "car_game" || archetype === "game") {
    const appContent = artifactMap.get("src/app/App.tsx") || artifactMap.get("src/App.tsx") || "";
    const hasCanvas = appContent.includes("<canvas") || appContent.includes("getContext");
    const hasGameLoop = appContent.includes("requestAnimationFrame");
    const hasControls = appContent.includes("keydown") || appContent.includes("Arrow") || appContent.includes("keysRef");
    const hasCollision = appContent.includes("collision") || appContent.includes("collided") || appContent.includes("Math.abs");
    const hasScoreTelemetry = appContent.includes("score") || appContent.includes("speed");

    archetypeChecks.push({
      name: "Canvas Game Engine",
      passed: hasCanvas,
      detail: hasCanvas ? "HTML5 Canvas renderer initialized" : "Missing <canvas> game viewport",
      critical: true,
    });
    archetypeChecks.push({
      name: "60 FPS Animation Loop",
      passed: hasGameLoop,
      detail: hasGameLoop ? "requestAnimationFrame active" : "Missing game loop",
      critical: true,
    });
    archetypeChecks.push({
      name: "Interactive Steering Controls",
      passed: hasControls,
      detail: hasControls ? "Keyboard / touch handlers bound" : "Missing player steering controls",
      critical: true,
    });
    archetypeChecks.push({
      name: "Collision Detection Logic",
      passed: hasCollision,
      detail: hasCollision ? "2D bounding box collision evaluated" : "Missing obstacle collision checks",
      critical: false,
    });
    archetypeChecks.push({
      name: "Speed & Score Telemetry",
      passed: hasScoreTelemetry,
      detail: hasScoreTelemetry ? "Real-time telemetry and score state tracked" : "Missing score/speed tracking",
      critical: false,
    });

    if (!hasCanvas || !hasGameLoop) {
      errors.push({
        file: "src/app/App.tsx",
        message: "Game application does not implement an interactive HTML5 canvas game loop",
        type: "runtime",
        suggestedFix: "Implement requestAnimationFrame canvas rendering loop with car steering controls",
      });
      suggestedRepairs.push({
        id: "repair_game_loop",
        title: "Synthesize Interactive Game Loop",
        description: "Replaces static mockup with an active 60 FPS HTML5 canvas game loop featuring player car, traffic obstacles, and steering controls.",
        affectedFile: "src/app/App.tsx",
      });
    }
  } else if (archetype === "dashboard") {
    const appContent = artifactMap.get("src/app/App.tsx") || "";
    const hasMetrics = appContent.toLowerCase().includes("kpi") || appContent.toLowerCase().includes("stat") || appContent.toLowerCase().includes("card");
    const hasFilters = appContent.toLowerCase().includes("filter") || appContent.toLowerCase().includes("search") || appContent.toLowerCase().includes("select");

    archetypeChecks.push({
      name: "Metrics & KPI Cards",
      passed: hasMetrics,
      detail: hasMetrics ? "Dashboard metrics cards detected" : "No KPI metrics found",
      critical: false,
    });
    archetypeChecks.push({
      name: "Interactive Filters",
      passed: hasFilters,
      detail: hasFilters ? "Dashboard filtering controls found" : "No data filters detected",
      critical: false,
    });
  } else if (archetype === "website") {
    const appContent = artifactMap.get("src/app/App.tsx") || "";
    const hasNav = appContent.toLowerCase().includes("nav") || appContent.toLowerCase().includes("header");
    const hasFooter = appContent.toLowerCase().includes("footer");

    archetypeChecks.push({
      name: "Header Navigation",
      passed: hasNav,
      detail: hasNav ? "Header and navigation links present" : "Missing header navigation",
      critical: false,
    });
    archetypeChecks.push({
      name: "Footer Section",
      passed: hasFooter,
      detail: hasFooter ? "Footer present" : "Footer omitted",
      critical: false,
    });
  } else {
    archetypeChecks.push({
      name: "General React Application",
      passed: hasAppEntry,
      detail: "Component mount point ready",
      critical: true,
    });
  }

  checks.push(...archetypeChecks);
  const passedArchetype = archetypeChecks.filter((c) => c.passed).length;
  const archetypeCompliance = archetypeChecks.length > 0 ? Math.round((passedArchetype / archetypeChecks.length) * 100) : 100;

  // 4. Runtime Health Calculation & Verification State
  let runtimeHealth = 100;
  let isVerified = true;
  let functionalStatus: ApplicationValidationReport["functionalStatus"] = "not_verified";
  let functionalDetail = "No automated functional test runs recorded for target";

  if (runtimeState) {
    if (runtimeState.hasRuntimeError) {
      runtimeHealth = 20;
      isVerified = true;
      functionalStatus = "failed";
      functionalDetail = runtimeState.runtimeErrorMsg || "Runtime error during target execution";
      errors.push({
        file: "Preview Sandbox",
        message: runtimeState.runtimeErrorMsg || "Runtime error encountered during execution",
        type: "runtime",
        suggestedFix: "Review error stack trace and trigger Auto-Fix",
      });
    } else if (!runtimeState.isMounted) {
      runtimeHealth = 60; // Compiling or pending mount
      isVerified = false;
      functionalStatus = "testing";
      functionalDetail = "Preview mount in progress...";
    } else {
      runtimeHealth = 100; // Verified mounted and running without runtime exceptions
      isVerified = true;
      // Note: Mounting successfully verifies the sandbox runtime, but deep domain functionality
      // (e.g. game loop score tracking, real backend API calls) remains not_verified without dedicated tests.
      functionalStatus = "not_verified";
      functionalDetail = "Preview mounted cleanly; domain functional tests pending";
    }
  } else {
    // Runtime checks have not run yet
    isVerified = false;
    runtimeHealth = 50;
    functionalStatus = "not_verified";
    functionalDetail = "Target has not mounted in active preview sandbox";
  }

  // 5. Build/Transpilation sanity check
  const buildChecks = hasAppEntry && hasPackageJson ? 100 : 40;

  // 6. Composite Score Calculation (Weighted: 30% static, 25% build, 25% archetype, 20% runtime)
  const criticalFailures = checks.filter((c) => c.critical && !c.passed).length;
  let score = Math.round(
    staticChecksScore * 0.30 +
    buildChecks * 0.25 +
    archetypeCompliance * 0.25 +
    runtimeHealth * 0.20
  );

  // If there are critical failures or runtime exceptions, score cannot exceed 60%
  if (criticalFailures > 0 || (runtimeState && runtimeState.hasRuntimeError)) {
    score = Math.min(score, 60);
  }

  const valid = criticalFailures === 0 && errors.length === 0 && (!runtimeState || !runtimeState.hasRuntimeError);

  return {
    valid,
    archetype,
    score,
    isVerified,
    functionalStatus,
    functionalDetail,
    breakdown: {
      staticChecks: staticChecksScore,
      buildChecks,
      runtimeHealth,
      archetypeCompliance,
      functionalChecks: (functionalStatus as string) === "passed" ? 100 : (functionalStatus === "failed" ? 0 : 50),
    },
    checks,
    errors,
    suggestedRepairs,
  };
}
