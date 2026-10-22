import React, { useState, useEffect } from "react";
import {
  Save,
  Download,
  History,
  RotateCcw,
  AlertTriangle,
  Eye,
  Edit3,
} from "lucide-react";
import type { ProjectDocument } from "@/types/document";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface DocWorkbenchProps {
  document: ProjectDocument;
  onSave: (newContent: string, summary: string) => Promise<void>;
  onRevertVersion: (versionNumber: number) => Promise<void>;
  onDismissDrift: (driftId: string) => void;
  onResolveDrift: (driftId: string) => void;
  onDownload: () => void;
}

export const DocWorkbench: React.FC<DocWorkbenchProps> = ({
  document,
  onSave,
  onRevertVersion,
  onDismissDrift,
  onResolveDrift,
  onDownload,
}) => {
  const [content, setContent] = useState(document.content);
  const [isDirty, setIsDirty] = useState(false);
  const [activeView, setActiveView] = useState<"edit" | "preview" | "history">("edit");

  useEffect(() => {
    setContent(document.content);
    setIsDirty(false);
  }, [document.id, document.content]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(e.target.value !== document.content);
  };

  const handleSaveClick = async () => {
    await onSave(content, "Updated document contents");
    setIsDirty(false);
  };

  const openDriftFindings = document.driftFindings?.filter((f) => f.status === "open") || [];

  return (
    <div className="space-y-4">
      {/* Top action toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-surface border-2 border-border rounded-tactile shadow-hard-sm">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-extrabold text-base text-foreground truncate">
              {document.title}
            </h3>
            {isDirty && (
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-accent-yellow-soft text-accent-yellow border border-accent-yellow/20 rounded">
                UNSAVED CHANGES
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-muted font-mono truncate">
            Sources: {document.sourcesUsed.join(", ") || "Manual"} • Updated:{" "}
            {new Date(document.updatedAt).toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View switcher */}
          <div className="flex items-center bg-background border border-border rounded-tactile p-0.5 text-xs font-bold">
            <button
              onClick={() => setActiveView("edit")}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                activeView === "edit" ? "bg-primary text-primary-foreground" : "text-foreground-muted"
              }`}
            >
              <Edit3 className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={() => setActiveView("preview")}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                activeView === "preview" ? "bg-primary text-primary-foreground" : "text-foreground-muted"
              }`}
            >
              <Eye className="w-3 h-3" /> Preview
            </button>
            <button
              onClick={() => setActiveView("history")}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                activeView === "history" ? "bg-primary text-primary-foreground" : "text-foreground-muted"
              }`}
            >
              <History className="w-3 h-3" /> Revisions ({document.versions?.length || 0})
            </button>
          </div>

          <Button variant="ghost" size="sm" onClick={onDownload} icon={<Download className="w-3.5 h-3.5" />}>
            Export
          </Button>

          {isDirty && (
            <Button size="sm" onClick={handleSaveClick} icon={<Save className="w-3.5 h-3.5" />}>
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Living Drift Alerts Banner */}
      {openDriftFindings.length > 0 && (
        <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-tactile shadow-hard-sm space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Living Drift Detected ({openDriftFindings.length} discrepancy found against project sources)</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {openDriftFindings.map((drift) => (
              <div
                key={drift.id}
                className="p-2 bg-white/70 border border-amber-200 rounded flex items-start justify-between gap-3 text-amber-950"
              >
                <div>
                  <span className="font-bold mr-1">[{drift.section}]:</span>
                  <span>{drift.reason}</span>
                  <span className="block text-[11px] text-amber-800 mt-0.5">
                    <strong>Action:</strong> {drift.suggestedAction}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onResolveDrift(drift.id)}
                    className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded"
                  >
                    Resolved
                  </button>
                  <button
                    onClick={() => onDismissDrift(drift.id)}
                    className="px-2 py-0.5 text-[10px] font-bold text-foreground-muted hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Mode View */}
      {activeView === "edit" && (
        <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-2">
          <textarea
            value={content}
            onChange={handleTextChange}
            rows={22}
            className="w-full p-3 bg-background border border-border rounded-tactile font-mono text-xs text-foreground focus:outline-none focus:border-primary leading-relaxed resize-y"
          />
        </Card>
      )}

      {activeView === "preview" && (
        <Card className="p-6 bg-surface border-2 border-border shadow-hard-sm prose prose-sm max-w-none font-sans overflow-x-auto min-h-[460px]">
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground bg-background p-4 rounded border border-border">
            {content}
          </pre>
        </Card>
      )}

      {activeView === "history" && (
        <Card className="p-5 bg-surface border-2 border-border shadow-hard-sm space-y-4">
          <h4 className="font-bold text-sm text-foreground">Document Version Snapshots</h4>
          {document.versions.length === 0 ? (
            <p className="text-xs text-foreground-muted">No prior version snapshots recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {document.versions.map((ver) => (
                <div
                  key={ver.versionId}
                  className="p-3 bg-background border border-border rounded-tactile flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground">
                      Version #{ver.versionNumber} ({ver.author.toUpperCase()})
                    </span>
                    <p className="text-foreground-muted">{ver.summary}</p>
                    <span className="text-[10px] font-mono text-foreground-muted">
                      Snapshot at: {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRevertVersion(ver.versionNumber)}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Restore Snapshot
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
