import React, { useState } from 'react';
import { ProjectIdea, StudentProfile, RoadmapMilestone } from '../../types/domain';
import { SkillGapEngine } from '../../lib/intelligence/skillGapEngine';
import { RoadmapEngine } from '../../lib/intelligence/roadmapEngine';
import { StorageService } from '../../lib/storage/storageService';
import { Milestone, CheckCircle2, BookOpen } from 'lucide-react';

interface AdaptiveRoadmapModuleProps {
  currentStudent: StudentProfile;
  selectedProject?: ProjectIdea;
  onProceedToWorkspace: () => void;
}

export const AdaptiveRoadmapModule: React.FC<AdaptiveRoadmapModuleProps> = ({
  currentStudent,
  selectedProject,
  onProceedToWorkspace,
}) => {
  if (!selectedProject) {
    return (
      <div className="p-12 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl text-[#A5B0A8]">
        Please select a project idea first to generate its adaptive roadmap.
      </div>
    );
  }

  const gapReport = SkillGapEngine.analyzeGap(currentStudent, selectedProject);
  
  const initialRoadmap = StorageService.getRoadmap(selectedProject.id) || 
    RoadmapEngine.generateRoadmap(selectedProject, currentStudent, gapReport);

  const [roadmap, setRoadmap] = useState<RoadmapMilestone[]>(initialRoadmap);

  const handleToggleStatus = (id: string) => {
    const updated = roadmap.map(m => {
      if (m.id === id) {
        const nextStatus: RoadmapMilestone['status'] = 
          m.status === 'pending' ? 'in_progress' :
          m.status === 'in_progress' ? 'completed' : 'pending';
        return { ...m, status: nextStatus };
      }
      return m;
    });
    setRoadmap(updated);
    StorageService.saveRoadmap(selectedProject.id, updated);
  };

  const completedCount = roadmap.filter(m => m.status === 'completed').length;
  const progressPercent = Math.round((completedCount / roadmap.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <Milestone className="w-5 h-5 text-[#10B981]" />
            <span>Module 9: Adaptive Learning & Implementation Roadmap</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Personalized sequence of skill acquisition, core implementation, and verification gates for {selectedProject.title}.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <span className="text-xs text-[#A5B0A8] block">Roadmap Velocity</span>
            <span className="text-sm font-mono font-bold text-[#10B981]">
              {completedCount} / {roadmap.length} Milestones ({progressPercent}%)
            </span>
          </div>
          <div className="w-24 bg-[#101713] rounded-full h-2 overflow-hidden border border-[#303A34]">
            <div className="bg-[#10B981] h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="relative border-l-2 border-[#303A34] ml-4 md:ml-6 space-y-6 pb-4">
        {roadmap.map((m, idx) => {
          const isDone = m.status === 'completed';
          const isInProgress = m.status === 'in_progress';

          return (
            <div key={m.id} className="relative pl-6 md:pl-8">
              {/* Timeline Bullet Node */}
              <button
                onClick={() => handleToggleStatus(m.id)}
                className={`absolute -left-[13px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors cursor-pointer ${
                  isDone ? 'bg-[#10B981] border-[#10B981] text-[#101713]' :
                  isInProgress ? 'bg-[#1C2420] border-[#10B981] text-[#10B981]' :
                  'bg-[#101713] border-[#303A34] text-[#A5B0A8]'
                }`}
                title="Click to toggle milestone state"
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#101713]" />
                ) : (
                  <span className="text-[10px] font-bold">{idx + 1}</span>
                )}
              </button>

              {/* Milestone Card */}
              <div className={`p-5 rounded-xl border transition-all ${
                isDone ? 'bg-[#1C2420]/80 border-[#303A34] opacity-80' :
                isInProgress ? 'bg-[#1C2420] border-[#10B981] shadow-sm' :
                'bg-[#1C2420] border-[#303A34]'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#303A34]">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-[#10B981]">Week {m.weekNumber}</span>
                    <span className="text-[#303A34]">•</span>
                    <span className="text-xs font-medium text-[#F5F7F5]">{m.type}</span>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(m.id)}
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider transition-colors cursor-pointer ${
                      isDone ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40' :
                      isInProgress ? 'bg-[#101713] text-[#10B981] border-[#10B981]' :
                      'bg-[#101713] text-[#A5B0A8] border-[#303A34]'
                    }`}
                  >
                    {m.status.replace('_', ' ')}
                  </button>
                </div>

                <h3 className="text-sm font-bold text-[#F5F7F5] mt-2 mb-1">{m.title}</h3>

                <div className="space-y-3 mt-3 text-xs">
                  <div>
                    <span className="text-[#A5B0A8] font-semibold block mb-1">Learning & Skill Objectives:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-[#A5B0A8]">
                      {m.learningObjectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-[#101713] rounded-lg border border-[#303A34] space-y-1">
                    <span className="text-[#10B981] font-semibold block">Concrete Deliverable:</span>
                    <p className="text-[#F5F7F5] leading-relaxed">{m.implementationDeliverable}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#303A34] text-[11px]">
                    <span className="text-[#A5B0A8]">
                      <strong className="text-[#F5F7F5]">Verification Gate: </strong>{m.verificationCriteria}
                    </span>
                    <div className="flex items-center space-x-2 shrink-0">
                      {m.resources.map((res, i) => (
                        <span key={i} className="text-[#10B981] flex items-center space-x-1">
                          <BookOpen className="w-3 h-3 text-[#10B981]" />
                          <span>{res.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-end pt-4 border-t border-[#303A34]">
        <button
          onClick={onProceedToWorkspace}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#101713] text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Open Saved Projects & Experimental Evaluation →</span>
        </button>
      </div>
    </div>
  );
};
