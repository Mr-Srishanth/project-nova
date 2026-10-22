import { describe, it, expect, beforeEach } from 'vitest';
import { agentRegistry } from './agentRegistry';
import { teamOrchestrator } from './teamOrchestrator';
import { consensusEngine } from './consensusEngine';
import { teamStorage } from '../storage/teamStorage';
import { AgentRole } from '../../types/team';

describe('Phase 19: Multi-Agent Teaming & Collaborative Workspaces', () => {
  const testProjectId = 'proj_test_phase_19';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('Agent Registry & Role Permissions', () => {
    it('registers all 6 specialist agents with defined capabilities', () => {
      const agents = agentRegistry.getAllAgents();
      expect(agents.length).toBe(6);
      const roles = agents.map((a) => a.role);
      expect(roles).toContain('project_architect');
      expect(roles).toContain('builder_agent');
      expect(roles).toContain('qa_agent');
      expect(roles).toContain('security_reviewer');
      expect(roles).toContain('release_manager');
      expect(roles).toContain('project_coordinator');
    });

    it('enforces that no agent can approve its own proposals (architectural invariant)', () => {
      const agents = agentRegistry.getAllAgents();
      agents.forEach((agent) => {
        expect(agent.canApproveOwnProposals).toBe(false);
        expect(agentRegistry.canReviewProposal(agent.role, agent.role)).toBe(false);
      });
    });

    it('enforces authorized cross-role review relationships', () => {
      expect(agentRegistry.canReviewProposal('builder_agent', 'qa_agent')).toBe(true);
      expect(agentRegistry.canReviewProposal('builder_agent', 'security_reviewer')).toBe(true);
      expect(agentRegistry.canReviewProposal('qa_agent', 'release_manager')).toBe(true);
    });

    it('verifies explicit capability permissions', () => {
      expect(agentRegistry.isAuthorized('security_reviewer', 'read_security_findings')).toBe(true);
      expect(agentRegistry.isAuthorized('security_reviewer', 'propose_deployment')).toBe(false);
      expect(agentRegistry.isAuthorized('release_manager', 'propose_deployment')).toBe(true);
    });
  });

  describe('Team Orchestrator & Plan Generation', () => {
    it('decomposes objective into structured specialist tasks with dependencies', () => {
      const plan = teamOrchestrator.generatePlan({
        projectId: testProjectId,
        objective: 'Refactor authentication module and verify zero credential leakage'
      });

      expect(plan.projectId).toBe(testProjectId);
      expect(plan.tasks.length).toBeGreaterThanOrEqual(5);
      expect(plan.suggestedLeadRole).toBe('project_coordinator');

      // Verify dependency chain: builder depends on architect
      const builderTask = plan.tasks.find((t) => t.assignedRole === 'builder_agent');
      const archTask = plan.tasks.find((t) => t.assignedRole === 'project_architect');
      expect(builderTask?.dependencies).toContain(archTask?.id);
    });

    it('executes a multi-agent coordination run and synthesizes evidence citations', async () => {
      const plan = teamOrchestrator.generatePlan({
        projectId: testProjectId,
        objective: 'Verify production release readiness for API gateway'
      });

      const run = await teamOrchestrator.executeTeamRun(plan);

      expect(run.id).toBe(plan.runId);
      expect(run.messages.length).toBeGreaterThan(0);
      expect(run.tasks.filter((t) => t.status === 'completed').length).toBeGreaterThan(0);
      expect(run.synthesis).toBeDefined();
      expect(run.synthesis?.consensusSummary).toContain('Coordinated team execution');

      // Check that all messages cite evidence or task context
      const completionMsgs = run.messages.filter((m) => m.type === 'completion_report');
      expect(completionMsgs.length).toBeGreaterThan(0);
      completionMsgs.forEach((m) => {
        expect(m.evidenceReferences).toBeDefined();
      });
    });
  });

  describe('Consensus Engine & Conflict Detection', () => {
    it('blocks self-approval of proposals with an explicit error', () => {
      expect(() => {
        consensusEngine.createReviewRequest({
          projectId: testProjectId,
          runId: 'run_1',
          taskId: 'task_1',
          proposalTitle: 'Unauthorized Self Signoff',
          proposingRole: 'project_architect',
          reviewerRole: 'project_architect',
          evidenceAudited: [],
          humanSignoffRequired: false
        });
      }).toThrow(/Self-approval prohibited/);
    });

    it('records peer review evaluation and human signoff', () => {
      const review = consensusEngine.createReviewRequest({
        projectId: testProjectId,
        runId: 'run_1',
        taskId: 'task_1',
        proposalTitle: 'Deploy v2 to Production',
        proposingRole: 'release_manager',
        reviewerRole: 'security_reviewer',
        evidenceAudited: [],
        humanSignoffRequired: true
      });

      expect(review.status).toBe('pending');
      expect(review.humanSignoffStatus).toBe('pending');

      // Reviewer approves
      const evaluated = consensusEngine.evaluateReview(review.id, testProjectId, 'approved', 'Security checks passed.');
      expect(evaluated.status).toBe('approved');

      // Human signoff granted
      const approved = consensusEngine.recordHumanSignoff(review.id, testProjectId, true, 'Approved by lead DevOps');
      expect(approved.humanSignoffStatus).toBe('granted');
    });

    it('detects contradictory claims between QA verification and Release readiness', () => {
      const conflicts = consensusEngine.detectConflicts({
        projectId: testProjectId,
        runId: 'run_conflict_test',
        tasks: [
          {
            id: 't_qa',
            projectId: testProjectId,
            runId: 'run_conflict_test',
            title: 'QA Run',
            description: 'Run tests',
            assignedRole: 'qa_agent',
            status: 'completed',
            priority: 'high',
            dependencies: [],
            evidenceRequired: [],
            outputSummary: 'Test execution failed with 3 unverified assertion failures.',
            requiresReview: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 't_rel',
            projectId: testProjectId,
            runId: 'run_conflict_test',
            title: 'Release Run',
            description: 'Verify release',
            assignedRole: 'release_manager',
            status: 'completed',
            priority: 'high',
            dependencies: [],
            evidenceRequired: [],
            outputSummary: 'Release gates passed and ready for immediate deployment.',
            requiresReview: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      });

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].title).toContain('Quality Verification vs Release Readiness Conflict');
      expect(conflicts[0].resolutionStrategy).toBe('conservative_fail_safe');
    });
  });

  describe('Storage Adapter Isolation', () => {
    it('isolates runs, tasks, and messages by project ID', () => {
      const run1 = {
        id: 'run_a',
        projectId: 'project_alpha',
        objective: 'Alpha initiative',
        status: 'completed' as const,
        leadRole: 'project_coordinator' as AgentRole,
        participatingRoles: ['project_coordinator' as AgentRole],
        tasks: [],
        messages: [],
        reviews: [],
        conflicts: [],
        activeRound: 1,
        maxRounds: 5,
        isAiGatewayConnected: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      teamStorage.saveRun(run1);

      expect(teamStorage.getRuns('project_alpha').length).toBe(1);
      expect(teamStorage.getRuns('project_beta').length).toBe(0);
    });
  });
});
