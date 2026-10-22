import type { RepairProposal, VerificationCheckResult } from "@/types/review";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { runStaticAnalysis } from "@/lib/quality/staticAnalysis";
import { runSecurityAnalysis } from "@/lib/quality/securityAnalysis";
import { isProposalStale } from "./proposalEngine";
import { activityLogger } from "@/lib/observability/activityLogger";
import { generateId } from "@/lib/utils";

export interface ApplyPatchOptions {
  proposal: RepairProposal;
  fullProposedContent: string;
  approvalToken: string;
}

export interface PatchApplyResult {
  success: boolean;
  message: string;
  appliedVersionId?: string;
  verificationResults?: VerificationCheckResult[];
}

/**
 * Applies a validated repair proposal atomically to Build Studio artifacts,
 * recording version history and running post-repair verification checks.
 */
export async function applyRepairPatch(options: ApplyPatchOptions): Promise<PatchApplyResult> {
  const { proposal, fullProposedContent, approvalToken } = options;
  const startTime = performance.now();

  // 1. Approval token verification
  if (!proposal.approvalToken || approvalToken !== proposal.approvalToken) {
    await activityLogger.log({
      projectId: proposal.projectId,
      category: "capability_action",
      eventType: "patch_rejected",
      severity: "warning",
      outcome: "blocked",
      sourceSubsystem: "quality_lab",
      summary: `Patch application rejected: invalid or missing approval token for ${proposal.targetFilePath}.`,
      errorCode: "INVALID_APPROVAL_TOKEN",
    });

    return {
      success: false,
      message: "Approval token invalid or missing. User confirmation is mandatory before modifying source code.",
    };
  }

  // 2. Fetch target artifact
  const targetArtifact = await artifactStorage.getByPath(proposal.projectId, proposal.targetFilePath);
  if (!targetArtifact) {
    return {
      success: false,
      message: `Target artifact "${proposal.targetFilePath}" not found in project storage.`,
    };
  }

  // 3. Stale proposal guard (source-hash verification)
  if (isProposalStale(proposal, targetArtifact.content)) {
    await activityLogger.log({
      projectId: proposal.projectId,
      category: "capability_action",
      eventType: "patch_stale",
      severity: "warning",
      outcome: "blocked",
      sourceSubsystem: "quality_lab",
      summary: `Patch application rejected: source file "${proposal.targetFilePath}" has changed since proposal was generated.`,
      errorCode: "STALE_PROPOSAL",
    });

    return {
      success: false,
      message: `Source file "${proposal.targetFilePath}" has been modified since this proposal was created. Proposal is stale; please generate a fresh review.`,
    };
  }

  // 4. Atomic modification & version record
  const versionId = generateId("ver");
  const updatedArtifact = await artifactStorage.recordVersion(
    proposal.projectId,
    proposal.targetFilePath,
    fullProposedContent,
    `AI Repair Proposal Applied: ${proposal.rationale}`,
    "ai"
  );

  // 5. Post-Repair Verification Checks
  const verificationResults: VerificationCheckResult[] = [];
  const now = new Date().toISOString();

  // Static analysis check
  const staticFindings = runStaticAnalysis({
    projectId: proposal.projectId,
    assessmentId: "post_patch_qa",
    artifacts: [updatedArtifact],
  });

  const staticPass = staticFindings.filter((f) => f.filePath === proposal.targetFilePath && f.severity === "error").length === 0;
  verificationResults.push({
    checkType: "static_analysis",
    title: "Static Quality Rules Check",
    passed: staticPass,
    message: staticPass
      ? "Clean. Zero new static errors introduced."
      : `Found ${staticFindings.length} issue(s) in patched file.`,
    executedAt: now,
  });

  // Security analysis check
  const secFindings = runSecurityAnalysis({
    projectId: proposal.projectId,
    assessmentId: "post_patch_sec",
    artifacts: [updatedArtifact],
  });

  const secPass = secFindings.filter((f) => f.filePath === proposal.targetFilePath && f.severity === "error").length === 0;
  verificationResults.push({
    checkType: "security_rules",
    title: "Security Rules Check",
    passed: secPass,
    message: secPass
      ? "No hardcoded credentials, unsafe eval(), or traversal patterns detected."
      : `Security finding triggered in patched code.`,
    executedAt: now,
  });

  const durationMs = performance.now() - startTime;
  await activityLogger.log({
    projectId: proposal.projectId,
    category: "capability_action",
    eventType: "patch_applied",
    severity: "info",
    outcome: "succeeded",
    sourceSubsystem: "quality_lab",
    durationMs,
    summary: `Applied repair patch to "${proposal.targetFilePath}" (Version ${versionId}). Post-repair verification passed: ${secPass && staticPass}.`,
    entityLink: {
      entityType: "artifact",
      entityId: updatedArtifact.id,
      route: `/build`,
    },
  });

  return {
    success: true,
    message: `Repair patch successfully applied to "${proposal.targetFilePath}".`,
    appliedVersionId: versionId,
    verificationResults,
  };
}
