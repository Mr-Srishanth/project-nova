import { describe, it, expect, beforeEach } from 'vitest';
import { capabilityRegistry, sanitizeTestOutput } from './testCapabilityRegistry';
import { generateDefaultTestPlan } from './testPlanEngine';
import { testExecutionEngine } from './testExecutionEngine';
import { testStorage } from '../storage/testStorage';
import type { Blueprint } from '../../types/blueprint';
import type { BuildArtifact } from '../../types/artifact';
import type { RepairProposal } from '../../types/review';

describe('Phase 15: Test Automation & Verification Engine', () => {
  const projectId = 'test-proj-phase15';
  
  const mockBlueprint: Blueprint = {
    id: 'bp-test-1',
    projectId,
    title: 'Phase 15 Verification API',
    overview: 'Blueprint for testing engine verification',
    problemStatement: 'Need automated testing engine',
    targetUsers: ['Engineers'],
    realWorldUseCase: 'Quality gate enforcement',
    features: {
      mvp: ['Verification'],
      important: [],
      advanced: [],
      optional: []
    },
    techStack: [],
    architecture: { summary: '', nodes: [], edges: [] },
    database: { entities: [], relationships: [], sql: '' },
    api: [
      { method: 'GET', route: '/api/v1/health', purpose: 'Health check' },
      { method: 'POST', route: '/api/v1/auth', purpose: 'Authentication' }
    ],
    uiScreens: [],
    folderStructure: '',
    testingStrategy: [],
    deploymentStrategy: [],
    futureImprovements: [],
    updatedAt: new Date().toISOString()
  };

  const mockArtifacts: BuildArtifact[] = [
    {
      id: 'art-1',
      projectId,
      path: 'src/api/health.ts',
      content: `export function getHealth() {\n  return { status: "ok" };\n}`,
      language: 'typescript',
      type: 'api',
      purpose: 'health check',
      status: 'approved',
      dependencies: [],
      versions: [],
      lastGeneratedAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString()
    },
    {
      id: 'art-2',
      projectId,
      path: 'src/config/app.json',
      content: `{\n  "appName": "ProjectNova",\n  "version": "1.0.0"\n}`,
      language: 'json',
      type: 'config',
      purpose: 'application configuration',
      status: 'approved',
      dependencies: [],
      versions: [],
      lastGeneratedAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    testStorage.clearRuns(projectId);
  });

  describe('1. Capability Registry & Parameter Whitelisting', () => {
    it('registers all 5 core deterministic capabilities', () => {
      const caps = capabilityRegistry.list();
      expect(caps.length).toBeGreaterThanOrEqual(5);

      const capIds = caps.map(c => c.id);
      expect(capIds).toContain('static_analysis_runner');
      expect(capIds).toContain('security_analysis_runner');
      expect(capIds).toContain('dependency_cycle_checker');
      expect(capIds).toContain('drift_verification_runner');
      expect(capIds).toContain('artifact_syntax_validator');
    });

    it('rejects unregistered capabilities gracefully with blocked status', async () => {
      const plan = generateDefaultTestPlan({
        projectId,
        projectName: 'Test',
        artifacts: mockArtifacts
      });

      const { updatedCase, record } = await testExecutionEngine.executeTestCase(
        {
          id: 'unregistered-tc',
          name: 'Unregistered Shell Runner',
          description: 'Attempts to run unregistered runner',
          category: 'unit',
          capabilityId: 'arbitrary_bash_runner',
          status: 'configured',
          priority: 'critical',
          targetPaths: ['src/api/health.ts'],
          parameters: {},
          assertions: []
        },
        { projectId, targetPaths: ['src/api/health.ts'], parameters: {}, artifacts: mockArtifacts },
        plan.id
      );

      expect(updatedCase.status).toBe('blocked');
      expect(record.status).toBe('blocked');
      expect(record.errorMessage).toContain('Unregistered capability');
    });

    it('sanitizes tokens and passwords from test output', () => {
      const raw = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz api_key="secret1234567890123"';
      const sanitized = sanitizeTestOutput(raw);
      expect(sanitized).not.toContain('secret1234567890123');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
      expect(sanitized).toContain('[REDACTED_TOKEN]');
    });
  });

  describe('2. Test Planning & Deterministic Generation', () => {
    it('generates a structured test plan with suites matching blueprint and artifacts', () => {
      const plan = generateDefaultTestPlan({
        projectId,
        projectName: 'Nova Test',
        blueprint: mockBlueprint,
        artifacts: mockArtifacts
      });

      expect(plan.projectId).toBe(projectId);
      expect(plan.testCases.length).toBeGreaterThanOrEqual(4);
      expect(plan.suites.length).toBeGreaterThanOrEqual(4);
      expect(plan.summary.unknown).toBe(plan.testCases.length);
      expect(plan.summary.passed).toBe(0);
    });

    it('links Phase 14 Repair Proposals into dedicated regression tests', () => {
      const mockProposals: RepairProposal[] = [{
        id: 'prop-fix-auth',
        projectId,
        findingId: 'f-sec-1',
        targetFilePath: 'src/api/health.ts',
        originalContentHash: 'hash1',
        originalCodeSnippet: 'const token = "123";',
        proposedCodeSnippet: 'const token = process.env.TOKEN;',
        unifiedDiff: '--- src/api/health.ts\n+++ src/api/health.ts\n@@ -1 +1 @@\n-const token = "123";\n+const token = process.env.TOKEN;',
        rationale: 'Avoid hardcoded secret',
        expectedBehaviorChange: 'Load token safely from environment',
        validationStatus: 'validated',
        createdAt: new Date().toISOString()
      }];

      const plan = generateDefaultTestPlan({
        projectId,
        projectName: 'Nova Test',
        proposals: mockProposals,
        artifacts: mockArtifacts
      });

      const regressionCase = plan.testCases.find(tc => tc.relatedProposalId === 'prop-fix-auth');
      expect(regressionCase).toBeDefined();
      expect(regressionCase?.category).toBe('regression');
      expect(regressionCase?.targetPaths).toContain('src/api/health.ts');
    });
  });

  describe('3. Test Execution Engine & Verification Gates', () => {
    it('executes static analysis and syntax validation with deterministic assertion outcomes', async () => {
      const plan = generateDefaultTestPlan({
        projectId,
        projectName: 'Nova Test',
        blueprint: mockBlueprint,
        artifacts: mockArtifacts
      });

      const updatedPlan = await testExecutionEngine.executePlan(plan, {
        projectId,
        planId: plan.id,
        artifacts: mockArtifacts,
        blueprint: mockBlueprint,
        executedBy: 'unit_test_runner'
      });

      expect(updatedPlan.summary.total).toBe(plan.testCases.length);
      expect(updatedPlan.summary.lastRunAt).toBeDefined();
      expect(updatedPlan.testCases.some(tc => tc.status === 'passed')).toBe(true);

      // Verify execution run records persisted
      const runs = testStorage.listRuns(projectId);
      expect(runs.length).toBe(plan.testCases.length);
      expect(runs[0].executionType).toBe('machine_verified');
    });

    it('evaluates release verification gate: blocks when tests unverified or failed', () => {
      // Unexecuted plan
      const unrunPlan = generateDefaultTestPlan({
        projectId,
        projectName: 'Nova Test',
        artifacts: mockArtifacts
      });

      const gateInitial = testExecutionEngine.evaluateVerificationGate(unrunPlan);
      expect(gateInitial.passed).toBe(false);
      expect(gateInitial.warnings.length).toBeGreaterThan(0);

      // Mutate plan to include a failure
      const failedPlan = {
        ...unrunPlan,
        testCases: unrunPlan.testCases.map((tc, idx) => ({
          ...tc,
          status: idx === 0 ? ('failed' as const) : ('passed' as const)
        }))
      };

      const gateFailed = testExecutionEngine.evaluateVerificationGate(failedPlan);
      expect(gateFailed.passed).toBe(false);
      expect(gateFailed.blockers.some(b => b.includes('failed execution'))).toBe(true);

      // Mutate plan to 100% passed
      const passedPlan = {
        ...unrunPlan,
        testCases: unrunPlan.testCases.map(tc => ({
          ...tc,
          status: 'passed' as const
        }))
      };

      const gatePassed = testExecutionEngine.evaluateVerificationGate(passedPlan);
      expect(gatePassed.passed).toBe(true);
      expect(gatePassed.blockers.length).toBe(0);
      expect(gatePassed.metrics.criticalPassingRate).toBe(100);
    });

    it('handles undefined or missing statistics and malformed plans defensively in storage adapter', () => {
      // 1. Missing summary object
      const rawPlanWithoutSummary = {
        id: 'plan-missing-summary',
        projectId,
        name: 'Plan Missing Summary',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        testCases: [
          { id: 'c1', name: 'Test 1', status: 'passed' },
          { id: 'c2', name: 'Test 2', status: 'failed' },
          { id: 'c3', name: 'Test 3', status: 'unknown' }
        ],
        suites: []
      };

      const sanitized = testStorage.sanitizePlan(rawPlanWithoutSummary);
      expect(sanitized.summary).toBeDefined();
      expect(sanitized.summary.total).toBe(3);
      expect(sanitized.summary.passed).toBe(1);
      expect(sanitized.summary.failed).toBe(1);
      expect(sanitized.summary.unknown).toBe(1);

      // 2. Completely empty test plan
      const emptyPlan = {
        id: 'plan-empty',
        projectId,
        name: 'Empty Plan',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        testCases: [],
        suites: []
      };

      const sanitizedEmpty = testStorage.sanitizePlan(emptyPlan);
      expect(sanitizedEmpty.summary.total).toBe(0);
      expect(sanitizedEmpty.summary.passed).toBe(0);
      expect(sanitizedEmpty.summary.failed).toBe(0);

      // Gate evaluation on empty plan
      const emptyGate = testExecutionEngine.evaluateVerificationGate(sanitizedEmpty);
      expect(emptyGate.passed).toBe(false);
      expect(emptyGate.metrics.totalTests).toBe(0);

      // Gate evaluation on null plan
      const nullGate = testExecutionEngine.evaluateVerificationGate(null);
      expect(nullGate.passed).toBe(false);
      expect(nullGate.metrics.totalTests).toBe(0);
    });
  });
});
