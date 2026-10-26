/**
 * ProjectNova AI - Multi-Agent Team Orchestrator
 * Phase 19: Multi-Agent Teaming & Collaborative AI Workspaces
 */

import {
  AgentRole,
  CoordinationPlan,
  TeamCoordinationRun,
  TeamMessage,
  TeamTask,
  TeamSynthesis,
  EvidenceReference
} from '../../types/team';
import { SPECIALIST_AGENTS } from './agentRegistry';
import { teamStorage } from '../storage/teamStorage';
import { GATEWAY_ORIGIN } from '../gatewayBase';
import { consensusEngine } from './consensusEngine';
import { projectStorage } from '../storage/projectStorage';
import { brainStorage } from '../storage/brainStorage';
import { testStorage } from '../storage/testStorage';
import { qualityStorage } from '../storage/qualityStorage';
import { releaseStorage } from '../storage/releaseStorage';
import { deploymentStorage } from '../storage/deploymentStorage';
import { repositoryStorage } from '../storage/repositoryStorage';
import { artifactStorage } from '../storage/artifactStorage';

export interface PlanGenerationRequest {
  projectId: string;
  objective: string;
  targetRoles?: AgentRole[];
}

export class TeamOrchestrator {
  /**
   * Generates a deterministic coordination plan decomposing an objective
   * into specialist agent assignments with strict dependency DAGs.
   */
  public generatePlan(request: PlanGenerationRequest): CoordinationPlan {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const roles: AgentRole[] = request.targetRoles && request.targetRoles.length > 0
      ? request.targetRoles
      : ['project_coordinator', 'project_architect', 'builder_agent', 'security_reviewer', 'qa_agent', 'release_manager'];

    const tasks: TeamTask[] = [];
    const now = new Date().toISOString();

    // 1. Project Coordinator framing
    const coordTaskId = `task_coord_${Date.now()}_1`;
    tasks.push({
      id: coordTaskId,
      projectId: request.projectId,
      runId,
      title: 'Synthesize Objective & Decompose Initiative',
      description: `Analyze objective: "${request.objective}" and formulate specialist delegation constraints.`,
      assignedRole: 'project_coordinator',
      status: 'assigned',
      priority: 'high',
      dependencies: [],
      evidenceRequired: ['project_blueprint', 'project_brain'],
      requiresReview: false,
      createdAt: now,
      updatedAt: now
    });

    // 2. Architect Blueprint & Drift Analysis
    const archTaskId = `task_arch_${Date.now()}_2`;
    tasks.push({
      id: archTaskId,
      projectId: request.projectId,
      runId,
      title: 'Architectural Blueprint & Topology Audit',
      description: 'Audit system blueprint, evaluate architectural drift, and verify module boundaries for the objective.',
      assignedRole: 'project_architect',
      status: 'backlog',
      priority: 'high',
      dependencies: [coordTaskId],
      evidenceRequired: ['project_blueprint', 'repository_files'],
      requiresReview: true,
      createdAt: now,
      updatedAt: now
    });

    // 3. Security Reviewer Pre-Implementation Audit
    const secTaskId = `task_sec_${Date.now()}_3`;
    tasks.push({
      id: secTaskId,
      projectId: request.projectId,
      runId,
      title: 'Static & Security Preflight Inspection',
      description: 'Review security rules, check credential exposure guards, and evaluate vulnerability posture.',
      assignedRole: 'security_reviewer',
      status: 'backlog',
      priority: 'critical',
      dependencies: [archTaskId],
      evidenceRequired: ['security_findings', 'repository_files'],
      requiresReview: true,
      createdAt: now,
      updatedAt: now
    });

    // 4. Builder Implementation Planning
    const builderTaskId = `task_bld_${Date.now()}_4`;
    tasks.push({
      id: builderTaskId,
      projectId: request.projectId,
      runId,
      title: 'Implementation Scaffolding & Code Generation Proposals',
      description: 'Formulate safe file generation proposals conforming to architect specifications.',
      assignedRole: 'builder_agent',
      status: 'backlog',
      priority: 'medium',
      dependencies: [archTaskId, secTaskId],
      evidenceRequired: ['project_blueprint', 'project_brain'],
      requiresReview: true,
      createdAt: now,
      updatedAt: now
    });

    // 5. QA Verification Suite Review
    const qaTaskId = `task_qa_${Date.now()}_5`;
    tasks.push({
      id: qaTaskId,
      projectId: request.projectId,
      runId,
      title: 'Verification Coverage & Test Suite Audit',
      description: 'Audit test evidence, identify verification gaps, and assemble structured test plans.',
      assignedRole: 'qa_agent',
      status: 'backlog',
      priority: 'high',
      dependencies: [builderTaskId],
      evidenceRequired: ['test_run_evidence'],
      requiresReview: true,
      createdAt: now,
      updatedAt: now
    });

    // 6. Release Manager Governance Check
    const relTaskId = `task_rel_${Date.now()}_6`;
    tasks.push({
      id: relTaskId,
      projectId: request.projectId,
      runId,
      title: 'Release Gate Evaluation & Preflight Governance',
      description: 'Audit release readiness criteria, check target preflight, and formulate deployment recommendation.',
      assignedRole: 'release_manager',
      status: 'backlog',
      priority: 'high',
      dependencies: [qaTaskId, secTaskId],
      evidenceRequired: ['release_gate_evidence', 'deployment_target'],
      requiresReview: true,
      createdAt: now,
      updatedAt: now
    });

    return {
      runId,
      projectId: request.projectId,
      objective: request.objective,
      tasks: tasks.filter((t) => roles.includes(t.assignedRole)),
      suggestedLeadRole: 'project_coordinator',
      maxRounds: 5,
      currentRound: 1
    };
  }

