import React from "react";
import {
  FileCode2,
  Lock,
  ArrowUpRight,
  TestTube,
  Calendar,
  HardDrive,
} from "lucide-react";
import type { FileInspectionResult } from "@/lib/repository/realFsClient";

interface FileInspectionPanelProps {
  inspection: FileInspectionResult | null;
  loading: boolean;
  onNavigateToFile?: (path: string) => void;
}

export const FileInspectionPanel: React.FC<FileInspectionPanelProps> = ({
  inspection,
  loading,
  onNavigateToFile,
}) => {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-surface rounded-tactile border border-border">
        <div className="text-center space-y-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-foreground-muted">Reading file content safely...</p>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-surface rounded-tactile border border-border text-center">
        <FileCode2 className="w-10 h-10 text-foreground-muted/40 mb-3" />
        <h4 className="font-display font-bold text-sm text-foreground">No File Selected</h4>
        <p className="text-xs font-sans text-foreground-muted max-w-xs mt-1">
          Select any file in the tree to view its verified source, dependencies, exports, and security status.
        </p>
      </div>
    );
  }

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-surface border-2 border-border rounded-tactile overflow-hidden shadow-hard-sm">
      {/* File Header */}
      <div className="p-4 bg-[#FAF7ED] border-b-2 border-border flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-base text-foreground">
              {inspection.name}
            </span>
            {inspection.isSecretOrRedacted && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                <Lock className="w-3 h-3 text-amber-800" />
                Secrets Redacted
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-foreground-muted block mt-0.5 truncate max-w-xl">
            {inspection.path}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-foreground-muted">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5" />
            {formatBytes(inspection.sizeBytes)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(inspection.lastModified).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Metadata summary bar: Imports, Exports, Tests */}
      <div className="px-4 py-2 bg-surface border-b border-border/20 flex items-center gap-4 text-xs font-mono flex-wrap">
        <span className="text-foreground-muted">
          <strong>Imports:</strong> {inspection.imports.length}
        </span>
        <span className="text-foreground-muted">
          <strong>Exports:</strong> {inspection.exports.length}
        </span>
        {inspection.relatedTests.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
            <TestTube className="w-3.5 h-3.5 text-emerald-600" />
            Test: {inspection.relatedTests[0]}
          </span>
        ) : (
          <span className="text-foreground-muted/60">No direct test spec</span>
        )}
      </div>

      {/* Main Source Viewer */}
      <div className="flex-1 overflow-auto p-4 bg-[#0F172A] text-slate-100 font-mono text-xs leading-relaxed custom-scrollbar">
        <pre className="select-text whitespace-pre overflow-x-auto font-mono">
          {inspection.content}
        </pre>
      </div>

      {/* Bottom Insights Drawer */}
      {(inspection.imports.length > 0 || inspection.exports.length > 0) && (
        <div className="p-3 bg-[#FAF7ED] border-t-2 border-border max-h-36 overflow-y-auto space-y-2 text-xs font-mono custom-scrollbar">
          {inspection.exports.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted block mb-1">
                Exported Symbols:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {inspection.exports.map((exp, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-surface border border-border rounded text-[11px] text-foreground"
                  >
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {inspection.imports.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted block mb-1">
                Resolved Imports:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {inspection.imports.slice(0, 10).map((imp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onNavigateToFile?.(imp)}
                    className="px-1.5 py-0.5 bg-surface border border-border rounded text-[11px] text-foreground hover:bg-primary/20 transition-colors flex items-center gap-1"
                  >
                    <span>{imp}</span>
                    <ArrowUpRight className="w-2.5 h-2.5 text-foreground-muted" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
