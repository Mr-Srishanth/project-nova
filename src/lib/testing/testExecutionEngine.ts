/**
 * ProjectNova AI - Test Execution Engine
 * Phase 15: Test Automation & Verification Engine
 *
 * Controls deterministic test execution against registered capabilities,
 * measures execution durations, sanitizes output, records evidence, and emits
 * audit events into the Phase 11 activityLogger.
 */

import { TestPlan, TestCase, TestExecutionRecord, VerificationGateResult } from '../../types/testing';
import { capabilityRegistry, ExecutionContext } from './testCapabilityRegistry';
import { testStorage } from '../storage/testStorage';
import type { BuildArtifact } from '../../types/artifact';
import type { Blueprint } from '../../types/blueprint';
import { activityLogger } from '../observability/activityLogger';

export interface ExecuteOptions {
  projectId: string;
  planId: string;
  testCaseIds?: string[];
  artifacts?: BuildArtifact[];
  blueprint?: Blueprint | null;
  executedBy?: string;
  onProgress?: (completed: number, total: number, currentCase: TestCase) => void;
}

/**
 * Calculates a quick content hash to detect file mutations between test runs.
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

export class TestExecutionEngine {
  /**
   * Executes a single test case using the registered capability.
   */
  public async executeTestCase(
    testCase: TestCase,
    context: ExecutionContext,
    planId: string,
    executedBy: string = 'system_engine'
  ): Promise<{ updatedCase: TestCase; record: TestExecutionRecord }> {
    const startedAt = new Date().toISOString();
    const cap = capabilityRegistry.get(testCase.capabilityId);

    // Compute target file snapshots for regression tracking
    const targetFilesSnapshot: Record<string, string> = {};
    if (context.artifacts) {
      for (const tp of testCase.targetPaths) {
        const found = context.artifacts.find(a => a.path.endsWith(tp) || tp.endsWith(a.path));
        if (found) {
          targetFilesSnapshot[found.path] = hashContent(found.content);
        }
      }
    }

    if (!cap) {
      const completedAt = new Date().toISOString();
      const updatedCase: TestCase = {
        ...testCase,
        status: 'blocked',
        failureMessage: `Capability '${testCase.capabilityId}' is not registered or permitted`,
        lastExecutedAt: completedAt,
        durationMs: 0
      };

      const record: TestExecutionRecord = {
        id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        planId,
        testCaseId: testCase.id,
        projectId: context.projectId,
        capabilityId: testCase.capabilityId,
        executionType: 'machine_verified',
        status: 'blocked',
        startedAt,
        completedAt,
        durationMs: 0,
        assertionsPassed: 0,
        assertionsTotal: 0,
        outputSanitized: `Execution blocked: capability '${testCase.capabilityId}' is unregistered.`,
        evidence: [],
        errorMessage: `Unregistered capability ${testCase.capabilityId}`,
        executedBy,
        targetFilesSnapshot
      };

      testStorage.saveRun(record);
      return { updatedCase, record };
    }

    try {
      const output = await cap.execute({
        ...context,
        targetPaths: testCase.targetPaths,
        parameters: testCase.parameters
      });

      const completedAt = new Date().toISOString();
      const passedAssertions = output.assertions.filter(a => a.passed).length;

      const updatedCase: TestCase = {
        ...testCase,
        status: output.status,
        assertions: output.assertions,
        lastExecutedAt: completedAt,
        durationMs: output.durationMs,
        failureMessage: output.errorMessage,
        targetHashAtExecution: Object.values(targetFilesSnapshot)[0] || undefined
      };

      const record: TestExecutionRecord = {
        id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        planId,
        testCaseId: testCase.id,
        projectId: context.projectId,
        capabilityId: cap.id,
        executionType: 'machine_verified',
        status: output.status,
        startedAt,
        completedAt,
        durationMs: output.durationMs,
        assertionsPassed: passedAssertions,
        assertionsTotal: output.assertions.length,
        outputSanitized: output.outputSanitized,
        evidence: output.evidence,
        errorMessage: output.errorMessage,
        executedBy,
        targetFilesSnapshot
      };

      testStorage.saveRun(record);

      try {
        activityLogger.log({
          projectId: context.projectId,
          category: 'quality_check',
          eventType: 'test_executed',
          severity: output.status === 'passed' ? 'info' : 'warning',
          outcome: output.status === 'passed' ? 'succeeded' : 'failed',
          sourceSubsystem: 'quality_lab',
          summary: `${testCase.name} -> ${output.status}`,
          durationMs: output.durationMs,
          safeDetails: {
            capabilityId: cap.id,
            testCaseId: testCase.id,
            assertionsTotal: output.assertions.length,
            assertionsPassed: passedAssertions
          }
        });
      } catch (logErr) {
        console.warn('[TestExecutionEngine] ActivityLogger ignored safely:', logErr);
      }

      return { updatedCase, record };
    } catch (err: any) {
      const completedAt = new Date().toISOString();
      const updatedCase: TestCase = {
        ...testCase,
        status: 'failed',
        failureMessage: err?.message || String(err),
        lastExecutedAt: completedAt,
        durationMs: 0
      };

      const record: TestExecutionRecord = {
        id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        planId,
        testCaseId: testCase.id,
        projectId: context.projectId,
        capabilityId: cap.id,
        executionType: 'machine_verified',
        status: 'failed',
        startedAt,
        completedAt,
        durationMs: 0,
        assertionsPassed: 0,
        assertionsTotal: 0,
        outputSanitized: `Exception during test execution: ${err?.message || String(err)}`,
        evidence: [],
        errorMessage: err?.message || String(err),
        executedBy,
        targetFilesSnapshot
      };

      testStorage.saveRun(record);
      return { updatedCase, record };
    }
  }

  /**
   * Executes a suite or all test cases in a plan.
   */
  public async executePlan(plan: TestPlan, options: ExecuteOptions): Promise<TestPlan> {
    const targets = options.testCaseIds && options.testCaseIds.length > 0
      ? plan.testCases.filter(tc => options.testCaseIds!.includes(tc.id))
      : plan.testCases;

    const updatedCases: TestCase[] = [...plan.testCases];
    let completedCount = 0;

    for (const tc of targets) {
      const idx = updatedCases.findIndex(c => c.id === tc.id);
      if (idx >= 0) {
        const { updatedCase } = await this.executeTestCase(
          tc,
          {
            projectId: options.projectId,
            targetPaths: tc.targetPaths,
            parameters: tc.parameters,
            artifacts: options.artifacts,
            blueprint: options.blueprint
          },
          plan.id,
          options.executedBy
        );
        updatedCases[idx] = updatedCase;
      }
      completedCount++;
      if (options.onProgress) {
        options.onProgress(completedCount, targets.length, tc);
      }
    }

    const summary = {
      total: updatedCases.length,
      passed: updatedCases.filter(c => c.status === 'passed').length,
      failed: updatedCases.filter(c => c.status === 'failed').length,
      blocked: updatedCases.filter(c => c.status === 'blocked').length,
      skipped: updatedCases.filter(c => c.status === 'skipped').length,
      unknown: updatedCases.filter(c => c.status === 'draft' || c.status === 'configured' || c.status === 'unknown').length,
      lastRunAt: new Date().toISOString()
    };

    const updatedPlan: TestPlan = {
      ...plan,
      testCases: updatedCases,
      summary,
      updatedAt: new Date().toISOString()
    };

    testStorage.savePlan(updatedPlan);
    return updatedPlan;
  }

  /**
   * Evaluates the verification gate status for release readiness.
   */
  public evaluateVerificationGate(plan: TestPlan | null): VerificationGateResult {
    const evaluatedAt = new Date().toISOString();

    if (!plan || plan.testCases.length === 0) {
      return {
        passed: false,
        blockers: ['No test plan configured or no test cases defined for this project.'],
        warnings: [],
        evaluatedAt,
        metrics: { totalTests: 0, passed: 0, failed: 0, blocked: 0, unknown: 0, criticalPassingRate: 0 }
      };
    }

    const blockers: string[] = [];
    const warnings: string[] = [];

    const total = plan.testCases.length;
    const passed = plan.testCases.filter(c => c.status === 'passed').length;
    const failed = plan.testCases.filter(c => c.status === 'failed').length;
    const blocked = plan.testCases.filter(c => c.status === 'blocked').length;
    const unknown = plan.testCases.filter(c => c.status === 'draft' || c.status === 'configured' || c.status === 'unknown').length;

    // Check critical tests
    const criticalTests = plan.testCases.filter(c => c.priority === 'critical');
    const criticalPassed = criticalTests.filter(c => c.status === 'passed').length;
    const criticalRate = criticalTests.length > 0 ? (criticalPassed / criticalTests.length) * 100 : 100;

    if (failed > 0) {
      blockers.push(`${failed} test(s) failed execution.`);
    }

    if (blocked > 0) {
      blockers.push(`${blocked} test(s) are blocked by missing capabilities or artifacts.`);
    }

    if (criticalTests.length > 0 && criticalPassed < criticalTests.length) {
      blockers.push(`Not all critical verification gates passed (${criticalPassed}/${criticalTests.length}).`);
    }

    if (unknown > 0) {
      warnings.push(`${unknown} test(s) have not been executed yet.`);
    }

    return {
      passed: blockers.length === 0 && passed > 0,
      blockers,
      warnings,
      evaluatedAt,
      metrics: {
        totalTests: total,
        passed,
        failed,
        blocked,
        unknown,
        criticalPassingRate: Math.round(criticalRate)
      }
    };
  }
}

export const testExecutionEngine = new TestExecutionEngine();
