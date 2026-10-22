import React from "react";
import {
  Files,
  GitBranch,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export type ActivityBarTab = "explorer" | "search" | "git" | "debug" | "problems" | "ai";

interface IDEActivityBarProps {
  activeTab: ActivityBarTab;
  onSelectTab: (tab: ActivityBarTab) => void;
  problemCount: number;
  changedFileCount: number;
}

export const IDEActivityBar: React.FC<IDEActivityBarProps> = ({
  activeTab,
  onSelectTab,
  problemCount,
  changedFileCount,
}) => {
  return (
    <div className="w-12 bg-[#333333] flex flex-col items-center py-2 select-none border-r border-[#252526] z-10">
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Explorer */}
        <button
          onClick={() => onSelectTab("explorer")}
          className={`relative p-2.5 rounded-lg transition-colors ${
            activeTab === "explorer"
              ? "text-white border-l-2 border-white bg-[#252526]"
              : "text-gray-400 hover:text-white"
          }`}
          title="Explorer (Ctrl+Shift+E)"
        >
          <Files className="w-5 h-5" />
        </button>

        {/* Source Control / Git */}
        <button
          onClick={() => onSelectTab("git")}
          className={`relative p-2.5 rounded-lg transition-colors ${
            activeTab === "git"
              ? "text-white border-l-2 border-white bg-[#252526]"
              : "text-gray-400 hover:text-white"
          }`}
          title="Source Control (Ctrl+Shift+G)"
        >
          <GitBranch className="w-5 h-5" />
          {changedFileCount > 0 && (
            <span className="absolute top-1 right-1 px-1 text-[9px] font-bold bg-[#007acc] text-white rounded-full">
              {changedFileCount}
            </span>
          )}
        </button>

        {/* Problems & Diagnostics */}
        <button
          onClick={() => onSelectTab("problems")}
          className={`relative p-2.5 rounded-lg transition-colors ${
            activeTab === "problems"
              ? "text-white border-l-2 border-white bg-[#252526]"
              : "text-gray-400 hover:text-white"
          }`}
          title="Problems & Diagnostics"
        >
          <AlertTriangle className="w-5 h-5" />
          {problemCount > 0 && (
            <span className="absolute top-1 right-1 px-1 text-[9px] font-bold bg-amber-600 text-white rounded-full">
              {problemCount}
            </span>
          )}
        </button>

        {/* AI Assistant */}
        <button
          onClick={() => onSelectTab("ai")}
          className={`relative p-2.5 rounded-lg transition-colors ${
            activeTab === "ai"
              ? "text-white border-l-2 border-emerald-400 bg-[#252526]"
              : "text-gray-400 hover:text-emerald-400"
          }`}
          title="AI Pair Programmer"
        >
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </button>
      </div>
    </div>
  );
};
