import React from "react";
import { FileCode, CheckCircle2, FileText, Settings, Database } from "lucide-react";
import type { BuildArtifact, ArtifactStatus, ArtifactType } from "@/types/artifact";
import { Badge } from "@/components/ui/Badge";

interface FileTreeProps {
  artifacts: BuildArtifact[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
}

const TYPE_ICONS: Record<ArtifactType, React.ReactNode> = {
  frontend: <FileCode className="w-3.5 h-3.5 text-accent-blue" />,
  backend: <FileCode className="w-3.5 h-3.5 text-primary" />,
  schema: <Database className="w-3.5 h-3.5 text-accent-yellow" />,
  api: <FileCode className="w-3.5 h-3.5 text-accent-blue-strong" />,
  config: <Settings className="w-3.5 h-3.5 text-foreground-muted" />,
  test: <CheckCircle2 className="w-3.5 h-3.5 text-primary" />,
  docs: <FileText className="w-3.5 h-3.5 text-foreground-muted" />,
};

const STATUS_BADGES: Record<ArtifactStatus, "muted" | "blue" | "yellow" | "primary" | "danger"> = {
  planned: "muted",
  generated: "blue",
  modified: "yellow",
  approved: "primary",
  applied: "primary",
  failed: "danger",
};

export const FileTree: React.FC<FileTreeProps> = ({ artifacts, selectedPath, onSelectPath }) => {
  return (
    <div className="w-full space-y-1">
      <div className="px-2 py-1 flex items-center justify-between text-[11px] font-mono text-foreground-muted uppercase tracking-wider border-b border-border/10 mb-1">
        <span>Proposed File Plan ({artifacts.length})</span>
        <span>Status</span>
      </div>

      <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
        {artifacts.map((a) => {
          const isSelected = a.path === selectedPath;
          const icon = TYPE_ICONS[a.type] || <FileCode className="w-3.5 h-3.5 text-foreground" />;

          return (
            <button
              key={a.path}
              type="button"
              onClick={() => onSelectPath(a.path)}
              className={`w-full flex items-center justify-between p-2 rounded-tactile text-left transition-all border-2 ${
                isSelected
                  ? "bg-surface border-foreground shadow-hard-sm"
                  : "bg-[#FAF7ED] border-transparent hover:bg-surface hover:border-border/40"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">{icon}</span>
                <span className="font-mono text-xs text-foreground truncate" title={a.path}>
                  {a.path}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <Badge variant={STATUS_BADGES[a.status]}>
                  {a.status.toUpperCase()}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
