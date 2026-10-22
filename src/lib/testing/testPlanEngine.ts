/**
 * ProjectNova AI - Test Planning Engine
 * Phase 15: Test Automation & Verification Engine
 *
 * Deterministically generates structured test plans and test cases from:
 * - Project Blueprint (API routes, requirements)
 * - Review Findings & Repair Proposals (Phase 14)
 * - Project Brain memory constraints (Phase 12)
 */

import { TestPlan, TestCase, TestSuite } from '../../types/testing';
import type { Blueprint } from '../../types/blueprint';
import type { RepairProposal } from '../../types/review';
import type { BuildArtifact } from '../../types/artifact';

export interface PlanGenerationInput {
  projectId: string;
  projectName: string;
  blueprint?: Blueprint | null;
  proposals?: RepairProposal[];
  artifacts?: BuildArtifact[];
  existingPlan?: TestPlan | null;
}

export function generateDefaultTestPlan(input: PlanGenerationInput): TestPlan {
  const { projectId, projectName, blueprint, proposals = [], artifacts = [] } = input;
  const now = new Date().toISOString();
  const testCases: TestCase[] = [];
  const suites: TestSuite[] = [];

  // 1. Suite: Static Code Quality & Style
  const staticCaseIds: string[] = [];
  testCases.push({
    id: `tc-static-ast-${Date.now()}-1`,
    name: 'Workspace Static AST & Complexity Check',
    description: 'Verify maximum line counts and structural complexity across codebase artifacts.',
    category: 'static_analysis',
    capabilityId: 'static_analysis_runner',
    status: 'configured',
    priority: 'medium',
    targetPaths: artifacts.map(a => a.path).slice(0, 50),
    parameters: { maxFileLines: 1200, checkNoAny: false },
    assertions: []
  });
  staticCaseIds.push(testCases[testCases.length - 1].id);

  suites.push({
    id: `suite-static-${Date.now()}`,
    name: 'Static Quality Suite',
    description: 'Automated complexity and AST pattern verifications',
    category: 'static_analysis',
    testCaseIds: staticCaseIds
  });

  // 2. Suite: Security & Secret Hygiene
  const secCaseIds: string[] = [];
  testCases.push({
    id: `tc-sec-hygiene-${Date.now()}-2`,
    name: 'Workspace Secret & Security Hygiene',
    description: 'Audit workspace artifacts for hardcoded tokens, path traversals, or dangerous dynamic evaluations.',
    category: 'security',
    capabilityId: 'security_analysis_runner',
    status: 'configured',
    priority: 'critical',
    targetPaths: artifacts.map(a => a.path).slice(0, 50),
    parameters: { disallowHighSeverity: true },
    assertions: []
  });
  secCaseIds.push(testCases[testCases.length - 1].id);

  suites.push({
    id: `suite-sec-${Date.now()}`,
    name: 'Security Hygiene Suite',
    description: 'Credential detection and security pattern assertions',
    category: 'security',
    testCaseIds: secCaseIds
  });

  // 3. Suite: Architecture Integrity & Cycle Detection
  const archCaseIds: string[] = [];
  testCases.push({
    id: `tc-dep-dag-${Date.now()}-3`,
    name: 'Dependency DAG Circularity Audit',
    description: 'Verify that workspace module imports form an acyclic graph with no dependency loops.',
    category: 'dependency_dag',
    capabilityId: 'dependency_cycle_checker',
    status: 'configured',
    priority: 'high',
    targetPaths: artifacts.map(a => a.path),
    parameters: {},
    assertions: []
  });
  archCaseIds.push(testCases[testCases.length - 1].id);

  if (blueprint) {
    testCases.push({
      id: `tc-drift-routes-${Date.now()}-4`,
      name: 'Blueprint Route Implementation Verification',
      description: 'Audit actual repository artifacts to verify that all specified blueprint API routes exist.',
      category: 'drift_verification',
      capabilityId: 'drift_verification_runner',
      status: 'configured',
      priority: 'high',
      targetPaths: ['src/app', 'src/lib', 'src/api'],
      parameters: {},
      assertions: []
    });
    archCaseIds.push(testCases[testCases.length - 1].id);
  }

  suites.push({
    id: `suite-arch-${Date.now()}`,
    name: 'Architecture & Drift Suite',
    description: 'Validates acyclic modular dependencies and alignment with project blueprint specifications',
    category: 'drift_verification',
    testCaseIds: archCaseIds
  });

  // 4. Suite: Syntax & Delimiter Validation
  const syntaxCaseIds: string[] = [];
  testCases.push({
    id: `tc-syntax-val-${Date.now()}-5`,
    name: 'Artifact Syntax & JSON Integrity Check',
    description: 'Validates JSON structure and balanced delimiters across target project files.',
    category: 'artifact_syntax',
    capabilityId: 'artifact_syntax_validator',
    status: 'configured',
    priority: 'medium',
    targetPaths: artifacts.map(a => a.path).slice(0, 50),
    parameters: {},
    assertions: []
  });
  syntaxCaseIds.push(testCases[testCases.length - 1].id);

  suites.push({
    id: `suite-syntax-${Date.now()}`,
    name: 'Syntax Integrity Suite',
    description: 'Validates file syntax and JSON parsability',
    category: 'artifact_syntax',
    testCaseIds: syntaxCaseIds
  });

  // 5. Suite: Regression Verifications for Phase 14 Repair Proposals
  const regressionCaseIds: string[] = [];
  for (const prop of proposals) {
    const targetFile = prop.targetFilePath;
    testCases.push({
      id: `tc-regress-${prop.id}`,
      name: `Regression Guard: ${prop.targetFilePath}`,
      description: `Targeted regression test validating stability for repair proposal ${prop.id}`,
      category: 'regression',
      capabilityId: 'static_analysis_runner',
      status: 'configured',
      priority: 'high',
      targetPaths: [targetFile],
      parameters: { checkNoAny: true },
      assertions: [],
      relatedProposalId: prop.id,
      relatedFindingId: prop.findingId
    });
    regressionCaseIds.push(testCases[testCases.length - 1].id);
  }

  if (regressionCaseIds.length > 0) {
    suites.push({
      id: `suite-regress-${Date.now()}`,
      name: 'Repair Proposal Regression Suite',
      description: 'Dedicated checks for files modified or targeted by repair proposals',
      category: 'regression',
      testCaseIds: regressionCaseIds
    });
  }

  return {
    id: input.existingPlan?.id || `plan-${projectId}-${Date.now()}`,
    projectId,
    name: `${projectName} Test Automation Plan`,
    version: (input.existingPlan?.version || 0) + 1,
    createdAt: input.existingPlan?.createdAt || now,
    updatedAt: now,
    testCases,
    suites,
    summary: {
      total: testCases.length,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      unknown: testCases.length
    }
  };
}
