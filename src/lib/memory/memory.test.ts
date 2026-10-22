import { describe, it, expect, beforeEach } from "vitest";
import { brainStorage } from "@/lib/storage/brainStorage";
import { detectMemoryIntegrityFindings } from "./integrityEngine";
import { retrieveRelevantMemories } from "./retrievalEngine";
import type { ProjectMemory } from "@/types/memory";

describe("Phase 12: Intelligent Project Memory & Knowledge Integrity", () => {
  const TEST_PROJ_1 = "proj-mem-1";
  const TEST_PROJ_2 = "proj-mem-2";

  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. Structured Memory Service & Lifecycle", () => {
    it("should create memory records with proper provenance and default verification", async () => {
      const userFact = await brainStorage.create({
        projectId: TEST_PROJ_1,
        type: "fact",
        title: "Target DB is PostgreSQL",
        content: "Production database must be hosted on PostgreSQL 16.",
        source: "user",
      });

      expect(userFact.id).toBeDefined();
      expect(userFact.status).toBe("active");
      expect(userFact.verificationState).toBe("user_confirmed");
      expect(userFact.version).toBe(1);

      const aiProposal = await brainStorage.create({
        projectId: TEST_PROJ_1,
        type: "decision",
        title: "Adopt Redis Cache",
        content: "Propose Redis for session caching layer.",
        source: "ai",
      });

      expect(aiProposal.verificationState).toBe("ai_proposed");
      expect(aiProposal.status).toBe("active");
    });

    it("should confirm an AI proposed memory into a verified fact", async () => {
      const proposal = await brainStorage.create({
        projectId: TEST_PROJ_1,
        type: "requirement",
        title: "OAuth2 GitHub Login",
        content: "Support GitHub single sign-on.",
        source: "ai",
      });

      expect(proposal.verificationState).toBe("ai_proposed");

      const confirmed = await brainStorage.confirmProposal(proposal.id);
      expect(confirmed.verificationState).toBe("user_confirmed");
    });

    it("should reject and archive an unverified proposal", async () => {
      const proposal = await brainStorage.create({
        projectId: TEST_PROJ_1,
        type: "decision",
        title: "Use MongoDB",
        content: "Store application state in Mongo.",
        source: "ai",
      });

      const rejected = await brainStorage.rejectProposal(proposal.id);
      expect(rejected.verificationState).toBe("rejected");
      expect(rejected.status).toBe("archived");
    });

    it("should supersede an outdated memory with a new revision while preserving history", async () => {
      const v1 = await brainStorage.create({
        projectId: TEST_PROJ_1,
        type: "decision",
        title: "Frontend Styling Approach",
        content: "Use Tailwind CSS utility classes.",
        source: "user",
        rationale: "Rapid prototype development.",
      });

      const { superseded, created } = await brainStorage.supersede(v1.id, {
        projectId: TEST_PROJ_1,
        type: "decision",
        title: "Frontend Styling Approach v2",
        content: "Adopt Tailwind CSS with Shadcn UI primitive components.",
        source: "user",
        rationale: "Enhanced accessibility and standardized design tokens.",
      });

      expect(superseded.status).toBe("superseded");
      expect(superseded.supersededBy).toBe(created.id);
      expect(created.status).toBe("active");
      expect(created.relatedMemoryIds).toContain(v1.id);

      // Verify list returns both but states differ
      const all = await brainStorage.list(TEST_PROJ_1);
      expect(all.length).toBe(2);
    });

    it("should resolve an open question with a resolution note", async () => {
      const question = await brainStorage.create({
        projectId: TEST_PROJ_1,
        type: "open_question",
        title: "Should we support SQLite fallback?",
        content: "Evaluate whether local SQLite is viable for offline demo mode.",
        source: "user",
      });

      const resolved = await brainStorage.resolveQuestion(question.id, "Resolved: Browser localStorage is used for client demo mode.");
      expect(resolved.status).toBe("resolved");
      expect(resolved.rationale).toContain("Browser localStorage");
    });

    it("should migrate legacy memory records safely without data loss", async () => {
      // Simulate raw legacy storage entry from Phase 3
      const legacyRaw = JSON.stringify([
        {
          id: "mem_legacy_1",
          projectId: TEST_PROJ_1,
          type: "decision",
          title: "Legacy Decision",
          content: "Legacy content without Phase 12 fields",
          source: "user",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
      localStorage.setItem("projectnova_brain_memories_v1", legacyRaw);

      const loaded = await brainStorage.list(TEST_PROJ_1);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].status).toBe("active");
      expect(loaded[0].verificationState).toBe("user_confirmed");
      expect(loaded[0].version).toBe(1);
    });
  });

  describe("2. Knowledge Integrity & Contradiction Detection", () => {
    it("should detect conflicting active decisions sharing topic keywords", () => {
      const memories: ProjectMemory[] = [
        {
          id: "m1",
          projectId: TEST_PROJ_1,
          type: "decision",
          title: "Primary Database Choice",
          content: "Use PostgreSQL for relational schemas.",
          source: "user",
          status: "active",
          verificationState: "user_confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "m2",
          projectId: TEST_PROJ_1,
          type: "decision",
          title: "Primary Database Choice",
          content: "Use MongoDB cluster for document storage.",
          source: "user",
          status: "active",
          verificationState: "user_confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const findings = detectMemoryIntegrityFindings(memories);
      expect(findings.length).toBeGreaterThanOrEqual(1);

      const conflict = findings.find((f) => f.findingType === "conflicting_decision");
      expect(conflict).toBeDefined();
      expect(conflict?.severity).toBe("high");
      expect(conflict?.affectedMemoryIds).toContain("m1");
      expect(conflict?.affectedMemoryIds).toContain("m2");
    });

    it("should flag stale references to deleted or missing project artifacts", () => {
      const memories: ProjectMemory[] = [
        {
          id: "m-ref",
          projectId: TEST_PROJ_1,
          type: "fact",
          title: "Server Gateway Entrypoint",
          content: "Main server routing file exists at server/gateway.ts",
          source: "user",
          status: "active",
          verificationState: "user_confirmed",
          relatedEntityRef: {
            entityType: "artifact",
            entityId: "art_old",
            name: "src/server/old_missing_gateway.ts",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const findings = detectMemoryIntegrityFindings(memories, {
        knownArtifactPaths: ["src/app/router.tsx", "src/main.tsx"],
      });

      const stale = findings.find((f) => f.findingType === "stale_reference");
      expect(stale).toBeDefined();
      expect(stale?.affectedMemoryIds).toContain("m-ref");
    });
  });

  describe("3. Relevance Ranking & Context Budget Packing", () => {
    it("should prioritize user-confirmed constraints and decisions over unverified proposals", () => {
      const memories: ProjectMemory[] = [
        {
          id: "mem-proposal",
          projectId: TEST_PROJ_1,
          type: "summary",
          title: "Proposal for Cloud Hosting",
          content: "Maybe deploy to AWS or GCP.",
          source: "ai",
          status: "active",
          verificationState: "ai_proposed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "mem-constraint",
          projectId: TEST_PROJ_1,
          type: "constraint",
          title: "Must Run Fully Offline",
          content: "Application must run standalone without mandatory internet connection.",
          source: "user",
          status: "active",
          verificationState: "user_confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const result = retrieveRelevantMemories(memories, {
        projectId: TEST_PROJ_1,
      });

      expect(result.selectedMemories.length).toBe(2);
      expect(result.selectedMemories[0].memory.id).toBe("mem-constraint");
      expect(result.selectedMemories[0].relevanceScore).toBeGreaterThan(result.selectedMemories[1].relevanceScore);
    });

    it("should enforce strict project boundary isolation during retrieval", () => {
      const memories: ProjectMemory[] = [
        {
          id: "m-proj1",
          projectId: TEST_PROJ_1,
          type: "fact",
          title: "Project 1 Secret Fact",
          content: "Unique to Project 1",
          source: "user",
          status: "active",
          verificationState: "user_confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "m-proj2",
          projectId: TEST_PROJ_2,
          type: "fact",
          title: "Project 2 Secret Fact",
          content: "Unique to Project 2",
          source: "user",
          status: "active",
          verificationState: "user_confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const p1Result = retrieveRelevantMemories(memories, { projectId: TEST_PROJ_1 });
      expect(p1Result.selectedMemories).toHaveLength(1);
      expect(p1Result.selectedMemories[0].memory.projectId).toBe(TEST_PROJ_1);
      expect(p1Result.contextText).not.toContain("Project 2");
    });

    it("should truncate context when budget is exceeded and report omitted count", () => {
      const memories: ProjectMemory[] = Array.from({ length: 20 }, (_, idx) => ({
        id: `mem-${idx}`,
        projectId: TEST_PROJ_1,
        type: "fact",
        title: `Detailed Project Technical Requirement #${idx}`,
        content: "Detailed paragraph explaining extensive requirements and architectural constraints.".repeat(5),
        source: "user",
        status: "active",
        verificationState: "user_confirmed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const budget = 1000;
      const result = retrieveRelevantMemories(memories, {
        projectId: TEST_PROJ_1,
        maxBudgetChars: budget,
      });

      expect(result.isTruncated).toBe(true);
      expect(result.omittedCount).toBeGreaterThan(0);
      expect(result.budgetUsedChars).toBeLessThanOrEqual(budget);
      expect(result.contextText).toContain("Context truncated");
    });
  });
});
