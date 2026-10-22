/**
 * ProjectNova AI - Review and Consensus Engine
 * Phase 19: Multi-Agent Teaming & Collaborative AI Workspaces
 */

import { ProposalReview, ConflictReport, TeamTask, AgentRole, EvidenceReference } from '../../types/team';
import { agentRegistry } from './agentRegistry';
import { teamStorage } from '../storage/teamStorage';

export class ConsensusEngine {
  /**
   * Creates a review request for a proposed task outcome.
   * Enforces architectural rule: an agent CANNOT review its own proposal.
   */
  public createReviewRequest(params: {
    projectId: string;
    runId: string;
    taskId: string;
    proposalTitle: string;
    proposingRole: AgentRole;
    reviewerRole: AgentRole;
    evidenceAudited: EvidenceReference[];
    humanSignoffRequired: boolean;
  }): ProposalReview {
    if (params.proposingRole === params.reviewerRole) {
      throw new Error(`Self-approval prohibited: ${params.proposingRole} cannot review its own proposal.`);
    }

    if (!agentRegistry.canReviewProposal(params.proposingRole, params.reviewerRole)) {
      throw new Error(`Invalid peer-review assignment: ${params.reviewerRole} is not an authorized reviewer for ${params.proposingRole}.`);
    }

    const review: ProposalReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId: params.projectId,
      runId: params.runId,
      taskId: params.taskId,
      proposalTitle: params.proposalTitle,
      proposingRole: params.proposingRole,
      reviewerRole: params.reviewerRole,
      status: 'pending',
      verdictReason: '',
      evidenceAudited: params.evidenceAudited,
      humanSignoffRequired: params.humanSignoffRequired,
      humanSignoffStatus: params.humanSignoffRequired ? 'pending' : undefined,
      createdAt: new Date().toISOString()
    };

    teamStorage.saveReview(review);
    return review;
  }

  /**
   * Conducts review verification with evidence evaluation.
   */
  public evaluateReview(
    reviewId: string,
    projectId: string,
    verdict: 'approved' | 'rejected' | 'changes_requested',
    verdictReason: string
  ): ProposalReview {
    const reviews = teamStorage.getReviews(projectId);
    const target = reviews.find((r) => r.id === reviewId);
    if (!target) {
      throw new Error(`Review record ${reviewId} not found.`);
    }

    target.status = verdict;
    target.verdictReason = verdictReason;
    target.decidedAt = new Date().toISOString();

    teamStorage.saveReview(target);
    return target;
  }

  /**
   * Records human signoff for high-impact proposals.
   */
  public recordHumanSignoff(
    reviewId: string,
    projectId: string,
    granted: boolean,
    notes?: string
  ): ProposalReview {
    const reviews = teamStorage.getReviews(projectId);
    const target = reviews.find((r) => r.id === reviewId);
    if (!target) {
      throw new Error(`Review record ${reviewId} not found.`);
    }

    target.humanSignoffStatus = granted ? 'granted' : 'denied';
    target.humanSignoffNotes = notes || (granted ? 'Human approval granted' : 'Human approval denied');
    target.decidedAt = new Date().toISOString();
    if (!granted) {
      target.status = 'rejected';
      target.verdictReason = `Human signoff denied: ${target.humanSignoffNotes}`;
    }

    teamStorage.saveReview(target);
    return target;
  }

  /**
   * Detects conflicting claims between agent findings or outputs.
   */
  public detectConflicts(params: {
    projectId: string;
    runId: string;
    tasks: TeamTask[];
  }): ConflictReport[] {
    const conflicts: ConflictReport[] = [];

    // Analyze completed tasks for contradictory claims
    const completedTasks = params.tasks.filter((t) => t.status === 'completed' && t.outputSummary);
    
    // Check QA vs Builder / Architect conflicts
    const qaTask = completedTasks.find((t) => t.assignedRole === 'qa_agent');
    const builderTask = completedTasks.find((t) => t.assignedRole === 'builder_agent');
    const securityTask = completedTasks.find((t) => t.assignedRole === 'security_reviewer');
    const releaseTask = completedTasks.find((t) => t.assignedRole === 'release_manager');

    // 1. QA test failure vs Release Manager readiness
    if (qaTask && releaseTask) {
      const qaFails = /fail|unverified|error|missing/i.test(qaTask.outputSummary || '');
      const releaseReady = /ready|passed|approved/i.test(releaseTask.outputSummary || '');
      if (qaFails && releaseReady) {
        conflicts.push({
          id: `conf_${Date.now()}_qa_release`,
          projectId: params.projectId,
          runId: params.runId,
          title: 'Quality Verification vs Release Readiness Conflict',
          agentRolesInvolved: ['qa_agent', 'release_manager'],
          conflictDescription: 'Release Manager reported ready, but QA Lead detected verification failures or missing tests.',
          competingClaims: [
            { agentRole: 'qa_agent', claim: qaTask.outputSummary || '' },
            { agentRole: 'release_manager', claim: releaseTask.outputSummary || '' }
          ],
          resolutionStrategy: 'conservative_fail_safe',
          isResolved: false
        });
      }
    }

    // 2. Security blocker vs Builder code generation
    if (securityTask && builderTask) {
      const secBlocked = /block|vulnerability|secret|high|critical/i.test(securityTask.outputSummary || '');
      const builderDone = /scaffolded|generated|complete/i.test(builderTask.outputSummary || '');
      if (secBlocked && builderDone) {
        conflicts.push({
          id: `conf_${Date.now()}_sec_builder`,
          projectId: params.projectId,
          runId: params.runId,
          title: 'Security Vulnerability vs Builder Implementation Conflict',
          agentRolesInvolved: ['security_reviewer', 'builder_agent'],
          conflictDescription: 'Builder proposed implementation, but Security Auditor flagged high-severity vulnerabilities or secrets.',
          competingClaims: [
            { agentRole: 'security_reviewer', claim: securityTask.outputSummary || '' },
            { agentRole: 'builder_agent', claim: builderTask.outputSummary || '' }
          ],
          resolutionStrategy: 'human_escalation',
          isResolved: false
        });
      }
    }

    conflicts.forEach((c) => teamStorage.saveConflict(c));
    return conflicts;
  }
}

export const consensusEngine = new ConsensusEngine();
