import React from "react";
import { DiffEditor } from "@monaco-editor/react";
import { Sparkles, Check, X, RotateCcw, Loader2 } from "lucide-react";
import { inferMonacoLanguage } from "./MonacoCodeEditor";

export interface AIContinuationProposal {
  filePath: string;
  originalText: string;
  proposedText: string;
  continuationSnippet: string;
  summary: string;
  intent: "continuation" | "next_step";
  insertionRange?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null;
}

interface AIContinueCodeDiffModalProps {
  proposal: AIContinuationProposal;
  isGenerating: boolean;
  errorMessage?: string | null;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}

export const AIContinueCodeDiffModal: React.FC<AIContinueCodeDiffModalProps> = ({
  proposal,
  isGenerating,
  errorMessage,
  onAccept,
  onReject,
  onRegenerate,
}) => {
  const lang = inferMonacoLanguage(proposal.filePath);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1e1e1e] border-2 border-border shadow-2xl rounded-tactile w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden text-gray-200 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#252526] border-b border-[#2d2d2d] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-emerald-950/60 border border-emerald-600/50 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">AI Continue Code Proposal</span>
                <span className="text-[11px] font-mono text-gray-400 px-2 py-0.5 rounded bg-[#1e1e1e] border border-[#333]">
                  {proposal.filePath}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    proposal.intent === "next_step"
                      ? "bg-amber-950/50 text-amber-400 border border-amber-800"
                      : "bg-emerald-950/50 text-emerald-400 border border-emerald-800"
                  }`}
                >
                  {proposal.intent === "next_step" ? "Next Step" : "Continuation"}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{proposal.summary}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#383838] text-gray-200 rounded text-xs font-bold transition-colors disabled:opacity-50"
              title="Regenerate proposal"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
              <span>Regenerate</span>
            </button>

            <button
              onClick={onReject}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-xs font-bold transition-colors disabled:opacity-50"
              title="Discard continuation"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>

            <button
              onClick={onAccept}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#007acc] hover:bg-[#0062a3] text-white rounded text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
              title="Accept and insert proposed code"
            >
              <Check className="w-4 h-4" />
              <span>Accept Continuation</span>
            </button>
          </div>
        </div>

        {/* Diff Banner Info */}
        <div className="px-4 py-2 bg-[#181818] border-b border-[#2d2d2d] flex items-center justify-between text-xs font-mono text-gray-400 shrink-0">
          <div className="flex items-center gap-4">
            <span>Original (Left) vs Proposed with Continuation (Right)</span>
          </div>
          <span className="text-[11px] text-gray-500">
            Click Accept to apply changes to the editor document
          </span>
        </div>

        {/* Error message if any */}
        {errorMessage && (
          <div className="px-4 py-2 bg-rose-950/70 text-rose-300 border-b border-rose-800 text-xs font-mono">
            {errorMessage}
          </div>
        )}

        {/* Diff Editor Container */}
        <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm font-semibold text-white">Generating code continuation…</p>
              <p className="text-xs text-gray-500">Grounded in file prefix, syntax structure, and project context</p>
            </div>
          ) : (
            <DiffEditor
              height="100%"
              width="100%"
              original={proposal.originalText}
              modified={proposal.proposedText}
              language={lang}
              theme="vs-dark"
              options={{
                readOnly: true,
                renderSideBySide: true,
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                diffWordWrap: "on",
                renderIndicators: true,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
