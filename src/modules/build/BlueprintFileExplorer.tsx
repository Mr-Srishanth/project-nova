import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  KeyRound,
} from "lucide-react";
import type {
  SynchronizedFileNode,
  BlueprintDirectoryModel,
} from "@/lib/build/blueprintDirectoryModel";
import type { BuildArtifact } from "@/types/artifact";

interface BlueprintFileExplorerProps {
  blueprintModel: BlueprintDirectoryModel;
  synchronizedTree: SynchronizedFileNode;
  additionalArtifacts: BuildArtifact[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  stats: {
    totalFiles: number;
    planned: number;
    generated: number;
    approved: number;
    failed: number;
    additional: number;
  };
}

export const BlueprintFileExplorer: React.FC<BlueprintFileExplorerProps> = ({
  blueprintModel,
  synchronizedTree,
  additionalArtifacts,
  selectedPath,
  onSelectPath,
  stats,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Expand root & primary folders by default
    return new Set(["", "src", "src/app", "src/components", "src/modules"]);
  });
  const [copiedNotice, setCopiedNotice] = useState(false);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const collect = (node: SynchronizedFileNode) => {
      if (node.isDir) {
        all.add(node.path);
        node.children.forEach(collect);
      }
    };
    collect(synchronizedTree);
    setExpandedFolders(all);
  };

  const collapseAll = () => {
    setExpandedFolders(new Set([""]));
  };

  const handleCopyTree = () => {
    navigator.clipboard.writeText(blueprintModel.rawText);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const getStatusBadge = (status: SynchronizedFileNode["status"]) => {
    switch (status) {
      case "approved":
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
            APPROVED
          </span>
        );
      case "generated":
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-300">
            GENERATED
          </span>
        );
      case "failed":
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-800 border border-red-300">
            ERROR
          </span>
        );
      case "planned":
      default:
        return (
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-border/20 text-foreground-muted border border-border/30">
            PLANNED
          </span>
        );
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.startsWith(".env") || fileName === ".gitignore") {
      return <KeyRound className="w-3.5 h-3.5 text-emerald-600" />;
    }
    if (fileName.endsWith(".ts") || fileName.endsWith(".tsx") || fileName.endsWith(".js") || fileName.endsWith(".jsx")) {
      return <FileCode className="w-3.5 h-3.5 text-sky-600" />;
    }
    if (fileName.endsWith(".json")) {
      return <FileJson className="w-3.5 h-3.5 text-amber-600" />;
    }
    if (fileName.endsWith(".md") || fileName.endsWith(".txt")) {
      return <FileText className="w-3.5 h-3.5 text-indigo-600" />;
    }
    return <File className="w-3.5 h-3.5 text-foreground-muted" />;
  };

  const renderNode = (node: SynchronizedFileNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedPath === node.path;

    if (node.isDir) {
      // Don't render root folder row, just container
      if (node.path === "") {
        return (
          <div key="root" className="space-y-0.5">
            {node.children.map((c) => renderNode(c, 0))}
          </div>
        );
      }

      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            className="flex items-center justify-between py-1 px-2 rounded hover:bg-[#FAF7ED] cursor-pointer text-xs font-mono transition-colors text-foreground font-semibold"
          >
            <div className="flex items-center gap-1.5 truncate">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
              <span className="truncate">{node.name}/</span>
            </div>

            {node.stats && node.stats.total > 0 && (
              <span className="text-[10px] font-mono text-foreground-muted font-normal shrink-0">
                {node.stats.approved + node.stats.generated}/{node.stats.total}
              </span>
            )}
          </div>

          {isExpanded && node.children.length > 0 && (
            <div className="border-l border-border/20 ml-2">
              {node.children.map((c) => renderNode(c, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf file
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (!node.name.toLowerCase().includes(q) && !node.path.toLowerCase().includes(q)) {
        return null;
      }
    }

    return (
      <div
        key={node.path}
        onClick={() => onSelectPath(node.path)}
        style={{ paddingLeft: `${depth * 14 + 20}px` }}
        className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer text-xs font-mono transition-all group ${
          isSelected
            ? "bg-[#70C84B]/20 text-[#153A52] font-bold border-l-2 border-[#153A52]"
            : "text-foreground hover:bg-[#FAF7ED]"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {getFileIcon(node.name)}
          <span className="truncate" title={node.path}>
            {node.name}
          </span>
        </div>

        <div className="shrink-0 ml-2">{getStatusBadge(node.status)}</div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Header bar with Root Project Name & Actions */}
      <div className="flex items-center justify-between pb-2 border-b border-border/20 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 font-display font-bold text-xs text-foreground">
          <Folder className="w-4 h-4 text-primary" />
          <span>{blueprintModel.rootName}/</span>
          <span className="text-[10px] font-mono font-normal text-foreground-muted">
            ({stats.totalFiles} files)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={expandAll}
            className="text-[10px] font-mono px-2 py-0.5 bg-[#FAF7ED] border border-border rounded hover:bg-primary/20 transition-colors"
          >
            Expand
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-[10px] font-mono px-2 py-0.5 bg-[#FAF7ED] border border-border rounded hover:bg-primary/20 transition-colors"
          >
            Collapse
          </button>
          <button
            type="button"
            onClick={handleCopyTree}
            className="text-[10px] font-mono px-2 py-0.5 bg-[#FAF7ED] border border-border rounded hover:bg-primary/20 transition-colors flex items-center gap-1"
          >
            <Copy className="w-2.5 h-2.5" />
            {copiedNotice ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 top-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter blueprint files..."
          className="w-full pl-8 pr-3 py-1 bg-[#FAF7ED] border border-border rounded text-xs text-foreground focus:outline-none focus:bg-surface focus:ring-1 focus:ring-foreground shadow-[inset_1px_1px_0_rgba(21,58,82,0.06)]"
        />
      </div>

      {/* Status Summary Pills */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center">
        <div className="p-1 rounded bg-border/10 border border-border/20">
          <span className="block text-foreground-muted">PLANNED</span>
          <span className="font-bold text-foreground">{stats.planned}</span>
        </div>
        <div className="p-1 rounded bg-blue-50 border border-blue-200">
          <span className="block text-blue-700">GENERATED</span>
          <span className="font-bold text-blue-900">{stats.generated}</span>
        </div>
        <div className="p-1 rounded bg-emerald-50 border border-emerald-200">
          <span className="block text-emerald-700">APPROVED</span>
          <span className="font-bold text-emerald-900">{stats.approved}</span>
        </div>
      </div>

      {/* Hierarchical Explorer Tree */}
      <div className="max-h-[520px] overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
        {renderNode(synchronizedTree)}
      </div>

      {/* Discrepancy Notice for Additional Artifacts not in Blueprint */}
      {additionalArtifacts.length > 0 && (
        <div className="pt-2 border-t border-border/20 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-foreground-muted">
            <span>Additional Artifacts ({additionalArtifacts.length})</span>
            <span className="text-[10px] text-amber-700 font-semibold">Not in Blueprint</span>
          </div>
          <p className="text-[10px] font-sans text-foreground-muted">
            These files were generated in Build Studio but are not declared in the canonical Blueprint structure.
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
            {additionalArtifacts.map((a) => (
              <button
                key={a.path}
                type="button"
                onClick={() => onSelectPath(a.path)}
                className={`w-full text-left p-1.5 rounded text-xs font-mono flex items-center justify-between border ${
                  selectedPath === a.path
                    ? "bg-[#70C84B]/20 border-[#153A52] text-[#153A52] font-bold"
                    : "bg-[#FAF7ED] border-border/40 hover:bg-surface text-foreground"
                }`}
              >
                <span className="truncate">{a.path}</span>
                {getStatusBadge(a.status as any)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
