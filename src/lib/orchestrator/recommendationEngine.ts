import type { ProjectStateSnapshot, OrchestrationAction, ActionRiskLevel } from "@/types/orchestrator";
import { generateId } from "@/lib/utils";

export function evaluateNextBestActions(snapshot: ProjectStateSnapshot): OrchestrationAction[] {
  const actions: OrchestrationAction[] = [];
  const pId = snapshot.projectId;

  // Rule 1: No Architecture Blueprint
  if (!snapshot.blueprint.defined) {
    actions.push({
      id: generateId("act_"),
      projectId: pId,
      title: "Synthesize Architecture Blueprint",
      description: "Project has no formal blueprint. Create an architecture design to establish tech stack and domain models.",
      targetModule: "blueprint",
      actionType: "create_blueprint",
      riskLevel: "medium",
      requiresApproval: true,
      sourceEvidence: "Blueprint status: undefined in project metadata",
      expectedOutcome: "Approved blueprint schema attached to project",
      targetRoute: `/blueprint?project=${pId}`,
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return actions; // Blueprint is a hard prerequisite for subsequent build steps
  }

  // Rule 2: Unresolved Critical Quality Findings
  if (snapshot.quality.openErrors > 0) {
    actions.push({
      id: generateId("act_"),
      projectId: pId,
      title: `Resolve ${snapshot.quality.openErrors} Critical Quality Errors`,
      description: "Static analysis or security audits identified critical defects (e.g. hardcoded secrets or broken imports).",
      targetModule: "quality",
      actionType: "resolve_quality_defect",
      riskLevel: "critical",
      requiresApproval: true,
      sourceEvidence: `Quality Engine: ${snapshot.quality.openErrors} open error(s) found`,
      expectedOutcome: "All critical findings marked resolved in Quality Engine",
      targetRoute: `/quality?project=${pId}`,
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Rule 3: Missing or Unapproved Build Artifacts
  if (snapshot.artifacts.total === 0) {
    actions.push({
      id: generateId("act_"),
      projectId: pId,
      title: "Derive File Plan and Synthesize Code Artifacts",
      description: "No code artifacts exist in the project repository. Generate file plan from blueprint specifications.",
      targetModule: "build",
      actionType: "synthesize_artifact",
      riskLevel: "high",
      requiresApproval: true,
      sourceEvidence: "Build Studio: 0 artifacts stored",
      expectedOutcome: "Source artifacts generated and stored in Build Studio",
      targetRoute: `/build?project=${pId}`,
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else if (snapshot.artifacts.unapproved > 0) {
    actions.push({
      id: generateId("act_"),
      projectId: pId,
      title: `Review & Approve ${snapshot.artifacts.unapproved} Unapproved Source Files`,
      description: "Source code artifacts are still in planned or generated state without human sign-off.",
      targetModule: "build",
      actionType: "approve_artifact",
      riskLevel: "medium",
      requiresApproval: true,
      sourceEvidence: `Build Studio: ${snapshot.artifacts.unapproved} file(s) unapproved`,
      expectedOutcome: "Files marked approved in Build Studio",
      targetRoute: `/build?project=${pId}`,
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Rule 4: Quality Assessment Not Executed
  if (!snapshot.quality.assessed && snapshot.artifacts.total > 0) {
    actions.push({
      id: generateId("act_"),
      projectId: pId,
      title: "Run Quality & Security Scan",
      description: "Source artifacts exist but have never undergone deterministic quality and credential inspection.",
      targetModule: "quality",
      actionType: "system_refresh",
      riskLevel: "low",
      requiresApproval: false, // low risk read-only scan
      sourceEvidence: "Quality Engine: assessed = false",
      expectedOutcome: "Deterministic quality scorecard and findings recorded",
      targetRoute: `/quality?project=${pId}`,
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Rule 5: Test Cases Exist but Remain Unrun
  if (snapshot.quality.unrunTests > 0 && snapshot.quality.passedTests === 0) {
    actions.push({
      id: generateId("act_"),
      projectId: pId,
      title: `Execute & Record ${snapshot.quality.unrunTests} Pending Verification Tests`,
      description: "Testing Lab has registered test cases, but none have been verified. Run manual or automated test suites.",
      targetModule: "quality",
      actionType: "run_test_case",
      riskLevel: "medium",
      requiresApproval: false,
      sourceEvidence: `Testing Lab: ${snapshot.quality.unrunTests} test(s) in not_run state`,
      expectedOutcome: "Test verification recorded in Testing Lab",
      targetRoute: `/quality?project=${pId}`,
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Rule 6: Living Documentation Drift Detected
  if (snapshot.docs.openDriftFindings > 0) {
    actions.push({
      id: generateId("act_"),
      projectId: pId,
      title: `Reconcile ${snapshot.docs.openDriftFindings} Documentation Drift Warnings`,
      description: "Project documents reference source files or endpoints that have changed or drifted.",
      targetModule: "docs",
      actionType: "sync_documentation",
      riskLevel: "low",
      requiresApproval: true,
      sourceEvidence: `Documentation Studio: ${snapshot.docs.openDriftFindings} open drift findings`,
      expectedOutcome: "Documents updated or drift findings dismissed",
      targetRoute: `/docs?project=${pId}`,
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Rule 7: Release Readiness Gate Sign-Off
  if (
    snapshot.artifacts.approved > 0 &&
    snapshot.quality.openErrors === 0 &&
    snapshot.release.status !== "approved" &&
    snapshot.release.status !== "released"
  ) {
    actions.push({
      id: generateId("act_"),
      projectId: pId,
      title: "Audit Release Readiness & Authorize Production Gate",
      description: "Code artifacts are approved and static checks pass cleanly. Perform formal release audit in Release Center.",
      targetModule: "release",
      actionType: "signoff_release",
      riskLevel: "high",
      requiresApproval: true,
      sourceEvidence: "Release Center: status not approved",
      expectedOutcome: "Release record marked approved with formal sign-off",
      targetRoute: `/release?project=${pId}`,
      status: "proposed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Deduplicate by actionType and sort by risk priority (critical -> high -> medium -> low)
  const seenTypes = new Set<string>();
  const uniqueActions: OrchestrationAction[] = [];

  for (const act of actions) {
    if (!seenTypes.has(act.actionType)) {
      seenTypes.add(act.actionType);
      uniqueActions.push(act);
    }
  }

  const riskOrder: Record<ActionRiskLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return uniqueActions.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
}
