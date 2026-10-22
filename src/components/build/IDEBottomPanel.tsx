import React, { useState } from "react";
import {
  Terminal as TerminalIcon,
  AlertTriangle,
  Play,
  Square,
  FileDiff,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export type BottomPanelTab = "terminal" | "problems" | "output" | "tests" | "gitDiff";

export interface DiagnosticProblem {
  id: string;
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  column: number;
  message: string;
  source: string;
}

interface IDEBottomPanelProps {
  activeTab: BottomPanelTab;
  onSelectTab: (tab: BottomPanelTab) => void;
  terminalLogs: string[];
  isRunningCommand: boolean;
  onExecuteCommand: (cmd: string) => void;
  onClearTerminal: () => void;
  onKillProcess?: () => void;
  problems: DiagnosticProblem[];
  onSelectProblem?: (prob: DiagnosticProblem) => void;
  testSummary?: { total: number; passed: number; failed: number; running: boolean } | null;
  onRunTests?: () => void;
  gitStatus?: {
    isGit: boolean;
    currentBranch: string;
    changedFiles: { path: string; status: string; isSecret: boolean }[];
  } | null;
  onCommitChanges?: (message: string) => void;
}

export const IDEBottomPanel: React.FC<IDEBottomPanelProps> = ({
  activeTab,
  onSelectTab,
  terminalLogs,
  isRunningCommand,
  onExecuteCommand,
  onClearTerminal,
  onKillProcess,
  problems,
  onSelectProblem,
  testSummary,
  onRunTests,
  gitStatus,
  onCommitChanges,
}) => {
  const [commandInput, setCommandInput] = useState("");
  const [commitMessage, setCommitMessage] = useState("");

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || isRunningCommand) return;
    onExecuteCommand(commandInput.trim());
    setCommandInput("");
  };

  const handleCommitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || !onCommitChanges) return;
    onCommitChanges(commitMessage.trim());
    setCommitMessage("");
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-t border-[#2d2d2d] text-[#cccccc] text-xs">
      {/* Tabs Header */}
      <div className="flex items-center justify-between px-3 border-b border-[#2d2d2d] bg-[#252526] select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSelectTab("terminal")}
            className={`px-3 py-1.5 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] border-b-2 transition-colors ${
              activeTab === "terminal"
                ? "border-[#007acc] text-white bg-[#1e1e1e]"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => onSelectTab("problems")}
            className={`px-3 py-1.5 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] border-b-2 transition-colors ${
              activeTab === "problems"
                ? "border-[#007acc] text-white bg-[#1e1e1e]"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Problems ({problems.length})</span>
          </button>

          <button
            onClick={() => onSelectTab("tests")}
            className={`px-3 py-1.5 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] border-b-2 transition-colors ${
              activeTab === "tests"
                ? "border-[#007acc] text-white bg-[#1e1e1e]"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test Results {testSummary ? `(${testSummary.passed}/${testSummary.total})` : ""}</span>
          </button>

          <button
            onClick={() => onSelectTab("gitDiff")}
            className={`px-3 py-1.5 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] border-b-2 transition-colors ${
              activeTab === "gitDiff"
                ? "border-[#007acc] text-white bg-[#1e1e1e]"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <FileDiff className="w-3.5 h-3.5 text-blue-400" />
            <span>Source Control {gitStatus?.changedFiles ? `(${gitStatus.changedFiles.length})` : ""}</span>
          </button>
        </div>

        {/* Tab Right Controls */}
        <div className="flex items-center gap-2">
          {activeTab === "terminal" && (
            <>
              {isRunningCommand && onKillProcess && (
                <button
                  onClick={onKillProcess}
                  className="px-2 py-0.5 bg-rose-900/60 text-rose-300 hover:bg-rose-800 border border-rose-700/50 rounded text-[10px] font-bold flex items-center gap-1"
                >
                  <Square className="w-3 h-3 fill-rose-300" />
                  Kill Process
                </button>
              )}
              <button
                onClick={onClearTerminal}
                className="p-1 hover:bg-[#2d2d2d] rounded text-gray-400 hover:text-white"
                title="Clear Terminal"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {activeTab === "tests" && onRunTests && (
            <button
              onClick={onRunTests}
              className="px-2 py-0.5 bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800 border border-emerald-700/50 rounded text-[10px] font-bold flex items-center gap-1"
            >
              <Play className="w-3 h-3 fill-emerald-300" />
              Run All Tests
            </button>
          )}
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-hidden relative">
        {/* 1. Terminal View */}
        {activeTab === "terminal" && (
          <div className="flex flex-col h-full bg-[#181818] p-2 font-mono text-[11px]">
            <div className="flex-1 overflow-y-auto space-y-1 select-text">
              <div className="text-gray-500 mb-2">
                ProjectNova Sandboxed Runner • Allowed: bun, npm, vite, tsc, git, python, pytest • Output capped
              </div>
              {terminalLogs.length === 0 ? (
                <div className="text-gray-600">No output yet. Run a command or click Build / Test above.</div>
              ) : (
                terminalLogs.map((log, idx) => (
                  <pre key={idx} className="whitespace-pre-wrap text-gray-300 font-mono leading-tight">
                    {log}
                  </pre>
                ))
              )}
            </div>

            {/* Command input prompt */}
            <form onSubmit={handleCommandSubmit} className="mt-2 pt-2 border-t border-[#2d2d2d] flex items-center gap-2">
              <span className="text-emerald-400 font-bold">$</span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="bun run build | npm test | git status..."
                disabled={isRunningCommand}
                className="flex-1 bg-transparent border-none text-white focus:outline-none text-xs font-mono"
              />
              {isRunningCommand && (
                <span className="text-amber-400 text-[10px] animate-pulse">Running…</span>
              )}
            </form>
          </div>
        )}

        {/* 2. Problems Diagnostic View */}
        {activeTab === "problems" && (
          <div className="h-full overflow-y-auto p-2 space-y-1">
            {problems.length === 0 ? (
              <div className="p-4 text-center text-gray-400 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>No problems detected in current project workspace.</span>
              </div>
            ) : (
              problems.map((prob) => (
                <div
                  key={prob.id}
                  onClick={() => onSelectProblem?.(prob)}
                  className="flex items-start justify-between p-2 rounded hover:bg-[#2a2d2e] cursor-pointer transition-colors border border-transparent hover:border-[#3c3c3c]"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        prob.severity === "error" ? "text-rose-400" : "text-amber-400"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-white text-xs">{prob.message}</p>
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                        {prob.file} ({prob.line}:{prob.column}) • {prob.source}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">{prob.severity}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. Tests View */}
        {activeTab === "tests" && (
          <div className="h-full overflow-y-auto p-4 space-y-3">
            <div className="flex items-center gap-4 bg-[#252526] p-3 rounded border border-[#2d2d2d]">
              <div>
                <span className="text-xs text-gray-400">Total Cases</span>
                <p className="text-xl font-bold text-white">{testSummary?.total || 0}</p>
              </div>
              <div>
                <span className="text-xs text-emerald-400">Passed</span>
                <p className="text-xl font-bold text-emerald-400">{testSummary?.passed || 0}</p>
              </div>
              <div>
                <span className="text-xs text-rose-400">Failed</span>
                <p className="text-xl font-bold text-rose-400">{testSummary?.failed || 0}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Integrates with ProjectNova deterministic Test Automation Engine (Phase 15).
            </p>
          </div>
        )}

        {/* 4. Git Diff & Source Control View */}
        {activeTab === "gitDiff" && (
          <div className="h-full overflow-y-auto p-3 space-y-3">
            {gitStatus?.isGit ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>
                    Current Branch: <strong className="text-emerald-400">{gitStatus.currentBranch}</strong>
                  </span>
                  <span>{gitStatus.changedFiles.length} file(s) changed</span>
                </div>

                {onCommitChanges && (
                  <form onSubmit={handleCommitSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Commit message (e.g. Feat: update car physics)..."
                      className="flex-1 bg-[#252526] border border-[#3c3c3c] text-white px-3 py-1.5 rounded text-xs focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!commitMessage.trim()}
                      className="px-3 py-1.5 bg-[#007acc] text-white font-bold rounded text-xs disabled:opacity-50"
                    >
                      Commit
                    </button>
                  </form>
                )}

                <div className="space-y-1">
                  {gitStatus.changedFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-[#252526] rounded text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold">{file.status}</span>
                        <span className="text-gray-300">{file.path}</span>
                      </div>
                      {file.isSecret && (
                        <span className="text-[10px] text-amber-500 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800">
                          Secret protected
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 text-gray-400 text-xs">
                Target workspace is not initialized as a git repository or git service is offline.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
