import React, { useState } from 'react';
import { StudentProfile, ProjectIdea } from '../../types/domain';
import { AIGenerationService } from '../../lib/intelligence/aiGenerationService';
import { Sparkles, BrainCircuit, Lightbulb, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface ProjectGeneratorModuleProps {
  currentStudent: StudentProfile;
  generatedIdeas: ProjectIdea[];
  onIdeasGenerated: (ideas: ProjectIdea[], source: string) => void;
  onSelectProject: (project: ProjectIdea) => void;
  selectedProjectId?: string;
}

export const ProjectGeneratorModule: React.FC<ProjectGeneratorModuleProps> = ({
  currentStudent,
  generatedIdeas,
  onIdeasGenerated,
  onSelectProject,
  selectedProjectId,
}) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generationSource, setGenerationSource] = useState<string>('');

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const res = await AIGenerationService.generateProjectIdeas(currentStudent, customPrompt);
      setGenerationSource(res.source);
      onIdeasGenerated(res.ideas, res.source);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-[#10B981]" />
            <span>Module 2: AI Project Generation Engine</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Synthesizes personalized, constraint-aware project proposals tailored to {currentStudent.name}'s profile.
          </p>
        </div>

        {generationSource && (
          <div className="flex items-center space-x-2 text-xs px-3 py-1.5 rounded-lg border bg-[#1C2420] border-[#303A34]">
            <span className="text-[#A5B0A8]">Inference Source:</span>
            <span className="font-mono font-semibold text-[#10B981]">
              {generationSource}
            </span>
          </div>
        )}
      </div>

      {/* Generation Input Bar */}
      <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-3">
        <label className="block text-xs font-semibold text-[#F5F7F5]">
          Optional Research Focus or Custom Constraint (Leave blank to use full student profile):
        </label>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. Focus on offline edge inference with solar power telemetry or WebAssembly databases"
            className="flex-1 bg-[#101713] border border-[#303A34] rounded-lg px-4 py-2.5 text-xs text-[#F5F7F5] placeholder-[#A5B0A8]/60 focus:outline-none focus:border-[#10B981]"
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#101713] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <BrainCircuit className="w-4 h-4 animate-spin text-[#101713]" />
                <span>Synthesizing Proposals...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#101713]" />
                <span>Run Project Synthesis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Candidate Ideas List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#F5F7F5]">
            Generated Candidate Projects ({generatedIdeas.length})
          </h3>
          <span className="text-xs text-[#A5B0A8]">
            Select a project to examine skill gaps, prior art novelty, and blueprints
          </span>
        </div>

        {generatedIdeas.length === 0 ? (
          <div className="p-12 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl space-y-3">
            <Lightbulb className="w-8 h-8 text-[#A5B0A8]/50 mx-auto" />
            <p className="text-sm text-[#F5F7F5]">No projects generated yet for this session.</p>
            <p className="text-xs text-[#A5B0A8]">
              Click "Run Project Synthesis" above to generate ideas tailored specifically to {currentStudent.name}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {generatedIdeas.map((idea) => {
              const isSelected = selectedProjectId === idea.id;
              return (
                <div
                  key={idea.id}
                  onClick={() => onSelectProject(idea)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1C2420] border-[#10B981] shadow-sm'
                      : 'bg-[#1C2420] border-[#303A34] hover:border-[#3D4A42]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#101713] border border-[#303A34] text-[#10B981]">
                          {idea.domain}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#101713] border border-[#303A34] text-[#A5B0A8]">
                          {idea.complexity}
                        </span>
                        <span className="text-xs text-[#A5B0A8] flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-[#A5B0A8]" />
                          <span>~{idea.estimatedWeeks} weeks</span>
                        </span>
                        {idea.isEvolved && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40">
                            EVOLVED IDEA
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-[#F5F7F5]">
                        {idea.title}
                      </h4>
                      <p className="text-xs text-[#A5B0A8] italic">
                        "{idea.tagline}"
                      </p>
                      <p className="text-xs text-[#A5B0A8] leading-relaxed pt-1">
                        <strong className="text-[#F5F7F5]">Problem: </strong>
                        {idea.problemStatement}
                      </p>
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(idea);
                        }}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#10B981] text-[#101713] border-[#10B981] font-semibold'
                            : 'bg-[#101713] text-[#F5F7F5] border-[#303A34] hover:border-[#10B981]'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#101713]" />
                            <span>Active Project</span>
                          </>
                        ) : (
                          <>
                            <span>Select Project</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#A5B0A8]" />
                          </>
                        )}
                      </button>
                      <span className="text-[11px] text-[#A5B0A8]">
                        Cost: {idea.estimatedCost}
                      </span>
                    </div>
                  </div>

                  {/* Objectives and Architecture Stack */}
                  <div className="mt-4 pt-3 border-t border-[#303A34] grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] font-semibold text-[#A5B0A8] block mb-1">
                        Measurable Target Objectives:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-xs text-[#F5F7F5]">
                        {idea.measurableObjectives.slice(0, 2).map((obj, i) => (
                          <li key={i} className="truncate">{obj}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-[#A5B0A8] block mb-1">
                        Recommended Stack:
                      </span>
                      <div className="flex flex-wrap gap-1 text-[11px] font-mono">
                        <span className="px-2 py-0.5 bg-[#101713] border border-[#303A34] rounded text-[#F5F7F5]">
                          {idea.suggestedStack.frontend}
                        </span>
                        <span className="px-2 py-0.5 bg-[#101713] border border-[#303A34] rounded text-[#F5F7F5]">
                          {idea.suggestedStack.backend}
                        </span>
                        <span className="px-2 py-0.5 bg-[#101713] border border-[#303A34] rounded text-[#10B981]">
                          {idea.suggestedStack.aiOrSpecialized}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
