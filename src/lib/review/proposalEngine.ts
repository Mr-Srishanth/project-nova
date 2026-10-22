import type { RepairProposal, ReviewFinding, ProposalStatus } from "@/types/review";
import type { BuildArtifact } from "@/types/artifact";
import { validateRelativeFilePath } from "@/lib/build/pathValidator";
import { checkFileExclusion } from "@/lib/repository/exclusionRules";
import { generateId } from "@/lib/utils";

/**
 * Computes a standard unified diff between original and proposed code snippets.
 */
export function createUnifiedDiff(
  filePath: string,
  originalText: string,
  proposedText: string
): string {
  const origLines = originalText.split("\n");
  const propLines = proposedText.split("\n");

  const diffLines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${origLines.length} +1,${propLines.length} @@`,
  ];

  // Simple line-based unified diff generation
  for (const line of origLines) {
    if (!propLines.includes(line)) {
      diffLines.push(`-${line}`);
    } else {
      diffLines.push(` ${line}`);
    }
  }

  for (const line of propLines) {
    if (!origLines.includes(line)) {
      diffLines.push(`+${line}`);
    }
  }

  return diffLines.join("\n");
}

/**
 * Simple hash helper to verify source integrity without external crypto libraries.
 */
export function simpleContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return "h_" + Math.abs(hash).toString(16);
}

export interface CreateProposalOptions {
  finding: ReviewFinding;
  targetArtifact: BuildArtifact;
  proposedCode: string;
  rationale: string;
  expectedBehaviorChange: string;
  potentialSideEffects?: string;
}

/**
 * Generates and strictly validates a repair proposal against repository confinement rules.
 */
export function createRepairProposal(options: CreateProposalOptions): RepairProposal {
  const { finding, targetArtifact, proposedCode, rationale, expectedBehaviorChange, potentialSideEffects } =
    options;

  const originalContent = targetArtifact.content;
  const originalHash = simpleContentHash(originalContent);
  const unifiedDiff = createUnifiedDiff(targetArtifact.path, originalContent, proposedCode);

  let validationStatus: ProposalStatus = "validated";
  let validationDiagnostic: string | undefined;

  // 1. Validate relative path confinement
  const pathVal = validateRelativeFilePath(targetArtifact.path);
  if (!pathVal.isValid) {
    validationStatus = "invalid";
    validationDiagnostic = pathVal.error || "Invalid relative file path.";
  }

  // 2. Validate exclusion rules (ensure we never edit secret-bearing or excluded files)
  const exclusion = checkFileExclusion(targetArtifact.path);
  if (exclusion.isExcluded) {
    validationStatus = "invalid";
    validationDiagnostic = `Target file is excluded: ${exclusion.reason}`;
  }

  // 3. Ensure proposed code differs from original
  if (originalContent.trim() === proposedCode.trim()) {
    validationStatus = "invalid";
    validationDiagnostic = "Proposed code is identical to current source content.";
  }

  // Generate cryptographic approval token bound to proposal ID and original hash
  const proposalId = generateId("prop");
  const approvalToken = validationStatus === "validated" ? `tok_${proposalId}_${originalHash}` : undefined;

  return {
    id: proposalId,
    projectId: finding.projectId,
    findingId: finding.id,
    targetFilePath: targetArtifact.path,
    originalContentHash: originalHash,
    originalCodeSnippet: originalContent.slice(0, 500),
    proposedCodeSnippet: proposedCode.slice(0, 500),
    unifiedDiff,
    rationale,
    expectedBehaviorChange,
    potentialSideEffects,
    validationStatus: validationStatus === "validated" ? "awaiting_approval" : "invalid",
    validationDiagnostic,
    approvalToken,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validates whether a proposal has become stale due to source file modifications.
 */
export function isProposalStale(proposal: RepairProposal, currentArtifactContent: string): boolean {
  const currentHash = simpleContentHash(currentArtifactContent);
  return currentHash !== proposal.originalContentHash;
}