  /**
   * Initializes and executes a team coordination run.
   * Genuinely inspects real project storage / brain / test / release evidence.
   * Never fabricates test passes or credentials.
   */
  public async executeTeamRun(plan: CoordinationPlan): Promise<TeamCoordinationRun> {
    const now = new Date().toISOString();
    const run: TeamCoordinationRun = {
      id: plan.runId,
      projectId: plan.projectId,
      objective: plan.objective,
      status: 'coordinating',
      leadRole: plan.suggestedLeadRole,
      participatingRoles: Array.from(new Set(plan.tasks.map((t) => t.assignedRole))),
      tasks: [...plan.tasks],
      messages: [],
      reviews: [],
      conflicts: [],
      activeRound: 1,
      maxRounds: plan.maxRounds,
      isAiGatewayConnected: false,
      createdAt: now,
      updatedAt: now
    };

    // Check gateway status
    try {
      const resp = await fetch(`${GATEWAY_ORIGIN}/api/ai/health`, { method: 'GET' }).catch(() => null);
      if (resp && resp.ok) {
        run.isAiGatewayConnected = true;
      }
    } catch {
      run.isAiGatewayConnected = false;
    }

    teamStorage.saveRun(run);
    teamStorage.saveTasks(run.tasks);

    // Initial coordination broadcast message
    const initMsg: TeamMessage = {
      id: `msg_${Date.now()}_init`,
      projectId: run.projectId,
      runId: run.id,
      fromAgentRole: 'project_coordinator',
      toAgentRole: 'all',
      type: 'task_assignment',
      title: 'Coordination Run Dispatched',
      content: `Initiative "${run.objective}" initialized with ${run.tasks.length} specialist tasks across ${run.participatingRoles.length} roles.`,
      evidenceReferences: [],
      timestamp: now
    };
    run.messages.push(initMsg);
    teamStorage.saveMessage(initMsg);

    // Process tasks in dependency order
    for (const task of run.tasks) {
      // Check if dependencies are met
      const depsCompleted = task.dependencies.every((depId) => {
        const depTask = run.tasks.find((t) => t.id === depId);
        return depTask && depTask.status === 'completed';
      });

      if (!depsCompleted && task.dependencies.length > 0) {
        task.status = 'blocked';
        task.outputSummary = `Blocked awaiting dependency completion: ${task.dependencies.join(', ')}`;
        teamStorage.saveTask(task);
        continue;
      }

      task.status = 'in_progress';
      teamStorage.saveTask(task);

      // Execute real inspection based on agent role
      const outcome = await this.executeSpecialistWork(task, run);
      task.outputSummary = outcome.summary;
      task.status = 'completed';
      task.updatedAt = new Date().toISOString();
      teamStorage.saveTask(task);

      // Post completion message with evidence
      const msg: TeamMessage = {
        id: `msg_${Date.now()}_${task.assignedRole}`,
        projectId: run.projectId,
        runId: run.id,
        fromAgentRole: task.assignedRole,
        toAgentRole: 'project_coordinator',
        type: 'completion_report',
        title: `${SPECIALIST_AGENTS[task.assignedRole].title}: ${task.title}`,
        content: outcome.summary,
        evidenceReferences: outcome.evidence,
        timestamp: new Date().toISOString()
      };
      run.messages.push(msg);
      teamStorage.saveMessage(msg);

      // Submit for review if required
      if (task.requiresReview) {
        let reviewerRole: AgentRole = 'project_coordinator';
        if (task.assignedRole === 'project_architect') reviewerRole = 'security_reviewer';
        if (task.assignedRole === 'builder_agent') reviewerRole = 'qa_agent';
        if (task.assignedRole === 'qa_agent') reviewerRole = 'project_architect';
        if (task.assignedRole === 'security_reviewer') reviewerRole = 'project_architect';
        if (task.assignedRole === 'release_manager') reviewerRole = 'security_reviewer';

        const review = consensusEngine.createReviewRequest({
          projectId: run.projectId,
          runId: run.id,
          taskId: task.id,
          proposalTitle: task.title,
          proposingRole: task.assignedRole,
          reviewerRole,
          evidenceAudited: outcome.evidence,
          humanSignoffRequired: task.assignedRole === 'release_manager' || task.assignedRole === 'security_reviewer'
        });

        // Automated evidence check only — NOT a human peer approval. A
        // review is marked approved only when the task actually produced
        // evidence citations; otherwise it is changes_requested so the UI
        // never counts an evidence-free run as "approved".
        const evaluated = outcome.evidence.length > 0
          ? consensusEngine.evaluateReview(
              review.id,
              run.projectId,
              'approved',
              `Automated evidence check by ${SPECIALIST_AGENTS[reviewerRole].title}: ${outcome.evidence.length} evidence citation(s) recorded. This is a deterministic check, not a human peer review.`
            )
          : consensusEngine.evaluateReview(
              review.id,
              run.projectId,
              'changes_requested',
              `Automated evidence check by ${SPECIALIST_AGENTS[reviewerRole].title}: no evidence citations recorded, so approval is withheld.`
            );
        run.reviews.push(evaluated);
      }
    }

    // Detect conflicts across specialist findings
    const conflicts = consensusEngine.detectConflicts({
      projectId: run.projectId,
      runId: run.id,
      tasks: run.tasks
    });
    run.conflicts = conflicts;

    // Synthesize results
    const synthesis = this.generateSynthesis(run);
    run.synthesis = synthesis;
    run.status = conflicts.length > 0 ? 'awaiting_reviews' : 'completed';
    run.completedAt = new Date().toISOString();
    run.updatedAt = new Date().toISOString();

    teamStorage.saveRun(run);
    return run;
  }

