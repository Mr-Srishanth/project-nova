import type { Project } from "@/types/project";
import type { BuildArtifact } from "@/types/artifact";
import type { QualityAssessment, TestPlan } from "@/types/quality";
import type { ReadinessCheckResult, EnvVariableSpec } from "@/types/release";

export interface ReadinessEvaluationInput {
  project: Project;
  artifacts: BuildArtifact[];
  assessment: QualityAssessment | null;
  testPlans: TestPlan[];
  envVariables: EnvVariableSpec[];
}

export function evaluateReleaseReadiness(input: ReadinessEvaluationInput): ReadinessCheckResult[] {
  const { project, artifacts, assessment, testPlans, envVariables } = input;
  const checks: ReadinessCheckResult[] = [];

  // Check 1: Architecture Blueprint Definition
  if (project.blueprint && project.blueprint.title) {
    checks.push({
      id: "CHK_BLUEPRINT_COMPLETE",
      name: "Architecture Blueprint Definition",
      category: "blueprint",
      state: "pass",
      explanation: `Project has an approved blueprint titled "${project.blueprint.title}".`,
      sourceRef: "Blueprint Studio",
    });
  } else {
    checks.push({
      id: "CHK_BLUEPRINT_COMPLETE",
      name: "Architecture Blueprint Definition",
      category: "blueprint",
      state: "fail",
      explanation: "No approved architecture blueprint found for this project.",
      sourceRef: "Blueprint Studio",
      remediation: "Create an architecture blueprint in Blueprint Studio before planning release.",
    });
  }

  // Check 2: Core Artifact Coverage
  if (artifacts.length === 0) {
    checks.push({
      id: "CHK_ARTIFACT_COVERAGE",
      name: "Source Artifact Coverage",
      category: "artifacts",
      state: "fail",
      explanation: "Zero source code or configuration artifacts exist in the project repository.",
      sourceRef: "Build Studio",
      remediation: "Synthesize or author source artifacts in Build Studio.",
    });
  } else {
    const unapproved = artifacts.filter((a) => a.status !== "approved");
    if (unapproved.length === 0) {
      checks.push({
        id: "CHK_ARTIFACT_COVERAGE",
        name: "Source Artifact Approval",
        category: "artifacts",
        state: "pass",
        explanation: `All ${artifacts.length} source artifacts have been reviewed and approved.`,
        sourceRef: "Build Studio",
      });
    } else {
      checks.push({
        id: "CHK_ARTIFACT_COVERAGE",
        name: "Source Artifact Approval",
        category: "artifacts",
        state: "warning",
        explanation: `${unapproved.length} out of ${artifacts.length} artifacts are not yet marked approved.`,
        sourceRef: "Build Studio",
        remediation: "Review and approve unapproved files in Build Studio.",
      });
    }
  }

  // Check 3: Static Analysis & Security Findings
  if (!assessment) {
    checks.push({
      id: "CHK_QUALITY_ASSESSMENT",
      name: "Quality & Security Scan",
      category: "quality",
      state: "not_verified",
      explanation: "No quality or security assessment has been executed yet for this project.",
      sourceRef: "Quality Engine",
      remediation: "Run a quality assessment scan in Quality Engine.",
    });
  } else {
    const unresolvedErrors = assessment.findings.filter(
      (f) => f.severity === "error" && f.status === "open"
    );
    const unresolvedWarnings = assessment.findings.filter(
      (f) => f.severity === "warning" && f.status === "open"
    );

    if (unresolvedErrors.length > 0) {
      checks.push({
        id: "CHK_QUALITY_ASSESSMENT",
        name: "Quality & Security Defect Gate",
        category: "quality",
        state: "fail",
        explanation: `Found ${unresolvedErrors.length} unresolved critical error(s) in stored artifacts.`,
        sourceRef: "Quality Engine",
        remediation: "Resolve or fix open critical findings in Quality Engine.",
      });
    } else if (unresolvedWarnings.length > 0) {
      checks.push({
        id: "CHK_QUALITY_ASSESSMENT",
        name: "Quality & Security Warnings",
        category: "quality",
        state: "warning",
        explanation: `All critical errors are resolved, but ${unresolvedWarnings.length} open warning(s) remain.`,
        sourceRef: "Quality Engine",
        remediation: "Inspect warnings in Quality Engine.",
      });
    } else {
      checks.push({
        id: "CHK_QUALITY_ASSESSMENT",
        name: "Quality & Security Assessment",
        category: "quality",
        state: "pass",
        explanation: `Quality assessment passed cleanly with 0 open defects. Health Grade: ${assessment.score.healthGrade}.`,
        sourceRef: "Quality Engine",
      });
    }
  }

  // Check 4: Testing & Test Case Status
  const allTestCases = testPlans.flatMap((tp) => tp.testCases);
  if (allTestCases.length === 0) {
    checks.push({
      id: "CHK_TESTING_STATUS",
      name: "Verification & Test Coverage",
      category: "tests",
      state: "warning",
      explanation: "No test cases or test plans have been registered for this project.",
      sourceRef: "Testing Lab",
      remediation: "Define test plans or run verification procedures in Testing Lab.",
    });
  } else {
    const failedTests = allTestCases.filter((tc) => tc.status === "failed");
    const blockedTests = allTestCases.filter((tc) => tc.status === "blocked");
    const unrunTests = allTestCases.filter((tc) => tc.status === "not_run");
    const passedTests = allTestCases.filter((tc) => tc.status === "passed");

    if (failedTests.length > 0) {
      checks.push({
        id: "CHK_TESTING_STATUS",
        name: "Test Verification Results",
        category: "tests",
        state: "fail",
        explanation: `${failedTests.length} recorded test case(s) failed execution.`,
        sourceRef: "Testing Lab",
        remediation: "Fix defect causes and rerun failed tests in Testing Lab.",
      });
    } else if (blockedTests.length > 0) {
      checks.push({
        id: "CHK_TESTING_STATUS",
        name: "Test Verification Blockers",
        category: "tests",
        state: "warning",
        explanation: `${blockedTests.length} test case(s) are blocked by external dependencies.`,
        sourceRef: "Testing Lab",
      });
    } else if (unrunTests.length > 0 && passedTests.length === 0) {
      checks.push({
        id: "CHK_TESTING_STATUS",
        name: "Test Execution Status",
        category: "tests",
        state: "not_verified",
        explanation: `All ${unrunTests.length} test cases remain in "not_run" state. No verified test runs recorded.`,
        sourceRef: "Testing Lab",
        remediation: "Execute and record manual or automated test runs.",
      });
    } else {
      checks.push({
        id: "CHK_TESTING_STATUS",
        name: "Test Verification Status",
        category: "tests",
        state: "pass",
        explanation: `${passedTests.length} test case(s) passed successfully (${unrunTests.length} unrun).`,
        sourceRef: "Testing Lab",
      });
    }
  }

  // Check 5: Required Environment Variables
  const requiredMissing = envVariables.filter((v) => v.required && v.status === "missing");
  const unverified = envVariables.filter((v) => v.required && v.status === "not_verified");

  if (requiredMissing.length > 0) {
    checks.push({
      id: "CHK_ENV_VARS",
      name: "Required Environment Configuration",
      category: "environment",
      state: "fail",
      explanation: `Missing required environment variables: ${requiredMissing.map((m) => m.name).join(", ")}.`,
      sourceRef: "Environment Manager",
      remediation: "Configure all required environment variables in .env configuration.",
    });
  } else if (unverified.length > 0) {
    checks.push({
      id: "CHK_ENV_VARS",
      name: "Environment Variable Verification",
      category: "environment",
      state: "warning",
      explanation: `${unverified.length} required variable(s) documented but runtime presence is unverified in client sandbox.`,
      sourceRef: "Environment Manager",
    });
  } else {
    checks.push({
      id: "CHK_ENV_VARS",
      name: "Environment Configuration",
      category: "environment",
      state: "pass",
      explanation: "All documented required environment variables are configured.",
      sourceRef: "Environment Manager",
    });
  }

  return checks;
}
