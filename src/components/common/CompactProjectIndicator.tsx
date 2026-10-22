import React from "react";
import { Link } from "react-router-dom";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";
import { ChevronRight } from "lucide-react";

export const CompactProjectIndicator: React.FC = () => {
  const { activeProject } = useActiveProject();

  if (!activeProject) {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border-2 border-border rounded-tactile text-xs font-mono text-amber-800">
        <span>No project activated.</span>
        <Link to="/" className="font-bold underline hover:text-amber-950">
          Select on Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-surface border-2 border-border rounded-tactile shadow-hard-xs">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-[10px] font-mono font-bold uppercase text-foreground-muted shrink-0">
          Project:
        </span>
        <span className="font-display font-bold text-xs text-foreground truncate max-w-[200px]" title={activeProject.name}>
          {activeProject.name}
        </span>
      </div>

      <Link
        to="/"
        className="text-[11px] font-mono text-foreground-muted hover:text-foreground hover:underline shrink-0 flex items-center gap-0.5"
        title="Switch active project on Home dashboard"
      >
        <span>Switch on Home</span>
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
};
