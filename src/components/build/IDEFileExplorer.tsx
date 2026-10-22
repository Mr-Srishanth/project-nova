import React, { useState } from "react";
import {
  FileCode,
  FileText,
  FileJson,
  File,
  Plus,
  Trash2,
  RefreshCw,
  Search,
} from "lucide-react";
import type { BuildArtifact } from "@/types/artifact";

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  isPlanned?: boolean;
  status?: string;
  children?: FileTreeNode[];
}

interface IDEFileExplorerProps {
  files: BuildArtifact[];
  plannedPaths: string[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    case "json":
      return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case "md":
    case "txt":
      return <FileText className="w-3.5 h-3.5 text-gray-300 shrink-0" />;
    case "css":
    case "html":
      return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    default:
      return <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
  }
}

export const IDEFileExplorer: React.FC<IDEFileExplorerProps> = ({
  files,
  plannedPaths,
  selectedPath,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRefresh,
  isRefreshing = false,
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [newFileInputOpen, setNewFileInputOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");

  // Map of generated vs planned
  const generatedMap = new Map(files.map((f) => [f.path.replace(/\\/g, "/"), f]));
  const allPathsSet = new Set([...files.map((f) => f.path.replace(/\\/g, "/")), ...plannedPaths.map((p) => p.replace(/\\/g, "/"))]);
  const allPaths = Array.from(allPathsSet).sort();

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;
    onCreateFile(newFilePath.trim().replace(/^[/\\]+/, ""));
    setNewFilePath("");
    setNewFileInputOpen(false);
  };

  const filteredPaths = filterQuery.trim()
    ? allPaths.filter((p) => p.toLowerCase().includes(filterQuery.toLowerCase()))
    : allPaths;

  return (
    <div className="flex flex-col h-full bg-[#181818] text-[#cccccc] select-none text-xs border-r border-[#2d2d2d]">
      {/* Explorer Header */}
      <div className="p-2 border-b border-[#2d2d2d] flex items-center justify-between">
        <span className="font-bold uppercase tracking-wider text-[11px] text-gray-300">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNewFileInputOpen(!newFileInputOpen)}
            className="p-1 hover:bg-[#2d2d2d] rounded text-gray-400 hover:text-white"
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1 hover:bg-[#2d2d2d] rounded text-gray-400 hover:text-white disabled:opacity-50"
            title="Refresh Explorer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter / Search input */}
      <div className="p-2 border-b border-[#2d2d2d]">
        <div className="flex items-center bg-[#252526] px-2 py-1 rounded border border-[#3c3c3c]">
          <Search className="w-3 h-3 text-gray-400 mr-1.5 shrink-0" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files (e.g. tsx)..."
            className="bg-transparent border-none text-[11px] text-white focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Create New File Row */}
      {newFileInputOpen && (
        <form onSubmit={handleCreateSubmit} className="p-2 bg-[#252526] border-b border-[#2d2d2d] flex items-center gap-1">
          <input
            type="text"
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
            placeholder="src/components/MyComp.tsx"
            autoFocus
            className="bg-[#1e1e1e] border border-[#007acc] text-white px-2 py-1 text-xs rounded w-full focus:outline-none"
          />
          <button type="submit" className="px-2 py-1 bg-[#007acc] text-white rounded text-[11px] font-bold">
            Add
          </button>
        </form>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto p-1 font-mono">
        {filteredPaths.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-[11px]">No files match query</div>
        ) : (
          filteredPaths.map((filePath) => {
            const isSelected = selectedPath === filePath;
            const isGenerated = generatedMap.has(filePath);
            const artifact = generatedMap.get(filePath);

            return (
              <div
                key={filePath}
                onClick={() => onSelectFile(filePath)}
                className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#37373d] text-white font-semibold"
                    : "hover:bg-[#2a2d2e] text-gray-300"
                }`}
                title={filePath}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {getFileIcon(filePath)}
                  <span className="truncate text-[11px]">{filePath}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isGenerated ? (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded ${
                        artifact?.status === "approved"
                          ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                          : "bg-blue-900/60 text-blue-300 border border-blue-700/50"
                      }`}
                      title={artifact?.status === "approved" ? "Approved Artifact" : "Generated Code"}
                    >
                      {artifact?.status === "approved" ? "APP" : "GEN"}
                    </span>
                  ) : (
                    <span
                      className="text-[9px] px-1 py-0.2 rounded bg-amber-900/50 text-amber-300 border border-amber-700/50"
                      title="Planned from Blueprint (Click to synthesize)"
                    >
                      PLN
                    </span>
                  )}

                  {isGenerated && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete file "${filePath}"?`)) {
                          onDeleteFile(filePath);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400"
                      title="Delete file"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Explorer Footer Stats */}
      <div className="p-2 border-t border-[#2d2d2d] bg-[#1e1e1e] flex items-center justify-between text-[10px] text-gray-400">
        <span>Files: {allPaths.length}</span>
        <span className="text-emerald-400 font-bold">Generated: {files.length}</span>
      </div>
    </div>
  );
};