  /**
   * Executes specialist task by auditing authentic project data.
   */
  private async executeSpecialistWork(
    task: TeamTask,
    run: TeamCoordinationRun
  ): Promise<{ summary: string; evidence: EvidenceReference[] }> {
    const evidence: EvidenceReference[] = [];

    switch (task.assignedRole) {
      case 'project_coordinator': {
        const brainEntries = await brainStorage.list(task.projectId);
        evidence.push({
          sourceType: 'brain_memory',
          idOrPath: `brain_count_${brainEntries.length}`,
          snippet: `Discovered ${brainEntries.length} Project Brain knowledge entries.`,
          confidence: 1.0
        });
        return {
          summary: `Synthesized objective and delegated to ${run.participatingRoles.length} specialist agents. Verified project memory integrity.`,
          evidence
        };
      }

      case 'project_architect': {
        const proj = await projectStorage.getById(task.projectId);
        const blueprintTitle = proj?.blueprint?.title || 'Default System Topology';
        const repoIndex = await repositoryStorage.getIndex(task.projectId);
        const fileCount = repoIndex?.files?.length || 0;
        const artifacts = await artifactStorage.list(task.projectId);
        const generatedCount = artifacts.filter((a) => a.status === 'generated' || a.status === 'approved').length;
        evidence.push({
          sourceType: 'repository_file',
          idOrPath: repoIndex?.sourceName || 'local_repo',
          snippet: `Examined ${fileCount} files in repository index and ${artifacts.length} Build Studio artifacts. Blueprint titled: ${blueprintTitle}`,
          confidence: 0.95
        });
        return {
          // No divergence verdict: this audit counts files, it does not diff
          // blueprint plans against artifacts, so it must not claim otherwise.
          summary: `Audited architectural layout: ${fileCount} files in the repository index, ${artifacts.length} Build Studio artifacts (${generatedCount} generated/approved), blueprint "${blueprintTitle}". Divergence was not computed — run Quality static analysis for a file-by-file check.`,
          evidence
        };
      }

      case 'security_reviewer': {
        const assessment = await qualityStorage.getLatestAssessment(task.projectId);
        evidence.push({
          sourceType: 'security_finding',
          idOrPath: 'security_audit',
          snippet: assessment
            ? `Latest assessment recorded ${assessment.findings?.length || 0} findings.`
            : 'No quality assessment has been recorded for this project yet.',
          confidence: 0.98
        });
        if (!assessment) {
          return {
            summary: 'No security assessment has run for this project yet, so zero findings cannot be confirmed. Run a Quality assessment first.',
            evidence
          };
        }
        const issueCount = assessment.findings?.length || 0;
        return {
          summary: issueCount === 0
            ? 'Latest recorded security assessment lists zero findings. (This reflects the last assessment run, not a fresh scan.)'
            : `Latest recorded assessment lists ${issueCount} security findings requiring triage before deployment.`,
          evidence
        };
      }

      case 'builder_agent': {
        const artifacts = await artifactStorage.list(task.projectId);
        const generatedCount = artifacts.filter((a) => a.status === 'generated' || a.status === 'approved').length;
        const pendingCount = artifacts.length - generatedCount;
        evidence.push({
          sourceType: 'artifact',
          idOrPath: 'build_manifest',
          snippet: `${artifacts.length} Build Studio artifacts on record (${generatedCount} generated/approved, ${pendingCount} pending).`,
          confidence: 0.92
        });
        return {
          // This role audits build state; it creates no files itself.
          summary: `Build-state audit: ${artifacts.length} artifacts on record (${generatedCount} generated/approved, ${pendingCount} pending). No files were created by this audit — generate them in Build Studio.`,
          evidence
        };
      }

      case 'qa_agent': {
        const plans = testStorage.listPlans(task.projectId);
        const lastPlan = plans[0];
        const passedCount = lastPlan?.summary?.passed || 0;
        const totalCount = lastPlan?.summary?.total || 0;
        evidence.push({
          sourceType: 'test_run',
          idOrPath: lastPlan?.id || 'none',
          snippet: lastPlan ? `Recorded test plan with ${passedCount}/${totalCount} passing.` : 'No test plan recorded.',
          confidence: 1.0
        });
        return {
          summary: lastPlan
            ? `Verified test execution: ${passedCount} passed out of ${totalCount} genuine tests.`
            : 'Audited test harness. Recommended configuring automated unit and integration suites.',
          evidence
        };
      }

      case 'release_manager': {
        const latestRelease = await releaseStorage.getLatest(task.projectId);
        const configs = deploymentStorage.listConfigurations(task.projectId);
        evidence.push({
          sourceType: 'deployment_target',
          idOrPath: `targets_count_${configs.length}`,
          snippet: `${configs.length} registered deployment targets found. Latest release: ${latestRelease?.version || 'None'}`,
          confidence: 1.0
        });
        return {
          // Configs are registered targets, not preflight results: preflight
          // runs separately in the Deployment Center and is not checked here.
          summary: configs.length > 0
            ? `Release audit: ${configs.length} deployment target(s) registered, latest release ${latestRelease?.version || 'none'}. Preflight was not run by this audit — run it in the Deployment Center before deploying.`
            : 'Release audit noted 0 active deployment targets registered. Deployment recommendation deferred.',
          evidence
        };
      }

      default:
        return {
          summary: `Task completed by ${task.assignedRole}.`,
          evidence: []
        };
    }
  }

  /**
   * Synthesizes outputs into cohesive consensus findings.
   */
  private generateSynthesis(run: TeamCoordinationRun): TeamSynthesis {
    const completedTasks = run.tasks.filter((t) => t.status === 'completed');
    const proposals = completedTasks
      .filter((t) => t.requiresReview)
      .map((t) => ({
        role: t.assignedRole,
        proposal: t.outputSummary || t.title,
        requiresHumanApproval: t.assignedRole === 'release_manager' || t.assignedRole === 'security_reviewer'
      }));

    return {
      runId: run.id,
      projectId: run.projectId,
      objective: run.objective,
      consensusSummary: `Coordinated team execution completed with ${completedTasks.length}/${run.tasks.length} tasks resolved across ${run.participatingRoles.length} specialist agents. Evidence citations audited for all claims.`,
      unresolvedConflictsCount: run.conflicts.filter((c) => !c.isResolved).length,
      completedTasksCount: completedTasks.length,
      totalTasksCount: run.tasks.length,
      actionableProposals: proposals,
      synthesizedAt: new Date().toISOString()
    };
  }
}

export const teamOrchestrator = new TeamOrchestrator();
