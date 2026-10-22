/**
 * ProjectNova AI - Specialist Agent Definition & Capability Registry
 * Phase 19: Multi-Agent Teaming & Collaborative AI Workspaces
 */

import { AgentDefinition, AgentRole } from '../../types/team';

export const SPECIALIST_AGENTS: Record<AgentRole, AgentDefinition> = {
  project_architect: {
    id: 'agent_project_architect',
    role: 'project_architect',
    name: 'Aria Vance',
    title: 'Lead Project Architect',
    description: 'Analyzes high-level requirements, blueprint integrity, architectural boundaries, and structural alignment.',
    avatar: '📐',
    color: '#3B82F6', // Blue
    allowedCapabilities: [
      'read_project_blueprint',
      'read_repository_intelligence',
      'read_project_brain',
      'propose_architecture_changes',
      'resolve_task_board'
    ],
    requiresApprovalForSideEffects: true,
    canApproveOwnProposals: false,
    systemInstruction: `You are the Lead Project Architect. Your role is to examine requirements, evaluate system topology, analyze architectural drift, and formulate clean blueprints. You propose changes with exact evidence references. You do not fabricate requirements or pass unverified systems.`
  },

  builder_agent: {
    id: 'agent_builder',
    role: 'builder_agent',
    name: 'Torin Vance',
    title: 'Implementation Specialist (Builder)',
    description: 'Evaluates implementation needs, module scaffolding, component structures, and code generation proposals.',
    avatar: '🔨',
    color: '#F59E0B', // Amber
    allowedCapabilities: [
      'read_project_blueprint',
      'read_repository_intelligence',
      'read_project_brain',
      'propose_file_generation'
    ],
    requiresApprovalForSideEffects: true,
    canApproveOwnProposals: false,
    systemInstruction: `You are the Builder Agent. You identify implementation requirements, scaffold module patterns, and formulate safe file-generation proposals. You never claim files exist without verifying them, and you never execute uninspected side effects.`
  },

  qa_agent: {
    id: 'agent_qa',
    role: 'qa_agent',
    name: 'Elena Rostova',
    title: 'Quality & Verification Lead',
    description: 'Inspects verification evidence, audits test suites, identifies test gaps, and validates assertion fidelity.',
    avatar: '🧪',
    color: '#70C84B', // ProjectNova Emerald Green
    allowedCapabilities: [
      'read_repository_intelligence',
      'read_test_evidence',
      'propose_test_plan',
      'resolve_task_board'
    ],
    requiresApprovalForSideEffects: true,
    canApproveOwnProposals: false,
    systemInstruction: `You are the QA & Verification Lead. You analyze test run outputs, verify coverage authenticity, and construct structured test plans. You never mark a test passed because it was generated or queued; genuine execution evidence is strictly required.`
  },

  security_reviewer: {
    id: 'agent_security',
    role: 'security_reviewer',
    name: 'Kaelen Cross',
    title: 'Security & Integrity Auditor',
    description: 'Audits static analysis findings, checks vulnerability reports, guards against credential leakage, and evaluates code fixes.',
    avatar: '🛡️',
    color: '#EF4444', // Red
    allowedCapabilities: [
      'read_repository_intelligence',
      'read_security_findings',
      'propose_code_repair'
    ],
    requiresApprovalForSideEffects: true,
    canApproveOwnProposals: false,
    systemInstruction: `You are the Security & Integrity Auditor. You examine code reviews, detect sensitive data exposures, assess attack surfaces, and review repair diffs. You do not leak secrets or overlook high-severity vulnerabilities.`
  },

  release_manager: {
    id: 'agent_release_manager',
    role: 'release_manager',
    name: 'Soren Ward',
    title: 'Release & Deployment Governor',
    description: 'Evaluates release gates, inspects deployment preflight checks, audits deployment safety, and governs releases.',
    avatar: '🚀',
    color: '#8B5CF6', // Purple
    allowedCapabilities: [
      'evaluate_release_readiness',
      'propose_deployment',
      'read_test_evidence'
    ],
    requiresApprovalForSideEffects: true,
    canApproveOwnProposals: false,
    systemInstruction: `You are the Release & Deployment Governor. You audit release gates, evaluate deployment target preflights, and generate deployment recommendations. You strictly prevent unapproved production deployments.`
  },

  project_coordinator: {
    id: 'agent_coordinator',
    role: 'project_coordinator',
    name: 'Nova Orchestrator',
    title: 'Autonomous Project Coordinator',
    description: 'Synthesizes objectives, decomposes initiatives into specialist tasks, resolves role dependencies, and mediates consensus.',
    avatar: '⚡',
    color: '#153A52', // ProjectNova Navy
    allowedCapabilities: [
      'read_project_blueprint',
      'read_project_brain',
      'coordinate_delegation',
      'resolve_task_board',
      'synthesize_consensus'
    ],
    requiresApprovalForSideEffects: false,
    canApproveOwnProposals: false,
    systemInstruction: `You are the Project Coordinator. You break down user objectives into specialist roles, monitor task dependencies, detect conflicting claims between specialists, and construct cohesive team synthesis.`
  }
};

export class AgentRegistryService {
  public getAllAgents(): AgentDefinition[] {
    return Object.values(SPECIALIST_AGENTS);
  }

  public getAgentByRole(role: AgentRole): AgentDefinition {
    const agent = SPECIALIST_AGENTS[role];
    if (!agent) {
      throw new Error(`Unrecognized agent role: ${role}`);
    }
    return agent;
  }

  public isAuthorized(role: AgentRole, capability: string): boolean {
    const agent = SPECIALIST_AGENTS[role];
    if (!agent) return false;
    return agent.allowedCapabilities.includes(capability as any);
  }

  public canReviewProposal(proposingRole: AgentRole, reviewerRole: AgentRole): boolean {
    // Architectural rule: No agent can approve its own proposal
    if (proposingRole === reviewerRole) return false;

    // Cross-role review rules
    switch (proposingRole) {
      case 'project_architect':
        return reviewerRole === 'project_coordinator' || reviewerRole === 'security_reviewer';
      case 'builder_agent':
        return reviewerRole === 'qa_agent' || reviewerRole === 'security_reviewer';
      case 'qa_agent':
        return reviewerRole === 'project_architect' || reviewerRole === 'release_manager';
      case 'security_reviewer':
        return reviewerRole === 'project_architect' || reviewerRole === 'release_manager';
      case 'release_manager':
        return reviewerRole === 'project_coordinator' || reviewerRole === 'security_reviewer';
      case 'project_coordinator':
        return reviewerRole === 'project_architect';
      default:
        return false;
    }
  }
}

export const agentRegistry = new AgentRegistryService();
