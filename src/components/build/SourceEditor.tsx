import React, { useState, useEffect } from "react";
import {
  Save,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  FileCode,
  History,
  Download,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react";
import type { BuildArtifact } from "@/types/artifact";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatDate } from "@/lib/utils";

interface SourceEditorProps {
  artifact: BuildArtifact;
  isGenerating: boolean;
  onSaveContent: (path: string, newContent: string) => Promise<void>;
  onRegenerateFile: (path: string) => Promise<void>;
  onApproveArtifact: (path: string) => Promise<void>;
  onRestoreVersion: (path: string, oldContent: string) => Promise<void>;
}

export const SourceEditor: React.FC<SourceEditorProps> = ({
  artifact,
  isGenerating,
  onSaveContent,
  onRegenerateFile,
  onApproveArtifact,
  onRestoreVersion,
}) => {
  const [content, setContent] = useState(artifact.content);
  const [isDirty, setIsDirty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffBaseContent, setDiffBaseContent] = useState<string>("");
  const [revealSecretContent, setRevealSecretContent] = useState<boolean>(false);

  const isSecretEnvFile =
    artifact.path === ".env" ||
    artifact.path.endsWith("/.env") ||
    artifact.path === ".env.local" ||
    artifact.path.endsWith(".pem") ||
    artifact.path.endsWith(".key");

  // Redact actual values if it is a secret file unless explicitly toggled by user
  const displayContent =
    isSecretEnvFile && !revealSecretContent
      ? content
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || !trimmed.includes("=")) return line;
            const idx = line.indexOf("=");
            const k = line.slice(0, idx);
            const v = line.slice(idx + 1).trim();
            if (!v) return line;
            return `${k}=•••••••••••••••• [REDACTED FOR SECURITY]`;
          })
          .join("\n")
      : content;

  useEffect(() => {
    setContent(artifact.content);
    setIsDirty(false);
    setShowDiff(false);
  }, [artifact.path, artifact.content]);

  const handleChange = (newVal: string) => {
    setContent(newVal);
    setIsDirty(newVal !== artifact.content);
  };

  const handleSave = async () => {
    await onSaveContent(artifact.path, content);
    setIsDirty(false);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    // Extract filename from path
    const filename = artifact.path.split("/").pop() || "artifact.txt";
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-surface border-2 border-border rounded-tactile shadow-hard overflow-hidden">
      {/* Top Toolbar */}
      <div className="p-3 bg-[#FAF7ED] border-b-2 border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-accent-blue-strong shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-foreground truncate">
                {artifact.path}
              </span>
              {isDirty && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent-yellow text-foreground border border-border">
                  Unsaved Edits
                </span>
              )}
            </div>
            <p className="text-[10px] font-sans text-foreground-muted truncate">
              {artifact.purpose}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {isSecretEnvFile && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRevealSecretContent(!revealSecretContent)}
              icon={revealSecretContent ? <EyeOff className="w-3 h-3 text-amber-700" /> : <Eye className="w-3 h-3 text-emerald-700" />}
            >
              {revealSecretContent ? "Hide Secrets" : "Reveal Secrets"}
            </Button>
          )}

          <CopyButton text={content} label="Copy Code" />

          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            icon={<Download className="w-3 h-3" />}
          >
            Export
          </Button>

          {artifact.versions && artifact.versions.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              icon={<History className="w-3 h-3" />}
            >
              History ({artifact.versions.length})
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => onRegenerateFile(artifact.path)}
            disabled={isGenerating}
            icon={isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          >
            {isGenerating ? "Generating…" : "Regenerate with AI"}
          </Button>

          {isDirty && (
            <Button size="sm" onClick={handleSave} icon={<Save className="w-3 h-3" />}>
              Save Draft
            </Button>
          )}

          {artifact.status !== "approved" && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onApproveArtifact(artifact.path)}
              icon={<CheckCircle2 className="w-3 h-3" />}
            >
              Approve Artifact
            </Button>
          )}
        </div>
      </div>

      {/* Version History Drawer */}
      {showHistory && (
        <div className="p-3 bg-surface border-b-2 border-border max-h-48 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-border/10">
            <span className="text-xs font-mono font-bold text-foreground">
              Previous Version Snapshots (Select to Inspect / Restore)
            </span>
            <button onClick={() => setShowHistory(false)} className="text-foreground-muted hover:text-foreground text-xs font-mono">
              Close
            </button>
          </div>

          {artifact.versions.map((v, i) => (
            <div
              key={v.versionId || i}
              className="p-2 bg-[#FAF7ED] border border-border rounded-tactile flex items-center justify-between text-xs font-mono"
            >
              <div>
                <span className="font-bold text-foreground">{v.summary}</span>
                <span className="text-[10px] text-foreground-muted ml-2">
                  by {v.author} • {formatDate(v.timestamp)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDiffBaseContent(v.content);
                    setShowDiff(true);
                  }}
                >
                  View Diff
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const confirm = window.confirm("Restore this prior version content into the editor?");
                    if (confirm) {
                      await onRestoreVersion(artifact.path, v.content);
                      setContent(v.content);
                      setShowHistory(false);
                    }
                  }}
                >
                  Restore
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side-by-side or line-based Diff View if active */}
      {showDiff && (
        <div className="p-3 bg-[#FAF7ED] border-b-2 border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-foreground">
              Diff Comparison: Snapshot vs. Current Editor Content
            </span>
            <Button size="sm" variant="ghost" onClick={() => setShowDiff(false)}>
              Close Diff
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono max-h-60 overflow-y-auto">
            <div className="p-2 bg-surface border border-border rounded">
              <span className="text-[10px] font-bold text-foreground-muted block mb-1">Previous Snapshot</span>
              <pre className="text-[11px] whitespace-pre-wrap">{diffBaseContent || "(Empty)"}</pre>
            </div>
            <div className="p-2 bg-surface border border-border rounded">
              <span className="text-[10px] font-bold text-primary block mb-1">Current Editor Draft</span>
              <pre className="text-[11px] whitespace-pre-wrap">{content || "(Empty)"}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 relative flex flex-col p-2">
        {isSecretEnvFile && !revealSecretContent && (
          <div className="mb-2 p-2 bg-amber-50 border border-amber-300 rounded text-[11px] font-mono text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span>Secret values redacted in view for browser security. Click &ldquo;Reveal Secrets&rdquo; to view or edit raw keys.</span>
            </div>
          </div>
        )}
        <textarea
          value={displayContent}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Code contents will appear here upon AI generation or manual authoring..."
          spellCheck={false}
          readOnly={isSecretEnvFile && !revealSecretContent}
          className="w-full flex-1 bg-[#FAF7ED] border border-border rounded-tactile p-3.5 font-mono text-xs text-foreground focus:outline-none focus:bg-surface focus:ring-1 focus:ring-foreground resize-none leading-relaxed"
        />
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-[#FAF7ED] border-t border-border flex items-center justify-between text-[11px] font-mono text-foreground-muted">
        <div>
          <span>Status: </span>
          <span className="font-bold text-foreground">{artifact.status.toUpperCase()}</span>
          {artifact.lastModifiedAt && (
            <span className="ml-3">Updated: {formatDate(artifact.lastModifiedAt)}</span>
          )}
        </div>
        <div>
          <span>Lines: {content.split("\n").length}</span>
          <span className="ml-3">Characters: {content.length}</span>
        </div>
      </div>
    </div>
  );
};
