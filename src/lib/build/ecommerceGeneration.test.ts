import { describe, it, expect } from "vitest";
import { detectProjectArchetype, generateTargetProjectBaseline } from "./targetProjectBaseline";
import { generateDefaultBlueprint } from "@/lib/blueprintDefaults";
import { buildTargetProjectPreviewHtml } from "@/lib/preview/previewBuilder";
import { validateApplicationTarget } from "@/lib/validation/applicationValidator";
import type { BuildArtifact } from "@/types/artifact";

function makeArtifact(path: string, content: string): BuildArtifact {
  return {
    id: `art_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
    projectId: "proj_ecommerce_test",
    path,
    type: "frontend",
    purpose: "ecommerce_test",
    status: "approved",
    content,
    language: path.endsWith(".html") ? "html" : "typescript",
    dependencies: [],
    versions: [],
  };
}

describe("E-Commerce Intent, Blueprint, Baseline & Multi-Page Preview", () => {
  const shopProject: any = {
    id: "proj_liquid_shop",
    name: "Liquid Glass Shop",
    category: "E-Commerce",
    objective: "Build an ethereal Liquid Glass e-commerce storefront with catalog, cart, and authentication",
    description: "Multi-page shopping experience with organic glass aesthetics, live ledger cart arithmetic, and login/register portals",
    technologies: ["React", "TypeScript", "Tailwind CSS"],
    status: "active",
    discoveryMode: "custom",
    milestones: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("detects 'ecommerce' archetype accurately from name and objective", () => {
    const archetype = detectProjectArchetype(shopProject);
    expect(archetype).toBe("ecommerce");
  });

  it("generates an e-commerce domain blueprint instead of generic dashboard", () => {
    const bp = generateDefaultBlueprint(
      shopProject.id,
      shopProject.name,
      shopProject.technologies,
      shopProject.category,
      shopProject.objective,
      shopProject.description
    );

    expect(bp.title).toContain("E-Commerce");
    expect(bp.overview).toContain("Liquid Glass");
    const allFeatures = [
      ...bp.features.mvp,
      ...bp.features.important,
      ...bp.features.advanced,
    ].join(" ");
    expect(allFeatures).toMatch(/catalog|cart|ledger|login|register/i);
  });

  it("generates 5-view Liquid Glass baseline code with real catalog, cart arithmetic, and authentication", () => {
    const baseline = generateTargetProjectBaseline(shopProject);
    const appTsx = baseline["src/app/App.tsx"];

    expect(appTsx).toBeDefined();
    // Verify 5 views
    expect(appTsx).toContain("activeTab");
    expect(appTsx).toContain("home");
    expect(appTsx).toContain("catalog");
    expect(appTsx).toContain("cart");
    expect(appTsx).toContain("login");
    expect(appTsx).toContain("register");

    // Verify 6 products
    expect(appTsx).toContain("CyberDeck Vision Neo");
    expect(appTsx).toContain("PulseCore Synthesizer");
    expect(appTsx).toContain("Aetheria Glass Pod");
    expect(appTsx).toContain("Neural Chrono V2");
    expect(appTsx).toContain("Quantum Data Key");
    expect(appTsx).toContain("Prism Flow Headset");

    // Verify Liquid Glass styling tokens
    expect(appTsx).toContain("#0f0c20");
    expect(appTsx).toContain("#00f0ff");
    expect(appTsx).toContain("#ff007f");
    expect(appTsx).toContain("backdrop-blur");

    // Verify arithmetic operations
    expect(appTsx).toContain("addToCart");
    expect(appTsx).toContain("updateQuantity");
    expect(appTsx).toContain("subtotal");
  });

  it("passes application validation for e-commerce archetype without flagging missing canvas or dashboard KPIs", () => {
    const baseline = generateTargetProjectBaseline(shopProject);
    const artifacts: BuildArtifact[] = Object.entries(baseline).map(([path, content]) =>
      makeArtifact(path, content)
    );

    const report = validateApplicationTarget(shopProject.name, artifacts, "ecommerce", {
      isMounted: true,
      hasRuntimeError: false,
    });

    expect(report.archetype).toBe("ecommerce");
    expect(report.valid).toBe(true);
    expect(report.errors.length).toBe(0);
    expect(report.breakdown.archetypeCompliance).toBe(100);
  });

  it("renders pure multi-page HTML projects and generates navigation links", () => {
    const homeHtml = `<!DOCTYPE html><html><head><title>Home</title></head><body><h1>Welcome</h1><a href="catalog.html">Shop Now</a></body></html>`;
    const catalogHtml = `<!DOCTYPE html><html><head><title>Catalog</title></head><body><h1>Catalog</h1><a href="cart.html">View Cart</a></body></html>`;
    const cartHtml = `<!DOCTYPE html><html><head><title>Cart</title></head><body><h1>Cart</h1><span id="subtotal">$2148</span></body></html>`;

    const artifacts = [
      makeArtifact("home.html", homeHtml),
      makeArtifact("catalog.html", catalogHtml),
      makeArtifact("cart.html", cartHtml),
    ];

    // Default route renders home.html
    const previewHome = buildTargetProjectPreviewHtml(shopProject.name, artifacts, {
      selectedRoute: "/",
    });
    expect(previewHome.entryFile).toBe("home.html");
    expect(previewHome.html).toContain("Welcome");
    expect(previewHome.html).toContain("PREVIEW_NAVIGATE");
    expect(previewHome.detectedRoutes).toContain("/catalog.html");
    expect(previewHome.detectedRoutes).toContain("/cart.html");

    // Navigating to catalog.html
    const previewCatalog = buildTargetProjectPreviewHtml(shopProject.name, artifacts, {
      selectedRoute: "/catalog.html",
    });
    expect(previewCatalog.entryFile).toBe("catalog.html");
    expect(previewCatalog.html).toContain("Catalog");
  });
});
