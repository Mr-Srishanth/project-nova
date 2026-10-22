import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FilePlus2,
  Folder,
  FolderOpen,
  Pencil,
  Search,
  Trash2,
  X,
  Check,
} from "lucide-react";
import type { StudioFileState } from "@/lib/uiStudio/studioDocuments";

interface StudioExplorerProps {
  files: StudioFileState[];
  selectedFilePath: string | null;
  openPaths: string[];
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => Promise<boolean>;
  onRenameFile: (oldPath: string, newPath: string) => Promise<boolean>;
  onDeleteFile: (path: string) => Promise<boolean>;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
  file?: StudioFileState;
}

type PendingAction =
  | { kind: "create" }
  | { kind: "rename"; path: string }
  | { kind: "delete"; path: string }
  | null;

const inputCls =
  "w-full text-xs px-2 py-1.5 rounded bg-[#0b0d10] border border-white/15 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60";

export const StudioExplorer: React.FC<StudioExplorerProps> = ({
  files,
  selectedFilePath,
  openPaths,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
}) => {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<PendingAction>(null);
  const [draftName, setDraftName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tree = useMemo(() => {
    const root = new Map<string, TreeNode>();
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    for (const file of sorted) {
      if (filter && !file.path.toLowerCase().includes(filter.toLowerCase())) continue;
      const parts = file.path.split("/");
      let level = root;
      let cur = "";
      parts.forEach((part, idx) => {
        cur = cur ? `${cur}/${part}` : part;
        const isFile = idx === parts.length - 1;
        if (!level.has(part)) {
          level.set(part, { name: part, path: cur, isDir: !isFile, children: new Map(), file: isFile ? file : undefined });
        }
        level = level.get(part)!.children;
      });
    }
    return root;
  }, [files, filter]);

  const runAction = async () => {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.kind === "create") {
        const name = draftName.trim();
        if (!name) throw new Error("Enter a file path, e.g. src/components/Card.tsx");
        if (!(await onCreateFile(name))) throw new Error("A file with that path already exists or could not be created.");
        onSelectFile(name.replace(/\\/g, "/"));
      } else if (pending.kind === "rename") {
        const name = draftName.trim();
        if (!name || name === pending.path) throw new Error("Enter a different new path.");
        if (!(await onRenameFile(pending.path, name))) throw new Error("Rename failed — the target may already exist.");
      } else if (pending.kind === "delete") {
        if (!(await onDeleteFile(pending.path))) throw new Error("Delete failed.");
      }
      setPending(null);
      setDraftName("");
    } catch (err: any) {
      setActionError(err?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const renderNodes = (nodes: Map<string, TreeNode>, depth: number): React.ReactNode => {
    const entries = [...nodes.values()].sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    return entries.map((node) => {
      if (node.isDir) {
        const isCollapsed = Boolean(collapsed[node.path]);
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [node.path]: !prev[node.path] }))}
              style={{ paddingLeft: `${depth * 12 + 4}px` }}
              className="w-full flex items-center gap-1 py-[3px] px-1 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded text-left"
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
              {isCollapsed ? (
                <Folder className="w-3.5 h-3.5 shrink-0 text-sky-400/80" />
              ) : (
                <FolderOpen className="w-3.5 h-3.5 shrink-0 text-sky-400/80" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {!isCollapsed && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const file = node.file!;
      const isSelected = selectedFilePath === node.path;
      const isOpen = openPaths.includes(node.path);
      const dirty = file.draftContent !== file.savedContent;
      return (
        <div
          key={node.path}
          className={`group flex items-center gap-1 rounded pr-1 ${
            isSelected ? "bg-emerald-500/15 text-zinc-50" : "text-zinc-300 hover:bg-white/5"
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectFile(node.path)}
            style={{ paddingLeft: `${depth * 12 + 22}px` }}
            className="flex-1 flex items-center gap-1.5 py-[3px] text-left min-w-0"
            title={node.path}
          >
            <File className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            <span className={`truncate font-mono text-[11px] ${isOpen && !isSelected ? "text-zinc-100" : ""}`}>{node.name}</span>
            {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
            {file.status === "failed" && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Save failed" />}
          </button>
          <span className="hidden group-hover:flex items-center shrink-0">
            <button
              type="button"
              title="Rename"
              onClick={() => {
                setPending({ kind: "rename", path: node.path });
                setDraftName(node.path);
                setActionError(null);
              }}
              className="p-0.5 text-zinc-500 hover:text-zinc-100 cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              title="Delete"
              onClick={() => {
                setPending({ kind: "delete", path: node.path });
                setActionError(null);
              }}
              className="p-0.5 text-zinc-500 hover:text-red-300 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-2 pt-2 pb-1.5 shrink-0">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search files…"
            className={`${inputCls} pl-7`}
            aria-label="Search files"
          />
        </div>
        <button
          type="button"
          title="New file"
          onClick={() => {
            setPending({ kind: "create" });
            setDraftName("");
            setActionError(null);
          }}
          className="p-1.5 rounded border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-zinc-50 cursor-pointer shrink-0"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {pending && (
        <div className="mx-2 mb-2 p-2 rounded border border-white/10 bg-[#0b0d10] space-y-2 shrink-0">
          {pending.kind === "delete" ? (
            <p className="text-[11px] text-zinc-300 leading-snug">
              Delete <span className="font-mono text-zinc-50">{pending.path}</span>? This removes the saved file
              (undo can restore it).
            </p>
          ) : (
            <>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                {pending.kind === "create" ? "New file path" : "Rename to"}
              </label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runAction();
                  if (e.key === "Escape") setPending(null);
                }}
                placeholder="src/components/Card.tsx"
                className={inputCls}
                autoFocus
              />
            </>
          )}
          {actionError && <p className="text-[11px] text-red-300">{actionError}</p>}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={runAction}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded cursor-pointer disabled:opacity-50 ${
                pending.kind === "delete"
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              <Check className="w-3 h-3" />
              {pending.kind === "delete" ? "Delete" : pending.kind === "create" ? "Create" : "Rename"}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-white/10 text-zinc-300 hover:bg-white/5 cursor-pointer"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1.5 pb-2 min-h-0">
        {files.length === 0 ? (
          <p className="text-[11px] text-zinc-500 px-2 py-3">No files in this project yet. Create one to get started.</p>
        ) : (
          renderNodes(tree, 0)
        )}
      </div>
    </div>
  );
};
