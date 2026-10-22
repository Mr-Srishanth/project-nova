import React, { useState } from "react";
import {
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCode,
  ShieldAlert,
  Loader2,
  FolderArchive,
  ShieldCheck,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ZipExportManifest, ZipExportOptions } from "@/lib/build/zipExportService";
import type { ProjectEnvironmentReport } from "@/lib/build/envConfigService";

interface ZipExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: ZipExportManifest | null;
  onConfirmDownload: (options?: ZipExportOptions) => void;
  isExporting: boolean;
  envReport?: ProjectEnvironmentReport | null;
  onNavigateToConfig?: () => void;
}

export const ZipExportModal: React.FC<ZipExportModalProps> = ({
  isOpen,
  onClose,
  manifest,
  onConfirmDownload,
  isExporting,
  envReport,
  onNavigateToConfig,
}) => {
  const [exportMode, setExportMode] = useState<"safe" | "configured">("safe");
  const [confirmedRisk, setConfirmedRisk] = useState<boolean>(false);

  if (!isOpen || !manifest) return null;

  // Inspect missing required variables for configured mode
  const missingRequiredVars = envReport?.variables.filter(
    (v) => v.isRequired && v.status === "MISSING"
  ) || [];

  const handleDownload = () => {
    if (exportMode === "configured") {
      if (missingRequiredVars.length > 0 || !confirmedRisk) {
        return;
      }
    }
    onConfirmDownload({
      includeConfiguredEnv: exportMode === "configured",
      userConfirmationGranted: exportMode === "configured" ? confirmedRisk : false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface border-2 border-border rounded-tactile shadow-hard max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-border/10 bg-[#FAF7ED]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-tactile-sm bg-[#70C84B]/20 border border-border text-[#153A52]">
              <FolderArchive className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-base text-foreground">
                Download Complete Project ZIP
              </h3>
              <p className="text-xs text-foreground-muted">
                {manifest.projectName} &bull; {manifest.totalIncludedFiles} file(s) ready
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 rounded hover:bg-black/5 text-foreground-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
          {/* Completeness Status Banner */}
          {manifest.isComplete ? (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-tactile flex items-start gap-2.5 shadow-hard-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-display font-bold text-emerald-950 block text-xs">
                  Project Codebase Complete
                </span>
                <p className="text-[11px] font-sans text-emerald-900 leading-relaxed mt-0.5">
                  All {manifest.totalIncludedFiles} canonical files have generated/approved content. The archive contains the complete target project.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-tactile flex items-start gap-2.5 shadow-hard-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-display font-bold text-amber-950 block text-xs">
                  Project Codebase Incomplete ({manifest.ungeneratedFiles.length} ungenerated files)
                </span>
                <p className="text-[11px] font-sans text-amber-900 leading-relaxed mt-0.5">
                  Some canonical files currently contain planned blueprint placeholders rather than synthesized code. You can download the available project files now or return to Build Studio to generate all files first.
                </p>
              </div>
            </div>
          )}

          {/* Export Mode Selection */}
          <div className="space-y-2 pt-1">
            <span className="font-mono font-bold text-[11px] text-foreground uppercase block">
              Archive Configuration Mode
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setExportMode("safe");
                  setConfirmedRisk(false);
                }}
                className={`p-3 rounded-tactile border text-left flex flex-col justify-between transition-all ${
                  exportMode === "safe"
                    ? "bg-emerald-50/80 border-emerald-500 shadow-hard-sm ring-1 ring-emerald-500"
                    : "bg-[#FAF7ED] border-border hover:bg-surface"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-foreground mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Safe ZIP (Recommended)</span>
                </div>
                <p className="text-[10px] text-foreground-muted leading-tight">
                  Contains clean <code>.env.example</code> with placeholders and <code>.gitignore</code>. No real keys or credentials.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportMode("configured")}
                className={`p-3 rounded-tactile border text-left flex flex-col justify-between transition-all ${
                  exportMode === "configured"
                    ? "bg-amber-50/80 border-amber-500 shadow-hard-sm ring-1 ring-amber-500"
                    : "bg-[#FAF7ED] border-border hover:bg-surface"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-foreground mb-1">
                  <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Download Configured ZIP (includes secrets)</span>
                </div>
                <p className="text-[10px] text-foreground-muted leading-tight">
                  Bundles active local <code>.env</code> file populated with your configured target values.
                </p>
              </button>
            </div>
          </div>

          {/* Missing Required Check in Configured Mode */}
          {exportMode === "configured" && missingRequiredVars.length > 0 && (
            <div className="p-3 bg-red-50 border-2 border-red-400 rounded-tactile space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-red-950 font-sans leading-relaxed">
                  <strong>Missing Required Target Credentials:</strong>
                  <p className="mt-1">
                    This project requires the following environment variables before a fully runnable Configured ZIP can be packaged:
                  </p>
                  <ul className="list-disc list-inside mt-1 font-mono text-[10px] space-y-0.5">
                    {missingRequiredVars.map((v) => (
                      <li key={v.name}>
                        <strong>{v.name}</strong> — {v.purpose}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px]">
                    Please configure these values in the Target Project Environment section below before downloading.
                  </p>
                </div>
              </div>

              {onNavigateToConfig && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToConfig();
                  }}
                  className="px-2.5 py-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700 flex items-center gap-1"
                >
                  <span>Go to Environment Configuration</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Configured Mode Warning & Confirmation Checkbox */}
          {exportMode === "configured" && missingRequiredVars.length === 0 && (
            <div className="p-3 bg-amber-50/90 border-2 border-amber-400 rounded-tactile space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-950 font-sans leading-relaxed">
                  <strong>Explicit Security Confirmation:</strong> This archive will contain a live <code className="font-mono bg-white px-1 py-0.5 rounded">.env</code> file with real target credentials. Anyone with access to this ZIP file will have full access to these keys.
                  <ul className="list-disc list-inside mt-1 text-[10px] text-amber-900">
                    <li>Never commit this archive to public repositories or shared drives.</li>
                    <li>The included <code>.gitignore</code> automatically excludes <code>.env</code> once extracted.</li>
                    <li><code>GEMINI_API_KEY</code> is reserved for backend runtime and excluded from Vite client bundles.</li>
                  </ul>
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none border-t border-amber-200">
                <input
                  type="checkbox"
                  checked={confirmedRisk}
                  onChange={(e) => setConfirmedRisk(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span className="text-[11px] font-bold text-amber-950">
                  I understand the security risk and explicitly confirm bundling real credentials into this ZIP.
                </span>
              </label>
            </div>
          )}

          {/* Metrics Overview */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="p-2 bg-[#FAF7ED] border border-border rounded-tactile">
              <span className="block text-foreground-muted text-[10px]">INCLUDED</span>
              <span className="text-sm font-bold text-foreground">
                {manifest.totalIncludedFiles + (exportMode === "configured" && confirmedRisk && missingRequiredVars.length === 0 ? 1 : 0)}
              </span>
            </div>
            <div className="p-2 bg-[#FAF7ED] border border-border rounded-tactile">
              <span className="block text-foreground-muted text-[10px]">UNGENERATED</span>
              <span className={`text-sm font-bold ${manifest.ungeneratedFiles.length > 0 ? "text-amber-700" : "text-foreground"}`}>
                {manifest.ungeneratedFiles.length}
              </span>
            </div>
            <div className="p-2 bg-[#FAF7ED] border border-border rounded-tactile">
              <span className="block text-foreground-muted text-[10px]">EXCLUDED</span>
              <span className="text-sm font-bold text-foreground">
                {exportMode === "configured" && confirmedRisk && missingRequiredVars.length === 0 ? manifest.exclusions.length - 1 : manifest.exclusions.length}
              </span>
            </div>
          </div>

          {/* Files List Preview */}
          <div className="space-y-1.5">
            <span className="font-mono font-bold text-[11px] text-foreground uppercase">
              Export Archive Manifest ({manifest.files.length + (exportMode === "configured" && confirmedRisk && missingRequiredVars.length === 0 ? 1 : 0)} files)
            </span>
            <div className="p-2.5 bg-[#FAF7ED] border border-border rounded-tactile max-h-40 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-1">
              {exportMode === "configured" && confirmedRisk && missingRequiredVars.length === 0 && (
                <div className="flex items-center justify-between text-amber-900 font-bold bg-amber-100/50 p-1 rounded">
                  <div className="flex items-center gap-1.5 truncate">
                    <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="truncate">.env (Local Configured with Selected Values)</span>
                  </div>
                  <span className="text-[10px] text-amber-700 shrink-0 ml-2">Active</span>
                </div>
              )}
              {manifest.files.map((f) => (
                <div key={f.path} className="flex items-center justify-between text-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCode className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{f.path}</span>
                  </div>
                  <span className="text-[10px] text-foreground-muted shrink-0 ml-2">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Safety & Secret Exclusion Report */}
          {manifest.exclusions.length > 0 && exportMode === "safe" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-foreground font-mono font-bold text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" />
                <span>Security Gate: Safe Exclusion Filter Applied</span>
              </div>
              <div className="p-2 bg-emerald-50/60 border border-emerald-200 rounded-tactile text-[11px] text-emerald-950 font-sans leading-relaxed">
                <p>
                  ProjectNova strictly excluded {manifest.exclusions.length} file(s) matching secrets (.env, keys) or system build clutter to guarantee archive hygiene.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t-2 border-border/10 bg-[#FAF7ED]">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={
              isExporting ||
              (exportMode === "configured" && (missingRequiredVars.length > 0 || !confirmedRisk))
            }
            icon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          >
            {isExporting
              ? "Packaging ZIP..."
              : exportMode === "configured"
              ? "Download Configured ZIP (includes secrets)"
              : manifest.isComplete
              ? "Download Safe ZIP"
              : "Download Available Files as Safe ZIP"}
          </Button>
        </div>
      </div>
    </div>
  );
};
