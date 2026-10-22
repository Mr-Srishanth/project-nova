import React, { useState } from "react";
import {
  Sparkles,
  Check,
  RefreshCw,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  Layers,
  RotateCcw,
  Sliders,
} from "lucide-react";
import type { IdeaUnderstandingResult } from "@/lib/ai/ideaTypes";

interface IdeaReviewPanelProps {
  result: IdeaUnderstandingResult;
  onAcceptAndFill: () => void;
  onRefine: (refinementText: string) => void;
  onReset: () => void;
  isRefining: boolean;
}

export const IdeaReviewPanel: React.FC<IdeaReviewPanelProps> = ({
  result,
  onAcceptAndFill,
  onRefine,
  onReset,
  isRefining,
}) => {
  const [refinementInput, setRefinementInput] = useState("");
  const [showRefineBox, setShowRefineBox] = useState(false);

  const handleRefineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refinementInput.trim()) return;
    onRefine(refinementInput.trim());
    setRefinementInput("");
    setShowRefineBox(false);
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "user_intent":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
            Based on your idea
          </span>
        );
      case "ai_recommendation":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#70C84B]/20 text-[#153A52] border border-[#70C84B]/40">
            AI Recommendation
          </span>
        );
      case "assumption":
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            Assumption to Confirm
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-[#153A52] shadow-md p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#153A52]/10 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#70C84B]/20 text-[#153A52]">
            <Sparkles className="w-5 h-5 text-[#153A52]" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#153A52]/60">
              AI Idea Understanding & Proposals
            </span>
            <h3 className="text-xl font-bold text-[#153A52]">
              {result.suggestedName}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-semibold text-[#153A52]/70 hover:bg-[#F4F1DF] rounded-lg border border-[#153A52]/15 flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Start Over
          </button>
          <button
            type="button"
            onClick={onAcceptAndFill}
            className="px-4 py-2 bg-[#70C84B] hover:bg-[#60B23E] text-[#153A52] text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            Accept & Fill Project Form
          </button>
        </div>
      </div>

      {/* Vague Idea Notice if applicable */}
      {result.isVague && (
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Concept was high-level:</strong> We framed an initial solid direction, but answering the questions below will help lock down the exact architecture.
          </div>
        </div>
      )}

      {/* Grid: What I Understood & Clarified Vision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* What I Understood */}
        <div className="p-4 bg-[#F4F1DF]/40 rounded-xl border border-[#153A52]/10 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#153A52]/70">
            <Lightbulb className="w-4 h-4 text-[#153A52]" />
            What I Understood (Core Intent)
          </div>
          <p className="text-xs text-[#153A52] leading-relaxed font-medium">
            {result.coreIntent}
          </p>
          <div className="pt-2 text-[11px] text-[#153A52]/60">
            <strong>Target Audience:</strong> {result.targetUsers.join(", ")}
          </div>
        </div>

        {/* Your Idea, Clarified */}
        <div className="p-4 bg-[#F4F1DF]/40 rounded-xl border border-[#153A52]/10 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#153A52]/70">
            <Layers className="w-4 h-4 text-[#153A52]" />
            Your Idea, Clarified (Polished Summary)
          </div>
          <p className="text-xs text-[#153A52] leading-relaxed font-medium">
            {result.polishedSummary}
          </p>
          <div className="pt-2 text-[11px] text-[#153A52]/60">
            <strong>Category:</strong> {result.suggestedCategory}
          </div>
        </div>
      </div>

      {/* Recommended 2-Week MVP Scope & Essential Features */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-[#153A52]/70">
          Recommended MVP Scope & Essential Features
        </div>
        <div className="p-4 bg-white rounded-xl border border-[#153A52]/15 space-y-3">
          <div className="text-xs text-[#153A52] font-semibold leading-relaxed">
            {result.recommendedMvpScope}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {result.essentialFeatures.map((feat, i) => (
              <div
                key={i}
                className="text-xs text-[#153A52] flex items-center gap-2 p-2 bg-[#F4F1DF]/30 rounded-lg border border-[#153A52]/10"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#70C84B] shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Suggested Improvements & Proposals */}
      {result.improvements.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[#153A52]/70">
            Proposed Architectural Improvements & Scope
          </div>
          <div className="space-y-2">
            {result.improvements.map((imp) => (
              <div
                key={imp.id}
                className="p-3 bg-white rounded-xl border border-[#153A52]/15 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#153A52]">{imp.title}</span>
                  {getSourceBadge(imp.source)}
                </div>
                <p className="text-[#153A52]/80 leading-relaxed font-sans">
                  {imp.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumptions & Questions for User */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assumptions to Confirm */}
        {result.assumptions.length > 0 && (
          <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Assumptions to Confirm
            </div>
            <ul className="list-disc list-inside text-xs text-amber-950/80 space-y-1">
              {result.assumptions.map((ass, i) => (
                <li key={i}>{ass}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Focused Questions Only When Needed */}
        {result.questionsForUser.length > 0 && (
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-900">
              <HelpCircle className="w-4 h-4 text-blue-700" />
              Questions for You (Affects Architecture)
            </div>
            <div className="space-y-2 pt-1">
              {result.questionsForUser.map((q) => (
                <div key={q.id} className="text-xs text-blue-950 space-y-0.5">
                  <div className="font-semibold">{q.question}</div>
                  <div className="text-[11px] text-blue-800/80 italic">
                    Why it matters: {q.whyItMatters}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggested Technology Stack */}
      {result.suggestedTechnologies.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#153A52]/70">
            Suggested Technology Stack
          </div>
          <div className="flex flex-wrap gap-2">
            {result.suggestedTechnologies.map((tech, i) => (
              <div
                key={i}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#153A52]/15 text-xs text-[#153A52] flex items-center gap-1.5 shadow-sm"
              >
                <span className="font-bold">{tech.tech}</span>
                <span className="text-[10px] text-[#153A52]/60">({tech.layer})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Iterative Refinement Area */}
      <div className="pt-2 border-t border-[#153A52]/10 space-y-3">
        {!showRefineBox ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#153A52]/70 font-semibold">
                Quick Refinements:
              </span>
              {[
                "Make it simpler for a college project",
                "Use free / open-source tech",
                "Make this a mobile app",
                "Include admin dashboard",
              ].map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  disabled={isRefining}
                  onClick={() => onRefine(promptText)}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#153A52] bg-[#F4F1DF] hover:bg-[#F4F1DF]/80 rounded-lg border border-[#153A52]/15 transition-all"
                >
                  "{promptText}"
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowRefineBox(true)}
              className="text-xs font-bold text-[#153A52] hover:underline flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5" />
              Custom Refine...
            </button>
          </div>
        ) : (
          <form onSubmit={handleRefineSubmit} className="space-y-2">
            <label className="text-xs font-bold text-[#153A52] block">
              Provide natural language refinement instructions:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                placeholder="e.g. Reduce scope to 1 week, focus on student collaboration, add OAuth"
                className="flex-1 px-3 py-2 bg-[#F4F1DF]/30 border border-[#153A52]/20 rounded-xl text-xs text-[#153A52] focus:outline-none focus:ring-2 focus:ring-[#70C84B]"
              />
              <button
                type="submit"
                disabled={isRefining || !refinementInput.trim()}
                className="px-4 py-2 bg-[#153A52] hover:bg-[#1f4e6d] disabled:opacity-50 text-[#F4F1DF] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                {isRefining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                Refine
              </button>
              <button
                type="button"
                onClick={() => setShowRefineBox(false)}
                className="px-3 py-2 text-xs font-semibold text-[#153A52]/70 hover:bg-[#F4F1DF] rounded-xl border border-[#153A52]/15"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bottom Accept Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onAcceptAndFill}
          className="px-5 py-2.5 bg-[#70C84B] hover:bg-[#60B23E] text-[#153A52] text-sm font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          Accept & Fill Project Form
        </button>
      </div>
    </div>
  );
};
