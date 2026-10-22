import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { BuildArtifact } from "@/types/artifact";
import type { ViewportMode, PreviewLifecycleStage } from "@/types/uiStudio";
import { buildTargetProjectPreviewHtml } from "@/lib/preview/previewBuilder";

interface InAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  artifacts: BuildArtifact[];
  isDirty?: boolean;
}

export const InAppPreviewModal: React.FC<InAppPreviewModalProps> = ({
  isOpen,
  onClose,
  projectName,
  artifacts,
  isDirty = false,
}) => {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [previewStage, setPreviewStage] = useState<PreviewLifecycleStage>("building");
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [buildKey, setBuildKey] = useState<number>(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build standalone preview HTML document
  const previewResult = useMemo(() => {
    if (!isOpen || artifacts.length === 0) return null;
    try {
      return buildTargetProjectPreviewHtml(projectName, artifacts);
    } catch (err: any) {
      return {
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#0f172a;color:#f87171"><h3>Build Error</h3><pre>${err.message}</pre></body></html>`,
        diagnostics: [err.message],
        buildId: "err",
        archetype: "general_app" as const,
      };
    }
  }, [isOpen, projectName, artifacts, buildKey]);

  // Listen for iframe communication / handshake
  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      const { type, message } = e.data;

      if (type === "PREVIEW_DOCUMENT_LOADED") {
        setPreviewStage("loading");
      } else if (type === "PREVIEW_MOUNTED_SUCCESS") {
        setPreviewStage("ready");
        setRuntimeError(null);
      } else if (type === "PREVIEW_RUNTIME_ERROR" || type === "PREVIEW_BUILD_ERROR") {
        setRuntimeError(message || "An error occurred while running the preview.");
        setPreviewStage("runtime_error");
      }
    };

    window.addEventListener("message", handleMessage);

    // Watchdog fallback: mark ready after 2s if handshake didn't fire
    const timer = setTimeout(() => {
      setPreviewStage((prev) => (prev === "building" || prev === "loading" ? "ready" : prev));
    }, 2000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timer);
    };
  }, [isOpen, buildKey]);

  const handleRefresh = useCallback(() => {
    setPreviewStage("building");
    setRuntimeError(null);
    setBuildKey((k) => k + 1);
  }, []);

  const handleOpenInNewTab = () => {
    if (!previewResult) return;
    const blob = new Blob([previewResult.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      {/* Modal Container: near-fullscreen 94vw x 88vh */}
      <div className="w-[94vw] h-[88vh] max-w-7xl bg-[#1e1e1e] border-2 border-border rounded-tactile shadow-2xl flex flex-col overflow-hidden relative">
        {/* Compact Top Preview Toolbar */}
        <div className="h-12 bg-[#252526] border-b border-[#2d2d2d] px-4 flex items-center justify-between select-none shrink-0">
          {/* Left: Project title & status indicator */}
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-sm text-white truncate max-w-[220px]">
              {projectName}
            </span>

            {/* Status Pill */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border">
              {previewStage === "building" && (
                <>
                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-amber-400 font-semibold">Building…</span>
                </>
              )}
              {previewStage === "ready" && (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Ready</span>
                </>
              )}
              {(previewStage === "runtime_error" || previewStage === "build_failed") && (
                <>
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span className="text-rose-400 font-semibold">Error</span>
                </>
              )}
            </div>

            {/* Unsaved indicator */}
            {isDirty && (
              <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                Unsaved Edits in IDE
              </span>
            )}
          </div>

          {/* Center: Viewport Controls */}
          <div className="flex items-center bg-[#181818] p-0.5 rounded border border-[#3c3c3c]">
            <button
              onClick={() => setViewport("desktop")}
              className={`p-1.5 rounded transition-colors ${
                viewport === "desktop" ? "bg-[#007acc] text-white" : "text-gray-400 hover:text-white"
              }`}
              title="Desktop View (100%)"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport("tablet")}
              className={`p-1.5 rounded transition-colors ${
                viewport === "tablet" ? "bg-[#007acc] text-white" : "text-gray-400 hover:text-white"
              }`}
              title="Tablet View (768px)"
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport("mobile")}
              className={`p-1.5 rounded transition-colors ${
                viewport === "mobile" ? "bg-[#007acc] text-white" : "text-gray-400 hover:text-white"
              }`}
              title="Mobile View (375px)"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Actions (Refresh, New Tab, Close) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white rounded transition-colors"
              title="Rebuild & Refresh Preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleOpenInNewTab}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
              title="Open Preview in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-5 bg-gray-600 mx-1" />

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-rose-900/60 rounded transition-colors"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagnostic Error Banner if present */}
        {runtimeError && (
          <div className="px-4 py-2 bg-rose-950/90 border-b border-rose-500/40 text-rose-200 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{runtimeError}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="px-2 py-0.5 bg-rose-800 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Viewport Canvas Stage */}
        <div className="flex-1 min-h-0 w-full overflow-auto bg-[#121212] p-4 flex items-center justify-center relative select-none">
          {previewResult ? (
            <div
              className={`transition-all duration-200 flex flex-col relative mx-auto items-center justify-center shrink-0 ${
                viewport === "desktop"
                  ? "w-full h-full rounded shadow bg-slate-950 overflow-hidden border border-[#2d2d2d]"
                  : viewport === "tablet"
                  ? "w-[768px] max-w-full h-[900px] max-h-full rounded-xl shadow-2xl border-4 border-slate-800 bg-slate-950 overflow-hidden"
                  : "w-[375px] max-w-full h-[740px] max-h-full rounded-3xl shadow-2xl border-[6px] border-slate-800 bg-slate-950 overflow-hidden"
              }`}
            >
              {/* Smartphone Top Notch */}
              {viewport === "mobile" && (
                <div className="h-4 w-full bg-slate-900 flex items-center justify-center shrink-0 border-b border-slate-800">
                  <div className="w-12 h-1 bg-slate-700 rounded-full" />
                </div>
              )}

              {/* Sandboxed Secure Iframe */}
              <iframe
                ref={iframeRef}
                srcDoc={previewResult.html}
                title="Project Live Preview"
                className="w-full flex-1 border-0 bg-slate-950 block min-h-0"
                sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
              />

              {/* Smartphone Home Indicator */}
              {viewport === "mobile" && (
                <div className="h-4 w-full bg-slate-900 flex items-center justify-center shrink-0 border-t border-slate-800">
                  <div className="w-24 h-1 bg-slate-600 rounded-full" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500 space-y-2">
              <Sparkles className="w-8 h-8 text-gray-600 mx-auto" />
              <p className="text-sm font-semibold">No project files found to preview</p>
              <p className="text-xs">Synthesize or create files in the IDE to view your live project.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
