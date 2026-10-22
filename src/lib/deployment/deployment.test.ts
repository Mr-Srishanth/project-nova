import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deploymentProviderRegistry,
  validateSafeDeploymentUrl,
  VercelDeploymentAdapter
} from './deploymentProviderRegistry';
import { preflightGateEvaluator } from './preflightGateEvaluator';
import { deploymentOrchestrator } from './deploymentOrchestrator';
import { deploymentStorage } from '../storage/deploymentStorage';
import { testStorage } from '../storage/testStorage';
import { artifactStorage } from '../storage/artifactStorage';
import type { Project } from '../../types/project';
import type { DeploymentConfiguration } from '../../types/deployment';

describe('Phase 16: Deployment Integrations & Release Orchestration', () => {
  const projectId = 'proj-deploy-phase16';

  const mockProject: Project = {
    id: projectId,
    name: 'Deployable Nova Project',
    description: 'Project configured for Phase 16 deployment testing',
    objective: 'Deploy apps safely',
    category: 'Web Application',
    technologies: ['TypeScript', 'React'],
    discoveryMode: 'custom',
    milestones: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    blueprint: {
      id: 'bp-1',
      projectId,
      title: 'Deployable Architecture',
      overview: 'Summary',
      problemStatement: 'Problem',
      targetUsers: [],
      realWorldUseCase: 'Use case',
      features: { mvp: ['Deploy'], important: [], advanced: [], optional: [] },
      techStack: [],
      architecture: { summary: '', nodes: [], edges: [] },
      database: { entities: [], relationships: [], sql: '' },
      api: [],
      uiScreens: [],
      folderStructure: '',
      testingStrategy: [],
      deploymentStrategy: [],
      futureImprovements: [],
      updatedAt: new Date().toISOString()
    }
  };

  const mockConfig: DeploymentConfiguration = {
    id: 'cfg-vercel-preview',
    projectId,
    providerId: 'vercel',
    name: 'Vercel Preview',
    targetEnvironment: 'preview',
    sourceBranch: 'main',
    sourceRevision: 'rev-abc12345',
    providerProjectId: 'prj_nova_preview',
    requiredEnvVarNames: ['DATABASE_URL'],
    isConfigured: true,
    isVerified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    deploymentStorage.clearRecords(projectId);
    testStorage.clearRuns(projectId);
  });

  describe('1. SSRF Protection & URL Validation', () => {
    it('rejects loopback and private IP addresses from deployment URLs', () => {
      expect(validateSafeDeploymentUrl('http://localhost:3000').safe).toBe(false);
      expect(validateSafeDeploymentUrl('http://127.0.0.1:8080').safe).toBe(false);
      expect(validateSafeDeploymentUrl('http://192.168.1.10/api').safe).toBe(false);
      expect(validateSafeDeploymentUrl('http://10.0.0.1/status').safe).toBe(false);
      expect(validateSafeDeploymentUrl('ftp://example.com').safe).toBe(false);
      expect(validateSafeDeploymentUrl('not-a-url').safe).toBe(false);
    });

    it('accepts valid public domain URLs', () => {
      expect(validateSafeDeploymentUrl('https://projectnova-preview.vercel.app').safe).toBe(true);
      expect(validateSafeDeploymentUrl('https://api.github.com').safe).toBe(true);
    });
  });

  describe('2. Provider Adapter Architecture & Registration', () => {
    it('registers Vercel and GitHub Actions adapters', () => {
      const adapters = deploymentProviderRegistry.list();
      expect(adapters.length).toBeGreaterThanOrEqual(2);
      expect(adapters.some(a => a.providerId === 'vercel')).toBe(true);
      expect(adapters.some(a => a.providerId === 'github_actions')).toBe(true);
    });

    it('fails safely when provider token is missing without throwing exceptions', async () => {
      const vercel = new VercelDeploymentAdapter();
      const res = await vercel.dispatchDeployment({
        projectId,
        configuration: mockConfig,
        sourceRevision: 'rev-1',
        idempotencyKey: 'idemp-1'
      });
      expect(res.status).toBe('failed');
      expect(res.errorMessage).toContain('authorization token missing');
    });

    it('handles simulated Vercel API response when token is injected', async () => {
      const vercel = new VercelDeploymentAdapter();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'dpl_test123', readyState: 'QUEUED', url: 'nova-app.vercel.app' })
      } as any);

      const res = await vercel.dispatchDeployment({
        projectId,
        configuration: mockConfig,
        sourceRevision: 'rev-1',
        idempotencyKey: 'idemp-1',
        authToken: 'secret_test_token'
      });

      expect(res.status).toBe('queued');
      expect(res.providerDeploymentId).toBe('dpl_test123');
      expect(res.deploymentUrl).toBe('https://nova-app.vercel.app');
    });
  });

  describe('3. Release Preflight & Gate Enforcement', () => {
    it('blocks deployment when test plans are missing', async () => {
      vi.spyOn(artifactStorage, 'list').mockResolvedValueOnce([
        {
          id: 'art-1',
          projectId,
          path: 'src/app.ts',
          type: 'backend',
          purpose: 'core',
          status: 'approved',
          content: 'console.log("ok");',
          language: 'typescript',
          dependencies: [],
          versions: []
        }
      ]);

      const preflight = await preflightGateEvaluator.evaluatePreflight({
        project: mockProject,
        configuration: mockConfig,
        targetRevision: 'rev-123'
      });

      expect(preflight.overallStatus).toBe('failed');
      expect(preflight.blockers.some(b => b.includes('Test Automation Plan'))).toBe(true);
    });

    it('blocks deployment when revision hash is missing', async () => {
      const preflight = await preflightGateEvaluator.evaluatePreflight({
        project: mockProject,
        configuration: mockConfig,
        targetRevision: ''
      });

      expect(preflight.overallStatus).toBe('failed');
      expect(preflight.blockers.some(b => b.includes('Source revision hash is missing'))).toBe(true);
    });
  });

  describe('4. Approval Lifecycle & Production Gate Binding', () => {
    it('requires explicit approval token for production deployments', async () => {
      const prodConfig: DeploymentConfiguration = {
        ...mockConfig,
        targetEnvironment: 'production'
      };

      // Mock clean preflight
      vi.spyOn(preflightGateEvaluator, 'evaluatePreflight').mockResolvedValueOnce({
        id: 'pf-1',
        projectId,
        configurationId: prodConfig.id,
        targetEnvironment: 'production',
        sourceRevision: 'rev-prod-1',
        overallStatus: 'passed',
        canProceedToApproval: true,
        blockers: [],
        warnings: [],
        gates: [],
        evaluatedAt: new Date().toISOString()
      });

      const record = await deploymentOrchestrator.requestDeployment({
        project: mockProject,
        configuration: prodConfig,
        sourceRevision: 'rev-prod-1'
      });

      expect(record.status).toBe('awaiting_approval');
      expect(record.safeErrorMessage).toContain('Production deployments require explicit human signoff');
    });

    it('invalidates approval when target revision changes', () => {
      const approval = deploymentOrchestrator.createApproval(
        projectId,
        mockConfig.id,
        'production',
        'rev-initial-123',
        'pf-1'
      );

      const check = deploymentOrchestrator.validateApproval(
        approval,
        'rev-mutated-456', // Changed revision
        { ...mockConfig, targetEnvironment: 'production' }
      );

      expect(check.valid).toBe(false);
      expect(check.reason).toContain('Source revision changed since approval');
    });
  });

  describe('5. Post-Deployment Health Verification', () => {
    it('safely verifies health of public deployment URL', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200
      } as any);

      const record = await deploymentOrchestrator.verifyDeploymentHealth({
        id: 'dep-1',
        projectId,
        configurationId: mockConfig.id,
        providerId: 'vercel',
        targetEnvironment: 'preview',
        sourceRevision: 'rev-1',
        status: 'succeeded',
        deploymentUrl: 'https://projectnova-preview.vercel.app',
        requestedAt: new Date().toISOString(),
        idempotencyKey: 'idemp-1'
      });

      expect(record.verificationResult?.healthy).toBe(true);
      expect(record.verificationResult?.statusCode).toBe(200);
    });

    it('blocks verification and flags SSRF for private loopback addresses', async () => {
      const record = await deploymentOrchestrator.verifyDeploymentHealth({
        id: 'dep-1',
        projectId,
        configurationId: mockConfig.id,
        providerId: 'vercel',
        targetEnvironment: 'preview',
        sourceRevision: 'rev-1',
        status: 'succeeded',
        deploymentUrl: 'http://127.0.0.1:4000/internal',
        requestedAt: new Date().toISOString(),
        idempotencyKey: 'idemp-1'
      });

      expect(record.verificationResult?.healthy).toBe(false);
      expect(record.verificationResult?.details).toContain('Verification blocked: Target hostname resides on private loopback network');
    });
  });
});
