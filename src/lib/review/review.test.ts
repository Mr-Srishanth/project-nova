import { describe, it, expect, beforeEach } from "vitest";
import { runDeterministicReview } from "./deterministicReviewer";
import { createRepairProposal, createUnifiedDiff, simpleContentHash, isProposalStale } from "./proposalEngine";
import { applyRepairPatch } from "./patchApplier";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { reviewStorage } from "@/lib/storage/reviewStorage";
import type { BuildArtifact } from "@/types/artifact";
import type { ReviewFinding } from "@/types/review";
import type { ProjectMemory } from "@/types/memory";

describe("Phase 14: AI Code Review & Repair Proposals Engine", () => {
  const TEST_PROJ = "proj-review-test";

  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. Deterministic Review Findings", () => {
    it("should detect security vulnerabilities such as unsafe eval() and hardcoded credentials", () => {
      const artifacts: BuildArtifact[] = [
        {
          id: "art-1",
          projectId: TEST_PROJ,
          path: "src/server.ts",
          type: "backend",
          purpose: "Server API",
          status: "approved",
          content: `
            const secret = "AIzaSyABC123456789012345678901234567";
            const dynamic = eval("2 + 2");
          `,
          language: "typescript",
          dependencies: [],
          versions: [],
        },
      ];

      const findings = runDeterministicReview({
        projectId: TEST_PROJ,
        artifacts,
      });

      expect(findings.length).toBeGreaterThanOrEqual(1);
      const evalFinding = findings.find((f) => f.explanation.includes("eval") || f.title.includes("eval"));
      expect(evalFinding).toBeDefined();
      expect(evalFinding?.category).toBe("security");
      expect(evalFinding?.severity).toBe("critical");
    });

    it("should cross-reference Project Brain architectural constraints against code", () => {
      const artifacts: BuildArtifact[] = [
        {
          id: "art-2",
          projectId: TEST_PROJ,
          path: "src/calc.ts",
          type: "frontend",
          purpose: "Calculator",
          status: "approved",
          content: "const res = eval(input);",
          language: "typescript",
          dependencies: [],
          versions: [],
        },
      ];

      const memories: ProjectMemory[] = [
        {
          id: "mem-no-eval",
          projectId: TEST_PROJ,
          type: "constraint",
          title: "Disallow eval in all modules",
          content: "Security policy prohibits dynamic evaluation.",
          source: "user",
          status: "active",
          verificationState: "user_confirmed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const findings = runDeterministicReview({
        projectId: TEST_PROJ,
        artifacts,
        memories,
      });

      const brainFinding = findings.find((f) => f.relatedMemoryId === "mem-no-eval");
      expect(brainFinding).toBeDefined();
      expect(brainFinding?.category).toBe("architecture");
    });
  });

  describe("2. Repair Proposal & Diff Validation", () => {
    it("should create valid repair proposals with unified diff and approval token", () => {
      const artifact: BuildArtifact = {
        id: "art-eval",
        projectId: TEST_PROJ,
        path: "src/safe.ts",
        type: "backend",
        purpose: "Safe module",
        status: "approved",
        content: `const a = eval("1 + 1");`,
        language: "typescript",
        dependencies: [],
        versions: [],
      };

      const finding: ReviewFinding = {
        id: "f-1",
        projectId: TEST_PROJ,
        category: "security",
        severity: "critical",
        confidence: "high",
        title: "Unsafe eval usage",
        explanation: "eval() allows arbitrary code execution",
        filePath: "src/safe.ts",
        detectionMethod: "deterministic_rule",
        potentialImpact: "RCE vulnerability",
        recommendedAction: "Replace with JSON.parse",
        status: "open",
        detectedAt: new Date().toISOString(),
      };

      const proposal = createRepairProposal({
        finding,
        targetArtifact: artifact,
        proposedCode: `const a = JSON.parse("2");`,
        rationale: "Replaced eval with JSON.parse",
        expectedBehaviorChange: "Prevents code injection",
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.validationStatus).toBe("awaiting_approval");
      expect(proposal.approvalToken).toBeDefined();
      expect(proposal.unifiedDiff).toContain("--- a/src/safe.ts");
      expect(proposal.unifiedDiff).toContain("-const a = eval(\"1 + 1\");");
      expect(proposal.unifiedDiff).toContain("+const a = JSON.parse(\"2\");");
    });

    it("should detect when a proposal becomes stale after source modification", () => {
      const originalCode = "const x: any = 10;";
      const modifiedCode = "const x: number = 20;";

      const artifact: BuildArtifact = {
        id: "art-stale",
        projectId: TEST_PROJ,
        path: "src/types.ts",
        type: "frontend",
        purpose: "Types",
        status: "approved",
        content: originalCode,
        language: "typescript",
        dependencies: [],
        versions: [],
      };

      const finding: ReviewFinding = {
        id: "f-stale",
        projectId: TEST_PROJ,
        category: "maintainability",
        severity: "medium",
        confidence: "high",
        title: "Excessive any",
        explanation: "Replace any with strict type",
        filePath: "src/types.ts",
        detectionMethod: "deterministic_rule",
        potentialImpact: "Type loss",
        recommendedAction: "Type explicitly",
        status: "open",
        detectedAt: new Date().toISOString(),
      };

      const proposal = createRepairProposal({
        finding,
        targetArtifact: artifact,
        proposedCode: "const x: unknown = 10;",
        rationale: "Use unknown instead of any",
        expectedBehaviorChange: "Stricter checks",
      });

      // Before modification: not stale
      expect(isProposalStale(proposal, originalCode)).toBe(false);

      // After source file modification: stale
      expect(isProposalStale(proposal, modifiedCode)).toBe(true);
    });
  });

  describe("3. Patch Application & Atomic Verification", () => {
    it("should reject patch application if approval token is missing or incorrect", async () => {
      const proposal = {
        id: "prop-invalid-token",
        projectId: TEST_PROJ,
        findingId: "f-1",
        targetFilePath: "src/test.ts",
        originalContentHash: "h_123",
        originalCodeSnippet: "old",
        proposedCodeSnippet: "new",
        unifiedDiff: "",
        rationale: "fix",
        expectedBehaviorChange: "fix",
        validationStatus: "awaiting_approval" as const,
        approvalToken: "tok_prop-invalid-token_h_123",
        createdAt: new Date().toISOString(),
      };

      const result = await applyRepairPatch({
        proposal,
        fullProposedContent: "new content",
        approvalToken: "wrong_fake_token",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Approval token invalid");
    });

    it("should apply patch atomically, record version, and execute post-repair verification", async () => {
      const original = "const port = 4000;\nconsole.log(port);";
      const patched = "const port: number = 4000;\nconsole.log(port);";

      await artifactStorage.save({
        id: "art-apply",
        projectId: TEST_PROJ,
        path: "src/server-config.ts",
        type: "backend",
        purpose: "Config",
        status: "approved",
        content: original,
        language: "typescript",
        dependencies: [],
        versions: [],
      });

      const originalHash = simpleContentHash(original);
      const proposal = {
        id: "prop-valid",
        projectId: TEST_PROJ,
        findingId: "f-2",
        targetFilePath: "src/server-config.ts",
        originalContentHash: originalHash,
        originalCodeSnippet: original,
        proposedCodeSnippet: patched,
        unifiedDiff: createUnifiedDiff("src/server-config.ts", original, patched),
        rationale: "Added explicit type annotation",
        expectedBehaviorChange: "Clean typing",
        validationStatus: "awaiting_approval" as const,
        approvalToken: `tok_prop-valid_${originalHash}`,
        createdAt: new Date().toISOString(),
      };

      const result = await applyRepairPatch({
        proposal,
        fullProposedContent: patched,
        approvalToken: proposal.approvalToken,
      });

      expect(result.success).toBe(true);
      expect(result.appliedVersionId).toBeDefined();
      expect(result.verificationResults?.length).toBeGreaterThanOrEqual(2);

      // Verify stored artifact was updated
      const updated = await artifactStorage.getByPath(TEST_PROJ, "src/server-config.ts");
      expect(updated?.content).toBe(patched);
      expect(updated?.versions.length).toBe(1);
    });
  });

  describe("4. Review Session Storage & Isolation", () => {
    it("should persist and retrieve review sessions isolated by project", async () => {
      const session = {
        id: "rev-s1",
        projectId: TEST_PROJ,
        sourceName: "Test Run",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "findings_available" as const,
        findings: [],
        proposals: [],
      };

      await reviewStorage.saveSession(session);
      const retrieved = await reviewStorage.getLatestSession(TEST_PROJ);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe("rev-s1");

      const other = await reviewStorage.getLatestSession("other-proj");
      expect(other).toBeNull();
    });
  });
});
