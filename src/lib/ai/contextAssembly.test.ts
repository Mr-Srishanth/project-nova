import { describe, it, expect } from "vitest";
import { assembleProjectContext } from "./contextAssembly";
import type { Project } from "@/types/project";
import type { ProjectMemory } from "@/types/memory";

describe("assembleProjectContext - Project Isolation and Boundary Enforcement", () => {
  const project1: Project = {
    id: "proj_alpha",
    name: "Project Alpha",
    category: "Web Application",
    objective: "Build a high-performance web platform",
    description: "Alpha core platform",
    technologies: ["React", "FastAPI"],
    status: "active",
    discoveryMode: "custom",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [],
  };

  const project2: Project = {
    id: "proj_beta",
    name: "Project Beta",
    category: "Data Engineering",
    objective: "Real-time streaming pipeline",
    description: "Beta stream pipeline",
    technologies: ["Python", "Apache Kafka"],
    status: "active",
    discoveryMode: "tech",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [],
  };

  const mixedMemories: ProjectMemory[] = [
    {
      id: "mem_1",
      projectId: "proj_alpha",
      type: "decision",
      title: "Alpha uses PostgreSQL",
      content: "Alpha requires relational database for transactions",
      source: "user",
      status: "active",
      verificationState: "user_confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "mem_2",
      projectId: "proj_alpha",
      type: "risk",
      title: "Alpha OAuth rate limits",
      content: "External OAuth identity provider may throttle requests",
      source: "ai",
      status: "active",
      verificationState: "ai_proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "mem_3",
      projectId: "proj_beta",
      type: "decision",
      title: "Beta uses ClickHouse",
      content: "Beta requires columnar storage for analytics",
      source: "user",
      status: "active",
      verificationState: "user_confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "mem_4",
      projectId: "proj_beta",
      type: "constraint",
      title: "Beta zero-telemetry",
      content: "No third party telemetry libraries allowed",
      source: "user",
      status: "active",
      verificationState: "user_confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("should assemble context strictly containing Project Alpha data and zero Project Beta data", () => {
    const { text, summary } = assembleProjectContext(project1, mixedMemories);

    expect(summary.projectId).toBe("proj_alpha");
    expect(text).toContain("=== PROJECT CONTEXT: Project Alpha ===");
    expect(text).toContain("Alpha uses PostgreSQL");
    expect(text).toContain("Alpha OAuth rate limits");

    // Strict boundary assertion: ensure no Project Beta information leaks in
    expect(text).not.toContain("Project Beta");
    expect(text).not.toContain("ClickHouse");
    expect(text).not.toContain("Kafka");
    expect(text).not.toContain("zero-telemetry");
  });

  it("should assemble context strictly containing Project Beta data and zero Project Alpha data", () => {
    const { text, summary } = assembleProjectContext(project2, mixedMemories);

    expect(summary.projectId).toBe("proj_beta");
    expect(text).toContain("=== PROJECT CONTEXT: Project Beta ===");
    expect(text).toContain("Beta uses ClickHouse");
    expect(text).toContain("Beta zero-telemetry");

    // Strict boundary assertion: ensure no Project Alpha information leaks in
    expect(text).not.toContain("Project Alpha");
    expect(text).not.toContain("PostgreSQL");
    expect(text).not.toContain("FastAPI");
    expect(text).not.toContain("Alpha OAuth rate limits");
  });

  it("should truncate prompt context when exceeding maxChars", () => {
    const longProject: Project = {
      ...project1,
      description: "A".repeat(5000),
    };

    const { text } = assembleProjectContext(longProject, [], 500);
    expect(text.length).toBeLessThanOrEqual(600); // 500 + truncation notice
    expect(text).toContain("...[Context truncated for size limit]");
  });
});
