import React, { useState } from 'react';
import { ProjectIdea, StudentProfile } from '../../types/domain';
import { IdeaEvolutionEngine } from '../../lib/intelligence/ideaEvolutionEngine';
import { NoveltyEngine } from '../../lib/intelligence/noveltyEngine';
import { FeasibilityEngine } from '../../lib/intelligence/feasibilityEngine';
import { RESEARCH_AND_OPEN_SOURCE_CORPUS } from '../../data/corpus';
import { Zap, Sparkles } from 'lucide-react';

interface IdeaEvolutionModuleProps {
  currentStudent: StudentProfile;
  selectedProject?: ProjectIdea;
  onProjectEvolved: (evolved: ProjectIdea) => void;
  onProceedToFeasibility: () => void;
}

export const IdeaEvolutionModule: React.FC<IdeaEvolutionModuleProps> = ({
  currentStudent,
  selectedProject,
  onProjectEvolved,
  onProceedToFeasibility,
}) => {
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolvedProject, setEvolvedProject] = useState<ProjectIdea | null>(
    selectedProject?.isEvolved ? selectedProject : null
  );

  if (!selectedProject) {
    return (
      <div className="p-12 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl text-[#A5B0A8]">
        Please select a project idea first to activate adaptive evolution.
      </div>
    );
  }

  const noveltyReport = NoveltyEngine.evaluateNovelty(selectedProject, RESEARCH_AND_OPEN_SOURCE_CORPUS);
  const originalFeasibility = FeasibilityEngine.assess(selectedProject, currentStudent);

  const handleTriggerEvolution = () => {
    setIsEvolving(true);
    setTimeout(() => {
      const evolved = IdeaEvolutionEngine.evolveIdea(selectedProject, currentStudent, noveltyReport);
      setEvolvedProject(evolved);
      onProjectEvolved(evolved);
      setIsEvolving(false);
    }, 600);
  };

  const evolvedFeasibility = evolvedProject ? FeasibilityEngine.assess(evolvedProject, currentStudent) : null;
  const evolvedNovelty = evolvedProject ? NoveltyEngine.evaluateNovelty(evolvedProject, RESEARCH_AND_OPEN_SOURCE_CORPUS) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <Zap className="w-5 h-5 text-[#10B981]" />
            <span>Module 6: Adaptive Idea Evolution Engine</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Upgrades baseline project proposals into highly differentiated architectures using prior-art similarity gaps.
          </p>
        </div>

        <button
          onClick={handleTriggerEvolution}
          disabled={isEvolving}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#101713] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
        >
          {isEvolving ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin text-[#101713]" />
              <span>Applying Innovations...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-[#101713]" />
              <span>{evolvedProject ? 'Re-Evolve Architecture' : 'Synthesize Evolved Variant'}</span>
            </>
          )}
        </button>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original Proposal */}
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#303A34]">
            <span className="text-xs font-mono uppercase tracking-wider text-[#A5B0A8]">Baseline Proposal</span>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-[#A5B0A8]">Novelty:</span>
              <span className="font-mono font-bold text-[#F5F7F5]">{noveltyReport.overallNoveltyScore}%</span>
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold text-[#F5F7F5] mb-1">{selectedProject.title}</h3>
            <p className="text-xs text-[#A5B0A8] italic">"{selectedProject.tagline}"</p>
          </div>

          <div className="space-y-2 text-xs text-[#A5B0A8]">
            <div>
              <strong className="text-[#F5F7F5] block mb-0.5">Problem Formulation:</strong>
              <p className="leading-relaxed">{selectedProject.problemStatement}</p>
            </div>
            <div>
              <strong className="text-[#F5F7F5] block mb-0.5">Proposed Solution:</strong>
              <p className="leading-relaxed">{selectedProject.proposedSolution}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-[#303A34] flex items-center justify-between text-xs">
            <span className="text-[#A5B0A8]">Feasibility Score:</span>
            <span className="font-mono font-bold text-[#10B981]">{originalFeasibility.feasibilityScore}/100</span>
          </div>
        </div>

        {/* Evolved Architecture */}
        <div className={`p-5 rounded-xl border space-y-4 transition-all ${
          evolvedProject
            ? 'bg-[#1C2420] border-[#10B981] shadow-sm'
            : 'bg-[#1C2420]/60 border-dashed border-[#303A34] flex flex-col justify-center items-center text-center'
        }`}>
          {!evolvedProject ? (
            <div className="py-12 space-y-3">
              <Zap className="w-8 h-8 text-[#A5B0A8]/40 mx-auto" />
              <p className="text-sm font-semibold text-[#F5F7F5]">No Evolved Variant Generated Yet</p>
              <p className="text-xs text-[#A5B0A8] max-w-xs">
                Click "Synthesize Evolved Variant" above to address similarity overlaps and integrate technical innovations.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-[#303A34]">
                <span className="text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Adaptive Evolved Architecture</span>
                </span>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-[#A5B0A8]">Boosted Novelty:</span>
                  <span className="font-mono font-bold text-[#10B981]">
                    {evolvedNovelty ? evolvedNovelty.overallNoveltyScore : 88}%
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#F5F7F5] mb-1">
                  {evolvedProject.title}
                </h3>
                <p className="text-xs text-[#10B981] italic">"{evolvedProject.tagline}"</p>
              </div>

              <div className="space-y-2 text-xs text-[#A5B0A8]">
                <div className="p-3 bg-[#101713] rounded-lg border border-[#303A34] text-xs">
                  <strong className="text-[#10B981] block mb-1">Evolution Rationale & Synthesis:</strong>
                  <p className="text-[#F5F7F5] leading-relaxed">{evolvedProject.evolutionSummary}</p>
                </div>

                <div>
                  <strong className="text-[#F5F7F5] block mb-0.5">Augmented Solution:</strong>
                  <p className="leading-relaxed text-[#A5B0A8]">{evolvedProject.proposedSolution}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#303A34] flex items-center justify-between text-xs">
                <span className="text-[#A5B0A8]">Recalculated Feasibility:</span>
                <span className="font-mono font-bold text-[#10B981]">
                  {evolvedFeasibility ? evolvedFeasibility.feasibilityScore : originalFeasibility.feasibilityScore - 4}/100
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-end pt-4 border-t border-[#303A34]">
        <button
          onClick={onProceedToFeasibility}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#101713] text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Audit Implementation Feasibility & Resource Risks →</span>
        </button>
      </div>
    </div>
  );
};
