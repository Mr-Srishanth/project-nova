import React, { useState } from 'react';
import { ProjectIdea, StudentProfile, EvaluationComparison } from '../../types/domain';
import { StorageService } from '../../lib/storage/storageService';
import { RecommendationEngine } from '../../lib/intelligence/recommendationEngine';
import { FolderGit2, Trash2, ArrowUpRight, BarChart2, Star, Download } from 'lucide-react';

interface ProjectWorkspaceModuleProps {
  currentStudent: StudentProfile;
  savedProjects: ProjectIdea[];
  onSelectProject: (project: ProjectIdea) => void;
  onRemoveProject: (projectId: string) => void;
}

export const ProjectWorkspaceModule: React.FC<ProjectWorkspaceModuleProps> = ({
  currentStudent,
  savedProjects,
  onSelectProject,
  onRemoveProject,
}) => {
  const [evaluations, setEvaluations] = useState<EvaluationComparison[]>(StorageService.getEvaluations());

  const handleRunEvaluationBenchmark = (project: ProjectIdea) => {
    const result = RecommendationEngine.evaluateAgainstBaselines(project, currentStudent);
    StorageService.saveEvaluation(result);
    setEvaluations(StorageService.getEvaluations());
  };

  const handleRateSatisfaction = (projectTitle: string, rating: number) => {
    const existing = evaluations.find(e => e.projectTitle === projectTitle);
    if (existing) {
      existing.studentSatisfactionRating = rating;
      StorageService.saveEvaluation(existing);
      setEvaluations([...StorageService.getEvaluations()]);
    }
  };

  const handleExportWorkspaceJson = () => {
    const bundle = {
      student: currentStudent,
      savedProjects,
      evaluations,
      exportedAt: new Date().toISOString(),
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `projectnova_${currentStudent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_workspace.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <FolderGit2 className="w-5 h-5 text-[#10B981]" />
            <span>Module 10: Project Workspace & Innovation Evaluation</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Persisted projects, multi-idea side-by-side comparison, and empirical recommendation quality evaluation against baselines.
          </p>
        </div>

        <button
          onClick={handleExportWorkspaceJson}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1C2420] hover:bg-[#242E28] border border-[#303A34] text-xs font-medium text-[#F5F7F5] transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#10B981]" />
          <span>Export Full Workspace Bundle</span>
        </button>
      </div>

      {/* Saved Projects Gallery */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center justify-between">
          <span>Saved Projects Portfolio ({savedProjects.length})</span>
          <span className="text-xs text-[#A5B0A8] font-normal">Stored in browser local persistence adapter</span>
        </h3>

        {savedProjects.length === 0 ? (
          <div className="p-8 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl text-xs text-[#A5B0A8]">
            No projects saved to your portfolio yet. Generate ideas and click "Save Project" from any candidate card.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedProjects.map((p) => {
              const evalRecord = evaluations.find(e => e.projectTitle === p.title);

              return (
                <div
                  key={p.id}
                  className="p-5 bg-[#1C2420] border border-[#303A34] rounded-xl space-y-3 text-xs hover:border-[#3D4A42] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#101713] text-[#10B981] border border-[#303A34]">
                          {p.domain}
                        </span>
                        {p.isEvolved && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40">
                            EVOLVED
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-[#F5F7F5]">{p.title}</h4>
                      <p className="text-[11px] text-[#A5B0A8] italic">"{p.tagline}"</p>
                    </div>

                    <button
                      onClick={() => onRemoveProject(p.id)}
                      className="text-[#A5B0A8] hover:text-[#F5F7F5] p-1.5 rounded transition-colors cursor-pointer"
                      title="Remove from saved"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-[#A5B0A8] leading-relaxed line-clamp-2">
                    {p.proposedSolution}
                  </p>

                  <div className="pt-2 border-t border-[#303A34] flex items-center justify-between">
                    <button
                      onClick={() => onSelectProject(p)}
                      className="flex items-center space-x-1 text-[#10B981] hover:text-[#059669] font-semibold cursor-pointer"
                    >
                      <span>Open in Studio</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleRunEvaluationBenchmark(p)}
                      className="px-2.5 py-1 rounded bg-[#101713] hover:bg-[#242E28] border border-[#303A34] text-[11px] text-[#F5F7F5] font-mono transition-colors cursor-pointer"
                    >
                      {evalRecord ? 'Re-Evaluate Baselines' : 'Run Baseline Benchmark'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Experimental Baseline Evaluation */}
      <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
            <BarChart2 className="w-4 h-4 text-[#10B981]" />
            <span>Empirical Evaluation: ProjectNova Multi-Factor Model vs. Baselines</span>
          </h3>
          <p className="text-xs text-[#A5B0A8] mt-0.5">
            Demonstrates reproducible recommendation accuracy comparison between ProjectNova's constraint-aware scoring, a Keyword baseline, and Random baseline.
          </p>
        </div>

        {evaluations.length === 0 ? (
          <div className="p-6 text-center bg-[#101713] border border-[#303A34] rounded-lg text-xs text-[#A5B0A8]">
            Click "Run Baseline Benchmark" on any saved project card above to compute reproducible delta metrics.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#303A34] text-[#A5B0A8] font-semibold">
                  <th className="py-2.5 px-3">Project Title</th>
                  <th className="py-2.5 px-3 text-[#10B981]">ProjectNova Score</th>
                  <th className="py-2.5 px-3 text-[#A5B0A8]">Keyword Baseline</th>
                  <th className="py-2.5 px-3 text-[#A5B0A8]">Random Baseline</th>
                  <th className="py-2.5 px-3 text-[#10B981]">Skill Alignment Δ</th>
                  <th className="py-2.5 px-3 text-[#F5F7F5]">Novelty Boost Δ</th>
                  <th className="py-2.5 px-3 text-right">Student Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303A34]">
                {evaluations.map((item, i) => (
                  <tr key={i} className="hover:bg-[#101713]/50">
                    <td className="py-2.5 px-3 font-semibold text-[#F5F7F5] truncate max-w-[200px]">
                      {item.projectTitle}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#10B981]">
                      {item.projectNovaScore} / 100
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#A5B0A8]">
                      {item.baselineKeywordScore} / 100
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#A5B0A8]">
                      {item.baselineRandomScore} / 100
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#10B981] font-bold">
                      +{item.skillAlignmentDelta}%
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#F5F7F5] font-bold">
                      +{item.noveltyDelta}%
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRateSatisfaction(item.projectTitle, star)}
                            className={`p-0.5 transition-colors cursor-pointer ${
                              (item.studentSatisfactionRating || 5) >= star
                                ? 'text-[#10B981]'
                                : 'text-[#303A34] hover:text-[#A5B0A8]'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
