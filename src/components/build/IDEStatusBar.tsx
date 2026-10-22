import React from "react";
import { GitBranch, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

interface IDEStatusBarProps {
  projectName: string;
  currentFilePath: string | null;
  language: string;
  isDirty?: boolean;
  problemCount: number;
  branch?: string;
  onOpenProblems?: () => void;
  onOpenGit?: () => void;
}

export const IDEStatusBar: React.FC<IDEStatusBarProps> = ({
  projectName,
  language,
  isDirty = false,
  problemCount,
  branch = "main",
  onOpenProblems,
  onOpenGit,
}) => {
  return (
    <div className="h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[11px] font-mono select-none z-10 shrink-0">
      {/* Left side items */}
      <div className="flex items-center gap-4">
        {/* Git Branch */}
        <button
          onClick={onOpenGit}
          className="flex items-center gap-1 hover:bg-[#005a9e] px-1.5 py-0.5 rounded transition-colors"
          title="Git Branch"
        >
          <GitBranch className="w-3 h-3" />
          <span>{branch}</span>
        </button>

        {/* Diagnostic Problems Status */}
        <button
          onClick={onOpenProblems}
          className="flex items-center gap-1 hover:bg-[#005a9e] px-1.5 py-0.5 rounded transition-colors"
          title="Diagnostics"
        >
          {problemCount === 0 ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-200" />
              <span>0 problems</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 text-amber-200" />
              <span>{problemCount} problems</span>
            </>
          )}
        </button>

        {/* Active Project Label */}
        <span className="hidden sm:inline text-white/80">Project: {projectName}</span>
      </div>

      {/* Right side items */}
      <div className="flex items-center gap-4">
        {isDirty && (
          <span className="px-1.5 py-0.2 bg-amber-400 text-amber-950 font-bold rounded text-[10px]">
            Unsaved Edits
          </span>
        )}
        <span className="text-white/90">{language}</span>
        <span className="hidden sm:inline text-white/80">UTF-8</span>
        <span className="flex items-center gap-1 text-emerald-200" title="ProjectNova Sandboxed Workspace">
          <ShieldCheck className="w-3 h-3" />
          <span>Sandboxed</span>
        </span>
      </div>
    </div>
  );
};
