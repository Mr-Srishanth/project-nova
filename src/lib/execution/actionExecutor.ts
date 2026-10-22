import type { SupportedActionType } from "@/types/execution";
import { isActionSupported, CAPABILITY_REGISTRY, generateApprovalToken } from "./capabilityRegistry";
import { projectStorage } from "@/lib/storage/projectStorage";
import { artifactStorage } from "@/lib/storage/artifactStorage";
import { qualityStorage } from "@/lib/storage/qualityStorage";
import { releaseStorage } from "@/lib/storage/releaseStorage";
import { documentStorage } from "@/lib/storage/documentStorage";
import { brainStorage } from "@/lib/storage/brainStorage";
import { orchestrationStorage } from "@/lib/storage/orchestrationStorage";
import { assembleProjectStateSnapshot } from "@/lib/orchestrator/stateAssembler";
import { evaluateNextBestActions } from "@/lib/orchestrator/recommendationEngine";
import { runStaticAnalysis } from "@/lib/quality/staticAnalysis";
import { runSecurityAnalysis } from "@/lib/quality/securityAnalysis";
import { detectDocumentDrift } from "@/lib/docs/driftDetector";
import { evaluateReleaseReadiness } from "@/lib/release/readinessEngine";
import { generateId } from "@/lib/utils";
import { activityLogger } from "@/lib/observability/activityLogger";

export interface ActionExecutionResult {
  success: boolean;
  resultSummary: string;
  failureReason?: string;
}

