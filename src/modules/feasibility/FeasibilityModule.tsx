import React from 'react';
import { ProjectIdea, StudentProfile } from '../../types/domain';
import { FeasibilityEngine } from '../../lib/intelligence/feasibilityEngine';
import { ShieldCheck, Clock, DollarSign, AlertTriangle } from 'lucide-react';

interface FeasibilityModuleProps {
  currentStudent: StudentProfile;
  selectedProject?: ProjectIdea;
  onProceedToBlueprint: () => void;
}

export const FeasibilityModule: React.FC<FeasibilityModuleProps> = ({
  currentStudent,
  selectedProject,
  onProceedToBlueprint,
}) => {
  if (!selectedProject) {
    return (
      <div className="p-12 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl text-[#A5B0A8]">
        Please select a project idea first to review its feasibility audit.
      </div>
    );
  }

  const assessment = FeasibilityEngine.assess(selectedProject, currentStudent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-[#10B981]" />
            <span>Module 7: Feasibility Intelligence & Risk Auditor</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Validates complexity, deadline viability, resource constraints, and critical risk mitigations for {selectedProject.title}.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <span className="text-xs text-[#A5B0A8] block">Feasibility Index</span>
            <span className="text-base font-mono font-bold text-[#10B981]">
              {assessment.feasibilityScore} / 100
            </span>
          </div>
          <div className="text-right pl-3 border-l border-[#303A34]">
            <span className="text-xs text-[#A5B0A8] block">Status Verdict</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
              assessment.verdict === 'Highly Feasible' ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40' :
              assessment.verdict === 'Feasible with Scoping' ? 'bg-[#1C2420] text-[#F5F7F5] border border-[#303A34]' :
              'bg-[#1C2420] text-[#A5B0A8] border border-[#303A34]'
            }`}>
              {assessment.verdict}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Dimension Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1C2420] p-4 rounded-xl border border-[#303A34] space-y-1">
          <span className="text-xs text-[#A5B0A8] flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Estimated Hours</span>
          </span>
          <div className="text-xl font-mono font-bold text-[#F5F7F5]">
            ~{assessment.estimatedHours} <span className="text-xs text-[#A5B0A8] font-sans">hrs</span>
          </div>
          <span className="text-[11px] text-[#A5B0A8] block">
            Over {selectedProject.estimatedWeeks} projected weeks
          </span>
        </div>

        <div className="bg-[#1C2420] p-4 rounded-xl border border-[#303A34] space-y-1">
          <span className="text-xs text-[#A5B0A8] flex items-center space-x-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Projected Cloud Cost</span>
          </span>
          <div className="text-xl font-mono font-bold text-[#F5F7F5]">
            ${assessment.estimatedCostUSD} <span className="text-xs text-[#A5B0A8] font-sans">USD</span>
          </div>
          <span className="text-[11px] text-[#A5B0A8] block">
            Budget tier: {currentStudent.budgetConstraint.split('(')[0]}
          </span>
        </div>

        <div className="bg-[#1C2420] p-4 rounded-xl border border-[#303A34] space-y-1">
          <span className="text-xs text-[#A5B0A8] flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#A5B0A8]" />
            <span>Schedule Viability</span>
          </span>
          <div className="text-sm font-bold pt-1 text-[#10B981]">
            {assessment.timeRisk}
          </div>
          <span className="text-[11px] text-[#A5B0A8] block">
            Target deadline: {currentStudent.targetDeadlineWeeks} weeks
          </span>
        </div>

        <div className="bg-[#1C2420] p-4 rounded-xl border border-[#303A34] space-y-1">
          <span className="text-xs text-[#A5B0A8] flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Complexity Tier</span>
          </span>
          <div className="text-sm font-bold pt-1 text-[#F5F7F5]">
            {assessment.complexityLevel} Complexity
          </div>
          <span className="text-[11px] text-[#A5B0A8] block">
            Level: {currentStudent.academicLevel}
          </span>
        </div>
      </div>

      {/* Technical Dependencies & Mitigations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-3">
          <h3 className="text-sm font-semibold text-[#F5F7F5]">
            Technical Subsystem Dependencies ({assessment.technicalDependencies.length})
          </h3>
          <p className="text-xs text-[#A5B0A8]">
            Runtime stacks that must be configured and hosted without exceeding resource limits.
          </p>

          <div className="space-y-2 pt-1">
            {assessment.technicalDependencies.map((dep, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 bg-[#101713] border border-[#303A34] rounded-lg text-xs"
              >
                <span className="font-mono text-[#10B981] font-semibold">{dep}</span>
                <span className="text-[10px] text-[#A5B0A8] bg-[#1C2420] px-2 py-0.5 rounded border border-[#303A34]">
                  Compatible
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-3">
          <h3 className="text-sm font-semibold text-[#F5F7F5]">
            Pre-emptive Risk Mitigation Playbook
          </h3>
          <p className="text-xs text-[#A5B0A8]">
            Automated architectural guardrails to prevent student project abandonment.
          </p>

          <div className="space-y-2.5 pt-1">
            {assessment.riskMitigations.map((item, i) => (
              <div
                key={i}
                className="p-3 bg-[#101713] border border-[#303A34] rounded-lg text-xs space-y-1"
              >
                <div className="flex items-center space-x-1.5 text-[#F5F7F5] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#10B981]" />
                  <span>Risk: {item.risk}</span>
                </div>
                <p className="text-[#A5B0A8] pl-5 leading-relaxed text-[11px]">
                  <strong className="text-[#10B981]">Mitigation: </strong>{item.mitigation}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-end pt-4 border-t border-[#303A34]">
        <button
          onClick={onProceedToBlueprint}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#101713] text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Generate Implementation Blueprint & DDL Schema →</span>
        </button>
      </div>
    </div>
  );
};
