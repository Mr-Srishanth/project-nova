import React, { useState, useMemo } from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileCode2,
  FileJson,
  FileText,
  ChevronRight,
  ChevronDown,
  Eye,
  Lock,
} from "lucide-react";
import type { RepoFileInfo, RepoDirectoryInfo } from "@/lib/repository/realFsClient";

interface RepoTreeNode {
  name: string;
  path: string; // relative path
  isDir: boolean;
  isExcluded: boolean;
  sizeBytes?: number;
  extension?: string;
  children: RepoTreeNode[];
}

interface RepoTreeExplorerProps {
  files: RepoFileInfo[];
  directories: RepoDirectoryInfo[];
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
  searchQuery: string;
  showExcluded: boolean;
  selectedExtension: string;
}

export const RepoTreeExplorer: React.FC<RepoTreeExplorerProps> = ({
  files,
  directories,
  selectedFilePath,
  onSelectFile,
  searchQuery,
  showExcluded,
  selectedExtension,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Expand root & primary folders by default
    return new Set(["", "src", "src/components", "src/modules", "server", "docs"]);
  });

  // Build tree data structure
  const rootNode = useMemo(() => {
    const root: RepoTreeNode = {
      name: "root",
      path: "",
      isDir: true,
      isExcluded: false,
      children: [],
    };

    const dirMap = new Map<string, RepoTreeNode>();
    dirMap.set("", root);

    // Sort directories by depth
    const sortedDirs = [...directories].sort((a, b) => {
      const depthA = a.path ? a.path.split("/").length : 0;
      const depthB = b.path ? b.path.split("/").length : 0;
      return depthA - depthB;
    });

    for (const d of sortedDirs) {
      if (!d.path) continue;
      const parts = d.path.split("/");
      const dirName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join("/");

      const dirNode: RepoTreeNode = {
        name: dirName,
        path: d.path,
        isDir: true,
        isExcluded: d.isExcluded,
        children: [],
      };
      dirMap.set(d.path, dirNode);

      const parentNode = dirMap.get(parentPath) || root;
      parentNode.children.push(dirNode);
    }

    // Insert files into their respective directories
    for (const f of files) {
      if (!showExcluded && f.isExcluded) continue;
      if (selectedExtension !== "all" && f.extension !== selectedExtension) continue;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        if (!f.path.toLowerCase().includes(query) && !f.name.toLowerCase().includes(query)) {
          continue;
        }
      }

      const parts = f.path.split("/");
      const parentPath = parts.slice(0, -1).join("/");
      const fileNode: RepoTreeNode = {
        name: f.name,
        path: f.path,
        isDir: false,
        isExcluded: f.isExcluded,
        sizeBytes: f.sizeBytes,
        extension: f.extension,
        children: [],
      };

      const parentNode = dirMap.get(parentPath) || root;
      parentNode.children.push(fileNode);
    }

    // Sort directories first, then alphabetically
    const sortNodes = (node: RepoTreeNode) => {
      node.children.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortNodes);
    };
    sortNodes(root);

    return root;
  }, [files, directories, showExcluded, selectedExtension, searchQuery]);

  const toggleFolder = (dirPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    for (const d of directories) {
      all.add(d.path);
    }
    setExpandedFolders(all);
  };

  const collapseAll = () => {
    setExpandedFolders(new Set([""]));
  };

  const getFileIcon = (ext?: string, name?: string) => {
    if (name?.startsWith(".env")) return <Lock className="w-3.5 h-3.5 text-amber-600" />;
    switch (ext) {
      case ".ts":
      case ".tsx":
      case ".js":
      case ".jsx":
        return <FileCode2 className="w-3.5 h-3.5 text-sky-600" />;
      case ".json":
        return <FileJson className="w-3.5 h-3.5 text-yellow-600" />;
      case ".md":
      case ".txt":
        return <FileText className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <File className="w-3.5 h-3.5 text-foreground-muted" />;
    }
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderNode = (node: RepoTreeNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFilePath === node.path;

    if (node.isDir) {
      // Don't render dummy root label, just render its children
      if (node.path === "") {
        return (
          <div key="root-container" className="space-y-0.5">
            {node.children.map((c) => renderNode(c, 0))}
          </div>
        );
      }

      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            className={`flex items-center gap-1.5 py-1 px-2 rounded hover:bg-[#FAF7ED] cursor-pointer text-xs font-mono transition-colors ${
              node.isExcluded ? "opacity-60" : "text-foreground font-semibold"
            }`}
          >
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
            <span className="truncate">{node.name}</span>
            {node.isExcluded && (
              <span className="text-[10px] px-1 bg-border/20 rounded text-foreground-muted">
                ignored
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

    return (
      <div
        key={node.path}
        onClick={() => onSelectFile(node.path)}
        style={{ paddingLeft: `${depth * 14 + 20}px` }}
        className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer text-xs font-mono transition-all group ${
          isSelected
            ? "bg-[#70C84B]/20 text-[#153A52] font-bold border-l-2 border-[#153A52]"
            : "text-foreground/90 hover:bg-[#FAF7ED]"
        } ${node.isExcluded ? "opacity-60" : ""}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {getFileIcon(node.extension, node.name)}
          <span className="truncate">{node.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-foreground-muted font-normal">
            {formatSize(node.sizeBytes)}
          </span>
          {isSelected && <Eye className="w-3 h-3 text-[#153A52]" />}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex items-center justify-between gap-1 pb-2 border-b border-border/20 px-1">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-muted">
          Repository Tree
        </span>
        <div className="flex items-center gap-1.5">
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
        </div>
      </div>

      <div className="overflow-y-auto max-h-[640px] pr-1 space-y-0.5 custom-scrollbar">
        {rootNode.children.length === 0 ? (
          <div className="p-4 text-center text-xs font-mono text-foreground-muted">
            No files match the search or filter criteria.
          </div>
        ) : (
          renderNode(rootNode)
        )}
      </div>
    </div>
  );
};
