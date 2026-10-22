import React, { useState } from "react";
import {
  HelpCircle,
  Sparkles,
  Check,
  ChevronRight,
  ThumbsUp,
} from "lucide-react";
import type { ClarificationQuestion, UserConfirmedDecision } from "@/types/discovery";
import { Button } from "@/components/ui/Button";

interface ClarificationInterviewPanelProps {
  questions: ClarificationQuestion[];
  onConfirmAnswer: (questionId: string, answer: string, source: UserConfirmedDecision["source"]) => void;
  onSkipQuestion: (questionId: string) => void;
  onProceedToSpecification: () => void;
  isAnalyzing?: boolean;
}

export const ClarificationInterviewPanel: React.FC<ClarificationInterviewPanelProps> = ({
  questions,
  onConfirmAnswer,
  onSkipQuestion,
  onProceedToSpecification,
}) => {
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [activeRecommendationId, setActiveRecommendationId] = useState<string | null>(null);

  const answeredCount = questions.filter((q) => q.status === "confirmed" || q.status === "answered").length;
  const allAnsweredOrSkipped = questions.every((q) => q.status === "confirmed" || q.status === "answered");

  return (
    <div className="bg-surface border-2 border-border rounded-tactile p-6 shadow-hard space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/20 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-tactile bg-[#70C84B]/20 border border-[#70C84B]/40 text-[#153A52]">
            <HelpCircle className="w-5 h-5 text-[#153A52]" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Section B • Adaptive Clarification Interview
            </span>
            <h3 className="text-lg font-display font-bold text-foreground">
              Architecture & Strategy Decisions ({answeredCount}/{questions.length} Decided)
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onProceedToSpecification}
            icon={<ChevronRight className="w-4 h-4" />}
          >
            {allAnsweredOrSkipped ? "Review Specification Form" : "Skip to Form"}
          </Button>
        </div>
      </div>

      <p className="text-xs font-sans text-foreground-muted leading-relaxed">
        ProjectNova AI identified a few consequential technical decisions for your application. You can pick an option, enter your own thoughts, or ask AI for a sensible recommendation.
      </p>

      {/* Questions Stack */}
      <div className="space-y-5">
        {questions.map((q, idx) => {
          const isConfirmed = q.status === "confirmed" || q.status === "answered";
          const isShowingRec = activeRecommendationId === q.id || q.status === "recommended";

          return (
            <div
              key={q.id}
              className={`p-4 rounded-tactile border-2 transition-all ${
                isConfirmed
                  ? "bg-[#FAF7ED] border-[#70C84B]/60 shadow-xs"
                  : "bg-surface border-border shadow-hard-sm"
              }`}
            >
              {/* Question Label */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-muted border border-border text-foreground">
                      Decision {idx + 1}
                    </span>
                    <span className="text-[11px] font-mono text-foreground-muted capitalize">
                      [{q.category}]
                    </span>
                    {q.isOptional && (
                      <span className="text-[10px] font-mono text-muted-foreground">(Optional)</span>
                    )}
                  </div>
                  <h4 className="text-sm font-display font-bold text-foreground">
                    {q.question}
                  </h4>
                  <p className="text-xs font-sans text-foreground-muted">
                    {q.plainLanguageExplanation}
                  </p>
                </div>

                {isConfirmed && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded shrink-0">
                    <Check className="w-3 h-3 text-emerald-700" />
                    Decided
                  </span>
                )}
              </div>

              {/* Confirmed State Summary */}
              {isConfirmed ? (
                <div className="mt-3 p-3 bg-white rounded border border-border/80 flex items-center justify-between gap-2">
                  <div className="text-xs font-sans text-foreground">
                    <span className="text-foreground-muted font-mono block text-[10px] uppercase font-bold">
                      Your Selected Approach:
                    </span>
                    <strong className="text-primary">{q.selectedOption || q.customAnswer}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSkipQuestion(q.id)}
                    className="text-xs text-muted-foreground hover:text-foreground underline font-mono shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Unanswered Question Controls */
                <div className="mt-3 space-y-3">
                  {/* Predefined Options */}
                  <div className="grid grid-cols-1 gap-2">
                    {q.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => onConfirmAnswer(q.id, opt, "user_answered")}
                        className="text-left p-2.5 rounded bg-white hover:bg-[#FAF7ED] border border-border text-xs font-sans text-foreground transition-colors flex items-center justify-between group"
                      >
                        <span>{opt}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-foreground-muted group-hover:text-foreground opacity-60 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>

                  {/* AI Recommendation Trigger / Card */}
                  {q.recommendation && (
                    <div className="pt-1">
                      {!isShowingRec ? (
                        <button
                          type="button"
                          onClick={() => setActiveRecommendationId(q.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-primary hover:underline py-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Not sure? Show AI Recommendation</span>
                        </button>
                      ) : (
                        <div className="p-3 bg-accent-yellow-soft/50 border border-accent-yellow rounded space-y-2 text-xs font-sans animate-fadeIn">
                          <div className="flex items-center gap-1.5 text-foreground font-display font-bold">
                            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>Recommended: {q.recommendation.suggestedAnswer}</span>
                          </div>
                          <p className="text-foreground-muted leading-relaxed">
                            {q.recommendation.explanation}
                          </p>
                          {q.recommendation.tradeoffs && (
                            <div className="text-[11px] font-mono text-foreground-muted/80 bg-white/60 p-1.5 rounded">
                              <strong>Trade-offs:</strong> {q.recommendation.tradeoffs}
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                onConfirmAnswer(q.id, q.recommendation!.suggestedAnswer, "ai_recommendation_accepted")
                              }
                              className="px-3 py-1 bg-primary text-primary-foreground font-bold rounded text-xs shadow-2xs hover:bg-primary/90 flex items-center gap-1"
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>Accept Recommendation</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveRecommendationId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground underline px-2 py-1"
                            >
                              Hide
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Answer Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Or enter custom answer..."
                      value={customAnswers[q.id] || ""}
                      onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customAnswers[q.id]?.trim()) {
                          onConfirmAnswer(q.id, customAnswers[q.id].trim(), "user_answered");
                        }
                      }}
                      className="flex-1 bg-white border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-sans"
                    />
                    {customAnswers[q.id]?.trim() && (
                      <button
                        type="button"
                        onClick={() => onConfirmAnswer(q.id, customAnswers[q.id].trim(), "user_answered")}
                        className="px-3 py-1.5 bg-foreground text-surface rounded text-xs font-semibold shrink-0"
                      >
                        Submit
                      </button>
                    )}
                    {q.isOptional && (
                      <button
                        type="button"
                        onClick={() => onSkipQuestion(q.id)}
                        className="text-xs font-mono text-muted-foreground hover:text-foreground px-2 py-1"
                      >
                        Skip
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Proceed Button */}
      <div className="pt-4 border-t border-border/20 flex items-center justify-between">
        <span className="text-xs font-mono text-foreground-muted">
          {answeredCount} of {questions.length} decisions resolved
        </span>
        <Button
          onClick={onProceedToSpecification}
          icon={<ChevronRight className="w-4 h-4" />}
        >
          Proceed to Project Specification
        </Button>
      </div>
    </div>
  );
};
