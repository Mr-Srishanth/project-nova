import React from 'react';
import { StudentProfile, ProjectIdea } from '../../types/domain';
import { RecommendationEngine } from '../../lib/intelligence/recommendationEngine';
import { BarChart3, Info, Check, AlertTriangle } from 'lucide-react';

interface RecommendationEngineModuleProps {
  currentStudent: StudentProfile;
  candidateProjects: ProjectIdea[];
  selectedProjectId?: string;
  onSelectProject: (project: ProjectIdea) => void;
  onProceedToSkillGap: () => void;
}

export const RecommendationEngineModule: React.FC<RecommendationEngineModuleProps> = ({
  currentStudent,
  candidateProjects,
  selectedProjectId,
  onSelectProject,
  onProceedToSkillGap,
}) => {
  const ranked = RecommendationEngine.rankProjects(candidateProjects, currentStudent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <BarChart3 className="w-5 h-5 text-[#10B981]" />
            <span>Module 3: Explainable Recommendation Engine</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Transparent multi-factor ranking algorithm with visible weight decomposition and reproducible rationale.
          </p>
        </div>

        {/* Weights Legend */}
        <div className="hidden lg:flex items-center space-x-2 text-[11px] bg-[#1C2420] border border-[#303A34] px-3 py-1.5 rounded-lg text-[#A5B0A8]">
          <span className="font-semibold text-[#F5F7F5]">Weights:</span>
          <span>Skill Fit (25%)</span>
          <span>• Interests (25%)</span>
          <span>• Feasibility (20%)</span>
          <span>• Learning (15%)</span>
          <span>• Novelty (15%)</span>
        </div>
      </div>

      {candidateProjects.length === 0 ? (
        <div className="p-12 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl text-[#A5B0A8]">
          Please generate project ideas in Module 2 first.
        </div>
      ) : (
        <div className="space-y-4">
          {ranked.map(({ project, score }, rankIndex) => {
            const isSelected = selectedProjectId === project.id;
            const rankBadge = rankIndex === 0 
              ? 'bg-[#10B981] text-[#101713] font-bold' 
              : 'bg-[#101713] text-[#A5B0A8] border border-[#303A34]';

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className={`p-5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1C2420] border-[#10B981] shadow-sm'
                    : 'bg-[#1C2420] border-[#303A34] hover:border-[#3D4A42]'
                }`}
              >
                {/* Top Banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#303A34]">
                  <div className="flex items-center space-x-3">
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs ${rankBadge}`}>
                      #{rankIndex + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-[#F5F7F5]">
                        {project.title}
                      </h3>
                      <span className="text-xs text-[#A5B0A8]">{project.domain}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-[#10B981]">
                        {score.finalWeightedScore} <span className="text-xs text-[#A5B0A8]">/ 100</span>
                      </div>
                      <span className="text-[10px] text-[#A5B0A8] block uppercase font-mono tracking-wider">
                        Composite Match
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(project);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#10B981] text-[#101713] border-[#10B981] font-semibold'
                          : 'bg-[#101713] text-[#F5F7F5] border-[#303A34] hover:border-[#10B981]'
                      }`}
                    >
                      {isSelected ? 'Active' : 'Select'}
                    </button>
                  </div>
                </div>

                {/* Score Factor Breakdown Progress Bars */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-4">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#A5B0A8]">Skill Fit (25%)</span>
                      <span className="font-mono text-[#10B981] font-semibold">{score.skillFitScore}%</span>
                    </div>
                    <div className="w-full bg-[#101713] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#10B981] h-1.5 rounded-full" style={{ width: `${score.skillFitScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#A5B0A8]">Interests (25%)</span>
                      <span className="font-mono text-[#F5F7F5] font-semibold">{score.interestAlignmentScore}%</span>
                    </div>
                    <div className="w-full bg-[#101713] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#A5B0A8] h-1.5 rounded-full" style={{ width: `${score.interestAlignmentScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#A5B0A8]">Feasibility (20%)</span>
                      <span className="font-mono text-[#10B981] font-semibold">{score.feasibilityScore}%</span>
                    </div>
                    <div className="w-full bg-[#101713] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#10B981] h-1.5 rounded-full" style={{ width: `${score.feasibilityScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#A5B0A8]">Learning (15%)</span>
                      <span className="font-mono text-[#F5F7F5] font-semibold">{score.learningValueScore}%</span>
                    </div>
                    <div className="w-full bg-[#101713] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#A5B0A8] h-1.5 rounded-full" style={{ width: `${score.learningValueScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#A5B0A8]">Novelty (15%)</span>
                      <span className="font-mono text-[#10B981] font-semibold">{score.noveltyScore}%</span>
                    </div>
                    <div className="w-full bg-[#101713] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#10B981] h-1.5 rounded-full" style={{ width: `${score.noveltyScore}%` }} />
                    </div>
                  </div>
                </div>

                {/* Explainable Rationale */}
                <div className="bg-[#101713] p-3.5 rounded-lg border border-[#303A34] space-y-2 text-xs">
                  <div className="font-semibold text-[#F5F7F5] flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Algorithmic Rationale & Multi-Factor Decomposition:</span>
                  </div>
                  <ul className="space-y-1 text-[#A5B0A8] list-disc list-inside">
                    {score.reasoning.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>

                  {/* Pros & Trade-offs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#303A34]">
                    {score.pros.length > 0 && (
                      <div className="flex items-start space-x-1.5 text-[#10B981]">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span><strong className="text-[#F5F7F5]">Advantage: </strong>{score.pros[0]}</span>
                      </div>
                    )}
                    {score.cons.length > 0 && (
                      <div className="flex items-start space-x-1.5 text-[#A5B0A8]">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#A5B0A8]" />
                        <span><strong className="text-[#F5F7F5]">Trade-off: </strong>{score.cons[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex justify-end pt-4 border-t border-[#303A34]">
        <button
          onClick={onProceedToSkillGap}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#101713] text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Examine Detailed Skill Gap Analysis →</span>
        </button>
      </div>
    </div>
  );
};
