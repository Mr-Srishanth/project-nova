import React from 'react';
import { ProjectIdea } from '../../types/domain';
import { NoveltyEngine } from '../../lib/intelligence/noveltyEngine';
import { RESEARCH_AND_OPEN_SOURCE_CORPUS } from '../../data/corpus';
import { Search, ShieldAlert, Sparkles, Zap } from 'lucide-react';

interface NoveltyRadarModuleProps {
  selectedProject?: ProjectIdea;
  onProceedToEvolution: () => void;
}

export const NoveltyRadarModule: React.FC<NoveltyRadarModuleProps> = ({
  selectedProject,
  onProceedToEvolution,
}) => {
  if (!selectedProject) {
    return (
      <div className="p-12 text-center bg-[#1C2420] border border-dashed border-[#303A34] rounded-xl text-[#A5B0A8]">
        Please select a project idea in Module 2 or 3 to inspect its novelty radar.
      </div>
    );
  }

  const noveltyReport = NoveltyEngine.evaluateNovelty(selectedProject, RESEARCH_AND_OPEN_SOURCE_CORPUS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <Search className="w-5 h-5 text-[#10B981]" />
            <span>Module 5: Novelty Intelligence & Prior Art Radar</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Lexical cosine similarity and pattern overlap analysis against indexed research papers and open-source repositories.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <span className="text-xs text-[#A5B0A8] block">Overall Novelty</span>
            <span className="text-base font-mono font-bold text-[#10B981]">
              {noveltyReport.overallNoveltyScore} / 100
            </span>
          </div>
          <div className="text-right pl-3 border-l border-[#303A34]">
            <span className="text-xs text-[#A5B0A8] block">Verdict</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#101713] border border-[#303A34] text-[#F5F7F5]">
              {noveltyReport.noveltyVerdict}
            </span>
          </div>
        </div>
      </div>

      {/* Honest Scientific Limitation Notice */}
      <div className="p-4 bg-[#1C2420] border border-[#303A34] rounded-xl text-xs text-[#A5B0A8] leading-relaxed flex items-start space-x-3">
        <ShieldAlert className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#F5F7F5] block mb-0.5">Scientific Transparency & Assessment Boundaries:</strong>
          {noveltyReport.limitations} Novelty is calculated via TF-IDF cosine distance against {RESEARCH_AND_OPEN_SOURCE_CORPUS.length} benchmarked IEEE and GitHub systems.
        </div>
      </div>

      {/* Prior Art Matches */}
      <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-4">
        <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-[#10B981]" />
            <span>Closest Matching Systems in Prior Art Corpus ({noveltyReport.topSimilarProjects.length})</span>
          </span>
          <span className="text-xs text-[#A5B0A8] font-mono">Method: {noveltyReport.methodUsed}</span>
        </h3>

        <div className="space-y-3">
          {noveltyReport.topSimilarProjects.map((match) => {
            const similarityPercent = Math.round(match.similarityScore * 100);
            return (
              <div
                key={match.sourceProjectId}
                className="p-4 bg-[#101713] border border-[#303A34] rounded-lg space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[#F5F7F5] text-sm">{match.sourceTitle}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1C2420] text-[#A5B0A8] border border-[#303A34]">
                      {match.sourceType}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[#A5B0A8] text-[11px]">Similarity Index:</span>
                    <span className="font-mono font-bold text-[#F5F7F5]">
                      {similarityPercent}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[#A5B0A8]">
                  <div>
                    <span className="text-[#A5B0A8] font-semibold block mb-0.5">Overlapping Patterns:</span>
                    <div className="flex flex-wrap gap-1">
                      {match.commonPatterns.map((p, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-[#1C2420] text-[#A5B0A8] border border-[#303A34] font-mono text-[10px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[#A5B0A8] font-semibold block mb-0.5">Distinguishing Architectural Gaps:</span>
                    <div className="flex flex-wrap gap-1">
                      {match.distinguishingGaps.map((g, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-[#1C2420] text-[#10B981] border border-[#303A34] font-mono text-[10px]">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Differentiation Opportunities */}
      <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-3">
        <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
          <Zap className="w-4 h-4 text-[#10B981]" />
          <span>Strategic Differentiation Opportunities to Boost Novelty</span>
        </h3>
        <p className="text-xs text-[#A5B0A8]">
          Identified architectural vectors that can evolve this idea into a publication-grade or standout portfolio project.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {noveltyReport.differentiationOpportunities.map((diff, i) => (
            <div
              key={i}
              className="p-3 bg-[#101713] border border-[#303A34] rounded-lg text-xs space-y-1.5 text-[#A5B0A8]"
            >
              <div className="text-[#10B981] font-semibold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Strategy Vector {i + 1}</span>
              </div>
              <p className="text-[#A5B0A8] leading-relaxed">{diff}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-end pt-4 border-t border-[#303A34]">
        <button
          onClick={onProceedToEvolution}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#101713] text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Evolve Project with Adaptive Intelligence →</span>
        </button>
      </div>
    </div>
  );
};
