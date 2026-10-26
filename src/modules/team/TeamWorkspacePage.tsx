import React, { useState, useEffect } from 'react';
import {
  Users,
  Bot,
  Play,
  Clock,
  RefreshCw,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { SPECIALIST_AGENTS, agentRegistry } from '../../lib/team/agentRegistry';
import { teamOrchestrator } from '../../lib/team/teamOrchestrator';
import { teamStorage } from '../../lib/storage/teamStorage';
import { consensusEngine } from '../../lib/team/consensusEngine';
import { projectStorage } from '../../lib/storage/projectStorage';
import { TeamCoordinationRun, TeamTask } from '../../types/team';

export const TeamWorkspacePage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [objective, setObjective] = useState<string>('Comprehensive System Blueprint & Verification Audit');
  const [activeTab, setActiveTab] = useState<'console' | 'board' | 'reviews' | 'conflicts' | 'specialists'>('console');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [currentRun, setCurrentRun] = useState<TeamCoordinationRun | null>(null);
  const [, setSelectedTask] = useState<TeamTask | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadTeamData(selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    const list = await projectStorage.list();
    setProjects(list);
    if (list.length > 0 && !selectedProjectId) {
      setSelectedProjectId(list[0].id);
    }
  };

  const loadTeamData = (projectId: string) => {
    const runs = teamStorage.getRuns(projectId);
    if (runs.length > 0) {
      setCurrentRun(runs[0]);
    } else {
      setCurrentRun(null);
    }
  };

  const handleStartCoordination = async () => {
    if (!selectedProjectId || !objective.trim()) return;
    setIsExecuting(true);
    try {
      const plan = teamOrchestrator.generatePlan({
        projectId: selectedProjectId,
        objective: objective.trim()
      });
      const run = await teamOrchestrator.executeTeamRun(plan);
      setCurrentRun(run);
      loadTeamData(selectedProjectId);
    } catch (e) {
      console.error('Failed to execute team run', e);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleHumanSignoff = (reviewId: string, granted: boolean) => {
    if (!selectedProjectId) return;
    consensusEngine.recordHumanSignoff(
      reviewId,
      selectedProjectId,
      granted,
      granted ? 'Approved via Multi-Agent Workspace' : 'Rejected via Multi-Agent Workspace'
    );
    loadTeamData(selectedProjectId);
  };

  const specialists = agentRegistry.getAllAgents();

  return (
    <div className="min-h-screen bg-[#F4F1DF] text-[#153A52] p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#153A52]/10 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#153A52] text-[#F4F1DF] shadow-md">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#153A52]">
                Multi-Agent Teaming & Collaborative Workspace
              </h1>
              <p className="text-sm text-[#153A52]/70 font-medium">
                Phase 19: Deterministic specialist audits with evidence citation, review gates, and consensus (no LLM agent calls — specialists audit real project data)
              </p>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#153A52]/60">
            Project:
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-1.5 bg-white border border-[#153A52]/20 rounded-lg text-sm font-semibold text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#70C84B]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mt-6 border-b border-[#153A52]/10 pb-2">
        <button
          onClick={() => setActiveTab('console')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'console'
              ? 'bg-[#153A52] text-[#F4F1DF] shadow-sm'
              : 'text-[#153A52]/70 hover:bg-[#153A52]/5'
          }`}
        >
          Coordination Console
        </button>
        <button
          onClick={() => setActiveTab('board')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'board'
              ? 'bg-[#153A52] text-[#F4F1DF] shadow-sm'
              : 'text-[#153A52]/70 hover:bg-[#153A52]/5'
          }`}
        >
          Shared Task Board ({currentRun?.tasks?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'reviews'
              ? 'bg-[#153A52] text-[#F4F1DF] shadow-sm'
              : 'text-[#153A52]/70 hover:bg-[#153A52]/5'
          }`}
        >
          Review Gates & Approvals ({currentRun?.reviews?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('conflicts')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'conflicts'
              ? 'bg-[#153A52] text-[#F4F1DF] shadow-sm'
              : 'text-[#153A52]/70 hover:bg-[#153A52]/5'
          }`}
        >
          Conflicts ({currentRun?.conflicts?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('specialists')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'specialists'
              ? 'bg-[#153A52] text-[#F4F1DF] shadow-sm'
              : 'text-[#153A52]/70 hover:bg-[#153A52]/5'
          }`}
        >
          Specialist Roster (6)
        </button>
      </div>

      {/* Main Content Area */}
      <div className="mt-6">
        {/* TAB: COORDINATION CONSOLE */}
        {activeTab === 'console' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Objective Form */}
              <div className="bg-white p-6 rounded-2xl border border-[#153A52]/10 shadow-sm">
                <h2 className="text-lg font-bold text-[#153A52] mb-2 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#153A52]" />
                  Dispatch Team Initiative
                </h2>
                <p className="text-xs text-[#153A52]/70 mb-4">
                  Define an objective for the autonomous specialist team. Tasks will be formulated in strict DAG order.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#153A52]/60 block mb-1">
                      Initiative Objective
                    </label>
                    <textarea
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-[#F4F1DF]/30 border border-[#153A52]/20 rounded-xl text-sm text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#70C84B]"
                      placeholder="e.g. Audit repository drift against blueprint and verify zero credential leakage before release"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#153A52]/60">
                      <span>Gateway:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        currentRun?.isAiGatewayConnected
                          ? 'bg-[#70C84B]/20 text-[#153A52]'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {currentRun?.isAiGatewayConnected ? 'Gateway reachable (deterministic audits only)' : 'Local deterministic mode'}
                      </span>
                    </div>

                    <button
                      onClick={handleStartCoordination}
                      disabled={isExecuting || !selectedProjectId}
                      className="px-5 py-2.5 bg-[#70C84B] hover:bg-[#60B23E] disabled:opacity-50 text-[#153A52] font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all"
                    >
                      {isExecuting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Coordinating Team...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          Run Team Coordination
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Run Synthesis */}
              {currentRun && (
                <div className="bg-white p-6 rounded-2xl border border-[#153A52]/10 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-[#153A52]/50">
                        Run Synthesis
                      </span>
                      <h3 className="text-lg font-bold text-[#153A52]">
                        {currentRun.objective}
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#153A52] text-[#F4F1DF]">
                      {currentRun.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-sm text-[#153A52]/80 leading-relaxed bg-[#F4F1DF]/40 p-4 rounded-xl border border-[#153A52]/5">
                    {currentRun.synthesis?.consensusSummary || 'No synthesis recorded yet.'}
                  </p>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="p-3 bg-[#F4F1DF]/30 rounded-xl border border-[#153A52]/5 text-center">
                      <div className="text-xl font-bold text-[#153A52]">
                        {currentRun.tasks.filter((t) => t.status === 'completed').length} / {currentRun.tasks.length}
                      </div>
                      <div className="text-[11px] font-semibold text-[#153A52]/60 uppercase tracking-wider">
                        Tasks Resolved
                      </div>
                    </div>
                    <div className="p-3 bg-[#F4F1DF]/30 rounded-xl border border-[#153A52]/5 text-center">
                      <div className="text-xl font-bold text-[#70C84B]">
                        {currentRun.reviews.filter((r) => r.status === 'approved').length}
                      </div>
                      <div className="text-[11px] font-semibold text-[#153A52]/60 uppercase tracking-wider">
                        Automated Checks Passed
                      </div>
                    </div>
                    <div className="p-3 bg-[#F4F1DF]/30 rounded-xl border border-[#153A52]/5 text-center">
                      <div className="text-xl font-bold text-[#EF4444]">
                        {currentRun.conflicts.length}
                      </div>
                      <div className="text-[11px] font-semibold text-[#153A52]/60 uppercase tracking-wider">
                        Conflicts Logged
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Messages Column */}
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-[#153A52]/10 shadow-sm h-full max-h-[600px] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-[#153A52]/10">
                  <h3 className="font-bold text-sm text-[#153A52] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#153A52]/60" />
                    Collaboration Timeline
                  </h3>
                  <span className="text-xs font-semibold text-[#153A52]/50">
                    {currentRun?.messages?.length || 0} event(s)
                  </span>
                </div>

                <div className="overflow-y-auto space-y-3 mt-3 pr-1 flex-1">
                  {currentRun?.messages && currentRun.messages.length > 0 ? (
                    currentRun.messages.map((m) => {
                      const agent = SPECIALIST_AGENTS[m.fromAgentRole];
                      return (
                        <div
                          key={m.id}
                          className="p-3.5 bg-[#F4F1DF]/30 rounded-xl border border-[#153A52]/10 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#153A52] flex items-center gap-1.5">
                              <span>{agent?.avatar || '🤖'}</span>
                              <span>{agent?.name || m.fromAgentRole}</span>
                            </span>
                            <span className="text-[10px] text-[#153A52]/50 font-medium">
                              {new Date(m.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="font-semibold text-[#153A52]">
                            {m.title}
                          </div>
                          <div className="text-[#153A52]/80 leading-relaxed">
                            {m.content}
                          </div>
                          {m.evidenceReferences && m.evidenceReferences.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[#153A52]/10 flex flex-wrap gap-1">
                              {m.evidenceReferences.map((ev, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded text-[10px] bg-white border border-[#153A52]/20 text-[#153A52]/70 font-mono"
                                >
                                  {ev.sourceType}: {ev.idOrPath}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-xs text-[#153A52]/50 font-medium">
                      No collaboration messages recorded. Run an initiative to observe autonomous teaming.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SHARED TASK BOARD */}
        {activeTab === 'board' && (
          <div className="bg-white p-6 rounded-2xl border border-[#153A52]/10 shadow-sm">
            <h2 className="text-lg font-bold text-[#153A52] mb-1">
              Shared Autonomous Task Board
            </h2>
            <p className="text-xs text-[#153A52]/70 mb-6">
              Assigned tasks across specialized agents with dependency constraints and completion status.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['assigned', 'in_progress', 'completed'].map((colStatus) => {
                const tasksInCol = currentRun?.tasks?.filter((t) => t.status === colStatus) || [];
                return (
                  <div key={colStatus} className="bg-[#F4F1DF]/40 p-4 rounded-xl border border-[#153A52]/10">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#153A52]/10">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#153A52]">
                        {colStatus.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 bg-white rounded-full border border-[#153A52]/10">
                        {tasksInCol.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {tasksInCol.map((task) => {
                        const agent = SPECIALIST_AGENTS[task.assignedRole];
                        return (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className="p-3 bg-white rounded-xl border border-[#153A52]/10 shadow-sm hover:border-[#153A52]/30 cursor-pointer transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold flex items-center gap-1.5 text-[#153A52]">
                                <span>{agent?.avatar}</span>
                                <span>{agent?.title}</span>
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-[#F4F1DF] text-[#153A52]">
                                {task.priority}
                              </span>
                            </div>

                            <div className="font-semibold text-xs text-[#153A52]">
                              {task.title}
                            </div>

                            <div className="text-[11px] text-[#153A52]/70 line-clamp-2">
                              {task.outputSummary || task.description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: REVIEWS & APPROVAL GATES */}
        {activeTab === 'reviews' && (
          <div className="bg-white p-6 rounded-2xl border border-[#153A52]/10 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[#153A52]">
              Peer Reviews & Human Signoff Gates
            </h2>
            <p className="text-xs text-[#153A52]/70">
              Cross-role review records. High-impact operations strictly mandate human signoff before execution.
            </p>

            <div className="space-y-3">
              {currentRun?.reviews && currentRun.reviews.length > 0 ? (
                currentRun.reviews.map((rev) => {
                  const proposingAgent = SPECIALIST_AGENTS[rev.proposingRole];
                  const reviewingAgent = SPECIALIST_AGENTS[rev.reviewerRole];
                  return (
                    <div
                      key={rev.id}
                      className="p-4 bg-[#F4F1DF]/30 rounded-xl border border-[#153A52]/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#153A52]">
                            {rev.proposalTitle}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rev.status === 'approved'
                              ? 'bg-[#70C84B]/20 text-[#153A52]'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rev.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-[#153A52]/70">
                          Proposed by <span className="font-semibold">{proposingAgent?.title}</span> • Reviewed by{' '}
                          <span className="font-semibold">{reviewingAgent?.title}</span>
                        </div>
                        <div className="text-xs text-[#153A52]/80 italic">
                          "{rev.verdictReason || 'Awaiting initial evaluation'}"
                        </div>
                      </div>

                      {rev.humanSignoffRequired && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#153A52]/70">
                            Human Signoff:
                          </span>
                          {rev.humanSignoffStatus === 'granted' ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-[#70C84B]">
                              <Check className="w-4 h-4" /> Granted
                            </span>
                          ) : rev.humanSignoffStatus === 'denied' ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-red-600">
                              <X className="w-4 h-4" /> Denied
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleHumanSignoff(rev.id, true)}
                                className="px-3 py-1 bg-[#70C84B] hover:bg-[#60B23E] text-[#153A52] text-xs font-bold rounded-lg transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleHumanSignoff(rev.id, false)}
                                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-xs text-[#153A52]/50">
                  No proposal reviews recorded.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CONFLICTS */}
        {activeTab === 'conflicts' && (
          <div className="bg-white p-6 rounded-2xl border border-[#153A52]/10 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[#153A52]">
              Detected Claim Conflicts
            </h2>
            <p className="text-xs text-[#153A52]/70">
              Contradictions between specialist outputs flagged by the Consensus Engine.
            </p>

            <div className="space-y-4">
              {currentRun?.conflicts && currentRun.conflicts.length > 0 ? (
                currentRun.conflicts.map((conf) => (
                  <div
                    key={conf.id}
                    className="p-4 bg-red-50/50 rounded-xl border border-red-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <h4 className="font-bold text-sm text-red-900">
                          {conf.title}
                        </h4>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">
                        Strategy: {conf.resolutionStrategy.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-red-800/90 leading-relaxed">
                      {conf.conflictDescription}
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-red-200/60">
                      {conf.competingClaims.map((claim, idx) => {
                        const agent = SPECIALIST_AGENTS[claim.agentRole];
                        return (
                          <div key={idx} className="text-xs bg-white/80 p-2.5 rounded-lg border border-red-100">
                            <span className="font-bold text-red-900">
                              {agent?.title}:
                            </span>{' '}
                            <span className="text-red-800/80">{claim.claim}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-xs text-[#153A52]/50 font-medium">
                  Zero contradictions detected in latest run.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: SPECIALIST ROSTER */}
        {activeTab === 'specialists' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {specialists.map((agent) => (
              <div
                key={agent.id}
                className="bg-white p-5 rounded-2xl border border-[#153A52]/10 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F4F1DF] flex items-center justify-center text-xl shadow-inner">
                    {agent.avatar}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#153A52]">
                      {agent.name}
                    </h3>
                    <p className="text-[11px] text-[#153A52]/60 font-semibold">
                      {agent.title}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#153A52]/80 leading-relaxed">
                  {agent.description}
                </p>

                <div className="pt-2 border-t border-[#153A52]/10">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#153A52]/50 block mb-1">
                    Allowed Capabilities
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {agent.allowedCapabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 rounded text-[10px] bg-[#F4F1DF]/60 text-[#153A52] font-semibold"
                      >
                        {cap.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
