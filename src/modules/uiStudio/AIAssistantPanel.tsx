import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileCode2,
  Wrench,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  History,
  FileText,
  Maximize2,
  Minimize2,
  Sparkles,
  Plus,
} from "lucide-react";
import type { AIEditPlan, AIConversationMessage, AIVerificationLevel } from "@/types/uiStudio";
import { CodeDiffView } from "./CodeDiffView";

interface AIAssistantPanelProps {
  prompt: string;
  setPrompt: (v: string) => void;
  mode: "edit" | "auto" | "plan" | "ask";
  setMode: (m: "edit" | "auto" | "plan" | "ask") => void;
  isProcessing: boolean;
  onSubmit: () => void;
  activePlan: AIEditPlan | null;
  onApplyPlan: () => void;
  onRejectPlan: () => void;
  onExecutePlanInMode?: (mode: "edit" | "auto") => void;
  onOpenHistory?: () => void;
  onToggleExpandChat?: () => void;
  isChatExpanded?: boolean;
  conversationHistory: AIConversationMessage[];
  selectedFilePath: string | null;
  activeOperationId?: string | null;
  runtimeError?: string | null;
  onNewSession?: () => void;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  prompt,
  setPrompt,
  mode,
  setMode,
  isProcessing,
  onSubmit,
  activePlan,
  onApplyPlan,
  onRejectPlan,
  onExecutePlanInMode,
  onOpenHistory,
  onToggleExpandChat,
  isChatExpanded,
  conversationHistory,
  selectedFilePath,
  activeOperationId,
  runtimeError,
  onNewSession,
}) => {
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);

  // Detect user deliberate scroll up to prevent unwanted forced autoscroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    isUserScrolledUpRef.current = distanceToBottom > 60;
  }, []);

  // Auto-scroll to bottom of conversation only if user is near bottom
  useEffect(() => {
    if (!isUserScrolledUpRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversationHistory.length, activePlan?.id, activePlan?.applied]);

  // Adjust textarea height dynamically up to sensible max-height (160px), then scroll internally
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(160, Math.max(48, textarea.scrollHeight));
    textarea.style.height = `${nextHeight}px`;
  }, [prompt]);

  const modes: Array<{
    id: "edit" | "auto" | "plan" | "ask";
    label: string;
    icon: React.ReactNode;
    desc: string;
    placeholder: string;
  }> = [
    {
      id: "edit",
      label: "Edit",
      icon: <Wrench className="w-3.5 h-3.5" />,
      desc: "Propose targeted changes with reviewable diffs. Requires explicit approval.",
      placeholder: "Describe specific UI or code adjustments (e.g. 'Add a high score counter to top bar')...",
    },
    {
      id: "auto",
      label: "Auto",
      icon: <Zap className="w-3.5 h-3.5" />,
      desc: "Autonomous workflow: inspect, plan, save, rebuild, and verify within safe boundaries.",
      placeholder: "Describe task for end-to-end automated remediation (e.g. 'Repair runtime error')...",
    },
    {
      id: "plan",
      label: "Plan",
      icon: <FileCode2 className="w-3.5 h-3.5" />,
      desc: "Formulate architectural roadmap. Zero files modified until explicitly executed.",
      placeholder: "Ask for an implementation roadmap (e.g. 'Plan migration to tabbed layout')...",
    },
    {
      id: "ask",
      label: "Ask",
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      desc: "Codebase advisory and technical explanations. Zero files modified.",
      placeholder: "Ask any question about architecture or behavior (e.g. 'How does animation loop work?')...",
    },
  ];

  const currentModeInfo = modes.find((m) => m.id === mode) || modes[0];
  const targetFileName = selectedFilePath ? selectedFilePath.split("/").pop() : "App.tsx";

  const toggleDiff = (id: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getVerificationBadge = (level: AIVerificationLevel) => {
    switch (level) {
      case "runtime_verified":
        return { label: "Runtime Verified", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
      case "build_passed":
        return { label: "Build Passed", className: "bg-teal-500/15 text-teal-800 border-teal-300" };
      case "saved":
        return { label: "Saved to Project", className: "bg-sky-500/15 text-blue-800 border-blue-300" };
      case "applied":
        return { label: "Applied", className: "bg-amber-500/15 text-amber-300 border-amber-500/40" };
      case "failed":
        return { label: "Verification Failed", className: "bg-red-500/15 text-red-300 border-red-500/40" };
      case "generated":
      default:
        return { label: "Proposed Diff", className: "bg-[#101318] text-stone-800 border-stone-300" };
    }
  };

  // Contextual suggested prompt chips when chat is empty
  const contextualPrompts = [
    ...(runtimeError ? [`Diagnose and repair: ${runtimeError.slice(0, 40)}...`] : []),
    "Make layout responsive for mobile",
    "Add a smooth gradient and modern cards",
    `Explain architecture of ${targetFileName}`,
    "Add navigation menu with route links",
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isProcessing) {
        onSubmit();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#15181f] border border-white/10 rounded-md shadow-2xs overflow-hidden w-full min-w-0">
      {/* =========================================================================
          REGION 1: PERSISTENT HEADER (Shrink-0)
          ========================================================================= */}
      <div className="shrink-0 bg-[#15181f] border-b border-white/10">
        {/* Title & Metadata Row */}
        <div className="p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100 truncate">
                AI Assistant & Live Editor
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono truncate">
                <span className="truncate max-w-[130px]">Context: {targetFileName}</span>
                {activeOperationId && <span className="opacity-60 shrink-0">• {activeOperationId.slice(-6)}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onNewSession && (
              <button
                type="button"
                onClick={onNewSession}
                className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-zinc-100 text-xs flex items-center gap-1 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
                title="Start New Chat Session"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-semibold">New</span>
              </button>
            )}

            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-zinc-100 text-xs flex items-center gap-1 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
                title="View Operation History & Conversations"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-semibold">History</span>
              </button>
            )}

            {onToggleExpandChat && (
              <button
                type="button"
                onClick={onToggleExpandChat}
                className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                title={isChatExpanded ? "Collapse Panel Width" : "Expand Fullscreen Chat Mode"}
              >
                {isChatExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-4 border-t border-white/10 bg-[#101318] p-1 gap-1">
          {modes.map((m) => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#15181f] text-zinc-100 shadow-2xs border border-white/10"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {m.icon}
                <span className="capitalize">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mode Advisory Tag */}
        <div className="px-3 py-1 bg-[#101318] border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="truncate pr-1 text-[10px] sm:text-[11px]">{currentModeInfo.desc}</span>
          <span className="font-mono text-[10px] font-bold text-zinc-100 px-1 bg-white/5 rounded shrink-0 uppercase">
            {mode}
          </span>
        </div>
      </div>

      {/* =========================================================================
          REGION 2: DEDICATED CONVERSATION & CARD VIEWPORT (flex-1 min-h-0 overflow-y-auto)
          ========================================================================= */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 overscroll-contain"
        tabIndex={0}
        aria-label="AI Conversation Stream"
      >
        {/* Empty State with Compact Suggested Actions */}
        {conversationHistory.length === 0 && !activePlan && (
          <div className="h-full flex flex-col items-center justify-center text-center p-3 text-zinc-400 space-y-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-100">Natural Language Assistant</div>
              <p className="text-[11px] max-w-xs mt-0.5 leading-relaxed">
                Describe the feature or fix you want. The assistant will formulate targeted edits for your approval.
              </p>
            </div>

            {/* Compact Suggested Action Chips */}
            <div className="w-full max-w-sm space-y-1.5 pt-1">
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider text-left">
                Suggested Actions
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {contextualPrompts.map((cp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(cp)}
                    className="w-full text-left py-1.5 px-2.5 rounded bg-white/5 hover:bg-white/5 border border-white/10 text-[11px] text-zinc-100 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate">{cp}</span>
                    <ChevronRight className="w-3 h-3 text-zinc-400 opacity-60 group-hover:opacity-100 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation Stream */}
        {conversationHistory.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-2 text-xs w-full ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg p-2.5 space-y-1 break-words ${
                  isUser
                    ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                    : "bg-[#101318] border border-white/10 text-zinc-100 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] opacity-75 font-mono">
                  <span>{isUser ? "You" : "ProjectNova AI"}</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed break-words">{msg.content}</div>
              </div>
              {isUser && (
                <div className="w-6 h-6 rounded-full bg-white/5 text-zinc-100 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Active Proposed Plan / Diff Card */}
        {activePlan && (
          <div className="border border-white/10 rounded-lg bg-[#15181f] p-3 space-y-3 shadow-xs animate-fadeIn w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="font-bold text-xs text-zinc-100 truncate">
                  {activePlan.mode === "plan" ? "Execution Blueprint" : "Proposed Code Changes"}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border shrink-0 ${
                  getVerificationBadge(activePlan.verificationLevel).className
                }`}
              >
                {getVerificationBadge(activePlan.verificationLevel).label}
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">{activePlan.summary}</p>

            {/* Plan-Mode Structured Steps */}
            {activePlan.mode === "plan" && activePlan.advisoryText && (
              <div className="p-2.5 bg-[#101318] rounded border border-white/10 font-mono text-xs whitespace-pre-wrap leading-relaxed text-zinc-100 break-words max-h-60 overflow-y-auto">
                {activePlan.advisoryText}
              </div>
            )}

            {/* File Change Items with Expandable Diffs */}
            {activePlan.items.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase font-bold text-zinc-400">
                  Targeted Files ({activePlan.items.length})
                </div>
                {activePlan.items.map((item) => {
                  const isDiffExpanded = expandedDiffs[item.id];
                  return (
                    <div key={item.id} className="border border-white/10 rounded bg-[#15181f] overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => toggleDiff(item.id)}
                        className="w-full p-2 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-primary font-bold truncate">{item.filePath}</span>
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0">({item.action})</span>
                        </div>
                        {isDiffExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
                        )}
                      </button>

                      {isDiffExpanded && (
                        <div className="p-2 bg-slate-950 border-t border-white/10 max-w-full overflow-x-auto">
                          <CodeDiffView
                            originalContent={item.originalContent || ""}
                            proposedContent={item.proposedContent}
                            filePath={item.filePath}
                            action={item.action}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
              {activePlan.mode === "plan" ? (
                <div className="flex items-center gap-2 w-full justify-end">
                  <button
                    type="button"
                    onClick={() => onExecutePlanInMode?.("edit")}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-[#15181f] border border-white/10 text-zinc-100 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    In Edit Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecutePlanInMode?.("auto")}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors cursor-pointer"
                  >
                    In Auto Mode
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full justify-end">
                  <button
                    type="button"
                    onClick={onRejectPlan}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-[#15181f] border border-white/10 text-zinc-100 hover:bg-white/5 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-300" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={onApplyPlan}
                    disabled={isProcessing || activePlan.applied}
                    className="px-3.5 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>{activePlan.applied ? "Applied" : "Apply Changes"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scroll Anchor */}
        <div ref={messagesEndRef} className="h-0" />
      </div>

      {/* =========================================================================
          REGION 3: PERSISTENT NON-SCROLLING COMPOSER (Shrink-0 at Bottom)
          ========================================================================= */}
      <div className="p-2.5 bg-[#15181f] border-t border-white/10 shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="border border-white/10 rounded-xl bg-[#15181f] focus-within:ring-1 focus-within:ring-primary shadow-2xs overflow-hidden">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentModeInfo.placeholder}
            className="w-full text-xs p-3 bg-transparent resize-none min-h-[48px] max-h-[160px] focus:outline-none text-zinc-100 placeholder:text-zinc-400/70 overflow-y-auto block leading-relaxed"
          />

          <div className="px-3 py-2 bg-[#101318] border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400">
            <div className="flex items-center gap-1">
              <span className="font-mono hidden sm:inline">Press</span>
              <kbd className="px-1 py-0.2 bg-[#15181f] rounded border border-white/10 font-mono text-[9px]">Enter</kbd>
              <span className="font-mono">to send,</span>
              <kbd className="px-1 py-0.2 bg-[#15181f] rounded border border-white/10 font-mono text-[9px]">Shift+Enter</kbd>
              <span className="font-mono hidden sm:inline">newline</span>
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={isProcessing || !prompt.trim()}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs shadow-2xs hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
