import React from "react";
import { X, Circle } from "lucide-react";

export interface EditorTabItem {
  path: string;
  isDirty?: boolean;
  status?: string;
}

interface IDEEditorTabsProps {
  openTabs: EditorTabItem[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
}

export const IDEEditorTabs: React.FC<IDEEditorTabsProps> = ({
  openTabs,
  activePath,
  onSelectTab,
  onCloseTab,
}) => {
  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center bg-[#252526] border-b border-[#1e1e1e] overflow-x-auto select-none text-xs">
      {openTabs.map((tab) => {
        const isActive = activePath === tab.path;
        const filename = tab.path.split("/").pop() || tab.path;

        return (
          <div
            key={tab.path}
            onClick={() => onSelectTab(tab.path)}
            className={`group flex items-center gap-2 px-3 py-2 border-r border-[#1e1e1e] cursor-pointer transition-colors ${
              isActive
                ? "bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc] font-medium"
                : "bg-[#2d2d2d] text-gray-400 hover:bg-[#252526] hover:text-gray-200"
            }`}
            title={tab.path}
          >
            <span className="truncate max-w-[150px]">{filename}</span>

            {/* Dirty Indicator or Close Button */}
            <div className="flex items-center">
              {tab.isDirty ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                  className="w-4 h-4 flex items-center justify-center hover:bg-[#333] rounded"
                  title="Unsaved changes (Click to close)"
                >
                  <Circle className="w-2 h-2 fill-white text-white group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:block" />
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-[#333] rounded p-0.5"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