export async function executeRegisteredAction(
  actionType: string,
  params: Record<string, unknown>,
  options?: {
    approvedToken?: string;
  }
): Promise<ActionExecutionResult> {
  // 1. Capability & Support Verification
  if (!isActionSupported(actionType)) {
    const failureReason = `Action "${actionType}" is not supported by the capability registry. Arbitrary instruction execution is blocked.`;
    await activityLogger.log({
      category: "capability_action",
      eventType: "action_rejected",
      severity: "warning",
      outcome: "blocked",
      sourceSubsystem: "execution_engine",
      summary: `Action "${actionType}" rejected by capability sandbox`,
      errorCode: "ACTION_NOT_SUPPORTED",
      safeDetails: { actionType },
    });

    return {
      success: false,
      resultSummary: "Execution rejected",
      failureReason,
    };
  }

  const def = CAPABILITY_REGISTRY[actionType as SupportedActionType];
  const validation = def.validateParameters(params);
  if (!validation.valid) {
    return {
      success: false,
      resultSummary: "Parameter validation failed",
      failureReason: validation.error || "Invalid parameters provided.",
    };
  }

  // 2. Approval Verification
  if (def.requiresApproval) {
    const expectedToken = generateApprovalToken(actionType, params);
    if (!options?.approvedToken || options.approvedToken !== expectedToken) {
      await activityLogger.log({
        projectId: params.projectId as string,
        category: "capability_action",
        eventType: "action_unauthorized",
        severity: "warning",
        outcome: "blocked",
        sourceSubsystem: "execution_engine",
        summary: `Action "${actionType}" blocked: missing or invalid approval token`,
        errorCode: "APPROVAL_REQUIRED",
      });

      return {
        success: false,
        resultSummary: "Authorization failed",
        failureReason: "Action requires explicit user approval. Approval token is missing or parameter signature has drifted.",
      };
    }
  }

  const projectId = params.projectId as string;
  const project = await projectStorage.getById(projectId);
  if (!project) {
    return {
      success: false,
      resultSummary: "Execution failed",
      failureReason: `Target project "${projectId}" not found in local storage.`,
    };
  }

  // 3. Execution Dispatch
  const startTime = performance.now();
  try {
    let result: ActionExecutionResult;
    switch (actionType) {
      case "refresh_state_assessment":
      case "recompute_recommendations": {
        const [artifacts, assessment, testPlans, release, documents, brainMemories] =
          await Promise.all([
            artifactStorage.list(projectId),
            qualityStorage.getLatestAssessment(projectId),
            qualityStorage.listTestPlans(projectId),
            releaseStorage.getLatest(projectId),
            documentStorage.list(projectId),
            brainStorage.list(projectId),
          ]);

        const snapshot = assembleProjectStateSnapshot({
          project,
          artifacts,
          assessment,
          testPlans,
          release,
          documents,
          brainMemories,
        });

        const actions = evaluateNextBestActions(snapshot);

        await orchestrationStorage.save({
          id: generateId("run_"),
          projectId,
          assessedAt: new Date().toISOString(),
          snapshot,
          actions,
          overallHealth: snapshot.quality.openErrors > 0 ? "blocked" : "healthy",
        });

        result = {
          success: true,
          resultSummary: `Refreshed project state assessment: ${actions.length} next-best action(s) computed.`,
        };
        break;
      }

      case "run_static_analysis": {
        const artifacts = await artifactStorage.list(projectId);
        const assessmentId = generateId("assess_exec_");

        const staticFindings = runStaticAnalysis({
          projectId,
          assessmentId,
          artifacts,
        });

        const secFindings = runSecurityAnalysis({
          projectId,
          assessmentId,
          artifacts,
        });

        const allFindings = [...staticFindings, ...secFindings];
        const errors = allFindings.filter((f) => f.severity === "error").length;
        const warnings = allFindings.filter((f) => f.severity === "warning").length;

        await qualityStorage.saveAssessment({
          id: assessmentId,
          projectId,
          assessedAt: new Date().toISOString(),
          checksPerformed: ["static_analysis", "security_analysis"],
          totalArtifactsChecked: artifacts.length,
          findings: allFindings,
          score: {
            healthGrade: errors > 0 ? "D" : warnings > 0 ? "B" : "A",
            errorCount: errors,
            warningCount: warnings,
            infoCount: allFindings.length - (errors + warnings),
            resolvedCount: 0,
          },
        });

        result = {
          success: true,
          resultSummary: `Executed quality scan across ${artifacts.length} file(s). Found ${errors} error(s) and ${warnings} warning(s).`,
        };
        break;
      }

      case "recalculate_doc_drift": {
        const [artifacts, documents, release] = await Promise.all([
          artifactStorage.list(projectId),
          documentStorage.list(projectId),
          releaseStorage.getLatest(projectId),
        ]);

        const envNames = release?.envVariables.map((v) => v.name) || [];
        let totalDrift = 0;

        for (const doc of documents) {
          const findings = detectDocumentDrift({
            document: doc,
            artifacts,
            blueprint: project.blueprint,
            documentedEnvVars: envNames,
          });
          totalDrift += findings.length;
          await documentStorage.updateDriftFindings(projectId, doc.id, findings);
        }

        result = {
          success: true,
          resultSummary: `Checked living drift across ${documents.length} document(s). Found ${totalDrift} active drift warning(s).`,
        };
        break;
      }

      case "audit_release_readiness": {
        const [artifacts, assessment, testPlans, release] = await Promise.all([
          artifactStorage.list(projectId),
          qualityStorage.getLatestAssessment(projectId),
          qualityStorage.listTestPlans(projectId),
          releaseStorage.getLatest(projectId),
        ]);

        const checks = evaluateReleaseReadiness({
          project,
          artifacts,
          assessment,
          testPlans,
          envVariables: release?.envVariables || [],
        });

        const failed = checks.filter((c) => c.state === "fail").length;
        const passed = checks.filter((c) => c.state === "pass").length;

        result = {
          success: true,
          resultSummary: `Evaluated ${checks.length} release readiness checks: ${passed} passed, ${failed} blocker(s).`,
        };
        break;
      }

      default:
        result = {
          success: false,
          resultSummary: "Unrecognized execution branch",
          failureReason: `Internal handler for action "${actionType}" is missing.`,
        };
        break;
    }

    const durationMs = performance.now() - startTime;
    await activityLogger.log({
      projectId,
      category: "capability_action",
      eventType: actionType,
      severity: result.success ? "info" : "error",
      outcome: result.success ? "succeeded" : "failed",
      sourceSubsystem: "execution_engine",
      summary: result.resultSummary,
      durationMs,
      errorCode: result.failureReason ? "EXECUTION_ERROR" : undefined,
    });

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal action execution threw an error";
    const durationMs = performance.now() - startTime;

    await activityLogger.log({
      projectId,
      category: "capability_action",
      eventType: actionType,
      severity: "error",
      outcome: "failed",
      sourceSubsystem: "execution_engine",
      summary: `Action execution error: ${errorMsg}`,
      durationMs,
      errorCode: "UNEXPECTED_ERROR",
    });

    return {
      success: false,
      resultSummary: "Execution error",
      failureReason: errorMsg,
    };
  }
}
