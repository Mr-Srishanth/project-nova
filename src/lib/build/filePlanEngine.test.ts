import { describe, it, expect } from "vitest";
import { generateFilePlanFromBlueprint } from "./filePlanEngine";
import type { Blueprint } from "@/types/blueprint";
import type { Project } from "@/types/project";

describe("filePlanEngine", () => {
  const mockProject: Project = {
    id: "proj-test",
    name: "E-Commerce App",
    description: "Modern e-commerce platform",
    objective: "Build scalable e-commerce store",
    category: "Web Application",
    technologies: ["react", "node"],
    status: "active",
    discoveryMode: "custom",
    milestones: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockBlueprint: Blueprint = {
    id: "bp-test",
    projectId: "proj-test",
    title: "E-Commerce Architecture",
    overview: "Modern headless e-commerce backend with Postgres and React UI.",
    problemStatement: "Need flexible e-commerce API",
    targetUsers: ["Shoppers", "Admins"],
    realWorldUseCase: "Online retail store",
    features: {
      mvp: ["Product catalog", "Stripe checkout"],
      important: ["User auth", "Order history"],
      advanced: ["Recommendations"],
      optional: ["Wishlist"],
    },
    techStack: [
      { layer: "Frontend", tech: "React + Tailwind", why: "Fast UI" },
      { layer: "Backend", tech: "Node.js + Express", why: "Scalable I/O" },
    ],
    architecture: {
      summary: "Three-tier architecture",
      nodes: [
        { id: "n1", label: "Client", kind: "client", detail: "Browser" },
        { id: "n2", label: "API Gateway", kind: "api", detail: "Express" },
      ],
      edges: [{ from: "n1", to: "n2", label: "HTTP" }],
    },
    database: {
      entities: [
        {
          name: "Product",
          purpose: "Products catalog",
          fields: [{ name: "id", type: "string", key: "PK" }],
        },
      ],
      relationships: [],
      sql: "CREATE TABLE products (id TEXT PRIMARY KEY);",
    },
    api: [
      { method: "GET", route: "/api/products", purpose: "List products" },
      { method: "POST", route: "/api/orders", purpose: "Create order" },
    ],
    uiScreens: [
      { name: "Catalog", purpose: "Display items", elements: ["Grid", "Filters"] },
      { name: "Checkout", purpose: "Pay for items", elements: ["Form"] },
    ],
    folderStructure: "src/\n  components/\n  lib/",
    testingStrategy: ["Unit testing with Vitest"],
    deploymentStrategy: ["Docker container"],
    futureImprovements: ["GraphQL"],
    updatedAt: new Date().toISOString(),
  };

  it("generates core project configuration and README files", () => {
    const plan = generateFilePlanFromBlueprint(mockProject, mockBlueprint);
    const paths = plan.files.map((i) => i.path);

    expect(paths).toContain("package.json");
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain("README.md");
  });

  it("generates database schema files when database is present", () => {
    const plan = generateFilePlanFromBlueprint(mockProject, mockBlueprint);
    const paths = plan.files.map((i) => i.path);

    expect(paths).toContain("src/db/schema.sql");
  });

  it("generates backend routes and API types", () => {
    const plan = generateFilePlanFromBlueprint(mockProject, mockBlueprint);
    const paths = plan.files.map((i) => i.path);

    expect(paths).toContain("src/api/routes.ts");
    expect(paths).toContain("src/core/types.ts");
    expect(paths).toContain("src/core/service.ts");
  });

  it("generates frontend UI modules when uiScreens is specified", () => {
    const plan = generateFilePlanFromBlueprint(mockProject, mockBlueprint);
    const paths = plan.files.map((i) => i.path);

    expect(paths).toContain("src/app/App.tsx");
  });

  it("ensures all generated paths are safe relative paths with no duplicates", () => {
    const plan = generateFilePlanFromBlueprint(mockProject, mockBlueprint);
    const paths = plan.files.map((i) => i.path);
    const uniquePaths = new Set(paths);

    expect(uniquePaths.size).toBe(paths.length);
    for (const p of paths) {
      expect(p.startsWith("/")).toBe(false);
      expect(p.includes("..")).toBe(false);
      expect(p.includes("\\")).toBe(false);
    }
  });
});
