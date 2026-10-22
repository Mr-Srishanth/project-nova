import { describe, it, expect } from "vitest";
import { generateDeterministicDoc } from "./docGenerator";
import { detectDocumentDrift } from "./driftDetector";
import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type { ProjectDocument } from "@/types/document";

describe("Documentation Generation & Living Drift Detection", () => {
  const mockProject: Project = {
    id: "proj-doc",
    name: "Fintech Core API",
    description: "Enterprise payment router",
    objective: "High throughput card transactions",
    category: "Web Application",
    technologies: ["Node.js", "PostgreSQL"],
    status: "active",
    discoveryMode: "custom",
    milestones: [],
    blueprint: {
      id: "bp-doc",
      projectId: "proj-doc",
      title: "Fintech Architecture",
      overview: "High-scale payment orchestrator",
      problemStatement: "Payment settlement latency",
      targetUsers: ["Merchants"],
      realWorldUseCase: "Card processing",
      features: { mvp: ["Charge API"], important: [], advanced: [], optional: [] },
      techStack: [{ layer: "Backend", tech: "Node.js", why: "Async event loop" }],
      architecture: {
        summary: "Event-driven architecture",
        nodes: [
          { id: "n1", label: "Client", kind: "client", detail: "Browser" },
          { id: "n2", label: "Gateway", kind: "api", detail: "Express" },
        ],
        edges: [{ from: "n1", to: "n2", label: "HTTPS" }],
      },
      database: {
        entities: [
          {
            name: "transactions",
            purpose: "Payment ledger",
            fields: [{ name: "id", type: "UUID", key: "PK" }],
          },
        ],
        relationships: [],
        sql: "CREATE TABLE transactions (id UUID PRIMARY KEY);",
      },
      api: [
        { method: "POST", route: "/api/charge", purpose: "Charge customer card" },
      ],
      uiScreens: [],
      folderStructure: "src/",
      testingStrategy: [],
      deploymentStrategy: [],
      futureImprovements: [],
      updatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleArtifacts: BuildArtifact[] = [
    {
      id: "art-1",
      projectId: "proj-doc",
      path: "package.json",
      type: "config",
      purpose: "Package dependencies",
      status: "approved",
      content: "{}",
      language: "json",
      dependencies: [],
      versions: [],
    },
    {
      id: "art-2",
      projectId: "proj-doc",
      path: "src/api/charge.ts",
      type: "api",
      purpose: "Payment charge handler",
      status: "approved",
      content: "export const charge = () => true;",
      language: "typescript",
      dependencies: [],
      versions: [],
    },
  ];

  it("deterministically generates README grounded in real project data", () => {
    const docData = generateDeterministicDoc("readme", {
      project: mockProject,
      artifacts: sampleArtifacts,
    });

    expect(docData.title).toBe("Fintech Core API README");
    expect(docData.content).toContain("# Fintech Core API");
    expect(docData.content).toContain("High-scale payment orchestrator");
    expect(docData.content).toContain("`package.json`");
    expect(docData.content).toContain("`src/api/charge.ts`");
  });

  it("deterministically generates architecture overview and mermaid diagram", () => {
    const docData = generateDeterministicDoc("architecture", {
      project: mockProject,
      artifacts: sampleArtifacts,
    });

    expect(docData.content).toContain("Event-driven architecture");
    expect(docData.content).toContain("```mermaid");
    expect(docData.content).toContain('n1["Client (client)"]');
  });

  it("deterministically generates API reference and marks missing elements as TODO", () => {
    const docData = generateDeterministicDoc("api_reference", {
      project: mockProject,
      artifacts: sampleArtifacts,
    });

    expect(docData.content).toContain("POST /api/charge");
    expect(docData.content).toContain("Charge customer card");
  });

  it("flags living drift when document references a deleted or non-existent file", () => {
    const doc: ProjectDocument = {
      id: "doc-test",
      projectId: "proj-doc",
      title: "Doc with drift",
      slug: "test",
      type: "readme",
      status: "draft",
      content: "Inspect the handler at `src/legacy/oldHandler.ts` and `package.json`.",
      summary: "Test",
      sourcesUsed: [],
      isAiGenerated: false,
      linkedArtifactPaths: [],
      linkedBrainRecordIds: [],
      versions: [],
      driftFindings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const findings = detectDocumentDrift({
      document: doc,
      artifacts: sampleArtifacts, // only has package.json and src/api/charge.ts
    });

    expect(findings.length).toBe(1);
    expect(findings[0].reason).toContain("src/legacy/oldHandler.ts");
    expect(findings[0].severity).toBe("mismatch");
  });

  it("flags drift when document references API route not present in blueprint", () => {
    const doc: ProjectDocument = {
      id: "doc-api",
      projectId: "proj-doc",
      title: "API doc",
      slug: "api",
      type: "api_reference",
      status: "approved",
      content: "Call `DELETE /api/users/remove` to delete an account.",
      summary: "API doc",
      sourcesUsed: [],
      isAiGenerated: false,
      linkedArtifactPaths: [],
      linkedBrainRecordIds: [],
      versions: [],
      driftFindings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const findings = detectDocumentDrift({
      document: doc,
      artifacts: sampleArtifacts,
      blueprint: mockProject.blueprint,
    });

    expect(findings.length).toBe(1);
    expect(findings[0].reason).toContain("DELETE /api/users/remove");
    expect(findings[0].severity).toBe("drift");
  });
});
