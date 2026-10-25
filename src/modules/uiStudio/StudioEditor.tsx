/**
 * StudioEditor.tsx — Code editor panel for UI Studio in Project Nova.
 *
 * Provides a textarea-based code editor with tab management,
 * line numbers, cursor position tracking, and keyboard shortcuts.
 */

import React, { useRef, useCallback, useEffect, useState } from "react";
import { X, Undo2, AlignLeft, Search, Replace } from "lucide-react";
import type { SourceFile } from "@/lib/uiStudio/studioSourceStore";
import {
  editFullSource,
  undo,
  formatSource,
  findAndReplaceAll,
  getCursorPosition,
  setCursorPosition,
  offsetToLineCol,
} from "@/lib/uiStudio/sourceEdit";

interface StudioEditorProps {
  files: SourceFile[];
  activeFile: SourceFile | null;
  activeFileId: string | null;
  dirtyFileIds: Set<string>;
  onSelectFile: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  openTabIds: string[];
}

export const StudioEditor: React.FC<StudioEditorProps> = ({
  files,
  activeFile,
  activeFileId,
  dirtyFileIds,
  onSelectFile,
  onCloseTab,
  openTabIds,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 0, column: 0 });
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  // Restore cursor position when switching files
  useEffect(() => {
    if (!activeFileId || !textareaRef.current) return;
    const pos = getCursorPosition(activeFileId);
    setCursorInfo({ line: pos.line, column: pos.column });
  }, [activeFileId]);

  // Focus textarea when active file changes
  useEffect(() => {
    if (activeFile && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeFile]);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!activeFileId) return;
      editFullSource(activeFileId, e.target.value);
    },
    [activeFileId]
  );

  const handleCursorMove = useCallback(() => {
    if (!activeFileId || !textareaRef.current || !activeFile) return;
    const pos = textareaRef.current.selectionStart;
    const lineCol = offsetToLineCol(activeFile.code, pos);
    setCursorInfo({ line: lineCol.line, column: lineCol.column });
    setCursorPosition(activeFileId, {
      line: lineCol.line,
      column: lineCol.column,
      selectionStart: textareaRef.current.selectionStart,
      selectionEnd: textareaRef.current.selectionEnd,
    });
  }, [activeFileId, activeFile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!activeFileId) return;

      // Tab key — insert spaces instead of moving focus
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const value = ta.value;
        const newValue = value.substring(0, start) + "  " + value.substring(end);
        editFullSource(activeFileId, newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = start + 2;
          ta.selectionEnd = start + 2;
        });
      }

      // Ctrl+Z — undo
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo(activeFileId);
      }

      // Ctrl+Shift+F — format
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        formatSource(activeFileId);
      }

      // Ctrl+H — find and replace
      if (e.ctrlKey && e.key === "h") {
        e.preventDefault();
        setShowFindReplace((v) => !v);
      }

      // Ctrl+F — find
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        setShowFindReplace(true);
      }
    },
    [activeFileId]
  );

  const handleFindReplace = useCallback(() => {
    if (!activeFileId || !findText) return;
    const count = findAndReplaceAll(activeFileId, findText, replaceText);
    if (count > 0) {
      setFindText("");
      setReplaceText("");
      setShowFindReplace(false);
    }
  }, [activeFileId, findText, replaceText]);

  const openFiles = openTabIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is SourceFile => f !== undefined);

  return (
    <div className="studio-editor-area">
      {/* Tabs */}
      <div className="studio-editor-tabs">
        {openFiles.map((file) => (
          <div
            key={file.id}
            className="studio-editor-tab"
            data-active={file.id === activeFileId}
            onClick={() => onSelectFile(file.id)}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelectFile(file.id);
            }}
          >
            <span className="truncate max-w-[120px]">{file.name}</span>
            {dirtyFileIds.has(file.id) && <span className="dirty-dot" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(file.id);
              }}
              title="Close tab"
              className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-black/10 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Find & Replace bar */}
      {showFindReplace && (
        <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/30">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder="Find"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            className="h-7 w-40 text-xs px-2 border rounded bg-background"
          />
          <Replace className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            placeholder="Replace"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            className="h-7 w-40 text-xs px-2 border rounded bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFindReplace();
            }}
          />
          <button
            type="button"
            className="h-7 px-2 text-xs font-medium border rounded bg-primary text-primary-foreground hover:opacity-90"
            onClick={handleFindReplace}
          >
            Replace All
          </button>
          <button
            type="button"
            className="h-7 px-1.5 text-xs rounded hover:bg-black/5"
            onClick={() => setShowFindReplace(false)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Editor */}
      {activeFile ? (
        <textarea
          ref={textareaRef}
          className="studio-code-editor"
          value={activeFile.code}
          onChange={handleCodeChange}
          onKeyDown={handleKeyDown}
          onSelect={handleCursorMove}
          onClick={handleCursorMove}
          onKeyUp={handleCursorMove}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <p className="text-sm">Select a file from the explorer to start editing</p>
        </div>
      )}

      {/* Status bar */}
      <div className="studio-editor-status">
        <div className="status-left">
          {activeFile && (
            <>
              <span>
                Ln {cursorInfo.line + 1}, Col {cursorInfo.column + 1}
              </span>
              <span>{activeFile.language.toUpperCase()}</span>
              <span>{activeFile.code.split("\n").length} lines</span>
            </>
          )}
        </div>
        <div className="status-right">
          {activeFileId && (
            <>
              <button
                type="button"
                className="p-1 rounded hover:bg-black/5"
                title="Undo (Ctrl+Z)"
                onClick={() => undo(activeFileId)}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                className="p-1 rounded hover:bg-black/5"
                title="Format (Ctrl+Shift+F)"
                onClick={() => formatSource(activeFileId)}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <span className="text-[10px]">UTF-8</span>
        </div>
      </div>
    </div>
  );
};
