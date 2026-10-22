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
}) => {
  const editorRef = React.useRef<any>(null);
  const lang = language || inferMonacoLanguage(filePath);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register Ctrl+S / Cmd+S shortcut inside Monaco
    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave();
      });
    }

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
