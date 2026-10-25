import React from 'react';
import { StudentProfile, ProjectIdea } from '../../types/domain';
import { SkillGapEngine } from '../../lib/intelligence/skillGapEngine';
import { Layers, CheckCircle2, AlertCircle, BookOpen, Clock } from 'lucide-react';

interface SkillGapModuleProps {
  currentStudent: StudentProfile;
  selectedProject?: ProjectIdea;
  onProceedToNovelty: () => void;
}

export const SkillGapModule: React.FC<SkillGapModuleProps> = ({
  currentStudent,
  selectedProject,
  onProceedToNovelty,
}) => {
  if (!selectedProject) {
    return (
      <div className="p-12 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl text-[#A5B0A8]">
        Please select a project idea in Module 2 or 3 to inspect its detailed skill gap analysis.
      </div>
    );
  }

  const gap = SkillGapEngine.analyzeGap(currentStudent, selectedProject);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <Layers className="w-5 h-5 text-[#10B981]" />
            <span>Module 4: Skill Gap Intelligence</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Prerequisite matching, learning curves, and estimated hours to build competency for {selectedProject.title}.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <span className="text-xs text-[#A5B0A8] block">Baseline Readiness</span>
            <span className="text-sm font-mono font-bold text-[#10B981]">
              {Math.round(gap.overlapScore * 100)}% Match
            </span>
          </div>
          <div className="text-right pl-3 border-l border-[#303A34]">
            <span className="text-xs text-[#A5B0A8] block">Estimated Ramp-Up</span>
            <span className="text-sm font-mono font-bold text-[#F5F7F5]">
              ~{gap.totalLearningCurveWeeks} Weeks
            </span>
          </div>
        </div>
      </div>

      {/* Summary Diagnostic */}
      <div className="p-4 bg-[#1C2420] border border-[#303A34] rounded-xl text-xs text-[#A5B0A8] leading-relaxed flex items-start space-x-3">
        <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#F5F7F5] block mb-0.5">Automated Gap Diagnostic:</strong>
          {gap.gapSummary}
        </div>
      </div>

      {/* Skills Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Matched Verified Skills */}
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-3">
          <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>Matched Existing Skills ({gap.matchedSkills.length})</span>
          </h3>
          <p className="text-xs text-[#A5B0A8]">
            Skills already mastered by {currentStudent.name} that directly satisfy project prerequisites.
          </p>

          <div className="space-y-2 pt-2">
            {gap.matchedSkills.length === 0 ? (
              <span className="text-xs text-[#A5B0A8] italic">No direct keyword overlap found.</span>
            ) : (
              gap.matchedSkills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center justify-between p-2.5 bg-[#101713] border border-[#303A34] rounded-lg text-xs"
                >
                  <span className="font-mono text-[#10B981] font-semibold">{skill}</span>
                  <span className="text-[11px] text-[#A5B0A8] bg-[#1C2420] px-2 py-0.5 rounded border border-[#303A34]">
                    Ready to Build
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Missing Prerequisites */}
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-3">
          <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#A5B0A8]" />
            <span>Missing Prerequisites & Learning Needs ({gap.missingSkills.length})</span>
          </h3>
          <p className="text-xs text-[#A5B0A8]">
            Required toolchains and concepts that must be onboarded during implementation.
          </p>

          <div className="space-y-2 pt-2">
            {gap.missingSkills.length === 0 ? (
              <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/40 rounded-lg text-xs text-[#10B981]">
                ✓ Full prerequisite coverage! No missing prerequisites required.
              </div>
            ) : (
              gap.missingSkills.map((item) => (
                <div
                  key={item.skill}
                  className="p-3 bg-[#101713] border border-[#303A34] rounded-lg text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#F5F7F5] font-bold">{item.skill}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#1C2420] border border-[#303A34] rounded text-[#A5B0A8]">
                        {item.category}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-[#1C2420] text-[#10B981] border border-[#303A34]">
                        {item.learningDifficulty} Difficulty
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[#A5B0A8] text-[11px] pt-1 border-t border-[#1C2420]">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-[#A5B0A8]" />
                      <span>Est. ~{item.estimatedLearningHours} hours study</span>
                    </span>
                    <span className="flex items-center space-x-1 text-[#F5F7F5] truncate max-w-[200px]">
                      <BookOpen className="w-3 h-3 shrink-0 text-[#10B981]" />
                      <span className="truncate">{item.recommendedResource}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-end pt-4 border-t border-[#303A34]">
        <button
          onClick={onProceedToNovelty}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#101713] text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Evaluate Project Novelty & Prior Art →</span>
        </button>
      </div>
    </div>
  );
};
