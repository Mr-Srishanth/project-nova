import React from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";

interface MonacoCodeEditorProps {
  filePath: string;
  value: string;
  language?: string;
  isReadOnly?: boolean;
  onChange: (newValue: string) => void;
  onSave?: () => void;
  diagnosticLine?: number;
  highlightLineRange?: { startLineNumber: number; endLineNumber?: number } | null;
  onContinueCode?: (context: {
    prefix: string;
    suffix: string;
    selectedText: string;
    position: { lineNumber: number; column: number };
    selectionRange: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } | null;
  }) => void;
  onExplainCode?: (context: {
    filePath: string;
    selectedText: string;
    selectionRange: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } | null;
  }) => void;
  onMountEditor?: (editor: any, monaco: any) => void;
}

export function inferMonacoLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "py":
      return "python";
    case "sql":
      return "sql";
    case "md":
      return "markdown";
    case "sh":
    case "bash":
      return "shell";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "plaintext";
  }
}

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  filePath,
  value,
  language,
  isReadOnly = false,
  onChange,
  onSave,
  diagnosticLine,
  highlightLineRange,
  onContinueCode,
  onExplainCode,
  onMountEditor,
}) => {
  const editorRef = React.useRef<any>(null);
  const decorationsRef = React.useRef<any[]>([]);
  const lang = language || inferMonacoLanguage(filePath);

  const triggerExplainCode = React.useCallback(() => {
    if (!onExplainCode || !editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const selection = editor.getSelection();
    const hasSelection =
      selection &&
      (selection.startLineNumber !== selection.endLineNumber ||
        selection.startColumn !== selection.endColumn);
    const selectedText = hasSelection ? model.getValueInRange(selection) : "";

    onExplainCode({
      filePath,
      selectedText,
      selectionRange: hasSelection
        ? {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn,
          }
        : null,
    });
  }, [onExplainCode, filePath]);

  const triggerContinueCode = React.useCallback(() => {
    if (!onContinueCode || !editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const position = editor.getPosition() || { lineNumber: 1, column: 1 };
    const selection = editor.getSelection();
    const hasSelection =
      selection &&
      (selection.startLineNumber !== selection.endLineNumber ||
        selection.startColumn !== selection.endColumn);

    const fullText = model.getValue();
    const cursorOffset = model.getOffsetAt(position);
    const selectedText = hasSelection ? model.getValueInRange(selection) : "";

    const prefix = hasSelection
      ? fullText.slice(0, model.getOffsetAt(selection.getStartPosition()))
      : fullText.slice(0, cursorOffset);

    const suffix = hasSelection
      ? fullText.slice(model.getOffsetAt(selection.getEndPosition()))
      : fullText.slice(cursorOffset);

    onContinueCode({
      prefix,
      suffix,
      selectedText,
      position,
      selectionRange: hasSelection
        ? {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn,
          }
        : null,
    });
  }, [onContinueCode]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    if (onMountEditor) {
      onMountEditor(editor, monaco);
    }

    // Register Ctrl+S / Cmd+S shortcut inside Monaco
    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave();
      });
    }

    // Register Ctrl+K or Alt+\ for AI Continue Code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      triggerContinueCode();
    });

    // Register Right-Click / Context Menu Action: "AI → Continue Code"
    editor.addAction({
      id: "projectnova-ai-continue-code",
      label: "AI: Continue Code (Ctrl+K)",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 1.5,
      run: () => {
        triggerContinueCode();
      },
    });

    // Register Right-Click / Context Menu Action: "AI → Explain Code"
    editor.addAction({
      id: "projectnova-ai-explain-code",
      label: "AI: Explain Code",
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 1.6,
      run: () => {
        triggerExplainCode();
      },
    });

    // If an initial diagnostic line was passed, reveal it
    if (diagnosticLine && diagnosticLine > 0) {
      editor.revealLineInCenter(diagnosticLine);
      editor.setPosition({ lineNumber: diagnosticLine, column: 1 });
    }
  };

  React.useEffect(() => {
    if (editorRef.current && diagnosticLine && diagnosticLine > 0) {
      editorRef.current.revealLineInCenter(diagnosticLine);
      editorRef.current.setPosition({ lineNumber: diagnosticLine, column: 1 });
    }
  }, [diagnosticLine]);

  // Handle active line range highlighting from code explainer navigation
  React.useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    if (highlightLineRange && highlightLineRange.startLineNumber > 0) {
      const start = highlightLineRange.startLineNumber;
      const end = highlightLineRange.endLineNumber || start;
      editor.revealLineInCenter(start);
      editor.setPosition({ lineNumber: start, column: 1 });

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
        {
          range: {
            startLineNumber: start,
            startColumn: 1,
            endLineNumber: end,
            endColumn: 1000,
          },
          options: {
            isWholeLine: true,
            className: "bg-emerald-500/20 border-l-2 border-emerald-400",
            glyphMarginClassName: "bg-emerald-400",
          },
        },
      ]);
    } else if (decorationsRef.current.length > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }
  }, [highlightLineRange]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#1e1e1e]">
      <Editor
        height="100%"
        width="100%"
        path={filePath}
        language={lang}
        value={value}
        theme="vs-dark"
        onChange={(val) => onChange(val || "")}
        onMount={handleEditorDidMount}
        loading={
          <div className="flex items-center justify-center h-full gap-2 text-xs font-mono text-gray-400 bg-[#1e1e1e]">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading Monaco Editor…</span>
          </div>
        }
        options={{
          readOnly: isReadOnly,
          fontSize: 13,
          fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: true, maxColumn: 80, scale: 1 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          lineNumbers: "on",
          glyphMargin: true,
          folding: true,
          bracketPairColorization: { enabled: true },
          cursorBlinking: "smooth",
          smoothScrolling: true,
          renderWhitespace: "selection",
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
};
