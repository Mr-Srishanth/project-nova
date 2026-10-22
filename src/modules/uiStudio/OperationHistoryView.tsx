import React, { useState } from "react";
import {
  History,
  RotateCcw,
  Search,
  Filter,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import type { OperationHistoryEntry } from "@/types/uiStudioHistory";
import { CodeDiffView } from "./CodeDiffView";

interface OperationHistoryViewProps {
  entries: OperationHistoryEntry[];
  onSelectEntry: (entry: OperationHistoryEntry) => void;
  onRevertEntry: (entry: OperationHistoryEntry) => void;
  onClearHistory: () => void;
  onSelectFile?: (path: string) => void;
}

export const OperationHistoryView: React.FC<OperationHistoryViewProps> = ({
  entries,
  onSelectEntry: _onSelectEntry,
  onRevertEntry,
  onClearHistory,
  onSelectFile,
}) => {
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null);

  const filteredEntries = entries.filter((e) => {
    if (filterMode !== "all" && e.mode !== filterMode) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (
      searchQuery.trim() &&
      !e.userPrompt.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !e.summary.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !e.affectedFiles.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status: OperationHistoryEntry["status"]) => {
    switch (status) {
      case "runtime_verified":
        return { label: "Runtime Verified", style: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
      case "build_passed":
        return { label: "Build Passed", style: "bg-teal-500/15 text-teal-800 border-teal-300" };
      case "saved":
        return { label: "Saved", style: "bg-sky-500/15 text-blue-800 border-blue-300" };
      case "applied":
        return { label: "Applied", style: "bg-amber-500/15 text-amber-300 border-amber-500/40" };
      case "reverted":
        return { label: "Reverted", style: "bg-purple-500/15 text-purple-800 border-purple-300" };
      case "failed":
        return { label: "Failed", style: "bg-red-500/15 text-red-300 border-red-500/40" };
      case "rejected":
        return { label: "Rejected", style: "bg-[#15181f]/10 text-slate-700 border-slate-300" };
      case "proposed":
      default:
        return { label: "Proposed", style: "bg-[#15181f]/10 text-slate-600 border-slate-200" };
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#15181f] border border-white/10 rounded-md overflow-hidden text-xs">
      {/* Header & Controls */}
      <div className="p-2.5 border-b border-white/10 bg-[#15181f] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-100">
          <History className="w-4 h-4 text-primary shrink-0" />
          <span>Edit & Operation History ({entries.length})</span>
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-0.5 rounded transition-colors"
            title="Clear all operation history for this project"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-2 border-b border-white/10 bg-white/5 space-y-1.5 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3 h-3 text-zinc-400 absolute left-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search prompt, file, or summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs py-1 pl-6 pr-2 border border-white/10 rounded bg-[#15181f] focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Filter className="w-2.5 h-2.5" />
            <span>Mode:</span>
          </div>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="text-[11px] p-0.5 border border-white/10 rounded bg-[#15181f] text-zinc-100"
          >
            <option value="all">All Modes</option>
            <option value="edit">Edit</option>
            <option value="auto">Auto</option>
            <option value="plan">Plan</option>
            <option value="ask">Ask</option>
          </select>

          <div className="flex items-center gap-1 text-[10px] text-zinc-400 ml-auto">
            <span>Status:</span>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-[11px] p-0.5 border border-white/10 rounded bg-[#15181f] text-zinc-100"
          >
            <option value="all">All</option>
            <option value="runtime_verified">Verified</option>
            <option value="saved">Saved</option>
            <option value="applied">Applied</option>
            <option value="reverted">Reverted</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="p-6 text-center text-zinc-400 space-y-1">
            <History className="w-6 h-6 mx-auto opacity-40" />
            <div className="font-semibold text-zinc-100">No operations found</div>
            <p className="text-[11px]">Operations formulated in Edit, Auto, Plan, or Ask modes will be logged here.</p>
          </div>
        ) : (
          filteredEntries.map((e) => {
            const isExpanded = expandedId === e.id;
            const badge = getStatusBadge(e.status);
            const canRevert = Boolean(e.previousFileSnapshots && Object.keys(e.previousFileSnapshots).length > 0 && e.status !== "reverted");

            return (
              <div key={e.id} className="border border-white/10 rounded bg-[#15181f] overflow-hidden shadow-xs">
                {/* Header Row */}
                <div
                  className="p-2 flex items-start justify-between gap-2 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : e.id)}
                >
                  <div className="flex items-start gap-1.5 min-w-0">
                    <button type="button" className="text-zinc-400 mt-0.5">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-100 truncate">{e.summary || e.userPrompt}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <span>•</span>
                        <span className="font-mono uppercase font-bold">{e.mode}</span>
                        {e.affectedFiles.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px] font-mono">{e.affectedFiles[0]}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-bold ${badge.style}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-2.5 bg-white/5 border-t border-white/10 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-zinc-400">Original User Prompt</div>
                      <p className="text-[11px] text-zinc-100 bg-[#15181f] p-1.5 rounded border border-white/10 mt-0.5">{e.userPrompt}</p>
                    </div>

                    {e.validationError && (
                      <div className="p-2 bg-red-500/10 text-red-300 border border-red-500/30 rounded text-[11px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{e.validationError}</span>
                      </div>
                    )}

                    {e.advisoryText && (
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-400">Advisory / Plan Output</div>
                        <pre className="text-[10px] bg-[#15181f] p-2 rounded border border-white/10 mt-0.5 whitespace-pre-wrap font-sans">{e.advisoryText}</pre>
                      </div>
                    )}

                    {e.items && e.items.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase font-bold text-zinc-400">Affected Artifacts</div>
                        {e.items.map((item) => (
                          <div key={item.id} className="p-1.5 bg-[#15181f] rounded border border-white/10 space-y-1">
                            <div className="flex items-center justify-between">
                              <span
                                className="font-mono text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                                onClick={() => onSelectFile?.(item.filePath)}
                              >
                                <FileText className="w-3 h-3" />
                                <span>{item.filePath}</span>
                              </span>
                              <span className="text-[9px] uppercase px-1 rounded bg-white/5 font-bold">{item.action}</span>
                            </div>
                            <div className="pt-1">
                              <CodeDiffView
                                originalContent={item.originalContent || ""}
                                proposedContent={item.proposedContent}
                                filePath={item.filePath}
                                action={item.action}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Revert confirmation and action */}
                    {canRevert && (
                      <div className="pt-1 flex items-center justify-end gap-2">
                        {confirmRevertId === e.id ? (
                          <div className="flex items-center gap-1.5 animate-fadeIn">
                            <span className="text-[10px] text-zinc-400">Confirm rollback to previous snapshot?</span>
                            <button
                              type="button"
                              onClick={() => {
                                onRevertEntry(e);
                                setConfirmRevertId(null);
                              }}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Confirm Revert</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRevertId(null)}
                              className="px-1.5 py-1 text-[10px] text-zinc-400 hover:text-zinc-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRevertId(e.id)}
                            className="px-2 py-1 bg-[#15181f] hover:bg-white/5 text-amber-300 border border-amber-500/40 font-semibold text-[10px] rounded flex items-center gap-1 shadow-xs"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Revert This Operation</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
