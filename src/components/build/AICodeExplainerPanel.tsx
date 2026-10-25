import React, { useState } from "react";
import {
  BookOpen,
  Baby,
  BrainCircuit,
  X,
  Copy,
  Check,
  RotateCw,
  ExternalLink,
  ChevronDown,
  Layers,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  FileCode,
  Box,
} from "lucide-react";
import type {
  CodeExplanationResult,
  CodeExplainerMode,
} from "@/types/codeExplainer";

interface AICodeExplainerPanelProps {
  explanation: CodeExplanationResult | null;
  mode: CodeExplainerMode;
  isLoading: boolean;
  errorMessage: string | null;
  filePath: string;
  isSelectionActive?: boolean;
  onModeChange: (newMode: CodeExplainerMode) => void;
  onReexplain: () => void;
  onNavigateToLine: (startLine: number, endLine?: number) => void;
  onClose: () => void;
}

export const AICodeExplainerPanel: React.FC<AICodeExplainerPanelProps> = ({
  explanation,
  mode,
  isLoading,
  errorMessage,
  filePath,
  isSelectionActive = false,
  onModeChange,
  onReexplain,
  onNavigateToLine,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCopyExplanation = async () => {
    if (!explanation) return;
    try {
      const formatted = `=== ProjectNova Code Explanation (${explanation.mode.toUpperCase()}) ===
File: ${explanation.fileName}

--- AT A GLANCE ---
${explanation.atAGlance}

--- HOW IT WORKS ---
${explanation.howItWorks.map((s) => `${s.step}. ${s.title}: ${s.explanation} (Lines ${s.lines || "N/A"})`).join("\n")}

--- CODE BREAKDOWN ---
${explanation.breakdown.map((b) => `• [${b.kind.toUpperCase()}] ${b.name}: ${b.summary || b.simpleExplanation} (Lines ${b.lines || "N/A"})`).join("\n")}

--- EXAMPLE ---
${explanation.example ? `${explanation.example.scenario}\n${explanation.example.walkthrough}` : "N/A"}

--- THINGS TO NOTICE ---
${explanation.thingsToNotice.join("\n• ")}
`;
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const parseLineRange = (lineStr?: string): { start: number; end?: number } | null => {
    if (!lineStr) return null;
    const parts = lineStr.split("-").map((p) => parseInt(p.trim(), 10));
    if (parts.length > 0 && !isNaN(parts[0])) {
      return { start: parts[0], end: parts.length > 1 && !isNaN(parts[1]) ? parts[1] : undefined };
    }
    return null;
  };

  const fileName = filePath.split("/").pop() || filePath;

  return (
    <div className="flex flex-col h-full bg-[#181a20] border-l border-white/10 text-zinc-100 select-text overflow-hidden transition-all duration-200">
      {/* 1. Header Toolbar */}
      <div className="p-3 bg-[#13151b] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-bold tracking-wide text-zinc-100 truncate flex items-center gap-1.5">
              <span>Code Explainer</span>
              {isSelectionActive && (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                  Selection
                </span>
              )}
            </h3>
            <span className="text-[10px] text-zinc-400 font-mono truncate block" title={filePath}>
              {fileName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Copy Explanation */}
          <button
            type="button"
            onClick={handleCopyExplanation}
            disabled={!explanation || isLoading}
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-white/5 transition-colors disabled:opacity-40"
            title="Copy Explanation Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Re-explain */}
          <button
            type="button"
            onClick={onReexplain}
            disabled={isLoading}
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-white/5 transition-colors disabled:opacity-40"
            title="Re-explain file"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          <div className="h-3.5 w-px bg-white/10 mx-1" />

          {/* Close Panel */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-white/5 transition-colors"
            title="Close Explainer Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Mode Selector: ELI5 vs Normal */}
      <div className="p-2 bg-[#101217] border-b border-white/10 shrink-0">
        <div className="grid grid-cols-2 gap-1.5 bg-[#181a20] p-1 rounded-md border border-white/10">
          <button
            type="button"
            onClick={() => onModeChange("eli5")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition-all ${
              mode === "eli5"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-2xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            <Baby className="w-3.5 h-3.5" />
            <span>ELI5 (Beginner)</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("normal")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition-all ${
              mode === "normal"
                ? "bg-primary text-white border border-primary/50 shadow-2xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Normal (Technical)</span>
          </button>
        </div>
      </div>

      {/* 3. Panel Body: Content, Loading, or Errors */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3.5">
        {/* Loading State */}
        {isLoading && (
          <div className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-200">
                {mode === "eli5" ? "Cooking up a super-simple explanation…" : "Analyzing architecture & execution flow…"}
              </p>
              <p className="text-[11px] text-zinc-400">
                Synthesizing {isSelectionActive ? "selected code" : fileName} using Gemini AI.
              </p>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {!isLoading && errorMessage && (
          <div className="p-3 bg-red-500/10 text-red-300 border border-red-500/30 rounded-md text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Failed to explain code</span>
            </div>
            <p className="text-[11px] leading-relaxed text-red-200/90">{errorMessage}</p>
            <button
              type="button"
              onClick={onReexplain}
              className="mt-1 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded border border-red-500/40 text-[11px] font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Successful Explanation */}
        {!isLoading && explanation && (
          <div className="space-y-3.5 text-xs">
            {/* Section 1: At a Glance */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold uppercase tracking-wider text-[10px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>At A Glance</span>
              </div>
              <p className="text-zinc-200 leading-relaxed text-xs">
                {explanation.atAGlance}
              </p>
            </div>

            {/* Section 2: How It Works (Collapsible) */}
            <div className="border border-white/10 rounded-md bg-[#12141a] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("howItWorks")}
                className="w-full p-2.5 bg-white/5 flex items-center justify-between text-left text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>How It Works ({explanation.howItWorks.length} Steps)</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                    collapsedSections["howItWorks"] ? "-rotate-90" : ""
                  }`}
                />
              </button>

              {!collapsedSections["howItWorks"] && (
                <div className="p-3 space-y-2.5 divide-y divide-white/5">
                  {explanation.howItWorks.map((step) => {
                    const range = parseLineRange(step.lines);
                    return (
                      <div key={step.step} className="pt-2.5 first:pt-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold">
                              {step.step}
                            </span>
                            {step.title}
                          </span>

                          {range && (
                            <button
                              type="button"
                              onClick={() => onNavigateToLine(range.start, range.end)}
                              className="text-[10px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-0.5 hover:underline shrink-0"
                              title={`Jump to line ${step.lines} in editor`}
                            >
                              <span>Lines {step.lines}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-zinc-300 text-[11px] leading-relaxed pl-5">
                          {step.explanation}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Code Breakdown (Collapsible) */}
            <div className="border border-white/10 rounded-md bg-[#12141a] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("breakdown")}
                className="w-full p-2.5 bg-white/5 flex items-center justify-between text-left text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Code Breakdown ({explanation.breakdown.length} items)</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                    collapsedSections["breakdown"] ? "-rotate-90" : ""
                  }`}
                />
              </button>

              {!collapsedSections["breakdown"] && (
                <div className="p-3 space-y-3">
                  {explanation.breakdown.map((item, idx) => {
                    const range = parseLineRange(item.lines);
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded bg-black/25 border border-white/10 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono font-bold text-xs text-amber-300 truncate">
                              {item.name}
                            </span>
                            <span className="text-[9px] uppercase px-1 py-0.2 bg-white/10 text-zinc-400 rounded shrink-0">
                              {item.kind}
                            </span>
                          </div>

                          {range && (
                            <button
                              type="button"
                              onClick={() => onNavigateToLine(range.start, range.end)}
                              className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-0.5 hover:underline shrink-0"
                              title={`Jump to line ${item.lines} in editor`}
                            >
                              <span>Lines {item.lines}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>

                        {/* ELI5 Content */}
                        {mode === "eli5" ? (
                          <div className="space-y-1 text-[11px]">
                            <p className="text-zinc-300 leading-relaxed">
                              {item.simpleExplanation || item.summary}
                            </p>
                            {item.analogy && (
                              <div className="p-1.5 bg-amber-500/10 rounded border border-amber-500/20 text-amber-200 flex items-start gap-1.5 text-[10px]">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <span>{item.analogy}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Normal Content */
                          <div className="space-y-1 text-[11px]">
                            <p className="text-zinc-200 leading-relaxed font-medium">
                              {item.summary || item.simpleExplanation}
                            </p>
                            {item.details && (
                              <p className="text-zinc-400 leading-relaxed text-[10px]">
                                {item.details}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 4: Example Scenario (Collapsible) */}
            {explanation.example && (
              <div className="border border-white/10 rounded-md bg-[#12141a] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("example")}
                  className="w-full p-2.5 bg-white/5 flex items-center justify-between text-left text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-purple-400" />
                    <span>Real-Life Example & Scenario</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                      collapsedSections["example"] ? "-rotate-90" : ""
                    }`}
                  />
                </button>

                {!collapsedSections["example"] && (
                  <div className="p-3 space-y-2 text-[11px]">
                    <div className="p-2 bg-purple-500/10 rounded border border-purple-500/20 text-purple-200">
                      <span className="font-bold block text-[10px] uppercase text-purple-300 mb-0.5">
                        Scenario
                      </span>
                      {explanation.example.scenario}
                    </div>
                    <div className="text-zinc-300 leading-relaxed pl-1">
                      <span className="font-bold block text-[10px] uppercase text-zinc-400 mb-0.5">
                        Walkthrough
                      </span>
                      {explanation.example.walkthrough}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 5: Connections & Dependencies (Collapsible) */}
            {explanation.connections && explanation.connections.length > 0 && (
              <div className="border border-white/10 rounded-md bg-[#12141a] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("connections")}
                  className="w-full p-2.5 bg-white/5 flex items-center justify-between text-left text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Box className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Connections & Dependencies ({explanation.connections.length})</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                      collapsedSections["connections"] ? "-rotate-90" : ""
                    }`}
                  />
                </button>

                {!collapsedSections["connections"] && (
                  <div className="p-3 space-y-1.5">
                    {explanation.connections.map((conn, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-1.5 bg-black/20 rounded border border-white/5 text-[11px]"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-mono font-semibold text-zinc-100">{conn.target}: </span>
                          <span className="text-zinc-400">{conn.relationship}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 6: Things to Notice / Edge Cases (Collapsible) */}
            {explanation.thingsToNotice && explanation.thingsToNotice.length > 0 && (
              <div className="border border-white/10 rounded-md bg-[#12141a] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("thingsToNotice")}
                  className="w-full p-2.5 bg-white/5 flex items-center justify-between text-left text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Things to Notice ({explanation.thingsToNotice.length})</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                      collapsedSections["thingsToNotice"] ? "-rotate-90" : ""
                    }`}
                  />
                </button>

                {!collapsedSections["thingsToNotice"] && (
                  <ul className="p-3 space-y-1.5 list-disc list-inside text-[11px] text-zinc-300">
                    {explanation.thingsToNotice.map((note, idx) => (
                      <li key={idx} className="leading-relaxed">
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
