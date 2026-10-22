import { describe, it, expect, beforeEach } from 'vitest';
import { releaseGateAuditor } from './releaseGateAuditor';
import { projectStorage } from '../storage/projectStorage';
import { qualityStorage } from '../storage/qualityStorage';
import { consensusEngine } from '../team/consensusEngine';
import { deploymentStorage } from '../storage/deploymentStorage';
import { deploymentOrchestrator } from '../deployment/deploymentOrchestrator';

describe('Phase 20: Final Product Hardening, End-to-End Integration & Release Readiness', () => {
  const testProjectId = 'proj_phase_20_e2e';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('Journey A to F Integration & Release Gate Evaluation', () => {
    it('evaluates complete release criteria for an active project', async () => {
      // Setup project with required fields
      const created = await projectStorage.create({
        name: 'ProjectNova Production System',
        description: 'Flagship enterprise AI development platform',
        objective: 'Autonomous software engineering coordination',
        category: 'Developer Tool',
        technologies: ['React', 'TypeScript']
      });

      await projectStorage.update(created.id, {
        blueprint: {
          id: `bp_${created.id}`,
          projectId: created.id,
          title: 'ProjectNova Architecture Blueprint',
          overview: 'Comprehensive system overview',
          problemStatement: 'Manual fragmented AI pipelines',
          targetUsers: ['Software Engineers', 'DevOps Architects'],
          realWorldUseCase: 'Autonomous end-to-end multi-agent development and release',
          features: { mvp: ['Discovery', 'Build'], important: ['Review'], advanced: ['Workflows'], optional: [] },
          techStack: [{ layer: 'Presentation', tech: 'React', why: 'Component reusability' }],
          architecture: { summary: 'System Topology', nodes: [], edges: [] },
          database: { entities: [], relationships: [], sql: '' },
          api: [],
          uiScreens: [],
          folderStructure: 'src/',
          testingStrategy: ['Unit', 'Integration'],
          deploymentStrategy: ['Automated Preflight', 'Human Signoff'],
          futureImprovements: [],
          updatedAt: new Date().toISOString()
        }
      });

      const audit = await releaseGateAuditor.evaluateProjectReleaseGate(created.id);

      expect(audit).toBeDefined();
      expect(audit.criteria.length).toBe(10);
      expect(audit.overallStatus).toBe('ready_with_documented_limitations');
      expect(audit.blockedCount).toBe(0);
      expect(audit.passedCount).toBeGreaterThanOrEqual(8);

      // Verify explicit criteria
      const securityCrit = audit.criteria.find((c) => c.id === 'CRIT_03_SECURITY_AUDIT');
      expect(securityCrit?.status).toBe('passed');

      const storageCrit = audit.criteria.find((c) => c.id === 'CRIT_10_STORAGE_PERSISTENCE');
      expect(storageCrit?.status).toBe('warning');
      expect(storageCrit?.remediation).toContain('shared PostgreSQL');
    });

    it('blocks release if unresolved high-severity security vulnerabilities exist', async () => {
      const proj = await projectStorage.create({
        name: 'Vulnerable Project',
        description: 'Project with vulnerability',
        objective: 'Test security blocker',
        category: 'Developer Tool',
        technologies: ['Node.js']
      });

      await qualityStorage.saveAssessment({
        id: 'qa_assessment_crit',
        projectId: proj.id,
        assessedAt: new Date().toISOString(),
        checksPerformed: ['security'],
        totalArtifactsChecked: 1,
        findings: [
          {
            id: 'qa_sec_hardcoded_key',
            projectId: proj.id,
            assessmentId: 'qa_assessment_crit',
            category: 'security',
            severity: 'error',
            title: 'Hardcoded Secret Detected',
            message: 'Plaintext secret leaked in production bundle',
            suggestedFix: 'Extract secret to server environment variables',
            ruleId: 'SEC001_HARDCODED_KEY',
            status: 'open',
            isAiGenerated: false,
            createdAt: new Date().toISOString()
          }
        ],
        score: {
          healthGrade: 'F',
          errorCount: 1,
          warningCount: 0,
          infoCount: 0,
          resolvedCount: 0
        }
      });

      const audit = await releaseGateAuditor.evaluateProjectReleaseGate(proj.id);
      expect(audit.overallStatus).toBe('blocked_by_critical_issues');
      expect(audit.blockedCount).toBeGreaterThanOrEqual(1);

      const secCrit = audit.criteria.find((c) => c.id === 'CRIT_03_SECURITY_AUDIT');
      expect(secCrit?.status).toBe('blocked');
      expect(secCrit?.remediation).toContain('Triage and resolve all high-severity security findings');
    });
  });

  describe('Security Boundaries & Action Policy Integrity', () => {
    it('strictly prevents agent self-approval across all roles', () => {
      expect(() => {
        consensusEngine.createReviewRequest({
          projectId: testProjectId,
          runId: 'run_tamper',
          taskId: 'task_tamper',
          proposalTitle: 'Self-Authorized File Modification',
          proposingRole: 'builder_agent',
          reviewerRole: 'builder_agent',
          evidenceAudited: [],
          humanSignoffRequired: false
        });
      }).toThrow(/Self-approval prohibited/);
    });

    it('enforces deployment approval binding to exact revision and target', () => {
      const approval = deploymentOrchestrator.createApproval(
        testProjectId,
        'cfg_prod_target',
        'production',
        'git_rev_abc123',
        'preflight_rep_456',
        'security_officer'
      );

      expect(approval.id).toBeDefined();
      expect(approval.boundSourceRevision).toBe('git_rev_abc123');
      expect(approval.targetEnvironment).toBe('production');
      expect(approval.revoked).toBe(false);

      // Verify that deployment storage retrieves the saved approval
      const stored = deploymentStorage.getApproval(approval.id);
      expect(stored?.boundSourceRevision).toBe('git_rev_abc123');
    });
  });
});
